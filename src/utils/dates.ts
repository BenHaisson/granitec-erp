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

/**
 * Formats a date as dd/mm/yyyy — the app's one date format.
 *
 * Month names were spelled out in some screens and numeric in others, and in
 * two different languages; a numeric month sorts and scans in a column and
 * reads the same everywhere. Accepts a Date, a Firestore timestamp, or a
 * YYYY-MM-DD string, which is parsed as a local date so the day never shifts.
 */
export function fmtDate(value: unknown): string {
  const d = parseLocal(value);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—';
}

/** dd/mm — for the compact spots that deliberately leave the year out. */
export function fmtDayMonth(value: unknown): string {
  const d = parseLocal(value);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : '—';
}

const pad = (n: number) => String(n).padStart(2, '0');

function parseLocal(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  // A YYYY-MM-DD string parsed by `new Date()` is read as UTC, which lands on
  // the previous day west of Greenwich — build it in the local frame instead.
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = tsToDate(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
