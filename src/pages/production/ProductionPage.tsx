import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  getProductionOrders, getRecipes, createProductionOrder, validateAndCompleteProduction,
} from '@/services/production.service';
import Badge from '@/components/ui/Badge';
import type { ProductionOrder, Recipe } from '@/types';

const statusVariant: Record<string, 'blue' | 'yellow' | 'green' | 'red'> = {
  PLANNED: 'yellow',
  IN_PROGRESS: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

export default function ProductionPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRecipeId, setNewRecipeId] = useState('');
  const [newQty, setNewQty] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([getProductionOrders(), getRecipes()])
      .then(([o, r]) => { setOrders(o); setRecipes(r); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newRecipeId || !newQty) return;
    setSaving(true);
    try {
      await createProductionOrder(newRecipeId, Number(newQty));
      setNewRecipeId('');
      setNewQty('');
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (id: string) => {
    if (!confirm('Complete this production order? This will deduct raw materials.')) return;
    try {
      await validateAndCompleteProduction(id);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to complete order');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Production</h1>
        <p className="text-slate-500 text-sm mt-1">Manage production orders</p>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-base font-semibold text-slate-700 mb-4">New Production Order</h2>
        <div className="flex gap-3">
          <select
            value={newRecipeId}
            onChange={e => setNewRecipeId(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select recipe...</option>
            {recipes.map(r => (
              <option key={r.id} value={r.id}>{r.id}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Quantity"
            value={newQty}
            onChange={e => setNewQty(e.target.value)}
            className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreate}
            disabled={saving || !newRecipeId || !newQty}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={16} />
            Create
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Order ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Recipe</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-mono text-slate-600">{o.id.slice(0, 10)}…</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{o.recipeId}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">{o.quantity}</td>
                  <td className="px-4 py-3">
                    <Badge label={o.status} variant={statusVariant[o.status] ?? 'gray'} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(o.status === 'PLANNED' || o.status === 'IN_PROGRESS') && (
                      <button
                        onClick={() => handleComplete(o.id)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No production orders yet.
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
