import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, CalendarDays } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { getEmployees, employeeName } from '@/services/employee.service';
import {
  getLeaveRequests, createLeaveRequest, updateLeaveRequest, deleteLeaveRequest,
} from '@/services/hr.service';
import { todayISO } from '@/utils/dates';
import { workingDaysBetween, leaveBalance, monthKey } from '@/utils/leave';
import type { Employee, LeaveRequest, LeaveType, RequestStatus } from '@/types';
import {
  INPUT_CLS, FILTER_CLS, PRIMARY_BTN, Field, EmployeeSelect, EmptyState, Loading,
  ErrorNote, StatusBadge, resolveName, fmtDate,
} from './shared';

const TYPE_LABEL: Record<LeaveType, string> = {
  annual: 'Annual', sick: 'Sick', unpaid: 'Unpaid', special: 'Special',
};
const TYPE_HINT: Record<LeaveType, string> = {
  annual: 'Counts against the accrued balance',
  sick: 'Does not touch the annual balance',
  unpaid: 'Does not touch the annual balance',
  special: 'Marriage, birth, bereavement…',
};

interface FormState {
  employeeId: string; type: LeaveType; startDate: string; endDate: string;
  days: string; status: RequestStatus; reason: string;
}

const emptyForm = (): FormState => ({
  employeeId: '', type: 'annual', startDate: todayISO(), endDate: todayISO(),
  days: '1', status: 'pending', reason: '',
});

function LeaveModal({ initial, employees, requests, onSave, onClose }: {
  initial?: LeaveRequest;
  employees: Employee[];
  requests: LeaveRequest[];
  onSave: (data: Omit<LeaveRequest, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial ? {
    employeeId: initial.employeeId, type: initial.type,
    startDate: initial.startDate, endDate: initial.endDate,
    days: String(initial.days), status: initial.status, reason: initial.reason ?? '',
  } : emptyForm());
  const [daysTouched, setDaysTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  // Re-derive the day count from the dates until the user overrides it by hand.
  const setDates = (patch: Partial<FormState>) => {
    setForm(f => {
      const next = { ...f, ...patch };
      if (!daysTouched) next.days = String(workingDaysBetween(next.startDate, next.endDate));
      return next;
    });
  };

  const employee = employees.find(e => e.id === form.employeeId);
  const balance = employee ? leaveBalance(employee, requests.filter(r => r.id !== initial?.id), todayISO()) : null;
  const requested = Number(form.days) || 0;
  const overdrawn = !!balance && form.type === 'annual' && requested > balance.remaining;

  const save = async () => {
    if (!employee) { setError('Select an employee.'); return; }
    if (!form.startDate || !form.endDate) { setError('Start and end dates are required.'); return; }
    if (form.endDate < form.startDate) { setError('The end date cannot be before the start date.'); return; }
    if (requested <= 0) { setError('Days must be greater than zero.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        employeeId: employee.id,
        employeeName: employeeName(employee),
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        days: requested,
        status: form.status,
        reason: form.reason.trim() || undefined,
        decidedAt: initial?.decidedAt,
        decidedBy: initial?.decidedBy,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit Leave' : 'New Leave Request'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Employee" required>
          <EmployeeSelect employees={employees} value={form.employeeId} onChange={id => set({ employeeId: id })} />
        </Field>

        {balance && (
          <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            <CalendarDays size={14} className="text-slate-400" />
            <span className="text-slate-500">Annual balance:</span>
            <strong className="text-slate-700">{balance.remaining} d</strong>
            <span className="text-xs text-slate-400">({balance.accrued} accrued − {balance.taken} taken)</span>
          </div>
        )}

        <Field label="Type" hint={TYPE_HINT[form.type]}>
          <select value={form.type} onChange={e => set({ type: e.target.value as LeaveType })} className={INPUT_CLS}>
            {(Object.keys(TYPE_LABEL) as LeaveType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="From" required>
            <input type="date" value={form.startDate} onChange={e => setDates({ startDate: e.target.value })} className={INPUT_CLS} />
          </Field>
          <Field label="To" required>
            <input type="date" value={form.endDate} onChange={e => setDates({ endDate: e.target.value })} className={INPUT_CLS} />
          </Field>
          <Field label="Days" required hint="Sundays excluded">
            <input type="number" min="0" step="0.5" value={form.days}
              onChange={e => { setDaysTouched(true); set({ days: e.target.value }); }} className={INPUT_CLS} />
          </Field>
        </div>

        {overdrawn && (
          <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            This exceeds the accrued balance by {Math.round((requested - (balance?.remaining ?? 0)) * 10) / 10} day(s). You can still record it.
          </div>
        )}

        <Field label="Status">
          <select value={form.status} onChange={e => set({ status: e.target.value as RequestStatus })} className={INPUT_CLS}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>

        <Field label="Reason">
          <textarea value={form.reason} onChange={e => set({ reason: e.target.value })} rows={2} className={`${INPUT_CLS} resize-none`} />
        </Field>

        {error && <ErrorNote message={error} />}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button onClick={save} disabled={saving} className={PRIMARY_BTN}>
            {saving ? <><span className="animate-spin inline-block">↻</span> Saving…</> : <><Plus size={14} /> {initial ? 'Save Changes' : 'Add Request'}</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Leave() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | RequestStatus>('');
  const [typeFilter, setTypeFilter] = useState<'' | LeaveType>('');
  const [month, setMonth] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LeaveRequest | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rows, emps] = await Promise.all([getLeaveRequests(), getEmployees()]);
      setRequests(rows); setEmployees(emps);
    } catch (e) {
      console.error('Failed to load leave requests:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Omit<LeaveRequest, 'id' | 'createdAt'>) => {
    if (editing) await updateLeaveRequest(editing.id, data);
    else await createLeaveRequest(data);
    await load();
  };

  const decide = async (r: LeaveRequest, status: RequestStatus) => {
    await updateLeaveRequest(r.id, {
      status,
      decidedAt: new Date().toISOString(),
      decidedBy: user?.email ?? undefined,
    });
    await load();
  };

  const handleDelete = async (r: LeaveRequest) => {
    if (!confirm(`Delete the ${fmtDate(r.startDate)} leave for ${r.employeeName}?`)) return;
    await deleteLeaveRequest(r.id);
    await load();
  };

  const filtered = useMemo(() => requests.filter(r => {
    if (employeeFilter && r.employeeId !== employeeFilter) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (typeFilter && r.type !== typeFilter) return false;
    if (month && monthKey(r.startDate) !== month) return false;
    return true;
  }), [requests, employeeFilter, statusFilter, typeFilter, month]);

  const pending = requests.filter(r => r.status === 'pending').length;

  // Balance strip: the filtered employee alone, otherwise everyone active.
  const balanceRows = useMemo(() => {
    const pool = employeeFilter
      ? employees.filter(e => e.id === employeeFilter)
      : employees.filter(e => e.status === 'active');
    return pool.map(e => ({ employee: e, balance: leaveBalance(e, requests, todayISO()) }));
  }, [employees, requests, employeeFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span><strong className="text-slate-700">{filtered.length}</strong> request{filtered.length !== 1 ? 's' : ''}</span>
          {pending > 0 && <><span>·</span><span className="text-amber-600 font-semibold">{pending} pending</span></>}
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className={PRIMARY_BTN}>
          <Plus size={16} /> New Request
        </button>
      </div>

      {balanceRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {balanceRows.map(({ employee, balance }) => (
            <div key={employee.id} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-semibold text-slate-600 truncate">
                {`${employee.firstName} ${employee.lastName}`.trim()}
              </p>
              <p className="text-lg font-bold text-emerald-600 leading-tight">{balance.remaining} <span className="text-xs font-medium text-slate-400">days left</span></p>
              <p className="text-[11px] text-slate-400">{balance.accrued} accrued · {balance.taken} taken</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <EmployeeSelect employees={employees} value={employeeFilter} onChange={setEmployeeFilter} allLabel="All employees" className={FILTER_CLS} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className={FILTER_CLS}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)} className={FILTER_CLS}>
          <option value="">All types</option>
          {(Object.keys(TYPE_LABEL) as LeaveType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={FILTER_CLS} />
        {(employeeFilter || statusFilter || typeFilter || month) && (
          <button onClick={() => { setEmployeeFilter(''); setStatusFilter(''); setTypeFilter(''); setMonth(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline">Clear filters</button>
        )}
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No leave requests"
          hint={requests.length === 0 ? 'Record the first request to start tracking balances.' : 'No requests match these filters.'} />
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="min-w-[160px] flex-1">
                <p className="font-bold text-slate-800 text-sm">{resolveName(employees, r)}</p>
                <p className="text-xs text-slate-400">
                  {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
                  {r.decidedBy && r.status !== 'pending' && ` · by ${r.decidedBy}`}
                </p>
              </div>
              <Badge label={TYPE_LABEL[r.type]} variant={r.type === 'annual' ? 'blue' : 'gray'} />
              <span className="text-sm font-bold text-slate-700 w-16">{r.days} d</span>
              <StatusBadge status={r.status} />
              {r.reason && <span className="text-xs text-slate-400 max-w-[200px] truncate">{r.reason}</span>}
              <div className="flex items-center gap-1 ml-auto">
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => decide(r, 'approved')} title="Approve"
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><Check size={15} /></button>
                    <button onClick={() => decide(r, 'rejected')} title="Reject"
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><X size={15} /></button>
                  </>
                )}
                <button onClick={() => { setEditing(r); setShowModal(true); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <LeaveModal initial={editing ?? undefined} employees={employees} requests={requests}
          onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); }} />
      )}
    </div>
  );
}
