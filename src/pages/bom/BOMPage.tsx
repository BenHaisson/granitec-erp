import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import ProductPickerDropdown from '@/components/ui/ProductPickerDropdown';
import { getRecipes, createRecipe, updateRecipe, deleteRecipe } from '@/services/production.service';
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
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Finished Product</label>
          <ProductPickerDropdown
            products={finishedList}
            value={finishedId}
            onChange={p => setFinishedId(p.id)}
            placeholder="Select a finished product…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Components</label>
          {rawList.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              No raw materials defined yet. Add them in Inventory first.
            </p>
          )}
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                  <ProductPickerDropdown
                    products={rawList}
                    value={row.productId}
                    onChange={p => updateRow(i, { productId: p.id })}
                    placeholder="Select material…"
                  />
                </div>
                <input type="number" min="0.001" step="any" value={row.quantity}
                  onChange={e => updateRow(i, { quantity: Number(e.target.value) })}
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0" />
                <button type="button" onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  className="p-2 mt-0.5 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addRow}
            className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            <Plus size={13} /> Add component
          </button>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save Recipe'}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const toggleExpand = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSave = () => { setModal(null); load(); };

  const handleDelete = async (recipe: Recipe) => {
    const name = productMap.get(recipe.finishedProductId)?.name ?? recipe.id;
    if (!confirm(`Delete recipe for "${name}"? This cannot be undone.`)) return;
    await deleteRecipe(recipe.id);
    load();
  };

  // Feasibility: how many finished units can be produced from current stock
  const producible = (recipe: Recipe) =>
    recipe.components.reduce((min, c) => {
      const p = productMap.get(c.productId);
      if (!p) return 0;
      return Math.min(min, Math.floor(p.stock_level / c.quantity));
    }, Infinity);

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
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={15} /> New Recipe
        </button>
      </div>

      {/* Recipe list */}
      {recipes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <BookOpen size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-slate-500 font-medium">No BOM recipes yet</p>
          <p className="text-slate-400 text-sm mt-1">Click <span className="font-semibold text-slate-500">New Recipe</span> to define a bill of materials</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recipes.map(recipe => {
            const finished = productMap.get(recipe.finishedProductId);
            const isOpen = expanded.has(recipe.id);
            const qty = producible(recipe);
            const feasible = isFinite(qty) && qty > 0;

            return (
              <div key={recipe.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Collapsed row — always visible */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button
                    onClick={() => toggleExpand(recipe.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left group"
                  >
                    {isOpen
                      ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
                      : <ChevronRight size={14} className="text-slate-400 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                        {finished?.name ?? recipe.finishedProductId}
                      </p>
                    </div>
                  </button>

                  {/* Meta badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline text-xs text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded">
                      {finished?.sku ?? '—'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {recipe.components.length} component{recipe.components.length !== 1 ? 's' : ''}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      feasible ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {feasible ? `${qty} producible` : 'No stock'}
                    </span>
                    <button onClick={() => setModal({ mode: 'edit', recipe })}
                      className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(recipe)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Expanded component table */}
                {isOpen && (
                  <div className="border-t border-slate-50 px-4 pb-4 pt-3">
                    <div className="space-y-1.5">
                      {recipe.components.map(c => {
                        const prod = productMap.get(c.productId);
                        const ok = prod ? prod.stock_level >= c.quantity : false;
                        return (
                          <div key={c.productId} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-emerald-500' : 'bg-red-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{prod?.name ?? c.productId}</p>
                              <p className="text-xs text-slate-400 font-mono">{prod?.sku ?? ''}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-slate-800 tabular-nums">
                                {c.quantity} <span className="text-xs font-normal text-slate-400">{prod?.unit ?? 'pcs'}</span>
                              </p>
                              <p className={`text-xs tabular-nums ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
                                {prod ? `${prod.stock_level.toLocaleString()} in stock` : 'Unknown'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
