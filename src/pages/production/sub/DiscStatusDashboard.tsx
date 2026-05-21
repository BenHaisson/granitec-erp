import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getAllEntries } from '@/services/productionTargets.service';
import type { ProductionEntry, ProductionStage } from '@/types';

const STAGE_ORDER: ProductionStage[] = ['Press', 'Tourna', 'Laser', 'Pounta', 'Screw', 'Gather', 'Box'];
const STAGE_COLORS: Record<string, string> = {
  Press:  'bg-indigo-500',
  Tourna: 'bg-violet-500',
  Laser:  'bg-blue-500',
  Pounta: 'bg-cyan-500',
  Screw:  'bg-teal-500',
  Gather: 'bg-amber-500',
  Box:    'bg-emerald-500',
};

interface PipelineState {
  [discType: string]: {
    [stage: string]: number; // units waiting at this stage
  };
}

function computePipeline(entries: ProductionEntry[]): PipelineState {
  // Sum total processed at each stage per disc type
  const processed: Record<string, Record<string, number>> = {};
  for (const e of entries) {
    if (!processed[e.discType]) processed[e.discType] = {};
    processed[e.discType][e.stage] = (processed[e.discType][e.stage] ?? 0) + e.qty;
  }
  // Derive waiting = processed at prev stage - processed at curr stage
  const pipeline: PipelineState = {};
  for (const disc of Object.keys(processed)) {
    pipeline[disc] = {};
    for (let i = 1; i < STAGE_ORDER.length; i++) {
      const prev = STAGE_ORDER[i - 1];
      const curr = STAGE_ORDER[i];
      const prevTotal = processed[disc][prev] ?? 0;
      const currTotal = processed[disc][curr] ?? 0;
      const waiting = prevTotal - currTotal;
      if (waiting > 0) pipeline[disc][curr] = waiting;
    }
  }
  return pipeline;
}

function totalAtStage(pipeline: PipelineState, stage: string): number {
  return Object.values(pipeline).reduce((s, d) => s + (d[stage] ?? 0), 0);
}

export default function DiscStatusDashboard() {
  const [entries, setEntries]   = useState<ProductionEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<string>('All');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const load = () => {
    setLoading(true);
    getAllEntries()
      .then(e => { setEntries(e); setLastUpdated(new Date()); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const pipeline = computePipeline(entries);
  const allDiscTypes = Object.keys(pipeline);
  const filteredDiscs = filter === 'All' ? allDiscTypes : [filter];

  // Bottleneck = stage with most total units waiting
  const stageTotals = STAGE_ORDER.slice(1).map(s => ({ stage: s, total: totalAtStage(pipeline, s) }));
  const bottleneck = stageTotals.sort((a, b) => b.total - a.total).find(x => x.total > 0);

  const maxStageTotal = Math.max(...stageTotals.map(s => s.total), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Disc Status</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Last updated: {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Disc filter */}
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option>All</option>
            {allDiscTypes.sort().map(d => <option key={d}>{d}</option>)}
          </select>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50 transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Pipeline flow bar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Pipeline Flow</p>
        <div className="flex items-center gap-1 flex-wrap">
          {STAGE_ORDER.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white ${STAGE_COLORS[s]} ${
                bottleneck?.stage === s ? 'ring-2 ring-red-400 ring-offset-1' : ''}`}>
                {s}
                {i > 0 && totalAtStage(pipeline, s) > 0 && (
                  <span className="ml-1.5 bg-white/30 rounded px-1 text-[10px]">
                    {totalAtStage(pipeline, s).toLocaleString()}
                  </span>
                )}
              </div>
              {i < STAGE_ORDER.length - 1 && <span className="text-slate-300 text-xs">→</span>}
            </div>
          ))}
        </div>
        {bottleneck && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            <AlertTriangle size={13} />
            <span>Bottleneck: <strong>{bottleneck.stage}</strong> — {bottleneck.total.toLocaleString()} units waiting</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>
      ) : allDiscTypes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <p className="text-slate-500 font-medium">No disc pipeline data yet</p>
          <p className="text-slate-400 text-sm mt-1">Log production entries in Data Entry to populate the pipeline</p>
        </div>
      ) : (
        <>
          {/* Stage breakdown */}
          {STAGE_ORDER.slice(1).map(stage => {
            const items = filteredDiscs
              .map(disc => ({ disc, qty: pipeline[disc]?.[stage] ?? 0 }))
              .filter(x => x.qty > 0);
            if (items.length === 0) return null;
            const stageTotal = items.reduce((s, x) => s + x.qty, 0);
            const pct = Math.round((stageTotal / maxStageTotal) * 100);
            const isBottleneck = bottleneck?.stage === stage;
            return (
              <div key={stage} className={`bg-white rounded-xl border shadow-sm p-4 ${isBottleneck ? 'border-red-200' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${STAGE_COLORS[stage]}`} />
                    <p className="text-sm font-bold text-slate-800">Waiting for {stage}</p>
                    {isBottleneck && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">BOTTLENECK</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-600 tabular-nums">{stageTotal.toLocaleString()} units</span>
                </div>

                {/* Stage load bar */}
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full ${isBottleneck ? 'bg-red-400' : STAGE_COLORS[stage]}`}
                    style={{ width: `${pct}%` }} />
                </div>

                {/* Per-disc breakdown */}
                <div className="space-y-1.5">
                  {items.map(({ disc, qty }) => (
                    <div key={disc} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 min-w-[100px]">{disc}</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${STAGE_COLORS[stage]} opacity-70`}
                          style={{ width: `${Math.round((qty / stageTotal) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-700 tabular-nums min-w-[60px] text-right">
                        {qty.toLocaleString()} <span className="font-normal text-slate-400">units</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Completed */}
          {(() => {
            const boxed = filteredDiscs
              .map(disc => ({ disc, qty: pipeline[disc]?.['Box'] ?? 0 }))
              .filter(x => x.qty > 0);
            if (boxed.length === 0) return null;
            return (
              <div className="bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <p className="text-sm font-bold text-emerald-800">Boxed & Ready</p>
                </div>
                {boxed.map(({ disc, qty }) => (
                  <div key={disc} className="flex items-center justify-between text-sm py-0.5">
                    <span className="text-emerald-700">{disc}</span>
                    <span className="font-bold text-emerald-800 tabular-nums">{qty.toLocaleString()} units</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
