import {
  collection, addDoc, getDocs, doc, deleteDoc, Timestamp,
  query, orderBy, limit, where, runTransaction,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase/config';
import type { ShippedSupply, ShippedSupplyLine } from '@/types';
import { withTimeout } from '@/utils/async';
import { receiveSupplyBatch } from './inventory.service';

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
const UPLOAD_TIMEOUT_MS = 30000;

export const uploadShippedSupplyDocument = async (id: string, file: File): Promise<{ url: string; name: string }> => {
  const path = `shipped-supply-documents/${id}/${Date.now()}_${sanitizeFileName(file.name)}`;
  const fileRef = storageRef(storage, path);
  try {
    await withTimeout(uploadBytes(fileRef, file), UPLOAD_TIMEOUT_MS, 'Upload timed out. Check your connection or Firebase Storage configuration.');
    return { url: await withTimeout(getDownloadURL(fileRef), UPLOAD_TIMEOUT_MS, 'Failed to retrieve the uploaded document URL.'), name: file.name };
  } catch (e) {
    console.error('uploadShippedSupplyDocument failed', e);
    throw e;
  }
};

export const getShippedSupplies = async (): Promise<ShippedSupply[]> => {
  const snap = await getDocs(
    query(collection(db, 'shipped_supplies'), orderBy('date', 'desc'), limit(500))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ShippedSupply));
};

export const createShippedSupply = async (
  data: {
    ref: string;
    supplier?: string;
    date: string;
    description?: string;
    lines: ShippedSupplyLine[];
    documentUrl?: string;
    documentName?: string;
  },
  addToInventory: boolean
): Promise<void> => {
  if (addToInventory) {
    await receiveSupplyBatch(
      data.lines.map(l => ({ productId: l.productId, qty: l.qty })),
      data.ref,
      new Date(data.date)
    );
  }

  const record: Record<string, unknown> = {
    ref: data.ref,
    date: data.date,
    lines: data.lines,
    addedToInventory: addToInventory,
    createdAt: Timestamp.now(),
  };
  if (data.supplier) record.supplier = data.supplier;
  if (data.description) record.description = data.description;
  if (data.documentUrl) record.documentUrl = data.documentUrl;
  if (data.documentName) record.documentName = data.documentName;
  await addDoc(collection(db, 'shipped_supplies'), record);
};

export const deleteShippedSupply = async (item: ShippedSupply): Promise<void> => {
  if (item.addedToInventory) {
    const movSnap = await getDocs(
      query(collection(db, 'inventory_movements'), where('note', '==', item.ref), where('reason', '==', 'PURCHASE'))
    );
    for (const movDoc of movSnap.docs) {
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
  await deleteDoc(doc(db, 'shipped_supplies', item.id));
};
