import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Clock } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { getEmployees, employeeName } from '@/services/employee.service';
import {
  getOvertimeEntries, createOvertimeEntry, updateOvertimeEntry, deleteOvertimeEntry,
} from '@/services/hr.service';
import { todayISO } from '@/utils/dates';
import { monthKey } from '@/utils/leave';
import type { Employee, OvertimeEntry, OvertimePeriod, RequestStatus } from '@/types';
import {
  INPUT_CLS, FILTER_CLS, PRIMARY_BTN, Field, EmployeeSelect, EmptyState, Loading,
  ErrorNote, StatusBadge, resolveName, fmtDate,
} from './shared';

const PERIOD_LABEL: Record<OvertimePeriod, string> = {
  day: 'Daytime', night: 'Night', rest_day: 'Rest day', holiday: 'Public holiday',
};

interface FormState {
  employeeId: string; date: string; hours: string;
  period: OvertimePeriod; status: RequestStatus; note: string;
}

const emptyForm = (): FormState => ({
  employeeId: '', date: todayISO(), hours: '', period: 'day', status: 'pending', note: '',
});

function OvertimeModal({ initial, employees, onSave, onClose }: {
  initial?: OvertimeEntry;
  employees: Employee[];
  onSave: (data: Omit<OvertimeEntry, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial ? {
    employeeId: initial.employeeId, date: initial.date, hours: String(initial.hours),
    period: initial.period ?? 'day', status: initial.status, note: initial.note ?? '',
  } : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const save = async () => {
    const employee = employees.find(e => e.id === form.employeeId);
    if (!employee) { setError('Select an employee.'); return; }
    if (!form.date) { setError('Date is required.'); return; }
    if (!form.hours || Number(form.hours) <= 0) { setError('Enter the hours worked.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        employeeId: employee.id,
        employeeName: employeeName(employee),
        date: form.date,
        hours: Number(form.hours),
        period: form.period,
        status: form.status,
        note: form.note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit Overtime' : 'Log Overtime'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Employee" required>
          <EmployeeSelect employees={employees} value={form.employeeId} onChange={id => set({ employeeId: id })} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <input type="date" value={form.date} onChange={e => set({ date: e.target.value })} className={INPUT_CLS} />
          </Field>
          <Field label="Hours" required>
            <input type="number" min="0" step="0.5" value={form.hours} onChange={e => set({ hours: e.target.value })} className={INPUT_CLS} placeholder="e.g. 2.5" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Period" hint="Recorded for context — no pay rates here">
            <select value={form.period} onChange={e => set({ period: e.target.value as OvertimePeriod })} className={INPUT_CLS}>
              {(Object.keys(PERIOD_LABEL) as OvertimePeriod[]).map(p => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => set({ status: e.target.value as RequestStatus })} className={INPUT_CLS}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        </div>

        <Field label="Note">
          <textarea value={form.note} onChange={e => set({ note: e.target.value })} rows={2} className={`${INPUT_CLS} resize-none`} placeholder="e.g. urgent order finishing" />
        </Field>

        {error && <ErrorNote message={error} />}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button onClick={save} disabled={saving} className={PRIMARY_BTN}>
            {saving ? <><span className="animate-spin inline-block">↻</span> Saving…</> : <><Plus size={14} /> {initial ? 'Save Changes' : 'Log Overtime'}</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Overtime() {
  const [entries, setEntries] = useState<OvertimeEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | RequestStatus>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<OvertimeEntry | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rows, emps] = await Promise.all([getOvertimeEntries(), getEmployees()]);
      setEntries(rows); setEmployees(emps);
    } catch (e) {
      console.error('Failed to load overtime:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Omit<OvertimeEntry, 'id' | 'createdAt'>) => {
    if (editing) await updateOvertimeEntry(editing.id, data);
    else await createOvertimeEntry(data);
    await load();
  };

  const decide = async (o: OvertimeEntry, status: RequestStatus) => {
    await updateOvertimeEntry(o.id, { status });
    await load();
  };

  const handleDelete = async (o: OvertimeEntry) => {
    if (!confirm(`Delete the ${fmtDate(o.date)} overtime for ${o.employeeName}?`)) return;
    await deleteOvertimeEntry(o.id);
    await load();
  };

  const filtered = useMemo(() => entries.filter(o => {
    if (month && monthKey(o.date) !== month) return false;
    if (employeeFilter && o.employeeId !== employeeFilter) return false;
    if (statusFilter && o.status !== statusFilter) return false;
    return true;
  }), [entries, month, employeeFilter, statusFilter]);

  const approvedHours = filtered.filter(o => o.status === 'approved').reduce((s, o) => s + o.hours, 0);
  const pendingHours = filtered.filter(o => o.status === 'pending').reduce((s, o) => s + o.hours, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span><strong className="text-slate-700">{approvedHours}</strong> h approved</span>
          {pendingHours > 0 && <><span>·</span><span className="text-amber-600 font-semibold">{pendingHours} h pending</span></>}
          <span>·</span>
          <span>{filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}</span>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className={PRIMARY_BTN}>
          <Plus size={16} /> Log Overtime
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={FILTER_CLS} />
        <EmployeeSelect employees={employees} value={employeeFilter} onChange={setEmployeeFilter} allLabel="All employees" className={FILTER_CLS} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className={FILTER_CLS}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {(month || employeeFilter || statusFilter) && (
          <button onClick={() => { setMonth(''); setEmployeeFilter(''); setStatusFilter(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline">Clear filters</button>
        )}
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState icon={Clock} title="No overtime logged"
          hint={entries.length === 0 ? 'Log extra hours as they happen.' : 'No entries match these filters.'} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-left text-[11px] uppercase tracking-widest">
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Employee</th>
                  <th className="px-4 py-3 font-bold text-right">Hours</th>
                  <th className="px-4 py-3 font-bold">Period</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Note</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{fmtDate(o.date)}</td>
                    <td className="px-4 py-3 text-slate-700">{resolveName(employees, o)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{o.hours} h</td>
                    <td className="px-4 py-3 text-slate-500">{o.period ? PERIOD_LABEL[o.period] : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{o.note || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {o.status === 'pending' && (
                          <>
                            <button onClick={() => decide(o, 'approved')} title="Approve" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><Check size={15} /></button>
                            <button onClick={() => decide(o, 'rejected')} title="Reject" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><X size={15} /></button>
                          </>
                        )}
                        <button onClick={() => { setEditing(o); setShowModal(true); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(o)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <OvertimeModal initial={editing ?? undefined} employees={employees}
          onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); }} />
      )}
    </div>
  );
}
