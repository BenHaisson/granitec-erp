import { type ReactNode, type ElementType } from 'react';
import Badge from '@/components/ui/Badge';
import type { Employee, RequestStatus, AdvanceStatus } from '@/types';

// Shared styling + small building blocks for the Personnel tabs.
export const INPUT_CLS =
  'w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400';
export const FILTER_CLS =
  'px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400';
export const PRIMARY_BTN =
  'flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 disabled:opacity-50';

const STATUS_VARIANT: Record<RequestStatus | AdvanceStatus, 'green' | 'yellow' | 'red' | 'blue' | 'gray'> = {
  pending:   'yellow',
  approved:  'green',
  rejected:  'red',
  cancelled: 'gray',
  open:      'blue',
  settled:   'green',
};

const STATUS_LABEL: Record<RequestStatus | AdvanceStatus, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
  cancelled: 'Cancelled', open: 'Open', settled: 'Settled',
};

export function StatusBadge({ status }: { status: RequestStatus | AdvanceStatus }) {
  return <Badge label={STATUS_LABEL[status]} variant={STATUS_VARIANT[status]} />;
}

/** "Firstname Lastname" — resolved live from the directory, falling back to
 *  the snapshot stored on the record (the employee may have been deleted). */
export function resolveName(
  employees: Employee[],
  record: { employeeId: string; employeeName: string },
): string {
  const live = employees.find(e => e.id === record.employeeId);
  return live ? `${live.firstName} ${live.lastName}`.trim() : record.employeeName;
}

export function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export function EmployeeSelect({ employees, value, onChange, allLabel, className }: {
  employees: Employee[];
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;              // when set, renders an "all employees" option
  className?: string;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={className ?? INPUT_CLS}>
      {allLabel !== undefined
        ? <option value="">{allLabel}</option>
        : <option value="">Select an employee…</option>}
      {employees.map(e => (
        <option key={e.id} value={e.id}>
          {`${e.firstName} ${e.lastName}`.trim()}{e.position ? ` — ${e.position}` : ''}
        </option>
      ))}
    </select>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }: {
  icon: ElementType; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-slate-300" />
      </div>
      <h3 className="text-slate-600 font-semibold">{title}</h3>
      {hint && <p className="text-slate-400 text-sm mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <span className="animate-spin mr-2">↻</span> Loading…
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
      {message}
    </div>
  );
}

/** Formats YYYY-MM-DD for display, fr-FR style. */
export function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export const fmtAmount = (n: number): string => n.toLocaleString('fr-FR');

/** "rest_day" → "Rest day" — for enum values rendered inline. */
export const titleCase = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
