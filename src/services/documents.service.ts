import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  Timestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { Invoice, MachineDoc } from '@/types';
import { uploadFileToR2, type R2Attachment } from '@/lib/r2Storage';

// Firestore rejects `undefined` field values — strip them before writing.
const stripUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

// ── Invoice document upload (Cloudflare R2) ───────────────────────
// Returns the attachment metadata to persist on the invoice. The permanent
// identifier is `objectKey`; signed URLs are minted on demand when opening.
export const uploadInvoiceDocument = (
  file: File,
  onProgress?: (percent: number) => void,
): Promise<R2Attachment> => uploadFileToR2(file, { folder: 'invoice-documents', onProgress });

// ── Invoices CRUD ─────────────────────────────────────────────────
export const getInvoices = async (): Promise<Invoice[]> => {
  const snap = await getDocs(query(collection(db, 'invoices'), orderBy('date', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
};

export const createInvoice = async (data: Omit<Invoice, 'id' | 'createdAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, 'invoices'), stripUndefined({ ...data, createdAt: Timestamp.now() }));
  return ref.id;
};

export const updateInvoice = async (id: string, data: Partial<Omit<Invoice, 'id' | 'createdAt'>>): Promise<void> => {
  await updateDoc(doc(db, 'invoices', id), stripUndefined({ ...data }));
};

export const deleteInvoice = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'invoices', id));
};

// ── Machine Docs CRUD ─────────────────────────────────────────────
export const getMachineDocs = async (): Promise<MachineDoc[]> => {
  const snap = await getDocs(query(collection(db, 'machine_docs'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MachineDoc));
};

export const createMachineDoc = async (data: Omit<MachineDoc, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, 'machine_docs'), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
};

export const updateMachineDoc = async (id: string, data: Partial<Omit<MachineDoc, 'id' | 'createdAt'>>): Promise<void> => {
  await updateDoc(doc(db, 'machine_docs', id), { ...data, updatedAt: Timestamp.now() });
};

export const deleteMachineDoc = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'machine_docs', id));
};
