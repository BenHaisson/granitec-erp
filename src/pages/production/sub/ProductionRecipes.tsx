import { useEffect, useState } from 'react';
import {
  ArrowLeft, BookOpen, ChevronDown, ChevronRight, Pencil, Plus, Search, Trash2, X, AlertCircle,
} from 'lucide-react';
import { getRecipes, createRecipe, updateRecipe, deleteRecipe } from '@/services/production.service';
import { getProducts } from '@/services/inventory.service';
import type { Recipe, Product, RecipeItem } from '@/types';

// ── Recipe full-screen overlay ────────────────────────────────────
interface RecipeOverlayProps {
  editRecipe: Recipe | null;
  products: Product[];
  fpId: string; setFpId: (v: string) => void;
  lines: { productId: string; quantity: string }[];
  setLines: React.Dispatch<React.SetStateAction<{ productId: string; quantity: string }[]>>;
  saving: boolean;
  error: string;
  onSave: () => void;
  onClose: () => void;
}
function RecipeOverlay({
  editRecipe, products, fpId, setFpId, lines, setLines, saving, error, onSave, onClose,
}: RecipeOverlayProps) {
  const [sidebarSearch, setSidebarSearch] = useState('');
  const productMap    = new Map(products.map(p => [p.id, p]));
  const finishedGoods = products.filter(p => p.type === 'FINISHED');
  const rawMats       = products.filter(p => p.type === 'RAW');

  const filteredRaw = sidebarSearch.trim()
    ? rawMats.filter(p =>
        p.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(sidebarSearch.toLowerCase()))
    : rawMats;
  const rawCats = Array.from(new Set(filteredRaw.map(p => p.category ?? 'Other')));
  const addedIds = new Set(lines.map(l => l.productId).filter(Boolean));

  const addComponent = (productId: string) => {
    if (addedIds.has(productId)) return;
    setLines(ls => {
      const empty = ls.findIndex(l => !l.productId);
      if (empty >= 0) return ls.map((l, i) => i === empty ? { ...l, productId } : l);
      return [...ls, { productId, quantity: '' }];
    });
  };

  const validCount = lines.filter(l => l.productId && Number(l.quantity) > 0).length;

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-slate-800">
            {editRecipe ? 'Edit Recipe' : 'New Recipe'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Finished Product *
            </label>
            <select value={fpId} onChange={e => setFpId(e.target.value)}
              className="px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white min-w-[220px]">
              <option value="">Select product…</option>
              {finishedGoods.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>
          <button onClick={onSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200">
            {saving ? 'Saving…' : editRecipe
              ? `Save Changes${validCount > 0 ? ` (${validCount})` : ''}`
              : `Save Recipe${validCount > 0 ? ` (${validCount})` : ''}`}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 shrink-0">
          <AlertCircle size={15} className="shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — raw material browser */}
        <aside className="w-64 shrink-0 border-r border-slate-100 flex flex-col overflow-hidden bg-slate-50">
          <div className="px-3 pt-3 pb-2 shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
              Raw Materials
            </p>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
                placeholder="Search…"
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {sidebarSearch && (
                <button onClick={() => setSidebarSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {rawCats.length === 0 && (
              <p className="text-xs text-slate-400 px-2 py-4 text-center">No materials found</p>
            )}
            {rawCats.map(cat => (
              <div key={cat} className="mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1">
                  {cat}
                </p>
                {filteredRaw.filter(p => (p.category ?? 'Other') === cat).map(p => (
                  <button
                    key={p.id}
                    onClick={() => addComponent(p.id)}
                    disabled={addedIds.has(p.id)}
                    title={addedIds.has(p.id) ? 'Already added' : `Add ${p.name}`}
                    className={`w-full text-left px-2 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 mb-0.5 ${
                      addedIds.has(p.id)
                        ? 'bg-indigo-50 text-indigo-700 font-semibold cursor-default'
                        : 'text-slate-700 hover:bg-white hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">{p.sku}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        {/* Main — component lines */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Components{validCount > 0 ? ` · ${validCount}` : ''}
              </h2>
              <button
                onClick={() => setLines(ls => [...ls, { productId: '', quantity: '' }])}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
                <Plus size={12} /> Add line
              </button>
            </div>

            {lines.filter(l => l.productId).length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <BookOpen size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm font-medium">Click a material in the sidebar to add it</p>
                <p className="text-xs mt-1 text-slate-300">or use "+ Add line" above</p>
              </div>
            )}

            <div className="space-y-2">
              {lines.map((line, i) => {
                const prod = productMap.get(line.productId);
                return (
                  <div key={i} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-200 transition-colors">
                    <span className="text-xs font-bold text-slate-300 w-5 shrink-0 tabular-nums text-right">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <select
                        value={line.productId}
                        onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, productId: e.target.value } : l))}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                      >
                        <option value="">Select component…</option>
                        <optgroup label="Raw Materials">
                          {rawMats.map(p => (
                            <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        value={line.quantity}
                        placeholder="Qty"
                        onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, quantity: e.target.value } : l))}
                        className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                      {prod && (
                        <span className="text-xs text-slate-400 w-8 shrink-0">{prod.unit ?? 'pcs'}</span>
                      )}
                    </div>
                    <button
                      onClick={() => setLines(ls =>
                        ls.length === 1 ? [{ productId: '', quantity: '' }] : ls.filter((_, j) => j !== i)
                      )}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function ProductionRecipes() {
  const [recipes, setRecipes]   = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [showOverlay, setShowOverlay] = useState(false);
  const [editRecipe, setEditRecipe]   = useState<Recipe | null>(null);
  const [fpId, setFpId]               = useState('');
  const [lines, setLines]             = useState<{ productId: string; quantity: string }[]>([{ productId: '', quantity: '' }]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([getRecipes(), getProducts()])
      .then(([r, p]) => { setRecipes(r); setProducts(p); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const productMap    = new Map(products.map(p => [p.id, p]));
  const finishedGoods = products.filter(p => p.type === 'FINISHED');

  const openCreate = () => {
    setEditRecipe(null);
    setFpId('');
    setLines([{ productId: '', quantity: '' }]);
    setError('');
    setShowOverlay(true);
  };

  const openEdit = (r: Recipe) => {
    setEditRecipe(r);
    setFpId(r.finishedProductId);
    setLines(r.components.map(c => ({ productId: c.productId, quantity: String(c.quantity) })));
    setError('');
    setShowOverlay(true);
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
    if (components.length === 0) { setError('Add at least one component with a quantity.'); return; }
    setError(''); setSaving(true);
    try {
      if (editRecipe) {
        await updateRecipe({ id: editRecipe.id, finishedProductId: fpId, components });
      } else {
        await createRecipe({ finishedProductId: fpId, components });
      }
      setShowOverlay(false); load();
    } catch { setError('Failed to save recipe.'); }
    finally { setSaving(false); }
  };

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Production Recipes</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} in library
          </p>
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
            const fp     = productMap.get(r.finishedProductId);
            const isOpen = expanded.has(r.id);
            const totalStock = r.components.reduce((s, c) => {
              const p = productMap.get(c.productId);
              if (!p) return s;
              return Math.min(s, Math.floor(p.stock_level / c.quantity));
            }, Infinity);
            const feasible = isFinite(totalStock) && totalStock > 0;

            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <button
                  className="w-full px-4 py-4 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(r.id)}>
                  {isOpen
                    ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
                    : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{fp?.name ?? r.finishedProductId}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {r.components.length} component{r.components.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${feasible ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {feasible ? `${totalStock} producible` : 'Stock insufficient'}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-slate-50">
                    <div className="mt-3 space-y-1">
                      {r.components.map((c, i) => {
                        const p  = productMap.get(c.productId);
                        const ok = p ? p.stock_level >= c.quantity : false;
                        return (
                          <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-slate-50 last:border-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-emerald-500' : 'bg-red-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700">{p?.name ?? c.productId}</p>
                              <p className="text-xs text-slate-400 font-mono">{p?.sku ?? ''}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-slate-800">
                                {c.quantity} <span className="text-xs font-normal text-slate-400">{p?.unit ?? 'pcs'}</span>
                              </p>
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

      {/* Full-screen overlay */}
      {showOverlay && (
        <RecipeOverlay
          editRecipe={editRecipe}
          products={products}
          fpId={fpId} setFpId={setFpId}
          lines={lines} setLines={setLines}
          saving={saving}
          error={error}
          onSave={handleSubmit}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </div>
  );
}
