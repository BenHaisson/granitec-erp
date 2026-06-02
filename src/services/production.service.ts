import {
  collection, addDoc, getDocs, doc, runTransaction, Timestamp, setDoc, deleteDoc, updateDoc, writeBatch,
  query, where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ProductionOrder, ProductionTarget, Recipe, RecipeItem } from '@/types';

export const getRecipes = async (): Promise<Recipe[]> => {
  const snap = await getDocs(collection(db, 'recipes'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
};

export const getProductionOrders = async (): Promise<ProductionOrder[]> => {
  const snap = await getDocs(collection(db, 'production_orders'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionOrder));
};

type FeasibilityResult = { feasible: boolean; shortfalls: { productId: string; need: number; have: number }[] };

/** Synchronous check — use this when the caller already has products + recipe loaded (avoids 2 extra Firestore reads) */
export const checkFeasibilitySync = (
  recipe: Recipe,
  quantity: number,
  products: import('@/types').Product[],
): FeasibilityResult => {
  const stockMap = new Map(products.map(p => [p.id, p.stock_level + (p.unverified_stock ?? 0)]));
  const shortfalls: FeasibilityResult['shortfalls'] = [];
  for (const comp of recipe.components) {
    const need = comp.quantity * quantity;
    const have = stockMap.get(comp.productId) ?? 0;
    if (have < need) shortfalls.push({ productId: comp.productId, need, have });
  }
  return { feasible: shortfalls.length === 0, shortfalls };
};

/** Async fallback — fetches products + recipe from Firestore. Prefer checkFeasibilitySync when data is already in state. */
export const checkFeasibility = async (recipeId: string, quantity: number): Promise<FeasibilityResult> => {
  const [recipesSnap, productsSnap] = await Promise.all([
    getDocs(collection(db, 'recipes')),
    getDocs(collection(db, 'products')),
  ]);
  const recipeDoc = recipesSnap.docs.find(d => d.id === recipeId);
  if (!recipeDoc) throw new Error('Recipe not found');
  const recipe = { id: recipeDoc.id, ...recipeDoc.data() } as Recipe;
  const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as import('@/types').Product));
  return checkFeasibilitySync(recipe, quantity, products);
};

export const deleteRecipe = (id: string) => deleteDoc(doc(db, 'recipes', id));

export const createRecipe = async (recipe: Omit<Recipe, 'id'>): Promise<string> => {
  const ref = await addDoc(collection(db, 'recipes'), recipe);
  return ref.id;
};

export const updateRecipe = async (recipe: Recipe): Promise<void> => {
  const { id, ...data } = recipe;
  await setDoc(doc(db, 'recipes', id), data);
};

export const createProductionOrder = (recipeId: string, quantity: number) =>
  addDoc(collection(db, 'production_orders'), {
    recipeId,
    quantity,
    status: 'PLANNED',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

export const startProductionOrder = (orderId: string) =>
  updateDoc(doc(db, 'production_orders', orderId), { status: 'IN_PROGRESS', updatedAt: Timestamp.now() });

export const upsertRecipe = async (recipe: { finishedProductId: string; components: RecipeItem[] }): Promise<void> => {
  await setDoc(doc(db, 'recipes', recipe.finishedProductId), {
    finishedProductId: recipe.finishedProductId,
    components: recipe.components,
  });
};

export const deleteAllProductionOrders = async (): Promise<void> => {
  const snap = await getDocs(collection(db, 'production_orders'));
  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
};

export const deleteAllRecipes = async (): Promise<void> => {
  const snap = await getDocs(collection(db, 'recipes'));
  const BATCH_SIZE = 400;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
};

const CREPE_SKUS = new Set([
  'JSM-1109C', 'JSM-1109N', 'JSM-0905C', 'JSM-0905N',
  'JSM-1405C', 'JSM-1405N', 'JSM-1954B', 'JSM-1954R',
]);

export const backfillCrepeProductionHistory = async (): Promise<number> => {
  const [ordersSnap, recipesSnap, productsSnap] = await Promise.all([
    getDocs(collection(db, 'sales_orders')),
    getDocs(collection(db, 'recipes')),
    getDocs(collection(db, 'products')),
  ]);

  // Build lookup maps
  const skuToProductId = new Map<string, string>();
  productsSnap.docs.forEach(d => skuToProductId.set(d.data().sku as string, d.id));

  // recipes keyed by finishedProductId
  const recipeByFinished = new Map<string, { id: string; components: RecipeItem[] }>();
  recipesSnap.docs.forEach(d => {
    recipeByFinished.set(d.id, { id: d.id, components: d.data().components as RecipeItem[] });
  });

  let created = 0;
  const CHUNK = 400;
  const prodOrderDocs: object[] = [];
  const movementDocs: object[] = [];

  for (const orderDoc of ordersSnap.docs) {
    const data = orderDoc.data();
    const saleDate: Date = (data.date as Timestamp).toDate();
    const prodDate = new Date(saleDate);
    prodDate.setDate(prodDate.getDate() - 3);
    const lines = data.lines as Array<{ sku: string; totalQty: number; productId: string }>;

    for (const line of lines) {
      if (!CREPE_SKUS.has(line.sku)) continue;
      const finishedProductId = skuToProductId.get(line.sku) ?? line.productId;
      const recipe = recipeByFinished.get(finishedProductId);
      if (!recipe || line.totalQty <= 0) continue;

      const ordId = `backfill_${orderDoc.id}_${line.sku}`;
      prodOrderDocs.push({
        _id: ordId,
        recipeId: finishedProductId,
        quantity: line.totalQty,
        status: 'COMPLETED',
        createdAt: Timestamp.fromDate(prodDate),
        updatedAt: Timestamp.fromDate(saleDate),
      });

      // Production movements: +finished goods on prodDate, -raw components on prodDate
      movementDocs.push({
        productId: finishedProductId,
        quantity: line.totalQty,
        reason: 'PRODUCTION',
        note: `Backfill: ${data.ref ?? orderDoc.id}`,
        createdAt: Timestamp.fromDate(prodDate),
      });
      for (const comp of recipe.components) {
        movementDocs.push({
          productId: comp.productId,
          quantity: -(comp.quantity * line.totalQty),
          reason: 'PRODUCTION',
          note: `Backfill: ${data.ref ?? orderDoc.id}`,
          createdAt: Timestamp.fromDate(prodDate),
        });
      }
      created++;
    }
  }

  // Write production orders using deterministic IDs (idempotent)
  for (let i = 0; i < prodOrderDocs.length; i += CHUNK) {
    const batch = writeBatch(db);
    (prodOrderDocs.slice(i, i + CHUNK) as Array<Record<string, unknown>>).forEach(o => {
      const { _id, ...rest } = o;
      batch.set(doc(db, 'production_orders', _id as string), rest);
    });
    await batch.commit();
  }

  // Write movements
  for (let i = 0; i < movementDocs.length; i += CHUNK) {
    const batch = writeBatch(db);
    (movementDocs.slice(i, i + CHUNK) as object[]).forEach(m => {
      batch.set(doc(collection(db, 'inventory_movements')), m);
    });
    await batch.commit();
  }

  return created;
};

export const startProductionTarget = async (
  target: ProductionTarget,
  recipe: Recipe,
): Promise<void> => {
  if (target.materialsDeducted) throw new Error('Already started');
  await runTransaction(db, async (tx) => {
    // Phase 1: all reads first (Firestore requires reads before any writes)
    const prodRefs = recipe.components.map(comp => doc(db, 'products', comp.productId));
    const snaps = await Promise.all(prodRefs.map(ref => tx.get(ref)));

    // Track auto-added unverified amounts so cancelProductionTarget can reverse perfectly
    const autoAddedUnverified: Record<string, number> = {};

    // Phase 2: all writes
    for (let i = 0; i < recipe.components.length; i++) {
      const comp = recipe.components[i];
      const snap = snaps[i];
      const need = comp.quantity * target.targetQty;
      const data = snap.data() ?? {};
      const realStock = (data.stock_level as number) ?? 0;
      const existingUnverified = (data.unverified_stock as number) ?? 0;
      const realDeduct = Math.min(realStock, need);

      // If combined stock (verified + unverified) is less than needed,
      // auto-add the shortfall as unverified stock.
      // This represents: "we physically have the materials, document pending."
      const shortfall = Math.max(0, need - (realStock + existingUnverified));
      const totalUnverified = existingUnverified + shortfall;
      const unverifiedDeduct = Math.min(totalUnverified, need - realDeduct);

      tx.update(prodRefs[i], {
        stock_level: realStock - realDeduct,
        unverified_stock: totalUnverified - unverifiedDeduct,
      });

      // If we auto-added unverified stock, record it as an ADJUSTMENT so the
      // audit trail shows the incoming materials (document to be provided later)
      if (shortfall > 0) {
        autoAddedUnverified[comp.productId] = shortfall;
        tx.set(doc(collection(db, 'inventory_movements')), {
          productId: comp.productId,
          quantity: shortfall,
          reason: 'ADJUSTMENT',
          note: `Unverified: auto-added for Production ${target.id} — document pending`,
          createdAt: Timestamp.now(),
        });
      }

      // Record the production deduction (always shows real quantity, never -0)
      tx.set(doc(collection(db, 'inventory_movements')), {
        productId: comp.productId,
        quantity: -(realDeduct + unverifiedDeduct),
        reason: 'PRODUCTION',
        note: unverifiedDeduct > 0
          ? `Production ${target.id} (incl. unverified stock)`
          : `Production ${target.id}`,
        createdAt: Timestamp.now(),
      });
    }

    tx.update(doc(db, 'production_targets', target.id), {
      status: 'in_progress',
      materialsDeducted: true,
      // Stored so cancelProductionTarget can cleanly reverse auto-added stock
      ...(Object.keys(autoAddedUnverified).length > 0 && { autoAddedUnverified }),
    });
  });
};

export const completeProductionTarget = async (
  target: ProductionTarget,
  recipe: Recipe,
): Promise<void> => {
  if (target.finishedGoodsAdded) throw new Error('Already completed');
  const qty = target.completedQty;
  if (qty <= 0) throw new Error('No completed quantity to record');
  await runTransaction(db, async (tx) => {
    const finRef = doc(db, 'products', recipe.finishedProductId);
    const finSnap = await tx.get(finRef);
    if (!finSnap.exists()) throw new Error(`Finished product "${recipe.finishedProductId}" not found. Add it to the products catalogue first.`);
    const current = (finSnap.data()?.stock_level as number) ?? 0;
    tx.update(finRef, { stock_level: current + qty });
    tx.set(doc(collection(db, 'inventory_movements')), {
      productId: recipe.finishedProductId,
      quantity: qty,
      reason: 'PRODUCTION',
      note: `Finished: ${target.recipeName ?? recipe.finishedProductId}`,
      createdAt: Timestamp.now(),
    });
    tx.update(doc(db, 'production_targets', target.id), {
      status: 'complete',
      finishedGoodsAdded: true,
    });
  });
};

// Helper function to reliably find PRODUCTION and ADJUSTMENT movements for a target
interface ProductionMovementSet {
  productionMovements: Map<string, DocumentReference>;
  adjustmentMovements: Map<string, DocumentReference>;
  missingComponents: string[];
}

const findProductionMovementsForTarget = async (
  targetId: string,
  componentProductIds: string[]
): Promise<ProductionMovementSet> => {
  // Query PRODUCTION movements for these products that relate to this target
  const prodMovSnap = await getDocs(
    query(
      collection(db, 'inventory_movements'),
      where('productId', 'in', componentProductIds),
      where('reason', '==', 'PRODUCTION')
    )
  );

  const productionMovements = new Map<string, DocumentReference>();
  prodMovSnap.docs.forEach(d => {
    const note = (d.data().note as string) ?? '';
    if (note.includes(targetId)) {
      const productId = d.data().productId as string;
      if (!productionMovements.has(productId)) {
        productionMovements.set(productId, d.ref);
      }
    }
  });

  // Query ADJUSTMENT movements (auto-added unverified stock)
  const adjMovSnap = await getDocs(
    query(
      collection(db, 'inventory_movements'),
      where('productId', 'in', componentProductIds),
      where('reason', '==', 'ADJUSTMENT')
    )
  );

  const adjustmentMovements = new Map<string, DocumentReference>();
  adjMovSnap.docs.forEach(d => {
    const note = (d.data().note as string) ?? '';
    if (note.includes(`auto-added for Production ${targetId}`)) {
      const productId = d.data().productId as string;
      if (!adjustmentMovements.has(productId)) {
        adjustmentMovements.set(productId, d.ref);
      }
    }
  });

  const missingComponents = componentProductIds.filter(
    pid => !productionMovements.has(pid)
  );

  return { productionMovements, adjustmentMovements, missingComponents };
};

export const cancelProductionTarget = async (
  target: ProductionTarget,
  recipe: Recipe,
): Promise<void> => {
  // Phase A: Gather data before transaction
  const componentProductIds = recipe.components.map(c => c.productId);
  const movementSet = await findProductionMovementsForTarget(target.id, componentProductIds);

  // Log warnings for missing movements (indicates incomplete state or data corruption)
  if (movementSet.missingComponents.length > 0) {
    console.warn(
      `[cancelProductionTarget] ${target.id}: Missing PRODUCTION movements for products: ` +
      `${movementSet.missingComponents.join(', ')}. Will attempt restoration from stored data.`
    );
  }

  // Read stored autoAddedUnverified from target (populated by startProductionTarget)
  const storedAutoAdded = (target.autoAddedUnverified ?? {}) as Record<string, number>;

  // Collect refs to read in transaction
  const prodMovRefs = Array.from(movementSet.productionMovements.values());
  const adjMovRefs = Array.from(movementSet.adjustmentMovements.values());

  // Phase B: Atomic transaction
  await runTransaction(db, async (tx) => {
    // Re-read movement docs inside transaction for fresh data (prevents TOCTOU)
    const prodMovSnapsInTx = await Promise.all(
      prodMovRefs.map(r => tx.get(r))
    );
    const adjMovSnapsInTx = await Promise.all(
      adjMovRefs.map(r => tx.get(r))
    );

    // Read all component product docs to get current stock levels
    const prodRefs = recipe.components.map(comp => doc(db, 'products', comp.productId));
    const snaps = await Promise.all(prodRefs.map(ref => tx.get(ref)));

    // Read finished product if goods were already added
    const finRef = target.finishedGoodsAdded
      ? doc(db, 'products', recipe.finishedProductId)
      : null;
    const finSnap = finRef ? await tx.get(finRef) : null;

    // Restore component stock and delete movements
    for (let i = 0; i < recipe.components.length; i++) {
      const comp = recipe.components[i];
      const snap = snaps[i];
      if (!snap.exists()) continue;

      const prodMovSnap = prodMovSnapsInTx.find(
        s => s.exists() && s.data()?.productId === comp.productId
      );
      const adjMovSnap = adjMovSnapsInTx.find(
        s => s.exists() && s.data()?.productId === comp.productId
      );

      // Get actual deducted quantity from movement (most reliable source)
      // Fall back to calculated amount if movement missing
      const deductedQty = prodMovSnap?.exists()
        ? Math.abs(prodMovSnap.data()!.quantity as number)
        : comp.quantity * target.targetQty;

      // Get auto-added amount from stored data or from the adjustment movement
      const autoAddedQty = adjMovSnap?.exists()
        ? Math.abs(adjMovSnap.data()!.quantity as number)
        : (storedAutoAdded[comp.productId] ?? 0);

      // Calculate what actually came from real stock
      // Real qty = total deducted - auto-added (the auto-added wasn't real to begin with)
      const realQty = Math.max(0, deductedQty - autoAddedQty);

      // Check if the production movement included unverified stock
      const wasUnverified = prodMovSnap?.exists()
        ? (prodMovSnap.data()!.note as string | undefined)?.includes('unverified') ?? false
        : false;

      // Restore to appropriate bucket
      if (realQty > 0) {
        if (wasUnverified) {
          // Material came from unverified stock, restore there
          const current = (snap.data()?.unverified_stock as number) ?? 0;
          tx.update(prodRefs[i], { unverified_stock: current + realQty });
        } else {
          // Material came from real stock, restore there
          const current = (snap.data()?.stock_level as number) ?? 0;
          tx.update(prodRefs[i], { stock_level: current + realQty });
        }
      }

      // Delete PRODUCTION movement
      if (prodMovSnap?.exists()) {
        tx.delete(prodMovSnap.ref);
      }

      // Delete ADJUSTMENT movement (auto-added unverified stock)
      if (adjMovSnap?.exists()) {
        tx.delete(adjMovSnap.ref);
      }
    }

    // Reverse finished goods addition if already completed
    if (target.finishedGoodsAdded && finSnap && finRef) {
      const current = (finSnap.data()?.stock_level as number) ?? 0;
      tx.update(finRef, { stock_level: current - target.completedQty });

      // Record the reversal
      tx.set(doc(collection(db, 'inventory_movements')), {
        productId: recipe.finishedProductId,
        quantity: -target.completedQty,
        reason: 'ADJUSTMENT',
        note: `Cancelled production: ${target.recipeName ?? recipe.finishedProductId}`,
        createdAt: Timestamp.now(),
      });
    }

    // Mark target as cancelled and clear all transient state
    tx.update(doc(db, 'production_targets', target.id), {
      status: 'cancelled',
      completedQty: 0,
      materialsDeducted: false,
      finishedGoodsAdded: false,
      autoAddedUnverified: {}, // Explicitly clear to prevent orphaned data
    });
  });

  // Phase C: Post-transaction cleanup (production entries)
  const entriesSnap = await getDocs(
    query(collection(db, 'production_entries'), where('targetId', '==', target.id))
  );
  if (entriesSnap.docs.length > 0) {
    const batch = writeBatch(db);
    entriesSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
};

export const validateAndCompleteProduction = async (orderId: string) => {
  await runTransaction(db, async (tx) => {
    const orderRef = doc(db, 'production_orders', orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error('Order not found');
    const order = orderSnap.data() as ProductionOrder;

    const recipeRef = doc(db, 'recipes', order.recipeId);
    const recipeSnap = await tx.get(recipeRef);
    if (!recipeSnap.exists()) throw new Error('Recipe not found');
    const recipe = { id: recipeSnap.id, ...recipeSnap.data() } as Recipe;

    for (const comp of recipe.components) {
      const prodRef = doc(db, 'products', comp.productId);
      const prodSnap = await tx.get(prodRef);
      const current = (prodSnap.data()?.stock_level as number) ?? 0;
      const need = comp.quantity * order.quantity;
      tx.update(prodRef, { stock_level: current - need });
      const movRef = doc(collection(db, 'inventory_movements'));
      tx.set(movRef, {
        productId: comp.productId,
        quantity: -need,
        reason: 'PRODUCTION',
        note: `Production order ${orderId}`,
        createdAt: Timestamp.now(),
      });
    }

    const finishedRef = doc(db, 'products', recipe.finishedProductId);
    const finishedSnap = await tx.get(finishedRef);
    const finCurrent = (finishedSnap.data()?.stock_level as number) ?? 0;
    tx.update(finishedRef, { stock_level: finCurrent + order.quantity });
    const finMovRef = doc(collection(db, 'inventory_movements'));
    tx.set(finMovRef, {
      productId: recipe.finishedProductId,
      quantity: order.quantity,
      reason: 'PRODUCTION',
      note: `Production order ${orderId}`,
      createdAt: Timestamp.now(),
    });

    tx.update(orderRef, { status: 'COMPLETED', updatedAt: Timestamp.now() });
  });
};
