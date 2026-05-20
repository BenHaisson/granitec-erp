import { useEffect, useState, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, AlertTriangle, Factory, ShoppingCart,
  TrendingUp, Layers, BarChart3, ArrowUpRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getProducts, getMovements } from '@/services/inventory.service';
import { getProductionOrders } from '@/services/production.service';
import { getSales } from '@/services/sales.service';
import { getOrders } from '@/services/orders.service';
import type { Product, ProductionOrder, Sale, InventoryMovement } from '@/types';
import type { SalesOrder } from '@/types';

// ── Stat card ────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  icon: ElementType;
  gradient: string;
  shadow: string;
  sub?: string;
  trend?: { value: string; positive: boolean };
  href?: string;
}

function StatCard({ label, value, icon: Icon, gradient, shadow, sub, trend, href }: StatCardProps) {
  const navigate = useNavigate();
  return (
    <div
      onClick={href ? () => navigate(href) : undefined}
      className={`bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col gap-3 ${href ? 'cursor-pointer hover:shadow-md hover:border-slate-200 transition-all' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-linear-to-br ${gradient} shadow-md ${shadow}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-500'}`}>
          <ArrowUpRight size={12} className={trend.positive ? '' : 'rotate-180'} />
          {trend.value}
        </div>
      )}
    </div>
  );
}

// ── Chart tooltip ────────────────────────────────────────────────
function MiniTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md p-2 text-xs">
      <p className="text-slate-500 mb-0.5">{label}</p>
      <p className="font-semibold text-slate-800">{payload[0].value.toLocaleString('fr-FR')} pcs</p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────
function tsToDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate(): Date }).toDate();
  return new Date(v as string);
}

function buildRecentMonths(orders: SalesOrder[], n = 6) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    let pcs = 0;
    for (const o of orders) {
      const od = tsToDate(o.date);
      const oym = `${od.getFullYear()}-${String(od.getMonth() + 1).padStart(2, '0')}`;
      if (oym === ym) pcs += o.lines.reduce((s, l) => s + l.totalQty, 0);
    }
    return { label, pcs };
  });
}

const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProducts(), getProductionOrders(), getSales(), getOrders(), getMovements()])
      .then(([p, o, s, so, m]) => {
        setProducts(p); setOrders(o); setSales(s); setSalesOrders(so); setMovements(m);
      })
      .finally(() => setLoading(false));
  }, []);

  const rawMaterials    = products.filter(p => p.type === 'RAW');
  const finishedGoods   = products.filter(p => p.type === 'FINISHED');
  const lowStock        = products.filter(p => p.stock_level > 0 && p.stock_level <= p.min_stock);
  const emptyStock      = products.filter(p => p.stock_level <= 0);
  const activeOrders    = orders.filter(o => o.status === 'PLANNED' || o.status === 'IN_PROGRESS');
  const totalRevenue    = sales.reduce((sum, s) => sum + (s.totalAmount ?? 0), 0);
  const totalDiscStock  = rawMaterials.reduce((s, p) => s + p.stock_level, 0);

  const recentSupply = [...movements]
    .filter(m => m.reason === 'PURCHASE')
    .sort((a, b) => tsToDate(b.createdAt).getTime() - tsToDate(a.createdAt).getTime())
    .slice(0, 5);

  const productMap = Object.fromEntries(products.map(p => [p.id, p]));
  const monthlyData = buildRecentMonths(salesOrders);
  const maxPcs = Math.max(...monthlyData.map(d => d.pcs), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-0.5 capitalize">{today}</p>
      </div>

      {/* KPI grid — row 1 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Finished Goods"
          value={finishedGoods.length}
          icon={Package}
          gradient="from-blue-400 to-blue-600"
          shadow="shadow-blue-500/30"
          sub={`${finishedGoods.filter(p => p.stock_level > 0).length} with stock`}
          href="/warehouse"
        />
        <StatCard
          label="Raw Materials"
          value={rawMaterials.length}
          icon={Layers}
          gradient="from-indigo-400 to-indigo-600"
          shadow="shadow-indigo-500/30"
          sub={`${totalDiscStock.toLocaleString('fr-FR')} pcs total`}
          href="/inventory"
        />
        <StatCard
          label="Stock Alerts"
          value={lowStock.length + emptyStock.length}
          icon={AlertTriangle}
          gradient={lowStock.length + emptyStock.length > 0 ? 'from-red-400 to-red-600' : 'from-emerald-400 to-emerald-600'}
          shadow={lowStock.length + emptyStock.length > 0 ? 'shadow-red-500/30' : 'shadow-emerald-500/30'}
          sub={`${emptyStock.length} empty · ${lowStock.length} low`}
          href="/inventory"
        />
        <StatCard
          label="Active Orders"
          value={activeOrders.length}
          icon={Factory}
          gradient="from-purple-400 to-purple-600"
          shadow="shadow-purple-500/30"
          sub="production in progress"
          href="/production"
        />
      </div>

      {/* KPI grid — row 2 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={`${totalRevenue.toLocaleString('fr-FR')} DH`}
          icon={ShoppingCart}
          gradient="from-emerald-400 to-emerald-600"
          shadow="shadow-emerald-500/30"
          sub={`${sales.length} sales`}
        />
        <StatCard
          label="Sales Orders"
          value={salesOrders.length}
          icon={BarChart3}
          gradient="from-cyan-400 to-cyan-600"
          shadow="shadow-cyan-500/30"
          sub="all time"
          href="/sales"
        />
        <StatCard
          label="Supply Receipts"
          value={movements.filter(m => m.reason === 'PURCHASE').length}
          icon={TrendingUp}
          gradient="from-amber-400 to-amber-600"
          shadow="shadow-amber-500/30"
          sub="purchase movements"
          href="/inventory"
        />
        <StatCard
          label="Completed Orders"
          value={orders.filter(o => o.status === 'COMPLETED').length}
          icon={Factory}
          gradient="from-slate-500 to-slate-700"
          shadow="shadow-slate-500/20"
          sub="production done"
          href="/production"
        />
      </div>

      {/* Chart + alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={15} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-700">Sales — Last 6 Months (pcs)</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip content={<MiniTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="pcs" radius={[6, 6, 0, 0]}>
                {monthlyData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.pcs === maxPcs ? 'url(#barGradient)' : '#bfdbfe'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stock alerts */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={15} className="text-red-400" />
            <h2 className="text-sm font-semibold text-slate-700">Stock Alerts</h2>
          </div>
          {lowStock.length + emptyStock.length === 0 ? (
            <p className="text-slate-400 text-sm">All products are sufficiently stocked.</p>
          ) : (
            <div className="space-y-2.5">
              {[...emptyStock, ...lowStock].slice(0, 7).map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{p.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold tabular-nums ${p.stock_level <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                      {p.stock_level} {p.unit}
                    </p>
                    <p className="text-xs text-slate-400">min {p.min_stock}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active production orders */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Factory size={15} className="text-purple-500" />
            <h2 className="text-sm font-semibold text-slate-700">Production Orders</h2>
          </div>
          {activeOrders.length === 0 ? (
            <p className="text-slate-400 text-sm">No active production orders.</p>
          ) : (
            <div className="space-y-2.5">
              {activeOrders.slice(0, 6).map(o => (
                <div key={o.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Order #{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-400">Qty: {o.quantity}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    o.status === 'IN_PROGRESS'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent supply receipts */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-700">Recent Supply Receipts</h2>
          </div>
          {recentSupply.length === 0 ? (
            <p className="text-slate-400 text-sm">No supply receipts yet.</p>
          ) : (
            <div className="space-y-2.5">
              {recentSupply.map(m => {
                const product = productMap[m.productId];
                return (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">
                        {product?.name ?? m.productId}
                      </p>
                      <p className="text-xs text-slate-400">
                        {m.note} · {tsToDate(m.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-indigo-600 tabular-nums shrink-0">
                      +{m.quantity.toLocaleString('fr-FR')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
