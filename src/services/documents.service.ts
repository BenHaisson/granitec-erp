import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  Timestamp, query, orderBy,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase/config';
import type { Invoice, MachineDoc } from '@/types';
import { withTimeout } from '@/utils/async';

const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
const UPLOAD_TIMEOUT_MS = 30000;

// ── Invoice document upload ───────────────────────────────────────
export const uploadInvoiceDocument = async (invoiceId: string, file: File): Promise<{ url: string; name: string }> => {
  const path = `invoice-documents/${invoiceId}/${Date.now()}_${sanitize(file.name)}`;
  const fileRef = storageRef(storage, path);
  try {
    await withTimeout(uploadBytes(fileRef, file), UPLOAD_TIMEOUT_MS, 'Upload timed out. Check your connection or Firebase Storage configuration.');
    return { url: await withTimeout(getDownloadURL(fileRef), UPLOAD_TIMEOUT_MS, 'Failed to retrieve the uploaded document URL.'), name: file.name };
  } catch (e) {
    console.error('uploadInvoiceDocument failed', e);
    throw e;
  }
};

// ── Invoices CRUD ─────────────────────────────────────────────────
export const getInvoices = async (): Promise<Invoice[]> => {
  const snap = await getDocs(query(collection(db, 'invoices'), orderBy('date', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
};

export const createInvoice = async (data: Omit<Invoice, 'id' | 'createdAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, 'invoices'), { ...data, createdAt: Timestamp.now() });
  return ref.id;
};

export const updateInvoice = async (id: string, data: Partial<Omit<Invoice, 'id' | 'createdAt'>>): Promise<void> => {
  await updateDoc(doc(db, 'invoices', id), data);
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
