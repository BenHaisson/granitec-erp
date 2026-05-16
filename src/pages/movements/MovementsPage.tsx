import { useEffect, useState } from 'react';
import { getMovements } from '@/services/inventory.service';
import { getProducts } from '@/services/inventory.service';
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

export default function MovementsPage() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMovements(), getProducts()])
      .then(([m, p]) => {
        setMovements(m);
        setProductMap(new Map(p.map(prod => [prod.id, prod])));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Movements</h1>
        <p className="text-slate-500 text-sm mt-1">Full inventory movement audit log</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reason</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Quantity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {movements.map(m => {
                const prod = productMap.get(m.productId);
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">{prod?.name ?? m.productId}</td>
                    <td className="px-4 py-3">
                      <Badge label={m.reason} variant={reasonVariant[m.reason] ?? 'gray'} />
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold text-right ${m.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {m.quantity > 0 ? '+' : ''}{m.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{m.note || '—'}</td>
                  </tr>
                );
              })}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">No movements recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
