import {
  collection, addDoc, getDocs, getDocsFromServer, doc, setDoc, deleteDoc, updateDoc, runTransaction, Timestamp, writeBatch,
  query, where, orderBy, limit,
} from 'firebase/firestore';
import { db, auth } from '@/firebase/config';
import type { Product, InventoryMovement } from '@/types';

export const getProducts = async (): Promise<Product[]> => {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
};

export const getProductsFresh = async (): Promise<Product[]> => {
  const snap = await getDocsFromServer(collection(db, 'products'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
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
): Promise<void> => {
  const failedIds = new Set<string>();
  for (const line of lines) {
    try {
      await runTransaction(db, async (tx) => {
        const prodRef = doc(db, 'products', line.productId);
        const snap = await tx.get(prodRef);
        if (!snap.exists()) throw new Error(`Product ${line.productId} not found`);
        tx.update(prodRef, { stock_level: (snap.data().stock_level as number) + line.qty });
      });
    } catch (e) {
      console.error('[receiveSupplyBatch]', e);
      failedIds.add(line.productId);
    }
  }
  const successLines = lines.filter(l => !failedIds.has(l.productId));
  const CHUNK = 400;
  for (let i = 0; i < successLines.length; i += CHUNK) {
    const batch = writeBatch(db);
    successLines.slice(i, i + CHUNK).forEach(line => {
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
    tx.update(ref, { unverified_stock: Math.max(0, current - qty) });
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

export const resetAllStockToZero = async (): Promise<void> => {
  const snap = await getDocs(collection(db, 'products'));
  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach(d => batch.update(d.ref, { stock_level: 0, unverified_stock: 0 }));
    await batch.commit();
  }
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
