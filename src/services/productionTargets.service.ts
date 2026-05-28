import {
  collection, addDoc, getDocs, doc, deleteDoc, updateDoc,
  query, where, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ProductionTarget, ProductionEntry } from '@/types';

// ── Targets ────────────────────────────────────────────────────────

export const getTargets = async (date: string): Promise<ProductionTarget[]> => {
  const q = query(collection(db, 'production_targets'), where('date', '==', date));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionTarget));
};

export const getAllTargets = async (): Promise<ProductionTarget[]> => {
  const q = query(
    collection(db, 'production_targets'),
    orderBy('date', 'desc'),
    limit(500)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionTarget));
};

export const createTarget = async (
  t: Omit<ProductionTarget, 'id' | 'createdAt'>
): Promise<string> => {
  const data = Object.fromEntries(
    Object.entries({ ...t, createdAt: Timestamp.now() }).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(collection(db, 'production_targets'), data);
  return ref.id;
};

export const updateTarget = (
  id: string,
  updates: Partial<Omit<ProductionTarget, 'id' | 'createdAt'>>
) => updateDoc(doc(db, 'production_targets', id), updates);

export const deleteTarget = (id: string) =>
  deleteDoc(doc(db, 'production_targets', id));

// ── Entries ────────────────────────────────────────────────────────

export const getEntries = async (date: string): Promise<ProductionEntry[]> => {
  const q = query(collection(db, 'production_entries'), where('date', '==', date));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionEntry));
};

export const getAllEntries = async (): Promise<ProductionEntry[]> => {
  const snap = await getDocs(collection(db, 'production_entries'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionEntry));
};

export const createEntry = async (
  e: Omit<ProductionEntry, 'id' | 'createdAt'>
): Promise<void> => {
  const data = Object.fromEntries(
    Object.entries({ ...e, createdAt: Timestamp.now() }).filter(([, v]) => v !== undefined)
  );
  await addDoc(collection(db, 'production_entries'), data);
};

export const deleteEntry = (id: string) =>
  deleteDoc(doc(db, 'production_entries', id));
