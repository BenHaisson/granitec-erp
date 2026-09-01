import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp,
  query, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { Absence, LeaveRequest, OvertimeEntry, AdvancePayment } from '@/types';
import { uploadFileToR2, deleteAttachmentObject, type R2Attachment } from '@/lib/r2Storage';

// Firestore rejects `undefined` field values — strip them before writing.
const stripUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

// Every HR log is small and read whole — pages filter client-side, which keeps
// the queries to a single `orderBy` and needs no composite indexes.
const listByDate = async <T>(col: string): Promise<T[]> => {
  const snap = await getDocs(query(collection(db, col), orderBy('date', 'desc'), limit(1000)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as T));
};

const createIn = async (col: string, data: Record<string, unknown>): Promise<string> => {
  const ref = await addDoc(collection(db, col), stripUndefined({ ...data, createdAt: Timestamp.now() }));
  return ref.id;
};

const updateIn = (col: string, id: string, data: Record<string, unknown>): Promise<void> =>
  updateDoc(doc(db, col, id), stripUndefined({ ...data }));

const deleteIn = (col: string, id: string): Promise<void> => deleteDoc(doc(db, col, id));

// ── Document uploads (Cloudflare R2) ──────────────────────────────
export const uploadAbsenceDocument = (
  file: File,
  onProgress?: (percent: number) => void,
): Promise<R2Attachment> => uploadFileToR2(file, { folder: 'absence-documents', onProgress });

export const uploadAdvanceDocument = (
  file: File,
  onProgress?: (percent: number) => void,
): Promise<R2Attachment> => uploadFileToR2(file, { folder: 'advance-documents', onProgress });

// ── Absences ──────────────────────────────────────────────────────
type NewAbsence = Omit<Absence, 'id' | 'createdAt'>;

export const getAbsences = (): Promise<Absence[]> => listByDate<Absence>('hr_absences');

export const createAbsence = (data: NewAbsence): Promise<string> =>
  createIn('hr_absences', data);

export const updateAbsence = (id: string, data: Partial<NewAbsence>): Promise<void> =>
  updateIn('hr_absences', id, data);

export const deleteAbsence = async (absence: Absence): Promise<void> => {
  await deleteAttachmentObject(absence);
  await deleteIn('hr_absences', absence.id);
};

// ── Leave requests ────────────────────────────────────────────────
type NewLeaveRequest = Omit<LeaveRequest, 'id' | 'createdAt'>;

export const getLeaveRequests = (): Promise<LeaveRequest[]> => listByDate<LeaveRequest>('hr_leave');

export const createLeaveRequest = (data: NewLeaveRequest): Promise<string> =>
  // `date` mirrors startDate so the shared date-ordered query applies here too.
  createIn('hr_leave', { ...data, date: data.startDate });

export const updateLeaveRequest = (id: string, data: Partial<NewLeaveRequest>): Promise<void> =>
  updateIn('hr_leave', id, data.startDate ? { ...data, date: data.startDate } : data);

export const deleteLeaveRequest = (id: string): Promise<void> => deleteIn('hr_leave', id);

// ── Overtime ──────────────────────────────────────────────────────
type NewOvertimeEntry = Omit<OvertimeEntry, 'id' | 'createdAt'>;

export const getOvertimeEntries = (): Promise<OvertimeEntry[]> =>
  listByDate<OvertimeEntry>('hr_overtime');

export const createOvertimeEntry = (data: NewOvertimeEntry): Promise<string> =>
  createIn('hr_overtime', data);

export const updateOvertimeEntry = (id: string, data: Partial<NewOvertimeEntry>): Promise<void> =>
  updateIn('hr_overtime', id, data);

export const deleteOvertimeEntry = (id: string): Promise<void> => deleteIn('hr_overtime', id);

// ── Advance payments ──────────────────────────────────────────────
type NewAdvancePayment = Omit<AdvancePayment, 'id' | 'createdAt'>;

export const getAdvances = (): Promise<AdvancePayment[]> => listByDate<AdvancePayment>('hr_advances');

export const createAdvance = (data: NewAdvancePayment): Promise<string> =>
  createIn('hr_advances', data);

export const updateAdvance = (id: string, data: Partial<NewAdvancePayment>): Promise<void> =>
  updateIn('hr_advances', id, data);

export const deleteAdvance = async (advance: AdvancePayment): Promise<void> => {
  await deleteAttachmentObject(advance);
  await deleteIn('hr_advances', advance.id);
};
