import { useEffect, useState } from 'react';
import { getProducts } from '@/services/inventory.service';
import Badge from '@/components/ui/Badge';
import type { Product } from '@/types';

export default function WarehousePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts()
      .then(p => setProducts(p.filter(prod => prod.type === 'FINISHED')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Warehouse</h1>
        <p className="text-slate-500 text-sm mt-1">Finished goods stock</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-500">{p.sku}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">{p.stock_level} {p.unit}</td>
                  <td className="px-4 py-3">
                    <Badge
                      label={p.stock_level <= 0 ? 'Empty' : p.stock_level <= p.min_stock ? 'Low' : 'OK'}
                      variant={p.stock_level <= 0 ? 'red' : p.stock_level <= p.min_stock ? 'yellow' : 'green'}
                    />
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">No finished products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
