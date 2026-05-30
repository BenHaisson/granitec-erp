/** Returns today as YYYY-MM-DD string in local time */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns current time as HH:MM string */
export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Converts a Firestore Timestamp, Date, or string to a Date object */
export function tsToDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof v === 'object' && 'toDate' in v)
    return (v as { toDate: () => Date }).toDate();
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  return new Date();
}
