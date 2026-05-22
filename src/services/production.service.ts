import {
  collection, addDoc, getDocs, doc, runTransaction, Timestamp, setDoc, deleteDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ProductionOrder, Recipe, RecipeItem } from '@/types';

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
  const stockMap = new Map(productsSnap.docs.map(d => [d.id, d.data().stock_level as number]));
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
