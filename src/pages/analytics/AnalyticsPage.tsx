import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { Layers, TrendingUp, Package, AlertTriangle } from 'lucide-react';
import { getProducts, getMovements } from '@/services/inventory.service';
import type { Product, InventoryMovement } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────
function tsToDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate(): Date }).toDate();
  return new Date(v as string);
}

// ── Chart tooltip ────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const filtered = payload.filter(p => p.value > 0);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {filtered.map(p => (
        <div key={p.name} className="flex justify-between gap-4 mb-1">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold tabular-nums">{p.value.toLocaleString('fr-FR')}</span>
        </div>
      ))}
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Thickness config ─────────────────────────────────────────────
const THICKNESS_GROUPS = [
  { key: '2mm',  label: '2mm',    color: '#3b82f6', match: (s: string) => /X2-|X2$/.test(s) && !s.includes('TF') },
  { key: '2tf',  label: '2mm Tf', color: '#06b6d4', match: (s: string) => s.includes('X2-TF') || (s.includes('X20-') && s.includes('TF')) },
  { key: '270',  label: '2.70mm', color: '#8b5cf6', match: (s: string) => s.includes('X27-') },
  { key: '32',   label: '3.2mm',  color: '#f59e0b', match: (s: string) => s.includes('X32-') },
] as const;

type ThicknessKey = typeof THICKNESS_GROUPS[number]['key'];

type MonthRow = { label: string; '2mm': number; '2tf': number; '270': number; '32': number };

function getThicknessKey(sku: string): ThicknessKey | null {
  for (const g of THICKNESS_GROUPS) {
    if (g.match(sku)) return g.key;
  }
  return null;
}

// ── Main page ─────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [thicknessFilter, setThicknessFilter] = useState<ThicknessKey | null>(null);

  useEffect(() => {
    Promise.all([getProducts(), getMovements()])
      .then(([p, m]) => { setProducts(p); setMovements(m); })
      .finally(() => setLoading(false));
  }, []);

  const discProducts = products.filter(p => p.category === 'Aluminium Disc');
  const purchases = movements.filter(m => m.reason === 'PURCHASE');

  // Stock by thickness — simple array for bar chart
  const stockByThickness: { label: string; stock: number; color: string }[] = THICKNESS_GROUPS.map(g => ({
    label: g.label,
    stock: discProducts.filter(p => getThicknessKey(p.sku) === g.key).reduce((s, p) => s + p.stock_level, 0),
    color: g.color,
  }));

  // All-time monthly inbound per thickness
  const discSkuSet = new Set(discProducts.map(p => p.id));
  const discPurchases = purchases.filter(m => discSkuSet.has(m.productId));
  const skuById = Object.fromEntries(products.map(p => [p.id, p.sku]));

  const ymOfDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  // Build sorted list of all months that appear in purchase data, filling gaps
  const ymSet = new Set(discPurchases.map(m => ymOfDate(tsToDate(m.createdAt))));
  const allYms = Array.from(ymSet).sort();
  if (allYms.length >= 2) {
    const [fy, fm] = allYms[0].split('-').map(Number);
    const [ly, lm] = allYms[allYms.length - 1].split('-').map(Number);
    const cur = new Date(fy, fm - 1, 1);
    const end = new Date(ly, lm - 1, 1);
    while (cur <= end) {
      const ym = ymOfDate(cur);
      if (!ymSet.has(ym)) allYms.push(ym);
      cur.setMonth(cur.getMonth() + 1);
    }
    allYms.sort();
  }

  const months12: MonthRow[] = allYms.map(ym => {
    const [y, mo] = ym.split('-').map(Number);
    return {
      label: new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      '2mm': 0, '2tf': 0, '270': 0, '32': 0,
    };
  });

  const ymIdx = Object.fromEntries(allYms.map((ym, i) => [ym, i]));

  for (const m of discPurchases) {
    const d = tsToDate(m.createdAt);
    const i = ymIdx[ymOfDate(d)];
    if (i === undefined) continue;
    const sku = skuById[m.productId] ?? '';
    const key = getThicknessKey(sku);
    if (key) months12[i][key] += m.quantity;
  }

  // Top 10 disc SKUs by stock
  const top10 = [...discProducts].sort((a, b) => b.stock_level - a.stock_level).slice(0, 10);

  // Stock health
  const healthEmpty = discProducts.filter(p => p.stock_level <= 0).length;
  const healthLow   = discProducts.filter(p => p.stock_level > 0 && p.stock_level <= p.min_stock).length;
  const healthOk    = discProducts.filter(p => p.stock_level > p.min_stock).length;
  const pieData: { name: string; value: number; color: string }[] = [
    { name: 'In Stock', value: healthOk,    color: '#10b981' },
    { name: 'Low',      value: healthLow,   color: '#f59e0b' },
    { name: 'Empty',    value: healthEmpty, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const totalDiscStock   = discProducts.reduce((s, p) => s + p.stock_level, 0);
  const totalDiscInbound = discPurchases.reduce((s, m) => s + m.quantity, 0);
  const uniqueShippings  = new Set(discPurchases.map(m => m.note)).size;

  const visibleGroups = thicknessFilter
    ? THICKNESS_GROUPS.filter(g => g.key === thicknessFilter)
    : [...THICKNESS_GROUPS];

  if (loading) {
    return <div className="text-center text-slate-400 py-20 text-sm">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Supply Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Aluminium disc inventory &amp; inbound history</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Disc References" value={discProducts.length.toString()}           icon={Package}       color="bg-indigo-500" />
        <KpiCard label="Total Stock"     value={totalDiscStock.toLocaleString('fr-FR')}    icon={Layers}        color="bg-blue-500"    sub="pcs on hand" />
        <KpiCard label="Total Inbound"   value={totalDiscInbound.toLocaleString('fr-FR')}  icon={TrendingUp}    color="bg-emerald-500" sub={`${uniqueShippings} shippings`} />
        <KpiCard label="Stock Alerts"    value={(healthEmpty + healthLow).toString()}       icon={AlertTriangle} color={healthEmpty + healthLow > 0 ? 'bg-red-500' : 'bg-green-500'} sub={`${healthEmpty} empty · ${healthLow} low`} />
      </div>

      {/* Stock by thickness + pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Current Stock by Thickness</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stockByThickness} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip formatter={(v: number, name: string) => [v.toLocaleString('fr-FR') + ' pcs', name]} />
              <Bar dataKey="stock" name="Stock" radius={[4, 4, 0, 0]}>
                {stockByThickness.map((g, i) => <Cell key={i} fill={g.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Stock Health</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={false}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [v + ' refs', '']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-slate-500">{d.name}</span>
                </div>
                <span className="font-semibold text-slate-700">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly inbound chart */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Monthly Inbound — All Time (pcs)</h2>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setThicknessFilter(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                !thicknessFilter ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}>
              All
            </button>
            {THICKNESS_GROUPS.map(g => (
              <button key={g.key}
                onClick={() => setThicknessFilter(thicknessFilter === g.key ? null : g.key)}
                className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                style={thicknessFilter === g.key
                  ? { backgroundColor: g.color, borderColor: g.color, color: '#fff' }
                  : { backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#64748b' }}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={months12} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            {visibleGroups.map((g, idx) => (
              <Bar key={g.key} dataKey={g.key} name={g.label} stackId="a"
                fill={g.color} radius={idx === visibleGroups.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative inbound line chart */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Inbound Trend — All Time</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={months12} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            {THICKNESS_GROUPS.map(g => (
              <Line key={g.key} type="monotone" dataKey={g.key} name={g.label}
                stroke={g.color} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top 10 SKUs */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Top 10 SKUs by Current Stock</h2>
        <div className="space-y-3">
          {top10.map(p => {
            const pct = top10[0].stock_level > 0 ? (p.stock_level / top10[0].stock_level) * 100 : 0;
            const key = getThicknessKey(p.sku);
            const color = THICKNESS_GROUPS.find(g => g.key === key)?.color ?? '#94a3b8';
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium text-slate-700">{p.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-800 tabular-nums">
                    {p.stock_level.toLocaleString('fr-FR')} {p.unit}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
