import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp,
  query, orderBy,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { Client } from '@/types';

/** Strip undefined values — Firestore rejects them */
const clean = (obj: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

const toClient = (id: string, data: Record<string, unknown>): Client => ({
  id,
  name: (data.name as string) ?? '',
  email: data.email as string | undefined,
  mainPhone: data.mainPhone as string | undefined,
  phones: data.phones as Client['phones'] | undefined,
  address: data.address as string | undefined,
  description: data.description as string | undefined,
  createdAt: data.createdAt as string | undefined,
});

export const getClients = async (): Promise<Client[]> => {
  const snap = await getDocs(
    query(collection(db, 'clients'), orderBy('name', 'asc'))
  );
  return snap.docs.map(d => toClient(d.id, d.data() as Record<string, unknown>));
};

export const createClient = async (client: Omit<Client, 'id'>): Promise<string> => {
  const ref = await addDoc(collection(db, 'clients'), clean({
    ...client,
    createdAt: Timestamp.now().toDate().toISOString(),
  }));
  return ref.id;
};

export const updateClient = async (id: string, patch: Partial<Omit<Client, 'id'>>): Promise<void> => {
  await updateDoc(doc(db, 'clients', id), clean(patch as Record<string, unknown>));
};

export const deleteClient = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'clients', id));
};
