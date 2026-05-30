import { useEffect, useState } from 'react';
import { FileDown, TrendingDown, CheckCircle2, AlertTriangle, Clock, X } from 'lucide-react';
import { getTargets, getAllTargets, getEntries, getAllEntries } from '@/services/productionTargets.service';
import type { ProductionTarget, ProductionEntry } from '@/types';
import { todayISO } from '@/utils/dates';
import { pct } from '@/utils/math';

const STATUS_ICON: Record<string, string> = {
  complete: '✓', in_progress: '⏳', not_started: '□', at_risk: '⚠',
};

export default function DailyReport() {
  const [date, setDate]         = useState('');
  const [targets, setTargets]   = useState<ProductionTarget[]>([]);
  const [entries, setEntries]   = useState<ProductionEntry[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      date ? getTargets(date) : getAllTargets(),
      date ? getEntries(date) : getAllEntries(),
    ]).then(([t, e]) => { setTargets(t); setEntries(e); })
      .finally(() => setLoading(false));
  }, [date]);

  // ── Analytics ──────────────────────────────────────────────────────
  const totalTarget    = targets.reduce((s, t) => s + t.targetQty, 0);
  const totalCompleted = targets.reduce((s, t) => s + t.completedQty, 0);
  const totalDefects   = entries.reduce((s, e) => s + (e.defects ?? 0), 0);
  const defectRate     = totalCompleted > 0 ? ((totalDefects / totalCompleted) * 100).toFixed(2) : '0.00';
  const overallPct     = pct(totalCompleted, totalTarget);

  // Production rate by stage (units logged at each stage today)
  const stageRates: Record<string, number> = {};
  for (const e of entries) {
    stageRates[e.stage] = (stageRates[e.stage] ?? 0) + e.qty;
  }

  // Bottleneck
  const stageEntries = Object.entries(stageRates);
  const bottleneck = stageEntries.length > 1
    ? stageEntries.sort((a, b) => a[1] - b[1])[0]
    : null;

  // Slowest and fastest
  const sortedStages = [...stageEntries].sort((a, b) => b[1] - a[1]);
  const fastest = sortedStages[0];
  const slowest = sortedStages[sortedStages.length - 1];

  const atRiskTargets  = targets.filter(t => t.status === 'at_risk' || (t.completedQty < t.targetQty * 0.4 && t.status !== 'complete'));
  const completeCount  = targets.filter(t => t.status === 'complete').length;
  const inProgCount    = targets.filter(t => t.status === 'in_progress').length;
  const notStartCount  = targets.filter(t => t.status === 'not_started').length;

  // Download HTML report
  const downloadReport = () => {
    const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const targetRows = targets.map(t => `
      <tr>
        <td>${STATUS_ICON[t.status] ?? '—'} ${t.type === 'stage' ? `${t.stage} — ${t.discType}` : `${t.recipeName} (Recipe)`}</td>
        <td class="num">${t.targetQty.toLocaleString('fr-FR')}</td>
        <td class="num">${t.completedQty.toLocaleString('fr-FR')}</td>
        <td class="num">${pct(t.completedQty, t.targetQty)}%</td>
        <td>${t.status.replace('_', ' ')}</td>
      </tr>`).join('');
    const stageRows = Object.entries(stageRates).map(([s, qty]) => `
      <tr><td>${s}</td><td class="num">${qty.toLocaleString('fr-FR')}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
      <title>Production Report — ${dateLabel}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;padding:40px 60px;font-size:13px}
        h1{font-size:22px;font-weight:900;border-bottom:2px solid #1a1a2e;padding-bottom:12px;margin-bottom:24px}
        h2{font-size:14px;font-weight:700;margin:24px 0 8px;color:#334155}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        th{text-align:left;padding:6px 10px;background:#f8fafc;border-bottom:2px solid #e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
        td{padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px}
        .num{text-align:right;font-variant-numeric:tabular-nums}
        .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
        .kpi-card{background:#f8fafc;border-radius:8px;padding:14px;border:1px solid #e2e8f0}
        .kpi-val{font-size:28px;font-weight:900;color:#1e293b}
        .kpi-label{font-size:11px;color:#94a3b8;margin-top:4px}
        .foot{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
      </style></head><body>
      <h1>Production Report — ${dateLabel}</h1>
      <div class="kpi">
        <div class="kpi-card"><div class="kpi-val">${targets.length}</div><div class="kpi-label">Total Targets</div></div>
        <div class="kpi-card"><div class="kpi-val">${overallPct}%</div><div class="kpi-label">Overall Progress</div></div>
        <div class="kpi-card"><div class="kpi-val">${totalCompleted.toLocaleString('fr-FR')}</div><div class="kpi-label">Units Completed</div></div>
        <div class="kpi-card"><div class="kpi-val">${defectRate}%</div><div class="kpi-label">Defect Rate</div></div>
      </div>
      <h2>Targets Summary</h2>
      <table><thead><tr><th>Target</th><th class="num">Goal</th><th class="num">Done</th><th class="num">%</th><th>Status</th></tr></thead>
      <tbody>${targetRows}</tbody></table>
      <h2>Production by Stage</h2>
      <table><thead><tr><th>Stage</th><th class="num">Units Processed Today</th></tr></thead>
      <tbody>${stageRows}</tbody></table>
      ${atRiskTargets.length > 0 ? `<h2>⚠ Issues & Alerts</h2><ul>${atRiskTargets.map(t => `<li>${t.type === 'stage' ? `${t.stage} — ${t.discType}` : t.recipeName}: ${pct(t.completedQty, t.targetQty)}% complete (at risk)</li>`).join('')}</ul>` : ''}
      <div class="foot">Confidentiel — Granitec ERP · ${new Date().toLocaleDateString('fr-FR')}</div>
      </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `production_report_${date}.html`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Daily Report</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {date ? `Production summary for ${date}` : 'All production — summary'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {date && (
            <button onClick={() => setDate('')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <X size={13} /> All dates
            </button>
          )}
          {date && (
            <button onClick={downloadReport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
              <FileDown size={14} /> Download Report
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>
      ) : targets.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <p className="text-slate-500 font-medium">{date ? 'No data for this date' : 'No production data yet'}</p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Targets', value: targets.length, sub: `${completeCount} complete · ${inProgCount} in progress · ${notStartCount} not started` },
              { label: 'Overall Progress', value: `${overallPct}%`, sub: `${totalCompleted.toLocaleString()} / ${totalTarget.toLocaleString()} units` },
              { label: 'Defect Rate', value: `${defectRate}%`, sub: `${totalDefects} defects / ${totalCompleted} units` },
              { label: 'Bottleneck', value: bottleneck ? bottleneck[0] : '—', sub: bottleneck ? `${bottleneck[1].toLocaleString()} units processed` : 'No bottleneck detected' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
                <p className="text-2xl font-black text-slate-800 mt-0.5">{s.value}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Targets Summary */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">Targets Summary</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {targets.map(t => {
                const p = pct(t.completedQty, t.targetQty);
                return (
                  <div key={t.id} className="px-5 py-3 flex items-center gap-4">
                    <span className="text-lg">{STATUS_ICON[t.status] ?? '—'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {t.type === 'stage' ? `${t.stage} — ${t.discType}` : `${t.recipeName} (Recipe)`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${t.status === 'complete' ? 'bg-emerald-500' : p >= 70 ? 'bg-indigo-500' : p >= 40 ? 'bg-yellow-500' : 'bg-red-400'}`}
                            style={{ width: `${p}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums shrink-0">{p}%</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{t.completedQty.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">/ {t.targetQty.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Production by Stage */}
          {Object.keys(stageRates).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <h3 className="text-sm font-semibold text-slate-700">Production by Stage</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {sortedStages.map(([stage, qty]) => {
                  const max = sortedStages[0][1];
                  const p = Math.round((qty / max) * 100);
                  const isFastest = stage === fastest?.[0];
                  const isSlowest = stage === slowest?.[0] && stageEntries.length > 1;
                  return (
                    <div key={stage} className="px-5 py-3 flex items-center gap-4">
                      <span className="text-sm font-semibold text-slate-700 w-20 shrink-0">{stage}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${isSlowest ? 'bg-red-400' : isFastest ? 'bg-emerald-500' : 'bg-indigo-400'}`}
                          style={{ width: `${p}%` }} />
                      </div>
                      <span className="text-sm font-bold text-slate-800 tabular-nums w-24 text-right">{qty.toLocaleString()} units</span>
                      {isFastest && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full shrink-0">FASTEST</span>}
                      {isSlowest && <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full shrink-0">SLOWEST</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alerts & Issues */}
          {atRiskTargets.length > 0 ? (
            <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={15} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-700">Issues & Alerts</h3>
              </div>
              <div className="space-y-2">
                {atRiskTargets.map(t => (
                  <div key={t.id} className="bg-amber-50 rounded-lg px-3 py-2 text-sm text-slate-700">
                    <strong>{t.type === 'stage' ? `${t.stage} — ${t.discType}` : t.recipeName}</strong>
                    {' '}— only {pct(t.completedQty, t.targetQty)}% complete (target: {t.targetQty.toLocaleString()} units)
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={15} />
              <span>No critical issues — all targets within acceptable range.</span>
            </div>
          )}

          {/* Quality */}
          {totalDefects > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={15} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-700">Quality Summary</h3>
              </div>
              <p className="text-sm text-slate-600">
                <strong className="text-slate-800">{totalDefects}</strong> defects recorded
                out of <strong className="text-slate-800">{totalCompleted.toLocaleString()}</strong> units
                — defect rate: <strong className={Number(defectRate) > 2 ? 'text-red-600' : 'text-emerald-600'}>{defectRate}%</strong>
                {Number(defectRate) <= 2 ? ' ✓ Within spec' : ' ⚠ Above 2% threshold'}
              </p>
            </div>
          )}

          {/* Today's entry log */}
          {entries.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                <Clock size={14} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-700">Entry Log</h3>
                <span className="text-xs text-slate-400 ml-1">{entries.length} entries</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>{['Time', 'Stage', 'Disc/Recipe', 'Units', 'Defects', 'Quality', 'Notes'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[...entries].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)).map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{e.loggedAt}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">{e.stage}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{e.discType}</td>
                      <td className="px-3 py-2 font-bold text-slate-800 tabular-nums">+{e.qty}</td>
                      <td className="px-3 py-2 text-slate-500">{e.defects ?? 0}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          e.qualityCheck === 'passed' ? 'bg-emerald-100 text-emerald-700' :
                          e.qualityCheck === 'review' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'}`}>
                          {e.qualityCheck ?? 'passed'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400 max-w-[120px] truncate">{e.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
