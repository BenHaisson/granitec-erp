import {
  collection, getDocs, doc, setDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { Machine, LibraryItem } from '@/types';

// ── Machines ─────────────────────────────────────────────────────

export const getMachines = async (): Promise<Machine[]> => {
  const snap = await getDocs(collection(db, 'machines'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Machine));
};

export const upsertMachine = async (m: Omit<Machine, 'id'>): Promise<void> => {
  await setDoc(doc(db, 'machines', m.name), m);
};

export const deleteAllMachines = async (): Promise<void> => {
  const snap = await getDocs(collection(db, 'machines'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
};

// ── Library items ─────────────────────────────────────────────────

export const getLibraryItems = async (): Promise<LibraryItem[]> => {
  const snap = await getDocs(collection(db, 'library_items'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryItem));
};

export const upsertLibraryItem = async (item: Omit<LibraryItem, 'id'>): Promise<void> => {
  await setDoc(doc(db, 'library_items', item.title), item);
};

export const deleteAllLibraryItems = async (): Promise<void> => {
  const snap = await getDocs(collection(db, 'library_items'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
};
