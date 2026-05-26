import { useEffect, useRef, useState } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, PackagePlus, Pencil, Plus, Search, Trash2, X, AlertCircle,
} from 'lucide-react';
import { getRecipes, createRecipe, updateRecipe, deleteRecipe } from '@/services/production.service';
import { getProducts } from '@/services/inventory.service';
import type { Recipe, Product, RecipeItem } from '@/types';

// ── Recipe line type ──────────────────────────────────────────────
type RecipeLine = {
  productId: string;
  productName: string;
  sku: string;
  quantity: string;
  search: string;
  showSuggestions: boolean;
  highlightIdx: number;
};

const EMPTY_LINE = (): RecipeLine => ({
  productId: '', productName: '', sku: '', quantity: '',
  search: '', showSuggestions: false, highlightIdx: -1,
});

// ── RecipeRow — mirrors DraftRow in ShippingPage ──────────────────
interface RecipeRowProps {
  line: RecipeLine;
  rowNum: number;
  products: Product[];
  qtyRef: (el: HTMLInputElement | null) => void;
  onUpdate: (patch: Partial<RecipeLine>) => void;
  onSelect: (p: Product) => void;
  onRemove: () => void;
  onQtyTab: () => void;
}
function RecipeRow({ line, rowNum, products, qtyRef, onUpdate, onSelect, onRemove, onQtyTab }: RecipeRowProps) {
  const q = line.search.toLowerCase();
  const suggestions = line.search.length > 0
    ? products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 10)
    : [];
  const selected = products.find(p => p.id === line.productId);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!line.showSuggestions) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        onUpdate({ showSuggestions: false });
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [line.showSuggestions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!line.showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); onUpdate({ highlightIdx: Math.min(line.highlightIdx + 1, suggestions.length - 1) }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); onUpdate({ highlightIdx: Math.max(line.highlightIdx - 1, 0) }); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = suggestions[line.highlightIdx >= 0 ? line.highlightIdx : 0];
      if (picked) onSelect(picked);
    } else if (e.key === 'Escape') { onUpdate({ showSuggestions: false }); }
  };

  return (
    <div className="grid grid-cols-[40px_1fr_160px_100px_180px_44px] gap-3 items-center px-4 py-2.5 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all group">
      <span className="text-sm font-bold text-slate-300 tabular-nums text-center">{rowNum}</span>

      {/* Inline search */}
      <div ref={containerRef} className="relative">
        {line.productId ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer"
            onClick={() => onUpdate({ productId: '', productName: '', sku: '', search: '', showSuggestions: true, highlightIdx: -1 })}>
            <span className="flex-1 text-sm font-semibold text-slate-800 truncate">{selected?.name}</span>
            <X size={13} className="text-indigo-400 shrink-0" />
          </div>
        ) : (
          <input
            type="text" data-recipe-search
            value={line.search}
            onChange={e => onUpdate({ search: e.target.value, showSuggestions: true, highlightIdx: -1 })}
            onFocus={() => onUpdate({ showSuggestions: true })}
            onKeyDown={handleKeyDown}
            placeholder="Type to search component…"
            autoComplete="off"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white"
          />
        )}
        {line.showSuggestions && suggestions.length > 0 && !line.productId && (
          <div className="absolute z-[300] left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
              {suggestions.map((p, si) => (
                <button key={p.id} type="button" onMouseDown={() => onSelect(p)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${si === line.highlightIdx ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{p.sku}</p>
                  </div>
                  <span className={`ml-3 text-xs font-semibold tabular-nums shrink-0 ${p.stock_level < 0 ? 'text-red-500' : p.stock_level === 0 ? 'text-orange-500' : 'text-slate-500'}`}>
                    {p.stock_level} {p.unit}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <span className="text-xs font-mono text-slate-400 truncate px-1">{line.sku || '—'}</span>

      <span className={`text-sm font-bold tabular-nums text-right pr-2 ${
        !selected ? 'text-slate-200' :
        selected.stock_level < 0 ? 'text-red-500' :
        selected.stock_level === 0 ? 'text-orange-400' : 'text-slate-600'
      }`}>
        {selected ? selected.stock_level.toLocaleString() : '—'}
      </span>

      <input ref={qtyRef} type="number" min="0.001" step="any" placeholder="0"
        value={line.quantity}
        onChange={e => onUpdate({ quantity: e.target.value })}
        onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); onQtyTab(); } }}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg text-base font-bold text-right focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white tabular-nums"
      />

      <button type="button" onClick={onRemove}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

// ── Recipe full-screen overlay ────────────────────────────────────
interface RecipeOverlayProps {
  editRecipe: Recipe | null;
  products: Product[];
  fpId: string; setFpId: (v: string) => void;
  lines: RecipeLine[];
  saving: boolean;
  error: string;
  onSave: () => void;
  onClose: () => void;
  onAddLine: () => void;
  onRemoveLine: (i: number) => void;
  onUpdateLine: (i: number, patch: Partial<RecipeLine>) => void;
  onSelectProduct: (i: number, p: Product) => void;
}
function RecipeOverlay({
  editRecipe, products, fpId, setFpId, lines, saving, error,
  onSave, onClose, onAddLine, onRemoveLine, onUpdateLine, onSelectProduct,
}: RecipeOverlayProps) {
  const qtyRefs = useRef<HTMLInputElement[]>([]);
  const pendingQuickAdd = useRef<{ idx: number; data: Partial<RecipeLine> } | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  const rawMats     = products.filter(p => p.type === 'RAW');
  const finishedGoods = products.filter(p => p.type === 'FINISHED');
  const validCount  = lines.filter(l => l.productId && Number(l.quantity) > 0).length;

  // Flush pending quick-add once the new line exists
  useEffect(() => {
    if (!pendingQuickAdd.current) return;
    const { idx, data } = pendingQuickAdd.current;
    if (lines.length > idx) {
      onUpdateLine(idx, data);
      pendingQuickAdd.current = null;
      setTimeout(() => qtyRefs.current[idx]?.focus(), 40);
    }
  }, [lines.length]);

  const handleQtyTab = (i: number) => {
    if (i === lines.length - 1) {
      onAddLine();
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('[data-recipe-search]');
        inputs[inputs.length - 1]?.focus();
      }, 50);
    } else {
      qtyRefs.current[i + 1]?.focus();
    }
  };

  const handleQuickAdd = (p: Product) => {
    const data: Partial<RecipeLine> = {
      productId: p.id, productName: p.name, sku: p.sku,
      search: p.name, showSuggestions: false, highlightIdx: -1,
    };
    const emptyIdx = lines.findIndex(l => !l.productId);
    if (emptyIdx >= 0) {
      onUpdateLine(emptyIdx, data);
      setTimeout(() => qtyRefs.current[emptyIdx]?.focus(), 40);
    } else {
      pendingQuickAdd.current = { idx: lines.length, data };
      onAddLine();
    }
  };

  const qs = quickSearch.trim().toLowerCase();
  const sidebarProducts = qs
    ? rawMats.filter(p => p.name.toLowerCase().includes(qs) || p.sku.toLowerCase().includes(qs))
    : rawMats;
  const sidebarCats = Array.from(new Set(sidebarProducts.map(p => p.category ?? 'Other')));
  const addedIds = new Set(lines.map(l => l.productId).filter(Boolean));

  const toggleCat = (cat: string) => setCollapsedCats(prev => {
    const next = new Set(prev);
    prev.has(cat) ? next.delete(cat) : next.add(cat);
    return next;
  });

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={20} />
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
            className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-indigo-200">
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
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={quickSearch} onChange={e => setQuickSearch(e.target.value)}
                placeholder="Quick search…"
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {sidebarCats.map(cat => {
              const catProducts = sidebarProducts.filter(p => (p.category ?? 'Other') === cat);
              const collapsed = collapsedCats.has(cat);
              return (
                <div key={cat} className="mb-1">
                  <button onClick={() => toggleCat(cat)}
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 text-left rounded-lg hover:bg-slate-200/60 transition-colors">
                    <ChevronDown size={12} className={`text-slate-400 transition-transform shrink-0 ${collapsed ? '-rotate-90' : ''}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{cat}</span>
                    <span className="ml-auto text-[10px] text-slate-400">{catProducts.length}</span>
                  </button>
                  {!collapsed && catProducts.map(p => (
                    <button key={p.id} onClick={() => handleQuickAdd(p)}
                      disabled={addedIds.has(p.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${addedIds.has(p.id) ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white hover:shadow-sm'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate leading-tight">{p.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{p.sku}</p>
                      </div>
                      <PackagePlus size={12} className={`shrink-0 ${addedIds.has(p.id) ? 'text-slate-300' : 'text-indigo-400'}`} />
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[40px_1fr_160px_100px_180px_44px] gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50 shrink-0 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span className="text-center">#</span>
            <span>Component</span>
            <span>SKU</span>
            <span className="text-right pr-2">Stock</span>
            <span className="text-right pr-4">Qty / unit</span>
            <span />
          </div>

          {/* Lines */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
            {lines.map((line, i) => (
              <RecipeRow
                key={i}
                line={line} rowNum={i + 1}
                products={rawMats}
                qtyRef={el => { qtyRefs.current[i] = el!; }}
                onUpdate={patch => onUpdateLine(i, patch)}
                onSelect={p => onSelectProduct(i, p)}
                onRemove={() => onRemoveLine(i)}
                onQtyTab={() => handleQtyTab(i)}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
            <button type="button" onClick={onAddLine}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
              <Plus size={15} /> Add Line
            </button>
            {validCount > 0 && (
              <p className="text-sm font-semibold text-slate-500">
                {validCount} component{validCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
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
  const [lines, setLines]             = useState<RecipeLine[]>([EMPTY_LINE()]);
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

  const addLine    = () => setLines(l => [...l, EMPTY_LINE()]);
  const removeLine = (i: number) => setLines(l => l.length === 1 ? [EMPTY_LINE()] : l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<RecipeLine>) =>
    setLines(l => l.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  const selectProduct = (i: number, p: Product) =>
    setLines(l => l.map((row, idx) => idx === i
      ? { ...row, productId: p.id, productName: p.name, sku: p.sku, search: p.name, showSuggestions: false, highlightIdx: -1 }
      : row));

  const openCreate = () => {
    setEditRecipe(null);
    setFpId('');
    setLines([EMPTY_LINE()]);
    setError('');
    setShowOverlay(true);
  };

  const openEdit = (r: Recipe) => {
    setEditRecipe(r);
    setFpId(r.finishedProductId);
    setLines(r.components.map(c => {
      const p = productMap.get(c.productId);
      return {
        productId: c.productId,
        productName: p?.name ?? '',
        sku: p?.sku ?? '',
        quantity: String(c.quantity),
        search: p?.name ?? c.productId,
        showSuggestions: false,
        highlightIdx: -1,
      };
    }));
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
          lines={lines}
          saving={saving}
          error={error}
          onSave={handleSubmit}
          onClose={() => setShowOverlay(false)}
          onAddLine={addLine}
          onRemoveLine={removeLine}
          onUpdateLine={updateLine}
          onSelectProduct={selectProduct}
        />
      )}
    </div>
  );
}
