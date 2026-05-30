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

export const checkFeasibility = async (recipeId: string, quantity: number) => {
  const [recipesSnap, productsSnap] = await Promise.all([
    getDocs(collection(db, 'recipes')),
    getDocs(collection(db, 'products')),
  ]);
  const recipeDoc = recipesSnap.docs.find(d => d.id === recipeId);
  if (!recipeDoc) throw new Error('Recipe not found');
  const recipe = { id: recipeDoc.id, ...recipeDoc.data() } as Recipe;
  const stockMap = new Map(productsSnap.docs.map(d => {
    const data = d.data();
    return [d.id, (data.stock_level as number) + ((data.unverified_stock as number) ?? 0)];
  }));
  const shortfalls: { productId: string; need: number; have: number }[] = [];
  for (const comp of recipe.components) {
    const need = comp.quantity * quantity;
    const have = stockMap.get(comp.productId) ?? 0;
    if (have < need) shortfalls.push({ productId: comp.productId, need, have });
  }
  return { feasible: shortfalls.length === 0, shortfalls };
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

    // Phase 2: all writes
    for (let i = 0; i < recipe.components.length; i++) {
      const comp = recipe.components[i];
      const snap = snaps[i];
      const need = comp.quantity * target.targetQty;
      const data = snap.data() ?? {};
      const realStock = (data.stock_level as number) ?? 0;
      const unverifiedStock = (data.unverified_stock as number) ?? 0;
      const realDeduct = Math.min(realStock, need);
      const unverifiedDeduct = Math.min(unverifiedStock, need - realDeduct);
      tx.update(prodRefs[i], {
        stock_level: realStock - realDeduct,
        unverified_stock: unverifiedStock - unverifiedDeduct,
      });
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

export const cancelProductionTarget = async (
  target: ProductionTarget,
  recipe: Recipe,
): Promise<void> => {
  // Find material deduction movements created by startProductionTarget
  const materialMovSnap = await getDocs(
    query(
      collection(db, 'inventory_movements'),
      where('note', 'in', [
        `Production ${target.id}`,
        `Production ${target.id} (incl. unverified stock)`,
      ])
    )
  );

  await runTransaction(db, async (tx) => {
    // Read all component product docs
    const prodRefs = recipe.components.map(comp => doc(db, 'products', comp.productId));
    const snaps = await Promise.all(prodRefs.map(ref => tx.get(ref)));

    // Read finished product if goods were already added to warehouse
    const finRef = target.finishedGoodsAdded
      ? doc(db, 'products', recipe.finishedProductId)
      : null;
    const finSnap = finRef ? await tx.get(finRef) : null;

    // Restore component stock and delete original movements
    for (let i = 0; i < recipe.components.length; i++) {
      const comp = recipe.components[i];
      const snap = snaps[i];
      const data = snap.data() ?? {};
      const mvDoc = materialMovSnap.docs.find(d => d.data().productId === comp.productId);
      const deductedQty = mvDoc ? Math.abs(mvDoc.data().quantity as number) : comp.quantity * target.targetQty;
      const wasUnverified = mvDoc?.data().note?.includes('unverified') ?? false;

      if (wasUnverified) {
        // Return to unverified_stock and just delete the movement (no audit trail for unverified)
        const current = (data.unverified_stock as number) ?? 0;
        tx.update(prodRefs[i], { unverified_stock: current + deductedQty });
      } else {
        // Return to verified stock
        const current = (data.stock_level as number) ?? 0;
        tx.update(prodRefs[i], { stock_level: current + deductedQty });
      }

      if (mvDoc) tx.delete(mvDoc.ref);
    }

    // Reverse finished goods addition if already completed
    if (target.finishedGoodsAdded && finSnap && finRef) {
      const current = (finSnap.data()?.stock_level as number) ?? 0;
      tx.update(finRef, { stock_level: current - target.completedQty });
      tx.set(doc(collection(db, 'inventory_movements')), {
        productId: recipe.finishedProductId,
        quantity: -target.completedQty,
        reason: 'ADJUSTMENT',
        note: `Cancelled production: ${target.recipeName ?? recipe.finishedProductId}`,
        createdAt: Timestamp.now(),
      });
    }

    // Mark target as cancelled
    tx.update(doc(db, 'production_targets', target.id), {
      status: 'cancelled',
      completedQty: 0,
      materialsDeducted: false,
      finishedGoodsAdded: false,
    });
  });

  // Delete all production entries for this target
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
