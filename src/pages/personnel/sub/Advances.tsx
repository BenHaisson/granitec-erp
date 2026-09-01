import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Paperclip, Wallet, FileUp, X, CheckCircle2, RotateCcw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { openAttachment } from '@/lib/r2Storage';
import { getEmployees, employeeName } from '@/services/employee.service';
import {
  getAdvances, createAdvance, updateAdvance, deleteAdvance, uploadAdvanceDocument,
} from '@/services/hr.service';
import { todayISO } from '@/utils/dates';
import { monthKey, monthLabel } from '@/utils/leave';
import type { AdvancePayment, AdvanceStatus, Employee, PaymentMethod } from '@/types';
import {
  INPUT_CLS, FILTER_CLS, PRIMARY_BTN, Field, EmployeeSelect, EmptyState, Loading,
  ErrorNote, StatusBadge, resolveName, fmtDate, fmtAmount,
} from './shared';

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash', transfer: 'Transfer', cheque: 'Cheque',
};
const CURRENCIES = ['MAD', 'EUR', 'USD'];

interface FormState {
  employeeId: string; date: string; amount: string; currency: string;
  method: PaymentMethod; deductMonth: string; status: AdvanceStatus;
  settledDate: string; reason: string;
}

const emptyForm = (): FormState => ({
  employeeId: '', date: todayISO(), amount: '', currency: 'MAD',
  method: 'cash', deductMonth: monthKey(todayISO()), status: 'open',
  settledDate: '', reason: '',
});

function AdvanceModal({ initial, employees, onSave, onClose }: {
  initial?: AdvancePayment;
  employees: Employee[];
  onSave: (data: Omit<AdvancePayment, 'id' | 'createdAt'>, file: File | null) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial ? {
    employeeId: initial.employeeId, date: initial.date, amount: String(initial.amount),
    currency: initial.currency, method: initial.method ?? 'cash',
    deductMonth: initial.deductMonth, status: initial.status,
    settledDate: initial.settledDate ?? '', reason: initial.reason ?? '',
  } : emptyForm());
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const save = async () => {
    const employee = employees.find(e => e.id === form.employeeId);
    if (!employee) { setError('Select an employee.'); return; }
    if (!form.date) { setError('Date is required.'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError('Enter the advance amount.'); return; }
    if (!form.deductMonth) { setError('Choose the month this advance comes off.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        employeeId: employee.id,
        employeeName: employeeName(employee),
        date: form.date,
        amount: Number(form.amount),
        currency: form.currency,
        method: form.method,
        deductMonth: form.deductMonth,
        status: form.status,
        settledDate: form.status === 'settled' ? (form.settledDate || todayISO()) : undefined,
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
    <Modal title={initial ? 'Edit Advance' : 'Record Advance'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Employee" required>
          <EmployeeSelect employees={employees} value={form.employeeId} onChange={id => set({ employeeId: id })} />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Paid On" required>
            <input type="date" value={form.date} onChange={e => set({ date: e.target.value })} className={INPUT_CLS} />
          </Field>
          <Field label="Amount" required>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set({ amount: e.target.value })} className={INPUT_CLS} placeholder="e.g. 1500" />
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={e => set({ currency: e.target.value })} className={INPUT_CLS}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Method">
            <select value={form.method} onChange={e => set({ method: e.target.value as PaymentMethod })} className={INPUT_CLS}>
              {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </Field>
          <Field label="Deduct From" required hint="The month's pay this comes off">
            <input type="month" value={form.deductMonth} onChange={e => set({ deductMonth: e.target.value })} className={INPUT_CLS} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select value={form.status} onChange={e => set({ status: e.target.value as AdvanceStatus })} className={INPUT_CLS}>
              <option value="open">Open — not yet deducted</option>
              <option value="settled">Settled — deducted</option>
            </select>
          </Field>
          {form.status === 'settled' && (
            <Field label="Settled On">
              <input type="date" value={form.settledDate} onChange={e => set({ settledDate: e.target.value })} className={INPUT_CLS} />
            </Field>
          )}
        </div>

        <Field label="Reason">
          <textarea value={form.reason} onChange={e => set({ reason: e.target.value })} rows={2} className={`${INPUT_CLS} resize-none`} placeholder="e.g. family emergency" />
        </Field>

        <Field label="Signed Receipt" hint="Scan or photo of the signed acknowledgement">
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
            {saving ? <><span className="animate-spin inline-block">↻</span> Saving…</> : <><Plus size={14} /> {initial ? 'Save Changes' : 'Record Advance'}</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Advances() {
  const [advances, setAdvances] = useState<AdvancePayment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | AdvanceStatus>('');
  const [deductMonth, setDeductMonth] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdvancePayment | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rows, emps] = await Promise.all([getAdvances(), getEmployees()]);
      setAdvances(rows); setEmployees(emps);
    } catch (e) {
      console.error('Failed to load advances:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Omit<AdvancePayment, 'id' | 'createdAt'>, file: File | null) => {
    let payload = data;
    if (file) {
      const att = await uploadAdvanceDocument(file);
      payload = {
        ...data,
        documentKey: att.objectKey,
        documentName: att.originalName,
        storageProvider: 'r2',
        documentUrl: undefined,
      };
    }
    if (editing) await updateAdvance(editing.id, payload);
    else await createAdvance(payload);
    await load();
  };

  const toggleSettled = async (a: AdvancePayment) => {
    await updateAdvance(a.id, a.status === 'open'
      ? { status: 'settled', settledDate: todayISO() }
      : { status: 'open', settledDate: undefined });
    await load();
  };

  const handleDelete = async (a: AdvancePayment) => {
    if (!confirm(`Delete the ${fmtAmount(a.amount)} ${a.currency} advance for ${a.employeeName}?`)) return;
    await deleteAdvance(a);
    await load();
  };

  const filtered = useMemo(() => {
    const rows = advances.filter(a => {
      if (employeeFilter && a.employeeId !== employeeFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (deductMonth && a.deductMonth !== deductMonth) return false;
      return true;
    });
    // Open advances first — they are the ones still owed.
    return rows.sort((x, y) => (x.status === y.status ? 0 : x.status === 'open' ? -1 : 1));
  }, [advances, employeeFilter, statusFilter, deductMonth]);

  const outstandingByCurrency = filtered
    .filter(a => a.status === 'open')
    .reduce<Record<string, number>>((acc, a) => {
      acc[a.currency] = (acc[a.currency] ?? 0) + a.amount;
      return acc;
    }, {});
  const outstandingLabel = Object.entries(outstandingByCurrency)
    .map(([cur, amt]) => `${fmtAmount(amt)} ${cur}`)
    .join(' · ');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span><strong className="text-slate-700">{filtered.length}</strong> advance{filtered.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span className="text-violet-600 font-semibold">{outstandingLabel || '0 MAD'} outstanding</span>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className={PRIMARY_BTN}>
          <Plus size={16} /> Record Advance
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <EmployeeSelect employees={employees} value={employeeFilter} onChange={setEmployeeFilter} allLabel="All employees" className={FILTER_CLS} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className={FILTER_CLS}>
          <option value="">Open & settled</option>
          <option value="open">Open only</option>
          <option value="settled">Settled only</option>
        </select>
        <input type="month" value={deductMonth} onChange={e => setDeductMonth(e.target.value)} className={FILTER_CLS} title="Deduction month" />
        {(employeeFilter || statusFilter || deductMonth) && (
          <button onClick={() => { setEmployeeFilter(''); setStatusFilter(''); setDeductMonth(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline">Clear filters</button>
        )}
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState icon={Wallet} title="No advances"
          hint={advances.length === 0 ? 'Record an advance when one is paid out.' : 'No advances match these filters.'} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-left text-[11px] uppercase tracking-widest">
                  <th className="px-4 py-3 font-bold">Paid On</th>
                  <th className="px-4 py-3 font-bold">Employee</th>
                  <th className="px-4 py-3 font-bold text-right">Amount</th>
                  <th className="px-4 py-3 font-bold">Method</th>
                  <th className="px-4 py-3 font-bold">Deduct From</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Reason</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{fmtDate(a.date)}</td>
                    <td className="px-4 py-3 text-slate-700">{resolveName(employees, a)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                      {fmtAmount(a.amount)} <span className="text-xs font-normal text-slate-400">{a.currency}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{a.method ? METHOD_LABEL[a.method] : '—'}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{monthLabel(a.deductMonth)}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{a.reason || '—'}</span>
                        {(a.documentKey || a.documentUrl) && (
                          <button onClick={() => openAttachment(a)} title={a.documentName ?? 'Open receipt'}
                            className="text-indigo-500 hover:text-indigo-700 shrink-0"><Paperclip size={13} /></button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggleSettled(a)}
                          title={a.status === 'open' ? 'Mark settled' : 'Reopen'}
                          className={`p-1.5 rounded-lg ${a.status === 'open' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                          {a.status === 'open' ? <CheckCircle2 size={15} /> : <RotateCcw size={15} />}
                        </button>
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
        <AdvanceModal initial={editing ?? undefined} employees={employees}
          onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); }} />
      )}
    </div>
  );
}
