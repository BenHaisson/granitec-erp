import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, TrendingDown, Plus } from 'lucide-react';
import { getTargets, getEntries } from '@/services/productionTargets.service';
import type { ProductionTarget, ProductionEntry } from '@/types';

const STAGE_ORDER = ['Press', 'Tourna', 'Laser', 'Pounta', 'Screw', 'Gather', 'Box'] as const;

function todayISO() { return new Date().toISOString().slice(0, 10); }

function pct(done: number, total: number) {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

function targetStatus(t: ProductionTarget): 'complete' | 'on_track' | 'at_risk' | 'slow' | 'waiting' {
  if (t.status === 'complete') return 'complete';
  const p = pct(t.completedQty, t.targetQty);
  if (t.type === 'recipe') return p === 0 ? 'waiting' : p >= 70 ? 'on_track' : 'at_risk';
  if (p >= 70) return 'on_track';
  if (p >= 40) return 'at_risk';
  return 'slow';
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  complete:  { label: 'Complete ✓',  cls: 'bg-emerald-100 text-emerald-700' },
  on_track:  { label: 'On Track ✓',  cls: 'bg-emerald-100 text-emerald-700' },
  at_risk:   { label: '⚠ At Risk',   cls: 'bg-yellow-100 text-yellow-700'   },
  slow:      { label: '🔴 Slow',     cls: 'bg-red-100 text-red-700'         },
  waiting:   { label: 'Waiting…',    cls: 'bg-slate-100 text-slate-600'     },
};

interface Props {
  onNavigate: (tab: string) => void;
}

export default function ProductionDashboard({ onNavigate }: Props) {
  const [date, setDate]         = useState(todayISO());
  const [targets, setTargets]   = useState<ProductionTarget[]>([]);
  const [entries, setEntries]   = useState<ProductionEntry[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getTargets(date), getEntries(date)])
      .then(([t, e]) => { setTargets(t); setEntries(e); })
      .finally(() => setLoading(false));
  }, [date]);

  // Disc pipeline: per disc type, per stage — count units waiting
  const pipeline = (() => {
    const totals: Record<string, Record<string, number>> = {};
    for (const e of entries) {
      const disc = e.discType;
      if (!totals[disc]) totals[disc] = {};
      for (const stage of STAGE_ORDER) {
        totals[disc][stage] = totals[disc][stage] ?? 0;
      }
    }
    // For each disc type, sum entries at each stage level
    for (const e of entries) {
      const disc = e.discType;
      if (!totals[disc]) totals[disc] = {};
      totals[disc][e.stage] = (totals[disc][e.stage] ?? 0) + e.qty;
    }
    // Derive "waiting at stage N" = sum(entries at stage N-1) - sum(entries at stage N)
    const waiting: Record<string, Record<string, number>> = {};
    const stageIdx: Record<string, number> = {};
    STAGE_ORDER.forEach((s, i) => { stageIdx[s] = i; });
    for (const disc of Object.keys(totals)) {
      waiting[disc] = {};
      for (let i = 1; i < STAGE_ORDER.length; i++) {
        const prev = STAGE_ORDER[i - 1];
        const curr = STAGE_ORDER[i];
        const prevDone = totals[disc][prev] ?? 0;
        const currDone = totals[disc][curr] ?? 0;
        const w = prevDone - currDone;
        if (w > 0) waiting[disc][curr] = w;
      }
    }
    return waiting;
  })();

  const stageItems = targets.filter(t => t.type === 'stage');
  const recipeItems = targets.filter(t => t.type === 'recipe');
  const overallPct = targets.length === 0 ? 0
    : Math.round(targets.reduce((s, t) => s + pct(t.completedQty, t.targetQty), 0) / targets.length);

  const bottleneck = (() => {
    const stageTotals: Record<string, number> = {};
    for (const e of entries) {
      stageTotals[e.stage] = (stageTotals[e.stage] ?? 0) + e.qty;
    }
    const slowest = Object.entries(stageTotals).sort((a, b) => a[1] - b[1])[0];
    return slowest ? slowest[0] : null;
  })();

  const alerts = targets.filter(t => {
    const s = targetStatus(t);
    return s === 'slow' || s === 'at_risk';
  });

  // Disc pipeline summary for right column
  const pipelineSummary = Object.entries(pipeline)
    .flatMap(([disc, stages]) => Object.entries(stages).map(([stage, qty]) => ({ disc, stage, qty })))
    .filter(x => x.qty > 0)
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage as typeof STAGE_ORDER[number]) - STAGE_ORDER.indexOf(b.stage as typeof STAGE_ORDER[number]));

  const stageGroups: Record<string, { disc: string; qty: number }[]> = {};
  for (const x of pipelineSummary) {
    if (!stageGroups[x.stage]) stageGroups[x.stage] = [];
    stageGroups[x.stage].push({ disc: x.disc, qty: x.qty });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Production Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">Today's targets at a glance</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={() => onNavigate('planning')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus size={15} /> New Target
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Targets', value: targets.length, sub: 'today' },
          { label: 'Progress', value: `${overallPct}%`, sub: 'overall avg' },
          { label: 'Bottleneck', value: bottleneck ?? '—', sub: 'slowest stage' },
          { label: 'Alerts', value: alerts.length, sub: 'issues' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className="text-2xl font-black text-slate-800 mt-0.5">{s.value}</p>
            <p className="text-[11px] text-slate-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>
      ) : targets.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <Clock size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-slate-500 font-medium">No targets for this date</p>
          <p className="text-slate-400 text-sm mt-1">Go to Daily Planning to create targets</p>
          <button onClick={() => onNavigate('planning')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            Open Daily Planning
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left — targets (60%) */}
          <div className="lg:col-span-3 space-y-3">
            {stageItems.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Stage Targets</p>
            )}
            {stageItems.map(t => {
              const p = pct(t.completedQty, t.targetQty);
              const s = targetStatus(t);
              const badge = STATUS_BADGE[s];
              return (
                <div key={t.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{t.stage} — {t.discType}</p>
                      {t.line && <p className="text-xs text-slate-400 mt-0.5">Line: {t.line}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${s === 'complete' || s === 'on_track' ? 'bg-emerald-500' : s === 'at_risk' ? 'bg-yellow-500' : s === 'slow' ? 'bg-red-500' : 'bg-slate-300'}`}
                        style={{ width: `${p}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 shrink-0 tabular-nums">{p}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{t.completedQty.toLocaleString()} / {t.targetQty.toLocaleString()} units</span>
                    <button onClick={() => onNavigate('data-entry')}
                      className="text-indigo-600 hover:text-indigo-800 font-medium">
                      Log Entry →
                    </button>
                  </div>
                </div>
              );
            })}

            {recipeItems.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-4">Recipe Targets</p>
            )}
            {recipeItems.map(t => {
              const p = pct(t.completedQty, t.targetQty);
              const s = targetStatus(t);
              const badge = STATUS_BADGE[s];
              return (
                <div key={t.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-sm font-bold text-slate-800">{t.recipeName ?? 'Recipe'} × {t.targetQty} sets</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${p}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 shrink-0 tabular-nums">{p}%</span>
                  </div>
                  <p className="text-xs text-slate-500">{t.completedQty} / {t.targetQty} sets · Deadline: {t.deadline}</p>
                </div>
              );
            })}
          </div>

          {/* Right — disc pipeline (40%) */}
          <div className="lg:col-span-2 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Disc Pipeline</p>
            {Object.keys(stageGroups).length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 text-center text-slate-400 text-sm">
                No discs in pipeline yet.<br />Log production entries to see status.
              </div>
            ) : (
              Object.entries(stageGroups).map(([stage, items]) => (
                <div key={stage} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Waiting for {stage}</p>
                  {items.map(({ disc, qty }) => (
                    <div key={disc} className="flex items-center justify-between text-sm py-0.5">
                      <span className="text-slate-600">{disc}</span>
                      <span className="font-bold text-slate-800 tabular-nums">{qty.toLocaleString()} <span className="text-xs font-normal text-slate-400">units</span></span>
                    </div>
                  ))}
                  <button onClick={() => onNavigate('disc-status')}
                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    View Details →
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-700">Production Alerts</h3>
          </div>
          <div className="space-y-2">
            {alerts.map(t => (
              <div key={t.id} className="flex items-start gap-2 text-sm text-slate-600 bg-amber-50 rounded-lg px-3 py-2">
                <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                <span>
                  <strong>{t.type === 'stage' ? `${t.stage} — ${t.discType}` : t.recipeName}</strong>{' '}
                  is {targetStatus(t) === 'slow' ? 'behind schedule' : 'at risk'} ({pct(t.completedQty, t.targetQty)}% done)
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate('report')}
            className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            View Full Daily Report →
          </button>
        </div>
      )}

      {/* All clear */}
      {!loading && targets.length > 0 && alerts.length === 0 && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={15} />
          <span>All targets on track — no issues detected.</span>
        </div>
      )}
    </div>
  );
}
