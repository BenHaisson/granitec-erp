import {
  collection, getDocs, Timestamp, orderBy, query, where, limit,
  writeBatch, doc, setDoc, deleteDoc, runTransaction,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { SalesOrder, SalesOrderLine } from '@/types';

/** Strip UI-only draft fields and coerce numbers so nothing `undefined` reaches Firestore */
const toLine = (l: SalesOrderLine): SalesOrderLine => {
  const boxes = Number(l?.boxes) || 0;
  const qtyPerBox = Number(l?.qtyPerBox) || 0;
  const totalQty = Number(l?.totalQty);
  return {
    productId: l?.productId ?? '',
    productName: l?.productName ?? '',
    sku: l?.sku ?? '',
    boxes,
    qtyPerBox,
    totalQty: Number.isFinite(totalQty) ? totalQty : boxes * qtyPerBox,
  };
};

const toOrder = (id: string, data: Record<string, unknown>): SalesOrder => {
  const ts = data.date as Timestamp | undefined;
  return {
    id,
    ref: (data.ref as string) ?? '',
    client: (data.client as string) ?? '',
    date: ts?.toDate?.() ?? new Date(),   // null-guard: missing date falls back to now
    lines: ((data.lines as SalesOrderLine[]) ?? []).map(toLine),
    // Keep the stock/status flags so an edit round-trips them instead of wiping them
    ...(data.paymentStatus !== undefined ? { paymentStatus: data.paymentStatus as SalesOrder['paymentStatus'] } : {}),
    ...(data.deliveryStatus !== undefined ? { deliveryStatus: data.deliveryStatus as SalesOrder['deliveryStatus'] } : {}),
    ...(data.reduceStock !== undefined ? { reduceStock: data.reduceStock as boolean } : {}),
  };
};

export const getOrders = async (): Promise<SalesOrder[]> => {
  const snap = await getDocs(query(collection(db, 'sales_orders'), orderBy('date', 'desc'), limit(500)));
  return snap.docs.map(d => toOrder(d.id, d.data() as Record<string, unknown>));
};

export const generateOrderRef = async (year?: number): Promise<string> => {
  const y = year ?? new Date().getFullYear();
  const prefix = `ORD-${y}-`;
  // Query only orders with matching prefix — reads 1 doc instead of the whole collection
  const snap = await getDocs(
    query(
      collection(db, 'sales_orders'),
      where('ref', '>=', prefix),
      where('ref', '<', prefix + ''),
      orderBy('ref', 'desc'),
      limit(1)
    )
  );
  const maxRef = snap.docs[0]?.data().ref as string | undefined;
  const max = maxRef ? (parseInt(maxRef.slice(prefix.length), 10) || 0) : 0;
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
};

export const createOrder = async (order: Omit<SalesOrder, 'id'>): Promise<string> => {
  const orderRef = doc(collection(db, 'sales_orders'));
  const lines = order.lines.map(toLine);
  const validLines = lines.filter(l => l.totalQty > 0);
  const shouldReduceStock = order.reduceStock !== false;

  const orderPayload: Record<string, unknown> = {
    ref: order.ref,
    client: order.client,
    lines,
    date: Timestamp.fromDate(order.date instanceof Date ? order.date : new Date(order.date)),
  };
  if (order.paymentStatus !== undefined) orderPayload.paymentStatus = order.paymentStatus;
  if (order.deliveryStatus !== undefined) orderPayload.deliveryStatus = order.deliveryStatus;
  if (order.reduceStock !== undefined) orderPayload.reduceStock = order.reduceStock;

  await runTransaction(db, async (tx) => {
    const prodSnaps = shouldReduceStock
      ? await Promise.all(validLines.map(l => tx.get(doc(db, 'products', l.productId))))
      : [];
    tx.set(orderRef, orderPayload);
    if (shouldReduceStock) {
      for (let i = 0; i < validLines.length; i++) {
        const line = validLines[i];
        const snap = prodSnaps[i];
        if (!snap.exists()) throw new Error(`Product ${line.productName ?? line.productId} not found`);
        const current = snap.data().stock_level as number;
        if (current < line.totalQty) throw new Error(`Insufficient stock for ${snap.data().name as string}: need ${line.totalQty}, have ${current}`);
        tx.update(snap.ref, { stock_level: current - line.totalQty });
        tx.set(doc(collection(db, 'inventory_movements')), {
          productId: line.productId, quantity: -line.totalQty, reason: 'SALE',
          note: order.ref ?? orderRef.id, createdAt: Timestamp.now(),
        });
      }
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
      if (!snap.exists()) {
        // Abort — deleting the movement without restoring stock would corrupt inventory
        throw new Error(`Cannot reverse sale: product "${movDoc.data().productId as string}" not found in catalogue. Restore it first or adjust manually.`);
      }
      tx.update(snap.ref, { stock_level: (snap.data().stock_level as number) - qty }); // -(-qty) = restore
      tx.delete(movDoc.ref);
    }
  });
}

export const updateOrder = async (order: SalesOrder): Promise<void> => {
  const orderDocRef = doc(db, 'sales_orders', order.id);
  const lines = order.lines.map(toLine);
  const validLines = lines.filter(l => l.totalQty > 0);

  // Merge-write so fields the edit form never loaded (payment/delivery status, reduceStock)
  // survive the save instead of being wiped by a full overwrite.
  const orderPayload: Record<string, unknown> = {
    ref: order.ref,
    client: order.client,
    lines,
    date: Timestamp.fromDate(order.date instanceof Date ? order.date : new Date(order.date)),
  };
  if (order.paymentStatus !== undefined) orderPayload.paymentStatus = order.paymentStatus;
  if (order.deliveryStatus !== undefined) orderPayload.deliveryStatus = order.deliveryStatus;
  if (order.reduceStock !== undefined) orderPayload.reduceStock = order.reduceStock;

  // Fetch existing SALE movements outside the transaction (queries can't run inside)
  const movSnap = await getDocs(
    query(collection(db, 'inventory_movements'), where('note', '==', order.ref))
  );
  const saleMoves = movSnap.docs.filter(d => d.data().reason === 'SALE');

  // An edit only re-syncs inventory for orders that actually took stock. Historical /
  // imported orders and orders saved with reduceStock: false carry no SALE movements —
  // deducting their quantities now would charge inventory twice (and fail on low stock).
  const tracksStock = order.reduceStock !== false && saleMoves.length > 0;

  if (!tracksStock) {
    await setDoc(orderDocRef, orderPayload, { merge: true });
    return;
  }

  // Single atomic transaction: reverse old movements + apply new lines + update order doc
  await runTransaction(db, async (tx) => {
    // ── All reads first: Firestore forbids a read after a write in a transaction ──
    const movSnapsInTx = await Promise.all(saleMoves.map(m => tx.get(m.ref)));

    // Collect all unique product IDs (from old movements + new lines)
    const oldProductIds = [...new Set(saleMoves.map(m => m.data().productId as string))];
    const newProductIds = [...new Set(validLines.map(l => l.productId))];
    const allProductIds = [...new Set([...oldProductIds, ...newProductIds])].filter(Boolean);

    const prodRefs = new Map(allProductIds.map(id => [id, doc(db, 'products', id)]));
    const prodSnaps = await Promise.all(allProductIds.map(id => tx.get(prodRefs.get(id)!)));

    // Build a mutable stock map — products deleted from the catalogue are left out so we
    // never issue an update against a missing doc (Firestore rejects the whole transaction)
    const stockMap = new Map<string, number>();
    allProductIds.forEach((id, i) => {
      if (prodSnaps[i].exists()) stockMap.set(id, Number(prodSnaps[i].data()?.stock_level) || 0);
    });
    const startingStock = new Map(stockMap);

    const missing = validLines.find(l => !stockMap.has(l.productId));
    if (missing) {
      throw new Error(`"${missing.productName || missing.productId}" is no longer in the product catalogue — restore it or remove that line.`);
    }

    // Step 1: reverse old movements (restore stock)
    for (const mov of movSnapsInTx) {
      if (!mov.exists()) continue;
      const productId = mov.data().productId as string;
      const qty = mov.data().quantity as number; // stored negative
      // A movement whose product was deleted has no stock to restore — drop it anyway,
      // otherwise it would be reversed again on the next edit.
      if (stockMap.has(productId)) stockMap.set(productId, stockMap.get(productId)! - qty); // restore: -(-qty)
      tx.delete(mov.ref);
    }

    // Step 2: apply new lines (check stock, deduct, create movements)
    for (const line of validLines) {
      const current = stockMap.get(line.productId) ?? 0;
      if (current < line.totalQty) {
        throw new Error(`Insufficient stock for ${line.productName || line.productId}: need ${line.totalQty}, have ${current}`);
      }
      stockMap.set(line.productId, current - line.totalQty);
      tx.set(doc(collection(db, 'inventory_movements')), {
        productId: line.productId, quantity: -line.totalQty, reason: 'SALE',
        note: order.ref, createdAt: Timestamp.now(),
      });
    }

    // Step 3: write back only the stock levels that actually moved
    for (const [productId, newStock] of stockMap.entries()) {
      if (newStock !== startingStock.get(productId)) {
        tx.update(prodRefs.get(productId)!, { stock_level: newStock });
      }
    }

    // Step 4: update the order document
    tx.set(orderDocRef, orderPayload, { merge: true });
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
