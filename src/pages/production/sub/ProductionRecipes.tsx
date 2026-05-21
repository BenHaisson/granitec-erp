import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, BookOpen } from 'lucide-react';
import { getRecipes, createRecipe, updateRecipe, deleteRecipe } from '@/services/production.service';
import { getProducts } from '@/services/inventory.service';
import Modal from '@/components/ui/Modal';
import type { Recipe, Product, RecipeItem } from '@/types';

export default function ProductionRecipes() {
  const [recipes, setRecipes]   = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [showModal, setShowModal]   = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [fpId, setFpId]             = useState('');
  const [lines, setLines]           = useState<{ productId: string; quantity: string }[]>([{ productId: '', quantity: '' }]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([getRecipes(), getProducts()])
      .then(([r, p]) => { setRecipes(r); setProducts(p); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const productMap = new Map(products.map(p => [p.id, p]));
  const finishedGoods = products.filter(p => p.type === 'FINISHED');
  const rawMats       = products.filter(p => p.type === 'RAW');

  const openCreate = () => {
    setEditRecipe(null);
    setFpId(''); setLines([{ productId: '', quantity: '' }]);
    setError(''); setShowModal(true);
  };

  const openEdit = (r: Recipe) => {
    setEditRecipe(r);
    setFpId(r.finishedProductId);
    setLines(r.components.map(c => ({ productId: c.productId, quantity: String(c.quantity) })));
    setError(''); setShowModal(true);
  };

  const handleDelete = async (r: Recipe) => {
    if (!confirm(`Delete recipe for "${productMap.get(r.finishedProductId)?.name ?? r.finishedProductId}"?`)) return;
    await deleteRecipe(r.id);
    load();
  };

  const handleSubmit = async () => {
    if (!fpId) { setError('Select a finished product.'); return; }
    const components: RecipeItem[] = lines
      .filter(l => l.productId && Number(l.quantity) > 0)
      .map(l => ({ productId: l.productId, quantity: Number(l.quantity) }));
    if (components.length === 0) { setError('Add at least one component.'); return; }
    setError(''); setSaving(true);
    try {
      if (editRecipe) {
        await updateRecipe({ id: editRecipe.id, finishedProductId: fpId, components });
      } else {
        await createRecipe({ finishedProductId: fpId, components });
      }
      setShowModal(false); load();
    } catch { setError('Failed to save recipe.'); }
    finally { setSaving(false); }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Production Recipes</h2>
          <p className="text-sm text-slate-500 mt-0.5">{recipes.length} recipe{recipes.length !== 1 ? 's' : ''} in library</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={15} /> New Recipe
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>
      ) : recipes.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <BookOpen size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-slate-500 font-medium">No recipes yet</p>
          <p className="text-slate-400 text-sm mt-1">Create a recipe to define component requirements</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map(r => {
            const fp = productMap.get(r.finishedProductId);
            const isOpen = expanded.has(r.id);
            const totalStock = r.components.reduce((s, c) => {
              const p = productMap.get(c.productId);
              if (!p) return s;
              return Math.min(s, Math.floor(p.stock_level / c.quantity));
            }, Infinity);
            const feasible = isFinite(totalStock) && totalStock > 0;

            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <button className="w-full px-4 py-4 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(r.id)}>
                  {isOpen ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{fp?.name ?? r.finishedProductId}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.components.length} component{r.components.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${feasible ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {feasible ? `${totalStock} producible` : 'Stock insufficient'}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-slate-50">
                    <div className="mt-3 space-y-2">
                      {r.components.map((c, i) => {
                        const p = productMap.get(c.productId);
                        const ok = p ? p.stock_level >= c.quantity : false;
                        return (
                          <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-slate-50 last:border-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-emerald-500' : 'bg-red-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700">{p?.name ?? c.productId}</p>
                              <p className="text-xs text-slate-400 font-mono">{p?.sku ?? ''}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-slate-800">{c.quantity} <span className="text-xs font-normal text-slate-400">{p?.unit ?? 'pcs'}</span></p>
                              <p className={`text-xs ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
                                {p ? `${p.stock_level.toLocaleString()} in stock` : 'Unknown'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <button onClick={() => openEdit(r)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                        <Pencil size={11} /> Edit
                      </button>
                      <button onClick={() => handleDelete(r)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <Modal title={editRecipe ? 'Edit Recipe' : 'New Recipe'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Finished Product <span className="text-red-500">*</span></label>
              <select value={fpId} onChange={e => setFpId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select product…</option>
                {finishedGoods.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Components</label>
                <button type="button" onClick={() => setLines(l => [...l, { productId: '', quantity: '' }])}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Add line</button>
              </div>
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <select value={line.productId}
                      onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, productId: e.target.value } : l))}
                      className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Select component…</option>
                      <optgroup label="Raw Materials">
                        {rawMats.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </optgroup>
                    </select>
                    <input type="number" min="1" value={line.quantity} placeholder="Qty"
                      onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, quantity: e.target.value } : l))}
                      className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editRecipe ? 'Save Changes' : 'Create Recipe'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
