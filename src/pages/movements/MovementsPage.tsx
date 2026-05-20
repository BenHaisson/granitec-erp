import { useEffect, useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { getMovements, getProducts } from '@/services/inventory.service';
import Badge from '@/components/ui/Badge';
import type { InventoryMovement, Product } from '@/types';

const reasonVariant: Record<string, 'blue' | 'green' | 'red' | 'yellow' | 'gray'> = {
  PRODUCTION: 'blue',
  PURCHASE: 'green',
  SHIPMENT: 'gray',
  ADJUSTMENT: 'yellow',
  WASTE: 'red',
  SALE: 'green',
};

function tsToDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate(): Date }).toDate();
  return new Date(v as string);
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function MovementsPage() {
  const [movements, setMovements]   = useState<InventoryMovement[]>([]);
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading]       = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');

  useEffect(() => {
    Promise.all([getMovements(), getProducts()])
      .then(([m, p]) => {
        setMovements(m.sort((a, b) => tsToDate(b.createdAt).getTime() - tsToDate(a.createdAt).getTime()));
        setProductMap(new Map(p.map(prod => [prod.id, prod])));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return movements.filter(m => {
      const d = tsToDate(m.createdAt);
      if (from && d < new Date(from)) return false;
      if (to   && d > new Date(to + 'T23:59:59')) return false;
      return true;
    });
  }, [movements, from, to]);

  const exportCSV = () => {
    const header = ['Date', 'Product', 'SKU', 'Reason', 'Quantity', 'Note'];
    const rows = filtered.map(m => {
      const p = productMap.get(m.productId);
      return [
        tsToDate(m.createdAt).toLocaleDateString('fr-FR'),
        p?.name ?? m.productId,
        p?.sku ?? '',
        m.reason,
        m.quantity,
        m.note ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movements_${toISODate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Movements</h1>
          <p className="text-slate-500 text-sm mt-1">
            {loading ? '…' : `${filtered.length} of ${movements.length} entries`}
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-sm"
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">From</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">To</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        {(from || to) && (
          <button onClick={() => { setFrom(''); setTo(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline">
            Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reason</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(m => {
                const prod = productMap.get(m.productId);
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-400 tabular-nums whitespace-nowrap">
                      {tsToDate(m.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <p className="truncate max-w-[200px]">{prod?.name ?? m.productId}</p>
                      {prod?.sku && <p className="text-xs text-slate-400 font-mono">{prod.sku}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={m.reason} variant={reasonVariant[m.reason] ?? 'gray'} />
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold text-right tabular-nums ${m.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {m.quantity > 0 ? '+' : ''}{m.quantity.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-[180px] truncate">{m.note || '—'}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                    {movements.length === 0 ? 'No movements recorded yet.' : 'No movements in selected date range.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
