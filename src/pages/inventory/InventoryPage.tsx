import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { getProducts, adjustStock } from '@/services/inventory.service';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import type { Product } from '@/types';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getProducts().then(setProducts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdjust = async () => {
    if (!adjustTarget || !adjustQty) return;
    setSaving(true);
    try {
      await adjustStock(adjustTarget.id, Number(adjustQty), 'ADJUSTMENT', adjustNote);
      setAdjustTarget(null);
      setAdjustQty('');
      setAdjustNote('');
      load();
    } finally {
      setSaving(false);
    }
  };

  const stockBadge = (p: Product): { label: string; variant: 'red' | 'yellow' | 'green' } => {
    if (p.stock_level <= 0) return { label: 'Out of Stock', variant: 'red' };
    if (p.stock_level <= p.min_stock) return { label: 'Low Stock', variant: 'yellow' };
    return { label: 'In Stock', variant: 'green' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
          <p className="text-slate-500 text-sm mt-1">{products.length} products tracked</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} />
          Add Product
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Min</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(p => {
                const badge = stockBadge(p);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-mono">{p.sku}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{p.type}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">{p.stock_level} {p.unit}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 text-right">{p.min_stock}</td>
                    <td className="px-4 py-3"><Badge label={badge.label} variant={badge.variant} /></td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setAdjustTarget(p)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {adjustTarget && (
        <Modal title={`Adjust Stock — ${adjustTarget.name}`} onClose={() => setAdjustTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Current stock: <strong>{adjustTarget.stock_level} {adjustTarget.unit}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Quantity (use negative to remove)
              </label>
              <input
                type="number"
                value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 50 or -10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
              <input
                type="text"
                value={adjustNote}
                onChange={e => setAdjustNote(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Reason for adjustment"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAdjust}
                disabled={saving || !adjustQty}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Apply Adjustment'}
              </button>
              <button
                onClick={() => setAdjustTarget(null)}
                className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
