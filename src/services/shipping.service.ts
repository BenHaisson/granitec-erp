import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ShippingOrder, ShippingOrderLine } from '@/types';
import { receiveSupplyBatch, adjustStock } from './inventory.service';

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
  const oldQtyMap = new Map(order.lines.map(l => [l.productId, l.qty]));
  const newQtyMap = new Map(patch.lines.map(l => [l.productId, l.qty]));

  // Products removed from order — reverse their stock
  for (const [productId, oldQty] of oldQtyMap) {
    if (!newQtyMap.has(productId)) {
      try { await adjustStock(productId, -oldQty, 'ADJUSTMENT', `Order edited: ${patch.ref}`); } catch { /* skip */ }
    }
  }
  // Products added or changed — apply the diff
  for (const line of patch.lines) {
    const diff = line.qty - (oldQtyMap.get(line.productId) ?? 0);
    if (diff !== 0) {
      try { await adjustStock(line.productId, diff, 'ADJUSTMENT', `Order edited: ${patch.ref}`); } catch { /* skip */ }
    }
  }

  const data: Record<string, unknown> = { ref: patch.ref, date: patch.date, lines: patch.lines };
  if (patch.supplier) data.supplier = patch.supplier;
  await updateDoc(doc(db, 'shipping_orders', order.id), data);
};

export const deleteReceivedShippingOrder = async (order: ShippingOrder): Promise<void> => {
  for (const line of order.lines) {
    try {
      await adjustStock(line.productId, -line.qty, 'ADJUSTMENT', `Order deleted: ${order.ref}`);
    } catch { /* product deleted — skip */ }
  }
  await deleteDoc(doc(db, 'shipping_orders', order.id));
};

export const updateShippingOrder = async (
  id: string,
  patch: { ref: string; supplier?: string; date: string; lines: ShippingOrderLine[] }
): Promise<void> => {
  const data: Record<string, unknown> = { ref: patch.ref, date: patch.date, lines: patch.lines };
  if (patch.supplier) data.supplier = patch.supplier;
  await updateDoc(doc(db, 'shipping_orders', id), data);
};
