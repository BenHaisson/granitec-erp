/**
 * Leave accrual helpers — pure date/number maths, no Firestore.
 *
 * Moroccan labour law grants 1.5 paid days per month worked (18 days a year).
 * An employee can override that with `leaveDaysPerYear`, and `leaveCarryOver`
 * seeds a balance that predates this system.
 */

import type { Employee, LeaveRequest } from '@/types';

export const DEFAULT_LEAVE_DAYS_PER_YEAR = 18;

/** Parses YYYY-MM-DD as a local date (never UTC — avoids off-by-one days). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** YYYY-MM key for a YYYY-MM-DD date string. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Formats YYYY-MM as e.g. "janv. 2026". */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, 1)
    .toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

/**
 * Days between two YYYY-MM-DD dates, inclusive of both ends, skipping Sundays.
 * Public holidays are not modelled — the caller keeps the count editable.
 */
export function workingDaysBetween(startISO: string, endISO: string): number {
  if (!startISO || !endISO) return 0;
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (end < start) return 0;

  let days = 0;
  for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    if (cur.getDay() !== 0) days += 1; // 0 = Sunday
  }
  return days;
}

/** Whole months elapsed between two dates (a partial month doesn't count). */
export function monthsWorked(hireDateISO: string, asOfISO: string): number {
  if (!hireDateISO) return 0;
  const hire = parseISODate(hireDateISO);
  const asOf = parseISODate(asOfISO);
  if (asOf < hire) return 0;

  let months = (asOf.getFullYear() - hire.getFullYear()) * 12 + (asOf.getMonth() - hire.getMonth());
  if (asOf.getDate() < hire.getDate()) months -= 1;
  return Math.max(0, months);
}

/** Leave days accrued since the hire date, plus any carry-over. */
export function accruedLeaveDays(employee: Employee, asOfISO: string): number {
  const perYear = employee.leaveDaysPerYear ?? DEFAULT_LEAVE_DAYS_PER_YEAR;
  const accrued = monthsWorked(employee.hireDate, asOfISO) * (perYear / 12);
  return round1(accrued + (employee.leaveCarryOver ?? 0));
}

/** Annual leave days already approved for an employee (all time). */
export function takenLeaveDays(employeeId: string, requests: LeaveRequest[]): number {
  return round1(
    requests
      .filter(r => r.employeeId === employeeId && r.type === 'annual' && r.status === 'approved')
      .reduce((sum, r) => sum + (r.days || 0), 0),
  );
}

export interface LeaveBalance {
  accrued: number;
  taken: number;
  remaining: number;
}

/** Accrued vs. taken annual leave for one employee. */
export function leaveBalance(
  employee: Employee,
  requests: LeaveRequest[],
  asOfISO: string,
): LeaveBalance {
  const accrued = accruedLeaveDays(employee, asOfISO);
  const taken = takenLeaveDays(employee.id, requests);
  return { accrued, taken, remaining: round1(accrued - taken) };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
