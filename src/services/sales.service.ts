import {
  collection, getDocs, doc, runTransaction, Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { Sale } from '@/types';

export const getSales = async (): Promise<Sale[]> => {
  const snap = await getDocs(collection(db, 'sales'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
};

export const addSale = async (sale: Omit<Sale, 'id'>) => {
  await runTransaction(db, async (tx) => {
    const productRef = doc(db, 'products', sale.productId);
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error('Product not found');
    const current = snap.data().stock_level as number;
    if (current < sale.quantity) throw new Error('Insufficient stock');
    tx.update(productRef, { stock_level: current - sale.quantity });
    const movRef = doc(collection(db, 'inventory_movements'));
    tx.set(movRef, {
      productId: sale.productId,
      quantity: -sale.quantity,
      reason: 'SALE',
      note: `Sale to ${sale.client}`,
      createdAt: Timestamp.now(),
    });
    const saleRef = doc(collection(db, 'sales'));
    tx.set(saleRef, { ...sale, createdAt: Timestamp.now() });
  });
};
