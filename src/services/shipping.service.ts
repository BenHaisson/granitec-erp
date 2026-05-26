import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp,
  query, where, runTransaction,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ShippingOrder, ShippingOrderLine } from '@/types';
import { receiveSupplyBatch } from './inventory.service';

export const getShippingOrders = async (): Promise<ShippingOrder[]> => {
  const snap = await getDocs(collection(db, 'shipping_orders'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as ShippingOrder))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const createShippingOrder = async (
  order: Omit<ShippingOrder, 'id' | 'createdAt' | 'status'>
): Promise<void> => {
  const data: Record<string, unknown> = {
    ref: order.ref,
    date: order.date,
    lines: order.lines,
    status: 'PLANNED',
    createdAt: Timestamp.now(),
  };
  if (order.supplier) data.supplier = order.supplier;
  await addDoc(collection(db, 'shipping_orders'), data);
};

export const receiveShippingOrder = async (order: ShippingOrder): Promise<void> => {
  await receiveSupplyBatch(
    order.lines.map(l => ({ productId: l.productId, qty: l.qty })),
    order.ref,
    new Date(order.date)
  );
  await updateDoc(doc(db, 'shipping_orders', order.id), {
    status: 'RECEIVED',
    receivedAt: Timestamp.now(),
  });
};

export const deleteShippingOrder = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'shipping_orders', id));
};

export const updateShippingOrderRef = async (id: string, ref: string): Promise<void> => {
  await updateDoc(doc(db, 'shipping_orders', id), { ref });
};

export const updateReceivedShippingOrder = async (
  order: ShippingOrder,
  patch: { ref: string; supplier?: string; date: string; lines: ShippingOrderLine[] }
): Promise<void> => {
  // Step 1: delete old PURCHASE movements and reverse their stock
  const movSnap = await getDocs(
    query(collection(db, 'inventory_movements'), where('note', '==', order.ref))
  );
  const purchaseMoves = movSnap.docs.filter(d => d.data().reason === 'PURCHASE');
  for (const movDoc of purchaseMoves) {
    const qty = movDoc.data().quantity as number;
    const productId = movDoc.data().productId as string;
    try {
      await runTransaction(db, async (tx) => {
        const prodRef = doc(db, 'products', productId);
        const snap = await tx.get(prodRef);
        if (snap.exists()) {
          tx.update(prodRef, { stock_level: (snap.data().stock_level as number) - qty });
        }
        tx.delete(movDoc.ref);
      });
    } catch { /* product deleted — skip */ }
  }
  // Step 2: apply new quantities (re-receive with corrected amounts)
  await receiveSupplyBatch(
    patch.lines.map(l => ({ productId: l.productId, qty: l.qty })),
    patch.ref,
    new Date(patch.date)
  );
  // Step 3: update the order document
  const data: Record<string, unknown> = { ref: patch.ref, date: patch.date, lines: patch.lines };
  if (patch.supplier) data.supplier = patch.supplier;
  await updateDoc(doc(db, 'shipping_orders', order.id), data);
};

export const deleteReceivedShippingOrder = async (order: ShippingOrder): Promise<void> => {
  const movSnap = await getDocs(
    query(collection(db, 'inventory_movements'), where('note', '==', order.ref))
  );
  const purchaseMoves = movSnap.docs.filter(d => d.data().reason === 'PURCHASE');
  for (const movDoc of purchaseMoves) {
    const qty = movDoc.data().quantity as number; // positive (e.g. +1000)
    const productId = movDoc.data().productId as string;
    try {
      await runTransaction(db, async (tx) => {
        const prodRef = doc(db, 'products', productId);
        const snap = await tx.get(prodRef);
        if (snap.exists()) {
          tx.update(prodRef, { stock_level: (snap.data().stock_level as number) - qty });
        }
        tx.delete(movDoc.ref);
      });
    } catch { /* product deleted — skip */ }
  }
  await deleteDoc(doc(db, 'shipping_orders', order.id));
};

export const findAndDeleteDuplicateReceipts = async (): Promise<number> => {
  const orders = await getShippingOrders();
  const received = orders.filter(o => o.status === 'RECEIVED');

  const groups = new Map<string, ShippingOrder[]>();
  for (const o of received) {
    const key = o.date + '|' + o.lines.map(l => l.sku).sort().join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }

  let deleted = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const toDelete = group.filter(o => /^SH-\d{4}-/.test(o.ref));
    for (const o of toDelete) {
      await deleteReceivedShippingOrder(o);
      deleted++;
    }
  }
  return deleted;
};

export const updateShippingOrder = async (
  id: string,
  patch: { ref: string; supplier?: string; date: string; lines: ShippingOrderLine[] }
): Promise<void> => {
  const data: Record<string, unknown> = { ref: patch.ref, date: patch.date, lines: patch.lines };
  if (patch.supplier) data.supplier = patch.supplier;
  await updateDoc(doc(db, 'shipping_orders', id), data);
};
