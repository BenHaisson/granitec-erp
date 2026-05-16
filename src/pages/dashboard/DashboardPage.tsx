import { useEffect, useState, type ElementType } from 'react';
import { Package, AlertTriangle, Factory, ShoppingCart } from 'lucide-react';
import { getProducts } from '@/services/inventory.service';
import { getProductionOrders } from '@/services/production.service';
import { getSales } from '@/services/sales.service';
import type { Product, ProductionOrder, Sale } from '@/types';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ElementType;
  color: string;
  sub?: string;
}

function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProducts(), getProductionOrders(), getSales()])
      .then(([p, o, s]) => { setProducts(p); setOrders(o); setSales(s); })
      .finally(() => setLoading(false));
  }, []);

  const lowStock = products.filter(p => p.stock_level <= p.min_stock);
  const activeOrders = orders.filter(o => o.status === 'PLANNED' || o.status === 'IN_PROGRESS');
  const totalRevenue = sales.reduce((sum, s) => sum + (s.totalAmount ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Factory overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Products"
          value={products.length}
          icon={Package}
          color="bg-blue-500"
          sub="SKUs tracked"
        />
        <StatCard
          label="Low Stock Alerts"
          value={lowStock.length}
          icon={AlertTriangle}
          color={lowStock.length > 0 ? 'bg-red-500' : 'bg-green-500'}
          sub={lowStock.length > 0 ? 'Needs attention' : 'All good'}
        />
        <StatCard
          label="Active Orders"
          value={activeOrders.length}
          icon={Factory}
          color="bg-purple-500"
          sub="Production in progress"
        />
        <StatCard
          label="Total Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          icon={ShoppingCart}
          color="bg-emerald-500"
          sub={`${sales.length} sales recorded`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Low Stock Items</h2>
          {lowStock.length === 0 ? (
            <p className="text-slate-400 text-sm">All products are sufficiently stocked.</p>
          ) : (
            <div className="space-y-3">
              {lowStock.slice(0, 6).map(p => (
                <div key={p.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600">{p.stock_level} {p.unit}</p>
                    <p className="text-xs text-slate-400">min: {p.min_stock}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Production Orders</h2>
          {activeOrders.length === 0 ? (
            <p className="text-slate-400 text-sm">No active production orders.</p>
          ) : (
            <div className="space-y-3">
              {activeOrders.slice(0, 6).map(o => (
                <div key={o.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Order #{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-400">Qty: {o.quantity}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
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
      </div>
    </div>
  );
}
