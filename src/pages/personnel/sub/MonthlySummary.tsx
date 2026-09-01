import { useEffect, useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { getEmployees } from '@/services/employee.service';
import { getAbsences, getLeaveRequests, getOvertimeEntries, getAdvances } from '@/services/hr.service';
import { todayISO } from '@/utils/dates';
import { monthKey, monthLabel } from '@/utils/leave';
import type { Absence, AdvancePayment, Employee, LeaveRequest, OvertimeEntry } from '@/types';
import { absenceDays } from './Absences';
import { FILTER_CLS, EmptyState, Loading, fmtAmount } from './shared';

interface SummaryRow {
  employee: Employee;
  absenceDays: number;
  absenceHours: number;
  unjustified: number;
  leaveDays: number;
  overtimeHours: number;
  advancesTotal: number;
  advancesCurrency: string;
}

/** Does a leave request touch the given YYYY-MM? Requests can span months. */
const leaveTouchesMonth = (r: LeaveRequest, ym: string): boolean =>
  monthKey(r.startDate) <= ym && monthKey(r.endDate) >= ym;

export default function MonthlySummary() {
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [overtime, setOvertime] = useState<OvertimeEntry[]>([]);
  const [advances, setAdvances] = useState<AdvancePayment[]>([]);
  const [includeLeft, setIncludeLeft] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [emps, a, l, o, adv] = await Promise.all([
          getEmployees(), getAbsences(), getLeaveRequests(), getOvertimeEntries(), getAdvances(),
        ]);
        setEmployees(emps); setAbsences(a); setLeave(l); setOvertime(o); setAdvances(adv);
      } catch (e) {
        console.error('Failed to load the monthly summary:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo<SummaryRow[]>(() => {
    const pool = includeLeft ? employees : employees.filter(e => e.status !== 'left');
    return pool.map(employee => {
      const mine = <T extends { employeeId: string }>(list: T[]) => list.filter(r => r.employeeId === employee.id);

      const monthAbsences = mine(absences).filter(a => monthKey(a.date) === month);
      const monthLeave = mine(leave).filter(r => r.status === 'approved' && leaveTouchesMonth(r, month));
      const monthOvertime = mine(overtime).filter(o => o.status === 'approved' && monthKey(o.date) === month);
      const monthAdvances = mine(advances).filter(a => a.deductMonth === month);

      return {
        employee,
        absenceDays: monthAbsences.reduce((s, a) => s + absenceDays(a), 0),
        absenceHours: monthAbsences.reduce((s, a) => s + (a.duration === 'hours' ? (a.hours ?? 0) : 0), 0),
        unjustified: monthAbsences.filter(a => !a.justified).length,
        leaveDays: monthLeave.reduce((s, r) => s + r.days, 0),
        overtimeHours: monthOvertime.reduce((s, o) => s + o.hours, 0),
        advancesTotal: monthAdvances.reduce((s, a) => s + a.amount, 0),
        advancesCurrency: monthAdvances[0]?.currency ?? 'MAD',
      };
    });
  }, [employees, absences, leave, overtime, advances, month, includeLeft]);

  const withActivity = rows.filter(r =>
    r.absenceDays > 0 || r.absenceHours > 0 || r.leaveDays > 0 || r.overtimeHours > 0 || r.advancesTotal > 0
  );

  const totals = rows.reduce((acc, r) => ({
    absenceDays: acc.absenceDays + r.absenceDays,
    leaveDays: acc.leaveDays + r.leaveDays,
    overtimeHours: acc.overtimeHours + r.overtimeHours,
    advancesTotal: acc.advancesTotal + r.advancesTotal,
  }), { absenceDays: 0, leaveDays: 0, overtimeHours: 0, advancesTotal: 0 });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-700">{monthLabel(month)}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            What each person accumulated this month — counts only, no pay calculation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={FILTER_CLS} />
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={includeLeft} onChange={e => setIncludeLeft(e.target.checked)} className="w-3.5 h-3.5 accent-indigo-600" />
            Include former staff
          </label>
        </div>
      </div>

      {loading ? <Loading /> : rows.length === 0 ? (
        <EmptyState icon={CalendarRange} title="No employees" hint="Add employees in the Directory tab first." />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-left text-[11px] uppercase tracking-widest">
                  <th className="px-4 py-3 font-bold">Employee</th>
                  <th className="px-4 py-3 font-bold text-right">Absence days</th>
                  <th className="px-4 py-3 font-bold text-right">Unjustified</th>
                  <th className="px-4 py-3 font-bold text-right">Leave days</th>
                  <th className="px-4 py-3 font-bold text-right">Overtime</th>
                  <th className="px-4 py-3 font-bold text-right">Advances</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => (
                  <tr key={r.employee.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">{`${r.employee.firstName} ${r.employee.lastName}`.trim()}</p>
                      {r.employee.position && <p className="text-[11px] text-slate-400">{r.employee.position}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {r.absenceDays || '—'}
                      {r.absenceHours > 0 && <span className="text-xs text-slate-400"> +{r.absenceHours} h</span>}
                    </td>
                    <td className={`px-4 py-3 text-right ${r.unjustified > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                      {r.unjustified || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.leaveDays || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.overtimeHours ? `${r.overtimeHours} h` : '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {r.advancesTotal ? `${fmtAmount(r.advancesTotal)} ${r.advancesCurrency}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr className="font-bold text-slate-700">
                  <td className="px-4 py-3">Total — {withActivity.length} with activity</td>
                  <td className="px-4 py-3 text-right">{totals.absenceDays || '—'}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right">{totals.leaveDays || '—'}</td>
                  <td className="px-4 py-3 text-right">{totals.overtimeHours ? `${totals.overtimeHours} h` : '—'}</td>
                  <td className="px-4 py-3 text-right">{totals.advancesTotal ? fmtAmount(totals.advancesTotal) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
