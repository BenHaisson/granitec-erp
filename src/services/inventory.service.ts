import {
  collection, addDoc, getDocs, getDocsFromServer, onSnapshot, doc, setDoc, deleteDoc, updateDoc, runTransaction, Timestamp, writeBatch,
  query, where, orderBy, limit,
} from 'firebase/firestore';
import { db, auth } from '@/firebase/config';
import type { Product, InventoryMovement } from '@/types';

/** Safe product mapper — adds numeric defaults so callers never get NaN from missing fields */
const toProduct = (id: string, data: Record<string, unknown>): Product => ({
  stock_level: 0,
  min_stock: 0,
  unverified_stock: 0,
  cost: 0,
  ...data,
  id,
} as Product);

export const getProducts = async (): Promise<Product[]> => {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs.map(d => toProduct(d.id, d.data() as Record<string, unknown>));
};

export const getProductsFresh = async (): Promise<Product[]> => {
  const snap = await getDocsFromServer(collection(db, 'products'));
  return snap.docs.map(d => toProduct(d.id, d.data() as Record<string, unknown>));
};

export const subscribeToProducts = (
  onData: (products: Product[]) => void,
  onError?: (err: Error) => void
): (() => void) => {
  return onSnapshot(
    collection(db, 'products'),
    (snap) => onData(snap.docs.map(d => toProduct(d.id, d.data() as Record<string, unknown>))),
    onError
  );
};

export const addProduct = (product: Omit<Product, 'id'>) =>
  addDoc(collection(db, 'products'), {
    ...product,
    source: 'user',
    createdBy: auth.currentUser?.email ?? auth.currentUser?.displayName ?? 'Unknown',
    createdAt: new Date().toISOString(),
  });

const sanitizeSku = (sku: string) => sku.replace(/[/\\.#$[\]]/g, '_');

export const upsertProduct = (product: Omit<Product, 'id'>) =>
  setDoc(doc(db, 'products', sanitizeSku(product.sku)), product);

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

export const deleteAllPackaging = async () => {
  const snap = await getDocs(collection(db, 'products'));
  const toDelete = snap.docs.filter(d => d.data().category === 'Packaging');
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
): Promise<string[]> => {
  if (lines.length === 0) return [];

  // Single atomic transaction for all stock updates (was N separate serial transactions)
  await runTransaction(db, async (tx) => {
    const prodRefs = lines.map(l => doc(db, 'products', l.productId));
    const snaps = await Promise.all(prodRefs.map(r => tx.get(r)));
    for (let i = 0; i < lines.length; i++) {
      if (!snaps[i].exists()) throw new Error(`Product "${lines[i].productId}" not found in catalogue`);
      tx.update(prodRefs[i], {
        stock_level: (snaps[i].data()!.stock_level as number) + lines[i].qty,
      });
    }
  });

  // Write PURCHASE movements in a batch (outside transaction — movements are append-only)
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

  return []; // all succeeded; errors throw and propagate to caller
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

export const addUnverifiedStock = async (productId: string, qty: number, note: string) => {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'products', productId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const current = (snap.data().unverified_stock ?? 0) as number;
    tx.update(ref, { unverified_stock: current + qty });
    const movRef = doc(collection(db, 'inventory_movements'));
    tx.set(movRef, { productId, quantity: qty, reason: 'ADJUSTMENT', note: `Unverified: ${note}`, createdAt: Timestamp.now() });
  });
};

export const reconcileUnverifiedStock = async (productId: string, qty: number) => {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'products', productId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const current = (snap.data().unverified_stock ?? 0) as number;
    const deducted = Math.min(current, qty);
    tx.update(ref, { unverified_stock: Math.max(0, current - qty) });
    if (deducted > 0) {
      tx.set(doc(collection(db, 'inventory_movements')), {
        productId,
        quantity: -deducted,
        reason: 'ADJUSTMENT',
        note: `Reconciled unverified: ${qty} units`,
        createdAt: Timestamp.now(),
      });
    }
  });
};

export const clearAllUnverifiedStock = async (): Promise<{ products: number }> => {
  const CHUNK = 400;
  const prodSnap = await getDocs(collection(db, 'products'));
  const withUnverified = prodSnap.docs.filter(d => (d.data().unverified_stock ?? 0) > 0);
  for (let i = 0; i < withUnverified.length; i += CHUNK) {
    const batch = writeBatch(db);
    withUnverified.slice(i, i + CHUNK).forEach(d => batch.update(d.ref, { unverified_stock: 0 }));
    await batch.commit();
  }
  return { products: withUnverified.length };
};

export const reconcileInventoryToMovements = async (): Promise<{
  discrepancies: number;
  fixed: number;
  details: Array<{ productId: string; sku: string; name: string; oldQty: number; newQty: number }>
}> => {
  // Get all products
  const prodSnap = await getDocs(collection(db, 'products'));
  const productMap = new Map(prodSnap.docs.map(d => [d.id, { ...d.data(), id: d.id }]));

  // Get all movements
  const movSnap = await getDocs(query(collection(db, 'inventory_movements'), orderBy('createdAt', 'asc')));
  const movements = movSnap.docs.map(d => d.data());

  // Calculate expected stock for each product
  const expectedStockMap = new Map<string, number>();
  for (const mov of movements) {
    const productId = mov.productId as string;
    const qty = (mov.quantity as number) ?? 0;
    const current = expectedStockMap.get(productId) ?? 0;
    expectedStockMap.set(productId, current + qty);
  }

  // Identify discrepancies
  const discrepancies = [];
  for (const [productId, product] of productMap) {
    const expected = expectedStockMap.get(productId) ?? 0;
    const current = (product.stock_level ?? 0) as number;
    if (expected !== current) {
      discrepancies.push({
        productId,
        sku: product.sku as string,
        name: product.name as string,
        oldQty: current,
        newQty: expected,
      });
    }
  }

  // Fix discrepancies in batch
  let fixed = 0;
  const CHUNK = 400;
  for (let i = 0; i < discrepancies.length; i += CHUNK) {
    const batch = writeBatch(db);
    discrepancies.slice(i, i + CHUNK).forEach(d => {
      batch.update(doc(db, 'products', d.productId), { stock_level: d.newQty });
      fixed++;
    });
    await batch.commit();
  }

  return {
    discrepancies: discrepancies.length,
    fixed,
    details: discrepancies,
  };
};

export const getMovements = async (): Promise<InventoryMovement[]> => {
  const snap = await getDocs(
    query(collection(db, 'inventory_movements'), orderBy('createdAt', 'desc'), limit(2000))
  );
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

export const deleteAllMovements = async (): Promise<void> => {
  const snap = await getDocs(collection(db, 'inventory_movements'));
  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
};

export const deleteMovementsByReasons = async (reasons: string[]): Promise<number> => {
  const snap = await getDocs(collection(db, 'inventory_movements'));
  const toDelete = snap.docs.filter(d => reasons.includes(d.data().reason as string));
  const CHUNK = 400;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const batch = writeBatch(db);
    toDelete.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return toDelete.length;
};

export const resetAllStockToZero = async (): Promise<void> => {
  const snap = await getDocs(collection(db, 'products'));
  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach(d => batch.update(d.ref, { stock_level: 0, unverified_stock: 0 }));
    await batch.commit();
  }
};

export const resetFinishedProductStock = async (): Promise<number> => {
  const snap = await getDocs(collection(db, 'products'));
  const finished = snap.docs.filter(d => d.data().type === 'FINISHED');
  const CHUNK = 400;
  for (let i = 0; i < finished.length; i += CHUNK) {
    const batch = writeBatch(db);
    finished.slice(i, i + CHUNK).forEach(d => batch.update(d.ref, { stock_level: 0 }));
    await batch.commit();
  }
  return finished.length;
};

export const deletePhantomAdjustmentMovements = async (): Promise<number> => {
  const snap = await getDocs(
    query(collection(db, 'inventory_movements'), where('reason', '==', 'ADJUSTMENT'))
  );
  const phantoms = snap.docs.filter(d => {
    const note = (d.data().note as string) ?? '';
    return note.startsWith('Order deleted:') || note.startsWith('Order edited:');
  });
  const CHUNK = 400;
  for (let i = 0; i < phantoms.length; i += CHUNK) {
    const batch = writeBatch(db);
    phantoms.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return phantoms.length;
};

export const backfillPurchaseMovements = async (): Promise<number> => {
  const [ordersSnap, movsSnap] = await Promise.all([
    getDocs(collection(db, 'shipping_orders')),
    getDocs(query(collection(db, 'inventory_movements'), where('reason', '==', 'PURCHASE'))),
  ]);

  const existingKeys = new Set(
    movsSnap.docs.map(d => `${d.data().productId as string}|${d.data().note as string}`)
  );

  const toCreate: object[] = [];
  for (const orderDoc of ordersSnap.docs) {
    const data = orderDoc.data();
    if (data.status !== 'RECEIVED') continue;
    const ref = data.ref as string;
    const date = data.date as string;
    const lines = data.lines as Array<{ productId: string; qty: number }>;
    for (const line of lines) {
      if (!line.qty || line.qty <= 0) continue;
      if (existingKeys.has(`${line.productId}|${ref}`)) continue;
      toCreate.push({
        productId: line.productId,
        quantity: line.qty,
        reason: 'PURCHASE',
        note: ref,
        createdAt: Timestamp.fromDate(new Date(date)),
      });
    }
  }

  const CHUNK = 400;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const batch = writeBatch(db);
    toCreate.slice(i, i + CHUNK).forEach(m => batch.set(doc(collection(db, 'inventory_movements')), m));
    await batch.commit();
  }
  return toCreate.length;
};

export const recalculateStockFromMovements = async (): Promise<number> => {
  const [movSnap, prodSnap] = await Promise.all([
    getDocs(collection(db, 'inventory_movements')),
    getDocs(collection(db, 'products')),
  ]);

  // Sum all signed movement quantities per product
  const netStock = new Map<string, number>();
  prodSnap.docs.forEach(d => netStock.set(d.id, 0));
  for (const m of movSnap.docs) {
    const { productId, quantity } = m.data() as { productId: string; quantity: number };
    if (productId) netStock.set(productId, (netStock.get(productId) ?? 0) + quantity);
  }

  const productIds = new Set(prodSnap.docs.map(d => d.id));
  const entries = Array.from(netStock.entries()).filter(([id]) => productIds.has(id));
  const CHUNK = 400;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const batch = writeBatch(db);
    entries.slice(i, i + CHUNK).forEach(([id, level]) => {
      batch.update(doc(db, 'products', id), { stock_level: level });
    });
    await batch.commit();
  }
  return entries.length;
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
