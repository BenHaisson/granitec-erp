import {
  collection, addDoc, getDocs, doc, runTransaction, Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { Product, InventoryMovement } from '@/types';

export const getProducts = async (): Promise<Product[]> => {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
};

export const addProduct = (product: Omit<Product, 'id'>) =>
  addDoc(collection(db, 'products'), product);

export const adjustStock = async (
  productId: string,
  delta: number,
  reason: InventoryMovement['reason'],
  note = ''
) => {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'products', productId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Product not found');
    const current = snap.data().stock_level as number;
    tx.update(ref, { stock_level: current + delta });
    const movRef = doc(collection(db, 'inventory_movements'));
    tx.set(movRef, { productId, quantity: delta, reason, note, createdAt: Timestamp.now() });
  });
};

export const getMovements = async (): Promise<InventoryMovement[]> => {
  const snap = await getDocs(collection(db, 'inventory_movements'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryMovement));
};
