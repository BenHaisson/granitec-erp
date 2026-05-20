import {
  collection, addDoc, getDocs, doc, setDoc, deleteDoc, updateDoc, runTransaction, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { Product, InventoryMovement } from '@/types';

export const getProducts = async (): Promise<Product[]> => {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
};

export const addProduct = (product: Omit<Product, 'id'>) =>
  addDoc(collection(db, 'products'), product);

export const upsertProduct = (product: Omit<Product, 'id'>) =>
  setDoc(doc(db, 'products', product.sku), product);

export const deleteAllProducts = async () => {
  const snap = await getDocs(collection(db, 'products'));
  const BATCH_SIZE = 400;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
};

export const deleteProduct = (id: string) => deleteDoc(doc(db, 'products', id));

export const deleteAllAccessories = async () => {
  const snap = await getDocs(collection(db, 'products'));
  const toDelete = snap.docs.filter(d => d.data().category === 'Accessories');
  const BATCH_SIZE = 400;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    toDelete.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
};

export const receiveSupplyBatch = async (
  lines: { productId: string; qty: number }[],
  ref: string,
  date: Date
): Promise<void> => {
  // Update each product's stock level atomically, then write all movement records
  for (const line of lines) {
    await runTransaction(db, async (tx) => {
      const prodRef = doc(db, 'products', line.productId);
      const snap = await tx.get(prodRef);
      if (!snap.exists()) return;
      tx.update(prodRef, { stock_level: (snap.data().stock_level as number) + line.qty });
    });
  }
  const CHUNK = 400;
  for (let i = 0; i < lines.length; i += CHUNK) {
    const batch = writeBatch(db);
    lines.slice(i, i + CHUNK).forEach(line => {
      batch.set(doc(collection(db, 'inventory_movements')), {
        productId: line.productId,
        quantity: line.qty,
        reason: 'PURCHASE',
        note: ref,
        createdAt: Timestamp.fromDate(date),
      });
    });
    await batch.commit();
  }
};

export const updateProduct = (id: string, patch: Partial<import('@/types').Product>) =>
  updateDoc(doc(db, 'products', id), patch as Record<string, unknown>);

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

export const seedDiscHistory = async (
  products: Omit<Product, 'id'>[],
  entries: { productSku: string; ref: string; date: Date; qty: number }[]
): Promise<void> => {
  const CHUNK = 400;
  const prodBatch = writeBatch(db);
  products.forEach(p => prodBatch.set(doc(db, 'products', p.sku), p));
  await prodBatch.commit();
  for (let i = 0; i < entries.length; i += CHUNK) {
    const batch = writeBatch(db);
    entries.slice(i, i + CHUNK).forEach(e => {
      batch.set(doc(collection(db, 'inventory_movements')), {
        productId: e.productSku,
        quantity: e.qty,
        reason: 'PURCHASE',
        note: e.ref,
        createdAt: Timestamp.fromDate(e.date),
      });
    });
    await batch.commit();
  }
};

export const deleteDiscHistory = async (): Promise<void> => {
  const [prodSnap, movSnap] = await Promise.all([
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'inventory_movements')),
  ]);
  const rawIds = new Set(prodSnap.docs.filter(d => d.data().type === 'RAW').map(d => d.id));
  const toDelete = [
    ...prodSnap.docs.filter(d => rawIds.has(d.id)),
    ...movSnap.docs.filter(d => rawIds.has(d.data().productId as string)),
  ];
  const CHUNK = 400;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const batch = writeBatch(db);
    toDelete.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
};
