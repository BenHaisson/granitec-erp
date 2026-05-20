import {
  collection, addDoc, getDocs, doc, runTransaction, Timestamp, setDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ProductionOrder, Recipe } from '@/types';

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
      if (current < need) throw new Error(`Insufficient stock for product ${comp.productId}`);
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
