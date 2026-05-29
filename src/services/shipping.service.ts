import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp,
  query, where, limit, runTransaction, writeBatch,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase/config';
import type { ShippingOrder, ShippingOrderLine } from '@/types';
import { receiveSupplyBatch, reconcileUnverifiedStock } from './inventory.service';

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

export const uploadReceiptDocument = async (orderId: string, file: File): Promise<{ url: string; name: string }> => {
  const safeName = sanitizeFileName(file.name);
  const path = `receipt-documents/${orderId}/${Date.now()}_${safeName}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { url, name: file.name };
};

export const getShippingOrders = async (): Promise<ShippingOrder[]> => {
  const snap = await getDocs(
    query(collection(db, 'shipping_orders'), limit(500))
  );
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
  if (order.verification) data.verification = true;
  await addDoc(collection(db, 'shipping_orders'), data);
};

export const receiveShippingOrder = async (
  order: ShippingOrder,
  receipt?: { blNumber?: string; remarks?: string; documentUrl?: string; documentName?: string },
  reconcileProductIds?: Set<string>
): Promise<string[]> => {
  const normalLines    = order.lines.filter(l => !reconcileProductIds?.has(l.productId));
  const reconcileLines = order.lines.filter(l => reconcileProductIds?.has(l.productId));

  // Normal lines — add to stock_level + create PURCHASE movements
  let failedIds: string[] = [];
  if (normalLines.length > 0) {
    failedIds = await receiveSupplyBatch(
      normalLines.map(l => ({ productId: l.productId, qty: l.qty })),
      order.ref,
      new Date(order.date)
    );
  }

  // Reconcile lines — reduce unverified_stock only, no stock_level change
  for (const line of reconcileLines) {
    await reconcileUnverifiedStock(line.productId, line.qty);
  }

  const update: Record<string, unknown> = { status: 'RECEIVED', receivedAt: Timestamp.now() };
  if (receipt?.blNumber) update.blNumber = receipt.blNumber;
  if (receipt?.remarks) update.remarks = receipt.remarks;
  if (receipt?.documentUrl) update.documentUrl = receipt.documentUrl;
  if (receipt?.documentName) update.documentName = receipt.documentName;
  await updateDoc(doc(db, 'shipping_orders', order.id), update);
  return failedIds;
};

export const deleteShippingOrder = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'shipping_orders', id));
};

export const updateShippingOrderRef = async (id: string, oldRef: string, newRef: string): Promise<void> => {
  const movSnap = await getDocs(
    query(collection(db, 'inventory_movements'), where('note', '==', oldRef), where('reason', '==', 'PURCHASE'))
  );
  if (movSnap.docs.length > 0) {
    const CHUNK = 400;
    for (let i = 0; i < movSnap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      movSnap.docs.slice(i, i + CHUNK).forEach(d => batch.update(d.ref, { note: newRef }));
      await batch.commit();
    }
  }
  await updateDoc(doc(db, 'shipping_orders', id), { ref: newRef });
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
    } catch (e) { console.error('[shipping] movement reversal skipped:', e); }
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
    } catch (e) { console.error('[shipping] movement reversal skipped:', e); }
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
