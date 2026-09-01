import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Paperclip, CalendarOff, FileUp, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { openAttachment } from '@/lib/r2Storage';
import { getEmployees, employeeName } from '@/services/employee.service';
import {
  getAbsences, createAbsence, updateAbsence, deleteAbsence, uploadAbsenceDocument,
} from '@/services/hr.service';
import { todayISO } from '@/utils/dates';
import { monthKey } from '@/utils/leave';
import type { Absence, AbsenceType, AbsenceDuration, Employee } from '@/types';
import {
  INPUT_CLS, FILTER_CLS, PRIMARY_BTN, Field, EmployeeSelect, EmptyState, Loading,
  ErrorNote, resolveName, fmtDate,
} from './shared';

const TYPE_LABEL: Record<AbsenceType, string> = {
  absence: 'Absence', sick: 'Sick', late: 'Late', unpaid: 'Unpaid',
};
const TYPE_VARIANT: Record<AbsenceType, 'gray' | 'blue' | 'yellow' | 'red'> = {
  absence: 'gray', sick: 'blue', late: 'yellow', unpaid: 'red',
};
const DURATION_LABEL: Record<AbsenceDuration, string> = {
  full: 'Full day', half: 'Half day', hours: 'Hours',
};

/** Days an absence costs — used by the header total and the monthly summary. */
export const absenceDays = (a: Absence): number =>
  a.duration === 'full' ? 1 : a.duration === 'half' ? 0.5 : 0;

interface FormState {
  employeeId: string; date: string; type: AbsenceType; duration: AbsenceDuration;
  hours: string; justified: boolean; reason: string;
}

const emptyForm = (): FormState => ({
  employeeId: '', date: todayISO(), type: 'absence', duration: 'full',
  hours: '', justified: false, reason: '',
});

function AbsenceModal({ initial, employees, onSave, onClose }: {
  initial?: Absence;
  employees: Employee[];
  onSave: (data: Omit<Absence, 'id' | 'createdAt'>, file: File | null) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial ? {
    employeeId: initial.employeeId, date: initial.date, type: initial.type,
    duration: initial.duration, hours: initial.hours != null ? String(initial.hours) : '',
    justified: initial.justified, reason: initial.reason ?? '',
  } : emptyForm());
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const save = async () => {
    const employee = employees.find(e => e.id === form.employeeId);
    if (!employee) { setError('Select an employee.'); return; }
    if (!form.date) { setError('Date is required.'); return; }
    if (form.duration === 'hours' && !form.hours) { setError('Enter the number of hours.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        employeeId: employee.id,
        employeeName: employeeName(employee),
        date: form.date,
        type: form.type,
        duration: form.duration,
        hours: form.duration === 'hours' ? Number(form.hours) : undefined,
        justified: form.justified,
        reason: form.reason.trim() || undefined,
        documentUrl: initial?.documentUrl,
        documentName: initial?.documentName,
        documentKey: initial?.documentKey,
        storageProvider: initial?.storageProvider,
      }, file);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit Absence' : 'Log Absence'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Employee" required>
          <EmployeeSelect employees={employees} value={form.employeeId} onChange={id => set({ employeeId: id })} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <input type="date" value={form.date} onChange={e => set({ date: e.target.value })} className={INPUT_CLS} />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={e => set({ type: e.target.value as AbsenceType })} className={INPUT_CLS}>
              {(Object.keys(TYPE_LABEL) as AbsenceType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration">
            <select value={form.duration} onChange={e => set({ duration: e.target.value as AbsenceDuration })} className={INPUT_CLS}>
              {(Object.keys(DURATION_LABEL) as AbsenceDuration[]).map(d => <option key={d} value={d}>{DURATION_LABEL[d]}</option>)}
            </select>
          </Field>
          {form.duration === 'hours' && (
            <Field label="Hours" required>
              <input type="number" min="0" step="0.5" value={form.hours} onChange={e => set({ hours: e.target.value })} className={INPUT_CLS} placeholder="e.g. 2" />
            </Field>
          )}
        </div>

        <label className="flex items-center gap-2.5 px-3 py-2.5 border-2 border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
          <input type="checkbox" checked={form.justified} onChange={e => set({ justified: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
          <span className="text-sm text-slate-700 font-medium">Justified</span>
          <span className="text-xs text-slate-400">— a certificate or accepted reason exists</span>
        </label>

        <Field label="Reason">
          <textarea value={form.reason} onChange={e => set({ reason: e.target.value })} rows={2} className={`${INPUT_CLS} resize-none`} placeholder="e.g. medical appointment" />
        </Field>

        <Field label="Justification Document" hint="Medical certificate, written excuse…">
          {initial?.documentName && !file && (
            <div className="flex items-center gap-2 mb-2 text-sm text-slate-600">
              <Paperclip size={13} className="text-slate-400" />
              <button type="button" onClick={() => openAttachment(initial)} className="hover:underline truncate">{initial.documentName}</button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-500 cursor-pointer hover:border-indigo-300 hover:text-indigo-600">
              <FileUp size={14} /> {file ? file.name : 'Choose a file'}
              <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {file && <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>}
          </div>
        </Field>

        {error && <ErrorNote message={error} />}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button onClick={save} disabled={saving} className={PRIMARY_BTN}>
            {saving ? <><span className="animate-spin inline-block">↻</span> Saving…</> : <><Plus size={14} /> {initial ? 'Save Changes' : 'Log Absence'}</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Absences() {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | AbsenceType>('');
  const [justifiedFilter, setJustifiedFilter] = useState<'' | 'yes' | 'no'>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Absence | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rows, emps] = await Promise.all([getAbsences(), getEmployees()]);
      setAbsences(rows); setEmployees(emps);
    } catch (e) {
      console.error('Failed to load absences:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Omit<Absence, 'id' | 'createdAt'>, file: File | null) => {
    let payload = data;
    if (file) {
      const att = await uploadAbsenceDocument(file);
      payload = {
        ...data,
        documentKey: att.objectKey,
        documentName: att.originalName,
        storageProvider: 'r2',
        documentUrl: undefined,
      };
    }
    if (editing) await updateAbsence(editing.id, payload);
    else await createAbsence(payload);
    await load();
  };

  const handleDelete = async (a: Absence) => {
    if (!confirm(`Delete the ${fmtDate(a.date)} absence for ${a.employeeName}?`)) return;
    await deleteAbsence(a);
    await load();
  };

  const filtered = useMemo(() => absences.filter(a => {
    if (month && monthKey(a.date) !== month) return false;
    if (employeeFilter && a.employeeId !== employeeFilter) return false;
    if (typeFilter && a.type !== typeFilter) return false;
    if (justifiedFilter === 'yes' && !a.justified) return false;
    if (justifiedFilter === 'no' && a.justified) return false;
    return true;
  }), [absences, month, employeeFilter, typeFilter, justifiedFilter]);

  const totalDays = filtered.reduce((s, a) => s + absenceDays(a), 0);
  const totalHours = filtered.reduce((s, a) => s + (a.duration === 'hours' ? (a.hours ?? 0) : 0), 0);
  const unjustified = filtered.filter(a => !a.justified).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span><strong className="text-slate-700">{filtered.length}</strong> record{filtered.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span><strong className="text-slate-700">{totalDays}</strong> day{totalDays !== 1 ? 's' : ''}{totalHours > 0 ? ` + ${totalHours} h` : ''}</span>
          <span>·</span>
          <span className={unjustified > 0 ? 'text-red-600 font-semibold' : ''}>{unjustified} unjustified</span>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className={PRIMARY_BTN}>
          <Plus size={16} /> Log Absence
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={FILTER_CLS} />
        <EmployeeSelect employees={employees} value={employeeFilter} onChange={setEmployeeFilter} allLabel="All employees" className={FILTER_CLS} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)} className={FILTER_CLS}>
          <option value="">All types</option>
          {(Object.keys(TYPE_LABEL) as AbsenceType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <select value={justifiedFilter} onChange={e => setJustifiedFilter(e.target.value as typeof justifiedFilter)} className={FILTER_CLS}>
          <option value="">Justified & not</option>
          <option value="yes">Justified only</option>
          <option value="no">Unjustified only</option>
        </select>
        {(month || employeeFilter || typeFilter || justifiedFilter) && (
          <button onClick={() => { setMonth(''); setEmployeeFilter(''); setTypeFilter(''); setJustifiedFilter(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline">Clear filters</button>
        )}
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState icon={CalendarOff} title="No absences here"
          hint={absences.length === 0 ? 'Nothing logged yet.' : 'No records match these filters.'} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-left text-[11px] uppercase tracking-widest">
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Employee</th>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Duration</th>
                  <th className="px-4 py-3 font-bold">Justified</th>
                  <th className="px-4 py-3 font-bold">Reason</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{fmtDate(a.date)}</td>
                    <td className="px-4 py-3 text-slate-700">{resolveName(employees, a)}</td>
                    <td className="px-4 py-3"><Badge label={TYPE_LABEL[a.type]} variant={TYPE_VARIANT[a.type]} /></td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {a.duration === 'hours' ? `${a.hours ?? 0} h` : DURATION_LABEL[a.duration]}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={a.justified ? 'Yes' : 'No'} variant={a.justified ? 'green' : 'red'} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{a.reason || '—'}</span>
                        {(a.documentKey || a.documentUrl) && (
                          <button onClick={() => openAttachment(a)} title={a.documentName ?? 'Open document'}
                            className="text-indigo-500 hover:text-indigo-700 shrink-0"><Paperclip size={13} /></button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(a); setShowModal(true); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(a)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
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
        <AbsenceModal initial={editing ?? undefined} employees={employees}
          onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); }} />
      )}
    </div>
  );
}
