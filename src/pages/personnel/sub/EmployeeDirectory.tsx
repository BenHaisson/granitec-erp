import { useEffect, useState, type ReactNode } from 'react';
import {
  Plus, X, Pencil, Trash2, Search, Phone, MapPin, UserCog, UserPlus,
  CalendarDays, Clock, Wallet, CalendarOff, BadgeCheck,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import {
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
} from '@/services/employee.service';
import { getAbsences, getLeaveRequests, getOvertimeEntries, getAdvances } from '@/services/hr.service';
import { leaveBalance, monthLabel, DEFAULT_LEAVE_DAYS_PER_YEAR } from '@/utils/leave';
import { todayISO } from '@/utils/dates';
import type {
  Employee, PhoneContact, Absence, LeaveRequest, OvertimeEntry, AdvancePayment,
} from '@/types';
import {
  INPUT_CLS, FILTER_CLS, PRIMARY_BTN, Field, EmptyState, Loading, ErrorNote,
  StatusBadge, fmtDate, fmtAmount, titleCase, isDeducted,
} from './shared';

const CONTRACT_LABEL: Record<string, string> = {
  CDI: 'CDI', CDD: 'CDD', interim: 'Interim', trial: 'Trial period',
};
const STATUS_VARIANT: Record<Employee['status'], 'green' | 'yellow' | 'gray'> = {
  active: 'green', suspended: 'yellow', left: 'gray',
};
const STATUS_LABEL: Record<Employee['status'], string> = {
  active: 'Active', suspended: 'Suspended', left: 'Left',
};

interface FormState {
  firstName: string; lastName: string; matricule: string; cin: string; cnss: string;
  position: string; department: string; hireDate: string; endDate: string;
  contractType: string; status: Employee['status']; mainPhone: string;
  phones: PhoneContact[]; address: string; notes: string;
  leaveDaysPerYear: string; leaveCarryOver: string;
}

const emptyForm = (): FormState => ({
  firstName: '', lastName: '', matricule: '', cin: '', cnss: '',
  position: '', department: '', hireDate: todayISO(), endDate: '',
  contractType: 'CDI', status: 'active', mainPhone: '',
  phones: [], address: '', notes: '', leaveDaysPerYear: '', leaveCarryOver: '',
});

const toForm = (e: Employee): FormState => ({
  firstName: e.firstName, lastName: e.lastName,
  matricule: e.matricule ?? '', cin: e.cin ?? '', cnss: e.cnss ?? '',
  position: e.position ?? '', department: e.department ?? '',
  hireDate: e.hireDate, endDate: e.endDate ?? '',
  contractType: e.contractType ?? 'CDI', status: e.status,
  mainPhone: e.mainPhone ?? '', phones: e.phones ?? [],
  address: e.address ?? '', notes: e.notes ?? '',
  leaveDaysPerYear: e.leaveDaysPerYear != null ? String(e.leaveDaysPerYear) : '',
  leaveCarryOver: e.leaveCarryOver != null ? String(e.leaveCarryOver) : '',
});

// ── Add / edit modal ──────────────────────────────────────────────
function EmployeeModal({ initial, departments, onSave, onClose }: {
  initial?: Employee;
  departments: string[];
  onSave: (data: Omit<Employee, 'id'>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial ? toForm(initial) : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const addContact = () => {
    if (!contactPhone.trim()) return;
    set({ phones: [...form.phones, { name: contactName.trim(), phone: contactPhone.trim() }] });
    setContactName(''); setContactPhone('');
  };

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('First and last name are required.'); return; }
    if (!form.hireDate) { setError('Hire date is required — leave accrual is counted from it.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        matricule: form.matricule.trim() || undefined,
        cin: form.cin.trim() || undefined,
        cnss: form.cnss.trim() || undefined,
        position: form.position.trim() || undefined,
        department: form.department.trim() || undefined,
        hireDate: form.hireDate,
        endDate: form.status === 'left' ? (form.endDate || undefined) : undefined,
        contractType: (form.contractType || undefined) as Employee['contractType'],
        status: form.status,
        mainPhone: form.mainPhone.trim() || undefined,
        phones: form.phones.length > 0 ? form.phones : undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
        leaveDaysPerYear: form.leaveDaysPerYear ? Number(form.leaveDaysPerYear) : undefined,
        leaveCarryOver: form.leaveCarryOver ? Number(form.leaveCarryOver) : undefined,
      });
      onClose();
    } catch (err) {
      setError(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit Employee' : 'Add Employee'} onClose={onClose} className="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="First Name" required>
            <input value={form.firstName} onChange={e => set({ firstName: e.target.value })} autoFocus className={INPUT_CLS} placeholder="e.g. Youssef" />
          </Field>
          <Field label="Last Name" required>
            <input value={form.lastName} onChange={e => set({ lastName: e.target.value })} className={INPUT_CLS} placeholder="e.g. Benali" />
          </Field>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Staff No."><input value={form.matricule} onChange={e => set({ matricule: e.target.value })} className={INPUT_CLS} placeholder="e.g. 042" /></Field>
          <Field label="CIN"><input value={form.cin} onChange={e => set({ cin: e.target.value })} className={INPUT_CLS} /></Field>
          <Field label="CNSS"><input value={form.cnss} onChange={e => set({ cnss: e.target.value })} className={INPUT_CLS} /></Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Position"><input value={form.position} onChange={e => set({ position: e.target.value })} className={INPUT_CLS} placeholder="e.g. Press operator" /></Field>
          <Field label="Department">
            <input value={form.department} onChange={e => set({ department: e.target.value })} className={INPUT_CLS} list="personnel-departments" placeholder="e.g. Production" />
            <datalist id="personnel-departments">
              {departments.map(d => <option key={d} value={d} />)}
            </datalist>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Hire Date" required hint="Leave accrues from this date.">
            <input type="date" value={form.hireDate} onChange={e => set({ hireDate: e.target.value })} className={INPUT_CLS} />
          </Field>
          <Field label="Contract">
            <select value={form.contractType} onChange={e => set({ contractType: e.target.value })} className={INPUT_CLS}>
              {Object.entries(CONTRACT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => set({ status: e.target.value as Employee['status'] })} className={INPUT_CLS}>
              {(Object.keys(STATUS_LABEL) as Employee['status'][]).map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Field>
        </div>

        {form.status === 'left' && (
          <Field label="End Date">
            <input type="date" value={form.endDate} onChange={e => set({ endDate: e.target.value })} className={INPUT_CLS} />
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Main Phone">
            <input type="tel" value={form.mainPhone} onChange={e => set({ mainPhone: e.target.value })} className={INPUT_CLS} placeholder="+212 6xx xxx xxx" />
          </Field>
          <Field label="Leave Days / Year" hint={`Default ${DEFAULT_LEAVE_DAYS_PER_YEAR}`}>
            <input type="number" min="0" step="0.5" value={form.leaveDaysPerYear} onChange={e => set({ leaveDaysPerYear: e.target.value })} className={INPUT_CLS} placeholder={String(DEFAULT_LEAVE_DAYS_PER_YEAR)} />
          </Field>
          <Field label="Carry-Over Days" hint="Balance from before this system">
            <input type="number" step="0.5" value={form.leaveCarryOver} onChange={e => set({ leaveCarryOver: e.target.value })} className={INPUT_CLS} placeholder="0" />
          </Field>
        </div>

        <Field label="Additional Contacts">
          {form.phones.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {form.phones.map((c, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <UserPlus size={13} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-600 min-w-[80px]">{c.name || <em className="text-slate-400 font-normal">unnamed</em>}</span>
                  <span className="text-xs font-mono text-slate-700 flex-1">{c.phone}</span>
                  <button type="button" onClick={() => set({ phones: form.phones.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-red-500"><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Name (e.g. wife)" className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && addContact()} placeholder="Phone" className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button type="button" onClick={addContact} className="px-3 py-2 rounded-xl bg-indigo-100 text-indigo-700 font-bold hover:bg-indigo-200 shrink-0"><Plus size={14} /></button>
          </div>
        </Field>

        <Field label="Address">
          <textarea value={form.address} onChange={e => set({ address: e.target.value })} rows={2} className={`${INPUT_CLS} resize-none`} />
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={e => set({ notes: e.target.value })} rows={2} className={`${INPUT_CLS} resize-none`} placeholder="Skills, shift, anything worth remembering…" />
        </Field>

        {error && <ErrorNote message={error} />}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button onClick={save} disabled={saving} className={PRIMARY_BTN}>
            {saving ? <><span className="animate-spin inline-block">↻</span> Saving…</> : <><Plus size={14} /> {initial ? 'Save Changes' : 'Add Employee'}</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Profile panel ─────────────────────────────────────────────────
function ProfileModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [overtime, setOvertime] = useState<OvertimeEntry[]>([]);
  const [advances, setAdvances] = useState<AdvancePayment[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [a, l, o, adv] = await Promise.all([
          getAbsences(), getLeaveRequests(), getOvertimeEntries(), getAdvances(),
        ]);
        const mine = <T extends { employeeId: string }>(rows: T[]) => rows.filter(r => r.employeeId === employee.id);
        setAbsences(mine(a)); setLeave(mine(l)); setOvertime(mine(o)); setAdvances(mine(adv));
      } catch (err) {
        console.error('Failed to load employee history:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [employee.id]);

  const balance = leaveBalance(employee, leave, todayISO());
  const outstanding = advances.filter(a => a.status === 'open').reduce((s, a) => s + a.amount, 0);
  const overtimeHours = overtime.filter(o => o.status !== 'rejected').reduce((s, o) => s + o.hours, 0);

  return (
    <Modal title={`${employee.firstName} ${employee.lastName}`.trim()} onClose={onClose} className="max-w-3xl">
      {loading ? <Loading /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: CalendarDays, label: 'Leave left', value: `${balance.remaining} d`, tone: 'text-emerald-600' },
              { icon: CalendarOff,  label: 'Absences',   value: `${absences.length}`,     tone: 'text-amber-600'   },
              { icon: Clock,        label: 'Overtime',   value: `${overtimeHours} h`,     tone: 'text-blue-600'    },
              { icon: Wallet,       label: 'Advances open', value: `${fmtAmount(outstanding)} MAD`, tone: 'text-violet-600' },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <s.icon size={12} /> {s.label}
                </div>
                <p className={`text-lg font-bold mt-1 ${s.tone}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400">
            Accrued {balance.accrued} d · taken {balance.taken} d since {fmtDate(employee.hireDate)}
          </p>

          <Section title="Leave" empty="No leave recorded.">
            {leave.map(l => (
              <Row key={l.id} left={`${fmtDate(l.startDate)} → ${fmtDate(l.endDate)}`}
                mid={`${l.days} d · ${titleCase(l.type)} leave`} right={<StatusBadge status={l.status} />} />
            ))}
          </Section>

          <Section title="Absences" empty="No absences recorded.">
            {absences.map(a => (
              <Row key={a.id} left={fmtDate(a.date)}
                mid={`${titleCase(a.type)}${a.duration === 'half' ? ' · half day' : a.duration === 'hours' ? ` · ${a.hours ?? 0} h` : ''}${a.reason ? ` — ${a.reason}` : ''}`}
                right={<div className="flex items-center gap-1.5">
                  <Badge label={a.justified ? 'Justified' : 'Unjustified'} variant={a.justified ? 'green' : 'red'} />
                  <Badge label={isDeducted(a) ? 'Deducted' : 'Paid'} variant={isDeducted(a) ? 'red' : 'green'} />
                </div>} />
            ))}
          </Section>

          <Section title="Overtime" empty="No overtime recorded.">
            {overtime.map(o => (
              <Row key={o.id} left={fmtDate(o.date)} mid={`${o.hours} h${o.period ? ` · ${titleCase(o.period)}` : ''}`}
                right={<StatusBadge status={o.status} />} />
            ))}
          </Section>

          <Section title="Advances" empty="No advances recorded.">
            {advances.map(a => (
              <Row key={a.id} left={fmtDate(a.date)} mid={`${fmtAmount(a.amount)} ${a.currency} · off ${monthLabel(a.deductMonth)}`}
                right={<StatusBadge status={a.status} />} />
            ))}
          </Section>
        </div>
      )}
    </Modal>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const rows = Array.isArray(children) ? children : [children];
  const isEmpty = rows.flat().filter(Boolean).length === 0;
  return (
    <div>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{title}</h3>
      {isEmpty ? <p className="text-sm text-slate-400 italic">{empty}</p> : <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

function Row({ left, mid, right }: { left: string; mid: string; right: ReactNode }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2">
      <span className="text-sm font-semibold text-slate-700 w-40 shrink-0">{left}</span>
      <span className="text-sm text-slate-500 flex-1 min-w-0 truncate">{mid}</span>
      {right}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────
function EmployeeCard({ employee, onOpen, onEdit, onDelete }: {
  employee: Employee;
  onOpen: (e: Employee) => void;
  onEdit: (e: Employee) => void;
  onDelete: (e: Employee) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => onOpen(employee)} className="flex items-start gap-3 min-w-0 text-left">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <UserCog size={18} className="text-indigo-500" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800 truncate hover:text-indigo-600 transition-colors">
              {`${employee.firstName} ${employee.lastName}`.trim()}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {employee.position || 'No position'}{employee.department ? ` · ${employee.department}` : ''}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(employee)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={14} /></button>
          <button onClick={() => onDelete(employee)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge label={STATUS_LABEL[employee.status]} variant={STATUS_VARIANT[employee.status]} />
        {employee.contractType && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {CONTRACT_LABEL[employee.contractType]}
          </span>
        )}
        {employee.matricule && (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">#{employee.matricule}</span>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <BadgeCheck size={12} className="text-slate-400 shrink-0" /> Hired {fmtDate(employee.hireDate)}
        </div>
        {employee.mainPhone && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone size={13} className="text-slate-400 shrink-0" /> <span className="font-semibold">{employee.mainPhone}</span>
          </div>
        )}
        {employee.address && (
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" /> <span className="line-clamp-2">{employee.address}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────
export default function EmployeeDirectory() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Employee['status']>('active');
  const [deptFilter, setDeptFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [profile, setProfile] = useState<Employee | null>(null);

  const load = async () => {
    setLoading(true);
    try { setEmployees(await getEmployees()); }
    catch (e) { console.error('Failed to load employees:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean) as string[])).sort();

  const handleSave = async (data: Omit<Employee, 'id'>) => {
    if (editing) await updateEmployee(editing.id, data);
    else await createEmployee(data);
    await load();
  };

  const handleDelete = async (e: Employee) => {
    const name = `${e.firstName} ${e.lastName}`.trim();
    if (!confirm(`Delete ${name}? Their absences, leave, overtime and advances must be removed first.`)) return;
    try {
      await deleteEmployee(e.id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete this employee.');
    }
  };

  const q = search.toLowerCase();
  const filtered = employees.filter(e => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (deptFilter && e.department !== deptFilter) return false;
    if (!q) return true;
    return [e.firstName, e.lastName, e.matricule, e.position, e.department, e.cin]
      .some(v => (v ?? '').toLowerCase().includes(q));
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {filtered.length} of {employees.length} employee{employees.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className={PRIMARY_BTN}>
          <Plus size={16} /> Add Employee
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, staff no., position…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className={FILTER_CLS}>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="left">Left</option>
          <option value="all">All statuses</option>
        </select>
        {departments.length > 0 && (
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className={FILTER_CLS}>
            <option value="">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title={employees.length === 0 ? 'No employees yet' : 'No results'}
          hint={employees.length === 0 ? 'Add your first employee to start tracking absences, leave, overtime and advances.' : 'Try adjusting the filters.'}
          action={employees.length === 0 && (
            <button onClick={() => { setEditing(null); setShowModal(true); }} className={PRIMARY_BTN}><Plus size={15} /> Add Employee</button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(e => (
            <EmployeeCard key={e.id} employee={e}
              onOpen={setProfile}
              onEdit={emp => { setEditing(emp); setShowModal(true); }}
              onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showModal && (
        <EmployeeModal initial={editing ?? undefined} departments={departments}
          onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); }} />
      )}
      {profile && <ProfileModal employee={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}
