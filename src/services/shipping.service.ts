import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp,
  query, where, orderBy, limit, runTransaction, writeBatch,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase/config';
import type { ShippingOrder, ShippingOrderLine, ShipmentReceipt, ShipmentReceiptLine, ShippingOrderStatus } from '@/types';
import { receiveSupplyBatch } from './inventory.service';

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
    query(collection(db, 'shipping_orders'), orderBy('date', 'desc'), limit(500))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ShippingOrder));
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
  addToInventory: boolean = true
): Promise<string[]> => {
  if (order.verification) {
    // Verification orders exist purely for document history.
    // unverified_stock was already reduced when the user clicked Verify in the
    // Unverified Stock page. No stock change happens here — just mark as RECEIVED.
  } else if (addToInventory) {
    // Regular supply order — add to stock_level + create PURCHASE movements.
    // Never touch unverified_stock here.
    await receiveSupplyBatch(
      order.lines.map(l => ({ productId: l.productId, qty: l.qty })),
      order.ref,
      new Date(order.date)
    );
  }

  const update: Record<string, unknown> = {
    status: 'RECEIVED',
    receivedAt: Timestamp.now(),
    addedToInventory: order.verification ? true : addToInventory,
  };
  if (receipt?.blNumber) update.blNumber = receipt.blNumber;
  if (receipt?.remarks) update.remarks = receipt.remarks;
  if (receipt?.documentUrl) update.documentUrl = receipt.documentUrl;
  if (receipt?.documentName) update.documentName = receipt.documentName;
  await updateDoc(doc(db, 'shipping_orders', order.id), update);
  return [];
};

export const deleteShippingOrder = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'shipping_orders', id));
};

export const deleteAllShippingOrders = async (): Promise<number> => {
  const snap = await getDocs(collection(db, 'shipping_orders'));
  const batches: Promise<void>[] = [];
  let batch = writeBatch(db);
  let count = 0;
  snap.docs.forEach((d, i) => {
    batch.delete(d.ref);
    count++;
    if ((i + 1) % 500 === 0) {
      batches.push(batch.commit());
      batch = writeBatch(db);
    }
  });
  if (count % 500 !== 0) batches.push(batch.commit());
  await Promise.all(batches);
  return count;
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
    await runTransaction(db, async (tx) => {
      const prodRef = doc(db, 'products', productId);
      const snap = await tx.get(prodRef);
      if (snap.exists()) {
        tx.update(prodRef, { stock_level: (snap.data().stock_level as number) - qty });
      }
      tx.delete(movDoc.ref);
    });
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
  // Reverse partial receipt movements (new flow)
  for (const receipt of (order.receipts ?? [])) {
    await reverseReceiptMovements(order, receipt.id);
  }
  // Reverse legacy movements where note == order.ref (old flow, no receipts array)
  if (!order.receipts || order.receipts.length === 0) {
    const movSnap = await getDocs(
      query(collection(db, 'inventory_movements'), where('note', '==', order.ref))
    );
    const purchaseMoves = movSnap.docs.filter(d => d.data().reason === 'PURCHASE');
    for (const movDoc of purchaseMoves) {
      const qty = movDoc.data().quantity as number;
      const productId = movDoc.data().productId as string;
      await runTransaction(db, async (tx) => {
        const prodRef = doc(db, 'products', productId);
        const snap = await tx.get(prodRef);
        if (snap.exists()) {
          tx.update(prodRef, { stock_level: (snap.data().stock_level as number) - qty });
        }
        tx.delete(movDoc.ref);
      });
    }
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

// ── Partial shipment helpers ──────────────────────────────────────

const genReceiptId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const computeReceivedMap = (receipts: ShipmentReceipt[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const r of receipts) {
    for (const l of r.lines) {
      map.set(l.productId, (map.get(l.productId) ?? 0) + l.receivedQty);
    }
  }
  return map;
};

export const computeOrderReceiptPercent = (order: ShippingOrder): number => {
  const receipts = order.receipts ?? [];
  if (receipts.length === 0) return 0;
  const totalOrdered = order.lines.reduce((s, l) => s + l.qty, 0);
  if (totalOrdered === 0) return 100;
  const receivedMap = computeReceivedMap(receipts);
  const totalReceived = order.lines.reduce((s, l) => s + Math.min(l.qty, receivedMap.get(l.productId) ?? 0), 0);
  return Math.min(100, Math.round((totalReceived / totalOrdered) * 100));
};

const reverseReceiptMovements = async (order: ShippingOrder, receiptId: string): Promise<void> => {
  const noteKey = `${order.ref}|rcpt:${receiptId}`;
  const movSnap = await getDocs(
    query(collection(db, 'inventory_movements'), where('note', '==', noteKey), where('reason', '==', 'PURCHASE'))
  );
  for (const movDoc of movSnap.docs) {
    const qty = movDoc.data().quantity as number;
    const productId = movDoc.data().productId as string;
    await runTransaction(db, async (tx) => {
      const prodRef = doc(db, 'products', productId);
      const snap = await tx.get(prodRef);
      if (snap.exists()) tx.update(prodRef, { stock_level: (snap.data().stock_level as number) - qty });
      tx.delete(movDoc.ref);
    });
  }
};

export const addShipmentReceipt = async (
  order: ShippingOrder,
  receiptData: {
    date: string;
    blNumber?: string;
    remarks?: string;
    documentUrl?: string;
    documentName?: string;
    lines: ShipmentReceiptLine[];
    addedToInventory: boolean;
  }
): Promise<void> => {
  const receiptId = genReceiptId();
  const linesToReceive = receiptData.lines.filter(l => l.receivedQty > 0);

  if (receiptData.addedToInventory && !order.verification && linesToReceive.length > 0) {
    await receiveSupplyBatch(
      linesToReceive.map(l => ({ productId: l.productId, qty: l.receivedQty })),
      `${order.ref}|rcpt:${receiptId}`,
      new Date(receiptData.date)
    );
  }

  const receipt: ShipmentReceipt = {
    id: receiptId,
    ...receiptData,
    createdAt: Timestamp.now(),
  };

  const updatedReceipts = [...(order.receipts ?? []), receipt];
  const percent = computeOrderReceiptPercent({ ...order, receipts: updatedReceipts });
  const newStatus: ShippingOrderStatus = percent >= 100 ? 'RECEIVED' : 'PARTIAL';

  const update: Record<string, unknown> = { receipts: updatedReceipts, status: newStatus };
  if (newStatus === 'RECEIVED') {
    update.receivedAt = Timestamp.now();
    update.addedToInventory = receiptData.addedToInventory;
  }
  await updateDoc(doc(db, 'shipping_orders', order.id), update);
};

export const updateShipmentReceipt = async (
  order: ShippingOrder,
  receiptId: string,
  receiptData: {
    date: string;
    blNumber?: string;
    remarks?: string;
    documentUrl?: string;
    documentName?: string;
    lines: ShipmentReceiptLine[];
    addedToInventory: boolean;
  }
): Promise<void> => {
  await reverseReceiptMovements(order, receiptId);

  const linesToReceive = receiptData.lines.filter(l => l.receivedQty > 0);
  if (receiptData.addedToInventory && !order.verification && linesToReceive.length > 0) {
    await receiveSupplyBatch(
      linesToReceive.map(l => ({ productId: l.productId, qty: l.receivedQty })),
      `${order.ref}|rcpt:${receiptId}`,
      new Date(receiptData.date)
    );
  }

  const updatedReceipts = (order.receipts ?? []).map(r =>
    r.id === receiptId ? { ...r, ...receiptData } : r
  );
  const percent = computeOrderReceiptPercent({ ...order, receipts: updatedReceipts });
  const newStatus: ShippingOrderStatus = percent >= 100 ? 'RECEIVED' : 'PARTIAL';

  const update: Record<string, unknown> = { receipts: updatedReceipts, status: newStatus };
  if (newStatus === 'RECEIVED') {
    update.receivedAt = Timestamp.now();
    update.addedToInventory = receiptData.addedToInventory;
  }
  await updateDoc(doc(db, 'shipping_orders', order.id), update);
};

export const deleteShipmentReceipt = async (
  order: ShippingOrder,
  receiptId: string
): Promise<void> => {
  await reverseReceiptMovements(order, receiptId);

  const updatedReceipts = (order.receipts ?? []).filter(r => r.id !== receiptId);
  const percent = updatedReceipts.length === 0 ? 0 : computeOrderReceiptPercent({ ...order, receipts: updatedReceipts });
  const newStatus: ShippingOrderStatus = updatedReceipts.length === 0 ? 'PLANNED' : (percent >= 100 ? 'RECEIVED' : 'PARTIAL');

  const update: Record<string, unknown> = { receipts: updatedReceipts, status: newStatus };
  if (newStatus !== 'RECEIVED') {
    update.receivedAt = null;
    update.addedToInventory = null;
  }
  await updateDoc(doc(db, 'shipping_orders', order.id), update);
};

export const cancelRemainingAndClose = async (order: ShippingOrder): Promise<void> => {
  await updateDoc(doc(db, 'shipping_orders', order.id), {
    status: 'RECEIVED',
    receivedAt: Timestamp.now(),
    addedToInventory: true,
    cancelledRemaining: true,
  });
};
