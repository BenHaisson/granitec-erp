import {
  collection, addDoc, getDocs, Timestamp, orderBy, query,
  writeBatch, doc, setDoc,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { SalesOrder, SalesOrderLine } from '@/types';
import { adjustStock } from './inventory.service';

const toOrder = (id: string, data: Record<string, unknown>): SalesOrder => ({
  id,
  ref: data.ref as string,
  client: data.client as string,
  date: (data.date as Timestamp).toDate(),
  lines: data.lines as SalesOrderLine[],
});

export const getOrders = async (): Promise<SalesOrder[]> => {
  const snap = await getDocs(query(collection(db, 'sales_orders'), orderBy('date', 'desc')));
  return snap.docs.map(d => toOrder(d.id, d.data() as Record<string, unknown>));
};

export const generateOrderRef = async (): Promise<string> => {
  const snap = await getDocs(collection(db, 'sales_orders'));
  const year = new Date().getFullYear();
  const seq = String(snap.size + 1).padStart(4, '0');
  return `ORD-${year}-${seq}`;
};

export const createOrder = async (
  order: Omit<SalesOrder, 'id'>
): Promise<string> => {
  const document = await addDoc(collection(db, 'sales_orders'), {
    ...order,
    date: Timestamp.fromDate(order.date instanceof Date ? order.date : new Date(order.date)),
  });
  // Deduct finished goods stock for each line
  for (const line of order.lines) {
    if (line.totalQty > 0) {
      try {
        await adjustStock(line.productId, -line.totalQty, 'SALE', order.ref ?? document.id);
      } catch { /* product may not exist in Firestore yet — skip silently */ }
    }
  }
  return document.id;
};

export const seedHistoricalOrders = async (
  orders: Omit<SalesOrder, 'id'>[]
): Promise<void> => {
  const CHUNK = 400;
  for (let i = 0; i < orders.length; i += CHUNK) {
    const batch = writeBatch(db);
    orders.slice(i, i + CHUNK).forEach(order => {
      const ref = doc(collection(db, 'sales_orders'));
      batch.set(ref, {
        ...order,
        date: Timestamp.fromDate(order.date instanceof Date ? order.date : new Date(order.date)),
      });
    });
    await batch.commit();
  }
};

export const updateOrder = async (order: SalesOrder): Promise<void> => {
  await setDoc(doc(db, 'sales_orders', order.id), {
    ref: order.ref,
    client: order.client,
    lines: order.lines,
    date: Timestamp.fromDate(order.date instanceof Date ? order.date : new Date(order.date)),
  });
};

export const deleteAllOrders = async (): Promise<void> => {
  const snap = await getDocs(collection(db, 'sales_orders'));
  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(doc(db, 'sales_orders', d.id)));
    await batch.commit();
  }
};

export const backfillSalesMovements = async (): Promise<number> => {
  const [ordersSnap, movsSnap] = await Promise.all([
    getDocs(collection(db, 'sales_orders')),
    getDocs(collection(db, 'inventory_movements')),
  ]);

  // Build set of productId|note keys for existing SALE movements (idempotency check)
  const existingKeys = new Set(
    movsSnap.docs
      .filter(d => d.data().reason === 'SALE')
      .map(d => `${d.data().productId as string}|${d.data().note as string}`)
  );

  const movDocs: object[] = [];
  for (const orderDoc of ordersSnap.docs) {
    const data = orderDoc.data();
    const ref = (data.ref as string) ?? orderDoc.id;
    const date = (data.date as Timestamp).toDate();
    const lines = data.lines as Array<{ productId: string; totalQty: number }>;
    for (const line of lines) {
      if (!line.totalQty || line.totalQty <= 0) continue;
      if (existingKeys.has(`${line.productId}|${ref}`)) continue;
      movDocs.push({
        productId: line.productId,
        quantity: -line.totalQty,
        reason: 'SALE',
        note: ref,
        createdAt: Timestamp.fromDate(date),
      });
    }
  }

  const CHUNK = 400;
  for (let i = 0; i < movDocs.length; i += CHUNK) {
    const batch = writeBatch(db);
    movDocs.slice(i, i + CHUNK).forEach(m => {
      batch.set(doc(collection(db, 'inventory_movements')), m);
    });
    await batch.commit();
  }
  return movDocs.length;
};
