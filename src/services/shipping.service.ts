import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ShippingOrder } from '@/types';
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
