import {
  collection, addDoc, getDocs, doc, deleteDoc, Timestamp,
  query, orderBy, limit, where, runTransaction,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ShippedSupply, ShippedSupplyLine } from '@/types';
import { receiveSupplyBatch } from './inventory.service';
import { uploadFileToR2, deleteAttachmentObject, type R2Attachment } from '@/lib/r2Storage';

// ── Shipped-supply document upload (Cloudflare R2) ────────────────
export const uploadShippedSupplyDocument = (
  file: File,
  onProgress?: (percent: number) => void,
): Promise<R2Attachment> => uploadFileToR2(file, { folder: 'shipped-supply-documents', onProgress });

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
    documentKey?: string;
    storageProvider?: 'r2';
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
  if (data.documentKey) record.documentKey = data.documentKey;
  if (data.storageProvider) record.storageProvider = data.storageProvider;
  await addDoc(collection(db, 'shipped_supplies'), record);
};

export const deleteShippedSupply = async (item: ShippedSupply): Promise<void> => {
  await deleteAttachmentObject(item);
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
