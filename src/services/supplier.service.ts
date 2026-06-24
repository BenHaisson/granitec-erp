import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp,
  query, orderBy,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { Supplier } from '@/types';

const toSupplier = (id: string, data: Record<string, unknown>): Supplier => ({
  id,
  name: (data.name as string) ?? '',
  supplyType: (data.supplyType as Supplier['supplyType']) ?? 'raw_material',
  address: data.address as string | undefined,
  phone: data.phone as string | undefined,
  description: data.description as string | undefined,
  ice: data.ice as string | undefined,
  rc: data.rc as string | undefined,
  createdAt: data.createdAt as string | undefined,
});

export const getSuppliers = async (): Promise<Supplier[]> => {
  const snap = await getDocs(
    query(collection(db, 'suppliers'), orderBy('name', 'asc'))
  );
  return snap.docs.map(d => toSupplier(d.id, d.data() as Record<string, unknown>));
};

export const createSupplier = async (supplier: Omit<Supplier, 'id'>): Promise<string> => {
  const ref = await addDoc(collection(db, 'suppliers'), {
    ...supplier,
    createdAt: Timestamp.now().toDate().toISOString(),
  });
  return ref.id;
};

export const updateSupplier = async (id: string, patch: Partial<Omit<Supplier, 'id'>>): Promise<void> => {
  await updateDoc(doc(db, 'suppliers', id), patch as Record<string, unknown>);
};

export const deleteSupplier = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'suppliers', id));
};
