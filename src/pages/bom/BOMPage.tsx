import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { getRecipes, createRecipe, updateRecipe } from '@/services/production.service';
import { getProducts } from '@/services/inventory.service';
import Modal from '@/components/ui/Modal';
import type { Recipe, Product } from '@/types';

type ComponentRow = { productId: string; quantity: number };
type ModalState = { mode: 'create' } | { mode: 'edit'; recipe: Recipe };

// ── Recipe modal ──────────────────────────────────────────────────
function RecipeModal({
  state, finishedList, rawList, onSave, onClose,
}: {
  state: ModalState;
  finishedList: Product[];
  rawList: Product[];
  onSave: () => void;
  onClose: () => void;
}) {
  const [finishedId, setFinishedId] = useState(
    state.mode === 'edit' ? state.recipe.finishedProductId : ''
  );
  const [rows, setRows] = useState<ComponentRow[]>(
    state.mode === 'edit'
      ? state.recipe.components.map(c => ({ productId: c.productId, quantity: c.quantity }))
      : [{ productId: '', quantity: 1 }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addRow = () => setRows(r => [...r, { productId: '', quantity: 1 }]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<ComponentRow>) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!finishedId) { setError('Select a finished product.'); return; }
    if (rows.some(r => !r.productId || r.quantity <= 0)) {
      setError('All component rows must have a material and quantity > 0.');
      return;
    }
    setSaving(true);
    try {
      const recipe = { finishedProductId: finishedId, components: rows };
      if (state.mode === 'create') {
        await createRecipe(recipe);
      } else {
        await updateRecipe({ id: state.recipe.id, ...recipe });
      }
      onSave();
    } catch {
      setError('Failed to save recipe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={state.mode === 'create' ? 'New Recipe' : 'Edit Recipe'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Finished product */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Finished Product</label>
          <select value={finishedId} onChange={e => setFinishedId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required>
            <option value="">Select a product…</option>
            {finishedList.map(p => (
              <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>
            ))}
          </select>
        </div>

        {/* Components */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Components</label>
          {rawList.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              No raw materials defined yet. Add them in Warehouse → Raw Materials first.
            </p>
          )}
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select value={row.productId} onChange={e => updateRow(i, { productId: e.target.value })}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select material…</option>
                  {rawList.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                  ))}
                </select>
                <input type="number" min="0.001" step="any" value={row.quantity}
                  onChange={e => updateRow(i, { quantity: Number(e.target.value) })}
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addRow}
            className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
            <Plus size={13} /> Add component
          </button>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Recipe'}
          </button>
          <button type="button" onClick={onClose}
            className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function BOMPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getRecipes(), getProducts()])
      .then(([r, p]) => {
        setRecipes(r);
        setProductMap(new Map(p.map(prod => [prod.id, prod])));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const finishedList = [...productMap.values()]
    .filter(p => p.type === 'FINISHED')
    .sort((a, b) => a.name.localeCompare(b.name));

  const rawList = [...productMap.values()]
    .filter(p => p.type === 'RAW')
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSave = () => {
    setModal(null);
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">BOM Recipes</h1>
          <p className="text-slate-500 text-sm mt-1">{recipes.length} recipe{recipes.length !== 1 ? 's' : ''} defined</p>
        </div>
        <button onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> New Recipe
        </button>
      </div>

      {/* Recipe list */}
      <div className="space-y-4">
        {recipes.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-slate-400 text-sm shadow-sm border border-slate-100">
            No BOM recipes yet. Click <span className="font-medium text-slate-600">New Recipe</span> to get started.
          </div>
        ) : (
          recipes.map(recipe => {
            const finished = productMap.get(recipe.finishedProductId);
            return (
              <div key={recipe.id} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-base font-semibold text-slate-800">
                    {finished?.name ?? recipe.finishedProductId}
                  </h2>
                  <button onClick={() => setModal({ mode: 'edit', recipe })}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Pencil size={14} />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-4">SKU: {finished?.sku ?? '—'}</p>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase pb-2">Component</th>
                      <th className="text-right text-xs font-semibold text-slate-500 uppercase pb-2">Qty per unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recipe.components.map(c => {
                      const prod = productMap.get(c.productId);
                      return (
                        <tr key={c.productId}>
                          <td className="py-2 text-sm text-slate-700">{prod?.name ?? c.productId}</td>
                          <td className="py-2 text-sm text-slate-700 text-right tabular-nums">
                            {c.quantity} {prod?.unit ?? ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {modal && (
        <RecipeModal
          state={modal}
          finishedList={finishedList}
          rawList={rawList}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
