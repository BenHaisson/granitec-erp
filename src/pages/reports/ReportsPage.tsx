import { useEffect, useState, type ElementType } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, ShoppingBag, BarChart3, Activity } from 'lucide-react';
import { getOrders } from '@/services/orders.service';
import type { SalesOrder } from '@/types';

// ── Product group config ──────────────────────────────────────────
const GROUPS = [
  { key: 'granite-frypan',   label: 'Frypan — Granite',   color: '#3b82f6', match: (n: string) => n.includes('Frypan')   && n.includes('Granite') },
  { key: 'ceramic-frypan',   label: 'Frypan — Ceramic',   color: '#06b6d4', match: (n: string) => n.includes('Frypan')   && n.includes('Ceramic') },
  { key: 'granite-saucepot', label: 'Saucepot — Granite', color: '#f97316', match: (n: string) => n.includes('Saucepot') && n.includes('Granite') },
  { key: 'ceramic-saucepot', label: 'Saucepot — Ceramic', color: '#8b5cf6', match: (n: string) => n.includes('Saucepot') && n.includes('Ceramic') },
  { key: 'marmite-granite',  label: 'Marmite — Granite',  color: '#10b981', match: (n: string) => n.includes('Marmite') },
  { key: 'crepierre',        label: 'Crepe Pan — Granite', color: '#f59e0b', match: (n: string) => n.includes('Crepe Pan') },
  { key: 'tanjara',          label: 'Tanjara',             color: '#ec4899', match: (n: string) => n.includes('Tanjara') },
] as const;

type GroupKey = typeof GROUPS[number]['key'];

function getGroupKey(productName: string): GroupKey | null {
  for (const g of GROUPS) {
    if (g.match(productName)) return g.key;
  }
  return null;
}

// ── Data helpers ──────────────────────────────────────────────────
function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

type ChartRow = { month: string; label: string } & Record<GroupKey, number>;

function buildChartData(orders: SalesOrder[], year: number | null): ChartRow[] {
  const dates = orders.map(o => toDate(o.date));
  if (dates.length === 0) return [];

  let yms: string[];
  if (year) {
    yms = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  } else {
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    yms = [];
    const cur = new Date(min.getFullYear(), min.getMonth(), 1);
    while (cur <= max) {
      yms.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  const rows: ChartRow[] = yms.map(ym => ({
    month: ym,
    label: monthLabel(ym),
    'granite-frypan': 0,
    'ceramic-frypan': 0,
    'granite-saucepot': 0,
    'ceramic-saucepot': 0,
    'marmite-granite': 0,
    'crepierre': 0,
    'tanjara': 0,
  }));
  const idx = Object.fromEntries(yms.map((ym, i) => [ym, i]));

  for (const order of orders) {
    const d = toDate(order.date);
    if (year && d.getFullYear() !== year) continue;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const i = idx[ym];
    if (i === undefined) continue;
    for (const line of order.lines) {
      const key = getGroupKey(line.productName);
      if (key) rows[i][key] += line.totalQty;
    }
  }

  return rows;
}

function rowTotal(row: ChartRow): number {
  return GROUPS.reduce((s, g) => s + row[g.key], 0);
}

// ── YoY data helper ───────────────────────────────────────────────
type YoYRow = { month: string; '2024': number; '2025': number; '2026': number };

function buildYoYData(orders: SalesOrder[], groupFilter: GroupKey | null): YoYRow[] {
  const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
    new Date(2024, i, 1).toLocaleDateString('fr-FR', { month: 'short' })
  );
  const rows: YoYRow[] = MONTH_LABELS.map(m => ({ month: m, '2024': 0, '2025': 0, '2026': 0 }));
  const gf = groupFilter ? GROUPS.find(g => g.key === groupFilter) : null;
  for (const order of orders) {
    const d = toDate(order.date);
    const yr = d.getFullYear();
    if (yr < 2024 || yr > 2026) continue;
    const mi = d.getMonth();
    for (const line of order.lines) {
      if (!gf || gf.match(line.productName)) {
        (rows[mi] as unknown as Record<string, number>)[String(yr)] += line.totalQty;
      }
    }
  }
  return rows;
}

// ── Custom tooltip ────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const filtered = payload.filter(p => p.value > 0);
  const total = filtered.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {filtered.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold tabular-nums">{p.value.toLocaleString('fr-FR')}</span>
        </div>
      ))}
      {filtered.length > 1 && (
        <div className="border-t border-slate-100 mt-2 pt-2 flex justify-between font-bold text-slate-800">
          <span>Total</span>
          <span className="tabular-nums">{total.toLocaleString('fr-FR')}</span>
        </div>
      )}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string;
  icon: ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
const YEARS = [2024, 2025, 2026] as const;
const FALLBACK_ROW: ChartRow = { month: '', label: '', 'granite-frypan': 0, 'ceramic-frypan': 0, 'granite-saucepot': 0, 'ceramic-saucepot': 0, 'marmite-granite': 0, 'crepierre': 0, 'tanjara': 0 };

export default function ReportsPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupKey | null>(null);
  const [chartMode, setChartMode] = useState<'stacked' | 'yoy'>('stacked');

  useEffect(() => {
    getOrders()
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  // All-time chart data (for KPIs)
  const allData = buildChartData(orders, null);
  const chartData = year ? buildChartData(orders, year) : allData;

  // KPIs (always computed over all time)
  const totalOrders = orders.length;
  const totalPcs = allData.reduce((s, r) => s + rowTotal(r), 0);
  const activeMonths = allData.filter(r => rowTotal(r) > 0);
  const monthlyAvg = activeMonths.length > 0 ? Math.round(totalPcs / activeMonths.length) : 0;
  const bestRow = allData.reduce((best, r) => rowTotal(r) > rowTotal(best) ? r : best, allData[0] ?? FALLBACK_ROW);
  const worstRow = activeMonths.reduce((worst, r) => rowTotal(r) < rowTotal(worst) ? r : worst, activeMonths[0] ?? bestRow);

  // YoY growth KPI
  const pcs2024 = allData.filter(r => r.month.startsWith('2024')).reduce((s, r) => s + rowTotal(r), 0);
  const pcs2025 = allData.filter(r => r.month.startsWith('2025')).reduce((s, r) => s + rowTotal(r), 0);
  const yoyPct  = pcs2024 > 0 ? ((pcs2025 - pcs2024) / pcs2024 * 100) : null;

  // Product group totals (all time)
  const groupTotals = GROUPS.map(g => ({
    ...g,
    total: allData.reduce((s, r) => s + r[g.key], 0),
  })).sort((a, b) => b.total - a.total);
  const maxGroupTotal = groupTotals[0]?.total ?? 1;

  // Groups to render in stacked chart
  const visibleGroups = selectedGroup ? GROUPS.filter(g => g.key === selectedGroup) : GROUPS;

  // Last stacked bar gets rounded top corners
  const lastKey = visibleGroups[visibleGroups.length - 1]?.key;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Sales analytics — all time</p>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-20 text-sm">Loading…</div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard label="Total Orders"   value={totalOrders.toLocaleString('fr-FR')} icon={ShoppingBag} color="bg-blue-500" />
            <KpiCard label="Total Pcs"      value={totalPcs.toLocaleString('fr-FR')}    icon={BarChart3}   color="bg-slate-700" />
            <KpiCard
              label="YoY Growth"
              value={yoyPct !== null ? `${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(1)}%` : '—'}
              sub="2025 vs 2024"
              icon={yoyPct !== null && yoyPct < 0 ? TrendingDown : TrendingUp}
              color={yoyPct !== null && yoyPct < 0 ? 'bg-red-400' : 'bg-green-500'}
            />
            <KpiCard label="Monthly Avg"    value={monthlyAvg.toLocaleString('fr-FR')}  icon={Activity}    color="bg-indigo-500" />
            <KpiCard
              label="Best Month"
              value={rowTotal(bestRow).toLocaleString('fr-FR')}
              sub={bestRow.label}
              icon={TrendingUp}
              color="bg-green-500"
            />
            <KpiCard
              label="Lowest Month"
              value={rowTotal(worstRow).toLocaleString('fr-FR')}
              sub={worstRow.label}
              icon={TrendingDown}
              color="bg-amber-500"
            />
          </div>

          {/* Monthly chart */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            {/* Row 1: title + mode toggle + year buttons */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
              <h2 className="text-sm font-semibold text-slate-700">Monthly Sales (pcs)</h2>
              <div className="flex items-center gap-2">
                {/* Chart mode toggle */}
                <div className="flex gap-1">
                  {(['stacked', 'yoy'] as const).map(m => (
                    <button key={m} onClick={() => setChartMode(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        chartMode === m
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}>
                      {m === 'stacked' ? 'Stacked' : 'YoY'}
                    </button>
                  ))}
                </div>
                {/* Year buttons — hidden in YoY mode */}
                {chartMode === 'stacked' && (
                  <div className="flex gap-1">
                    {([null, ...YEARS] as (number | null)[]).map(y => (
                      <button key={y ?? 'all'} onClick={() => setYear(y)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          year === y
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                        {y ?? 'All'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: group filter chips */}
            <div className="flex gap-1.5 flex-wrap mb-5">
              <button
                onClick={() => setSelectedGroup(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedGroup === null
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}>
                All groups
              </button>
              {GROUPS.map(g => (
                <button
                  key={g.key}
                  onClick={() => setSelectedGroup(selectedGroup === g.key ? null : g.key)}
                  className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                  style={selectedGroup === g.key
                    ? { backgroundColor: g.color, borderColor: g.color, color: '#fff' }
                    : { backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#64748b' }
                  }>
                  {g.label}
                </button>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={300}>
              {chartMode === 'stacked' ? (
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  {visibleGroups.map(g => (
                    <Bar key={g.key} dataKey={g.key} name={g.label} stackId="a"
                      fill={g.color} radius={g.key === lastKey ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              ) : (
                <BarChart data={buildYoYData(orders, selectedGroup)} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  <Bar dataKey="2024" name="2024" fill="#94a3b8" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="2025" name="2025" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="2026" name="2026" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Product breakdown */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Product Group Breakdown — All Time</h2>
            <div className="space-y-4">
              {groupTotals.map(g => {
                const pct = maxGroupTotal > 0 ? Math.round((g.total / maxGroupTotal) * 100) : 0;
                const sharePct = totalPcs > 0 ? ((g.total / totalPcs) * 100).toFixed(1) : '0';
                return (
                  <div key={g.key}>
                    <div className="flex items-center justify-between mb-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="font-medium text-slate-700">{g.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <span className="text-slate-400 text-xs">{sharePct}%</span>
                        <span className="font-semibold text-slate-800 tabular-nums w-20 text-right">
                          {g.total.toLocaleString('fr-FR')} pcs
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: g.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
