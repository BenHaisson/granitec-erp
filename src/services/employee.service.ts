import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp,
  query, orderBy, where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { Employee } from '@/types';

/** Strip undefined values — Firestore rejects them */
const clean = (obj: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

const toEmployee = (id: string, data: Record<string, unknown>): Employee => ({
  id,
  firstName: (data.firstName as string) ?? '',
  lastName: (data.lastName as string) ?? '',
  matricule: data.matricule as string | undefined,
  cin: data.cin as string | undefined,
  cnss: data.cnss as string | undefined,
  position: data.position as string | undefined,
  department: data.department as string | undefined,
  hireDate: (data.hireDate as string) ?? '',
  endDate: data.endDate as string | undefined,
  contractType: data.contractType as Employee['contractType'],
  status: (data.status as Employee['status']) ?? 'active',
  mainPhone: data.mainPhone as string | undefined,
  phones: data.phones as Employee['phones'] | undefined,
  address: data.address as string | undefined,
  notes: data.notes as string | undefined,
  leaveDaysPerYear: data.leaveDaysPerYear as number | undefined,
  leaveCarryOver: data.leaveCarryOver as number | undefined,
  createdAt: data.createdAt as string | undefined,
});

/** "Firstname Lastname", trimmed — the label stored on every HR record. */
export const employeeName = (e: Pick<Employee, 'firstName' | 'lastName'>): string =>
  `${e.firstName} ${e.lastName}`.trim();

export const getEmployees = async (): Promise<Employee[]> => {
  const snap = await getDocs(
    query(collection(db, 'employees'), orderBy('lastName', 'asc'))
  );
  return snap.docs.map(d => toEmployee(d.id, d.data() as Record<string, unknown>));
};

export const createEmployee = async (employee: Omit<Employee, 'id'>): Promise<string> => {
  const ref = await addDoc(collection(db, 'employees'), clean({
    ...employee,
    createdAt: Timestamp.now().toDate().toISOString(),
  }));
  return ref.id;
};

export const updateEmployee = async (id: string, patch: Partial<Omit<Employee, 'id'>>): Promise<void> => {
  await updateDoc(doc(db, 'employees', id), clean(patch as Record<string, unknown>));
};

const HR_COLLECTIONS: { name: string; label: string }[] = [
  { name: 'hr_absences', label: 'absence' },
  { name: 'hr_leave',    label: 'leave request' },
  { name: 'hr_overtime', label: 'overtime entry' },
  { name: 'hr_advances', label: 'advance' },
];

/** Counts an employee's records across the HR logs, keyed by human-readable label. */
export const countEmployeeRecords = async (employeeId: string): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const { name, label } of HR_COLLECTIONS) {
    const snap = await getDocs(query(collection(db, name), where('employeeId', '==', employeeId)));
    if (snap.size > 0) counts[label] = snap.size;
  }
  return counts;
};

/**
 * Deletes an employee, refusing while HR records still point at them —
 * removing one would orphan their history. Callers should offer marking the
 * employee as `left` instead.
 */
export const deleteEmployee = async (id: string): Promise<void> => {
  const counts = await countEmployeeRecords(id);
  const entries = Object.entries(counts);
  if (entries.length > 0) {
    const summary = entries
      .map(([label, n]) => `${n} ${label}${n > 1 ? 's' : ''}`)
      .join(', ');
    throw new Error(
      `This employee still has ${summary}. Delete those records first, or set their status to "Left" to keep the history.`
    );
  }
  await deleteDoc(doc(db, 'employees', id));
};
