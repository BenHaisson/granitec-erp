import {
  collection, getDocs, Timestamp, orderBy, query, where, limit,
  writeBatch, doc, setDoc, deleteDoc, runTransaction,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { SalesOrder, SalesOrderLine } from '@/types';

const toOrder = (id: string, data: Record<string, unknown>): SalesOrder => ({
  id,
  ref: data.ref as string,
  client: data.client as string,
  date: (data.date as Timestamp).toDate(),
  lines: data.lines as SalesOrderLine[],
});

export const getOrders = async (): Promise<SalesOrder[]> => {
  const snap = await getDocs(query(collection(db, 'sales_orders'), orderBy('date', 'desc'), limit(500)));
  return snap.docs.map(d => toOrder(d.id, d.data() as Record<string, unknown>));
};

export const generateOrderRef = async (): Promise<string> => {
  const snap = await getDocs(collection(db, 'sales_orders'));
  const year = new Date().getFullYear();
  const seq = String(snap.size + 1).padStart(4, '0');
  return `ORD-${year}-${seq}`;
};

export const createOrder = async (order: Omit<SalesOrder, 'id'>): Promise<string> => {
  const orderRef = doc(collection(db, 'sales_orders'));
  const validLines = order.lines.filter(l => l.totalQty > 0);
  await runTransaction(db, async (tx) => {
    const prodSnaps = await Promise.all(validLines.map(l => tx.get(doc(db, 'products', l.productId))));
    tx.set(orderRef, {
      ...order,
      date: Timestamp.fromDate(order.date instanceof Date ? order.date : new Date(order.date)),
    });
    for (let i = 0; i < validLines.length; i++) {
      const line = validLines[i];
      const snap = prodSnaps[i];
      if (!snap.exists()) { console.error(`[createOrder] Product ${line.productId} not found`); continue; }
      tx.update(snap.ref, { stock_level: (snap.data().stock_level as number) - line.totalQty });
      tx.set(doc(collection(db, 'inventory_movements')), {
        productId: line.productId, quantity: -line.totalQty, reason: 'SALE',
        note: order.ref ?? orderRef.id, createdAt: Timestamp.now(),
      });
    }
  });
  return orderRef.id;
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

async function reverseSaleMovements(orderRef: string): Promise<void> {
  const movSnap = await getDocs(
    query(collection(db, 'inventory_movements'), where('note', '==', orderRef))
  );
  const saleMoves = movSnap.docs.filter(d => d.data().reason === 'SALE');
  if (saleMoves.length === 0) return;
  await runTransaction(db, async (tx) => {
    const prodSnaps = await Promise.all(
      saleMoves.map(m => tx.get(doc(db, 'products', m.data().productId as string)))
    );
    for (let i = 0; i < saleMoves.length; i++) {
      const movDoc = saleMoves[i];
      const qty = movDoc.data().quantity as number; // stored as negative (e.g. -500)
      const snap = prodSnaps[i];
      if (snap.exists()) {
        tx.update(snap.ref, { stock_level: (snap.data().stock_level as number) - qty }); // -(-500) = +500
      } else {
        console.error(`[reverseSaleMovements] Product ${movDoc.data().productId as string} not found`);
      }
      tx.delete(movDoc.ref);
    }
  });
}

export const updateOrder = async (order: SalesOrder): Promise<void> => {
  await reverseSaleMovements(order.ref);
  const validLines = order.lines.filter(l => l.totalQty > 0);
  if (validLines.length > 0) {
    await runTransaction(db, async (tx) => {
      const prodSnaps = await Promise.all(validLines.map(l => tx.get(doc(db, 'products', l.productId))));
      for (let i = 0; i < validLines.length; i++) {
        const line = validLines[i];
        const snap = prodSnaps[i];
        if (!snap.exists()) { console.error(`[updateOrder] Product ${line.productId} not found`); continue; }
        tx.update(snap.ref, { stock_level: (snap.data().stock_level as number) - line.totalQty });
        tx.set(doc(collection(db, 'inventory_movements')), {
          productId: line.productId, quantity: -line.totalQty, reason: 'SALE',
          note: order.ref, createdAt: Timestamp.now(),
        });
      }
    });
  }
  await setDoc(doc(db, 'sales_orders', order.id), {
    ref: order.ref,
    client: order.client,
    lines: order.lines,
    date: Timestamp.fromDate(order.date instanceof Date ? order.date : new Date(order.date)),
  });
};

export const deleteOrder = async (order: SalesOrder): Promise<void> => {
  await reverseSaleMovements(order.ref);
  await deleteDoc(doc(db, 'sales_orders', order.id));
};

export const deleteAllOrders = async (): Promise<void> => {
  const [ordersSnap, movSnap] = await Promise.all([
    getDocs(collection(db, 'sales_orders')),
    getDocs(query(collection(db, 'inventory_movements'), where('reason', '==', 'SALE'))),
  ]);
  const allDocs = [...ordersSnap.docs, ...movSnap.docs];
  const CHUNK = 400;
  for (let i = 0; i < allDocs.length; i += CHUNK) {
    const batch = writeBatch(db);
    allDocs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
};

export const backfillSalesMovements = async (): Promise<number> => {
  const [ordersSnap, movsSnap] = await Promise.all([
    getDocs(collection(db, 'sales_orders')),
    getDocs(collection(db, 'inventory_movements')),
  ]);

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
