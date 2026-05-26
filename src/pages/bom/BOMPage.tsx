import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, BookOpen, Check, ChevronDown, ChevronRight,
  Copy, FileText, PackagePlus, Pencil, Plus, Search, Trash2, X,
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

// ── Import text parser ────────────────────────────────────────────
type ImportRow = { product: Product | null; qty: number; raw: string };

function parseImportText(text: string, products: Product[]): ImportRow[] {
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      // Accept: "identifier, qty" | "identifier\tqty" | "identifier - qty" | "identifier qty"
      const m = l.match(/^(.+?)[\t,;]+\s*(\d+(?:\.\d+)?)\s*$/)
             ?? l.match(/^(.+?)\s+-\s+(\d+(?:\.\d+)?)\s*$/)
             ?? l.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*$/);
      if (!m) return { product: null, qty: 0, raw: l };
      const identifier = m[1].trim().replace(/^["']|["']$/g, '');
      const qty = Number(m[2]);
      const product =
        products.find(p => p.sku.toLowerCase() === identifier.toLowerCase()) ??
        products.find(p => p.name.toLowerCase() === identifier.toLowerCase()) ??
        null;
      return { product, qty, raw: l };
    });
}

// ── RecipeRow — inline search with grouped/filtered suggestions ───
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
  const filteredSuggestions = q.length > 0
    ? products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 30)
    : [];
  const selected = products.find(p => p.id === line.productId);
  const containerRef = useRef<HTMLDivElement>(null);

  // Grouped view data (for empty-search state)
  const groupedCats = Array.from(new Set(products.map(p => p.category ?? 'Other'))).sort();
  const byCategory = Object.fromEntries(
    groupedCats.map(c => [c, products.filter(p => (p.category ?? 'Other') === c)])
  );

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
    if (!line.showSuggestions || filteredSuggestions.length === 0 || q.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); onUpdate({ highlightIdx: Math.min(line.highlightIdx + 1, filteredSuggestions.length - 1) }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); onUpdate({ highlightIdx: Math.max(line.highlightIdx - 1, 0) }); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = filteredSuggestions[line.highlightIdx >= 0 ? line.highlightIdx : 0];
      if (picked) onSelect(picked);
    } else if (e.key === 'Escape') { onUpdate({ showSuggestions: false }); }
  };

  const showDropdown = line.showSuggestions && !line.productId;

  return (
    <div className="grid grid-cols-[40px_1fr_160px_100px_180px_44px] gap-3 items-center px-4 py-2.5 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all group">
      <span className="text-sm font-bold text-slate-300 tabular-nums text-center">{rowNum}</span>

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
            placeholder="Type to search or browse below…"
            autoComplete="off"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white"
          />
        )}

        {showDropdown && (
          <div className="absolute z-[300] left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
            {q.length > 0 ? (
              filteredSuggestions.length > 0 ? (
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                  {filteredSuggestions.map((p, si) => (
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
              ) : (
                <div className="px-4 py-3 text-sm text-slate-400">No products match "{line.search}"</div>
              )
            ) : (
              // Grouped by category when search is empty
              <div className="max-h-72 overflow-y-auto">
                {groupedCats.map(cat => (
                  <div key={cat}>
                    <div className="sticky top-0 px-4 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {cat}
                      <span className="ml-2 font-normal text-slate-400">({byCategory[cat].length})</span>
                    </div>
                    {byCategory[cat].map(p => (
                      <button key={p.id} type="button" onMouseDown={() => onSelect(p)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors">
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
                ))}
              </div>
            )}
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

// ── Finished-product picker with collapsible categories ──────────
const FP_CAT_PRIORITY = (cat: string): string => {
  const l = cat.toLowerCase();
  if (l.includes('set') || l.includes('pack'))     return '0' + l;
  if (l.includes('marmite') || l.includes('casserole')) return '1' + l;
  if (l.includes('crêpe') || l.includes('crepe'))  return '2' + l;
  return '9' + l;
};

interface FpSelectProps {
  value: string;
  onChange: (id: string) => void;
  products: Product[];
}
function FpSelect({ value, onChange, products }: FpSelectProps) {
  const [open, setOpen]         = useState(false);
  const [search, setSearch]     = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = products.find(p => p.id === value);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const qs = search.toLowerCase();
  const filtered = qs
    ? products.filter(p => p.name.toLowerCase().includes(qs) || p.sku.toLowerCase().includes(qs))
    : products;
  const cats = Array.from(new Set(filtered.map(p => p.category ?? 'Other')))
    .sort((a, b) => FP_CAT_PRIORITY(a).localeCompare(FP_CAT_PRIORITY(b)));

  const toggleCat = (cat: string) => setCollapsed(prev => {
    const next = new Set(prev);
    prev.has(cat) ? next.delete(cat) : next.add(cat);
    return next;
  });

  return (
    <div ref={containerRef} className="relative min-w-[220px]">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border-2 border-slate-200 rounded-lg text-sm bg-white hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors">
        <span className={`truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
          {selected?.name ?? 'Select product…'}
        </span>
        <ChevronDown size={14} className={`ml-2 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-[400] flex flex-col overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…" autoFocus
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {cats.map(cat => {
              const catProds = filtered.filter(p => (p.category ?? 'Other') === cat);
              const isColl = collapsed.has(cat);
              return (
                <div key={cat}>
                  <button type="button" onClick={() => toggleCat(cat)}
                    className="flex items-center gap-1.5 w-full px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-left hover:bg-slate-100 transition-colors">
                    <ChevronDown size={11} className={`text-slate-400 transition-transform shrink-0 ${isColl ? '-rotate-90' : ''}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{cat}</span>
                    <span className="ml-auto text-[10px] text-slate-400">{catProds.length}</span>
                  </button>
                  {!isColl && catProds.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => { onChange(p.id); setOpen(false); setSearch(''); }}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${value === p.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-xs font-mono text-slate-400 shrink-0">{p.sku}</span>
                    </button>
                  ))}
                </div>
              );
            })}
            {cats.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-400">No products match "{search}"</div>
            )}
          </div>
        </div>
      )}
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
  onImport: (newLines: RecipeLine[]) => void;
}
function RecipeOverlay({
  editRecipe, products, fpId, setFpId, lines, saving, error,
  onSave, onClose, onAddLine, onRemoveLine, onUpdateLine, onSelectProduct, onImport,
}: RecipeOverlayProps) {
  const qtyRefs = useRef<HTMLInputElement[]>([]);
  const pendingQuickAdd = useRef<{ idx: number; data: Partial<RecipeLine> } | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  // Import from text state
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<ImportRow[]>([]);
  const [importParsed, setImportParsed] = useState(false);

  const rawMats      = products.filter(p => p.type === 'RAW');
  const finishedGoods = products.filter(p => p.type === 'FINISHED');
  const validCount   = lines.filter(l => l.productId && Number(l.quantity) > 0).length;

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

  const closeImport = () => { setShowImport(false); setImportText(''); setImportResult([]); setImportParsed(false); };

  const handleImportConfirm = () => {
    const matched = importResult.filter(r => r.product && r.qty > 0);
    onImport(matched.map(r => ({
      productId: r.product!.id, productName: r.product!.name, sku: r.product!.sku,
      quantity: String(r.qty), search: r.product!.name, showSuggestions: false, highlightIdx: -1,
    })));
    closeImport();
  };

  const matchCount = importResult.filter(r => r.product && r.qty > 0).length;

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
            <FpSelect value={fpId} onChange={setFpId} products={finishedGoods} />
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
        {/* Sidebar */}
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
          <div className="grid grid-cols-[40px_1fr_160px_100px_180px_44px] gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50 shrink-0 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span className="text-center">#</span>
            <span>Component</span>
            <span>SKU</span>
            <span className="text-right pr-2">Stock</span>
            <span className="text-right pr-4">Qty / unit</span>
            <span />
          </div>

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

          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
            <div className="flex items-center gap-2">
              <button type="button" onClick={onAddLine}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                <Plus size={15} /> Add Line
              </button>
              <button type="button" onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors bg-white">
                <FileText size={15} /> Import from text
              </button>
            </div>
            {validCount > 0 && (
              <p className="text-sm font-semibold text-slate-500">
                {validCount} component{validCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Import from text panel */}
      {showImport && (
        <div className="absolute inset-0 z-[200] bg-black/40 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Import from text</h2>
              <button onClick={closeImport}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            {!importParsed ? (
              <div className="flex-1 overflow-auto p-6 flex flex-col gap-4">
                <p className="text-sm text-slate-500">
                  One component per line — SKU or product name, then quantity.
                  Supports commas, tabs, dashes, or spaces as separators.
                </p>
                <div className="font-mono text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-4 py-3 leading-relaxed">
                  SKU-001, 100<br />
                  SKU-002{'  '}50<br />
                  Product Name - 25<br />
                  "Another Product", 10
                </div>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  rows={8}
                  placeholder="Paste your list here…"
                  autoFocus
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={closeImport}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={() => { setImportResult(parseImportText(importText, rawMats)); setImportParsed(true); }}
                    disabled={!importText.trim()}
                    className="px-5 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                    Parse →
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="font-semibold text-emerald-600">{matchCount} matched</span>
                  {importResult.length - matchCount > 0 && (
                    <span className="text-red-500">· {importResult.length - matchCount} not found</span>
                  )}
                </div>
                <div className="space-y-1 overflow-y-auto max-h-72">
                  {importResult.map((r, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${r.product && r.qty > 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                      {r.product && r.qty > 0
                        ? <Check size={14} className="text-emerald-600 shrink-0" />
                        : <AlertCircle size={14} className="text-red-500 shrink-0" />}
                      <span className="flex-1 font-mono text-slate-500 truncate text-xs">{r.raw}</span>
                      {r.product && r.qty > 0 ? (
                        <span className="text-slate-700 shrink-0 font-medium">
                          {r.product.name} <span className="text-slate-400">× {r.qty}</span>
                        </span>
                      ) : (
                        <span className="text-red-500 shrink-0">
                          {r.qty <= 0 ? 'Invalid qty' : 'Not found'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button onClick={() => setImportParsed(false)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                    ← Edit
                  </button>
                  <button
                    onClick={handleImportConfirm}
                    disabled={matchCount === 0}
                    className="px-5 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                    Import {matchCount} line{matchCount !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function BOMPage() {
  const [recipes, setRecipes]       = useState<Recipe[]>([]);
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());

  const [showOverlay, setShowOverlay] = useState(false);
  const [editRecipe, setEditRecipe]   = useState<Recipe | null>(null);
  const [fpId, setFpId]               = useState('');
  const [lines, setLines]             = useState<RecipeLine[]>([EMPTY_LINE()]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

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

  const finishedList = [...productMap.values()].filter(p => p.type === 'FINISHED').sort((a, b) => a.name.localeCompare(b.name));
  void finishedList; // used in overlay via products prop

  const addLine    = () => setLines(l => [...l, EMPTY_LINE()]);
  const removeLine = (i: number) => setLines(l => l.length === 1 ? [EMPTY_LINE()] : l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<RecipeLine>) =>
    setLines(l => l.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  const selectProduct = (i: number, p: Product) =>
    setLines(l => l.map((row, idx) => idx === i
      ? { ...row, productId: p.id, productName: p.name, sku: p.sku, search: p.name, showSuggestions: false, highlightIdx: -1 }
      : row));
  const importLines = (imported: RecipeLine[]) => {
    setLines(current => {
      const nonEmpty = current.filter(l => l.productId);
      return nonEmpty.length > 0 ? [...nonEmpty, ...imported] : imported;
    });
  };

  const openCreate = () => {
    setEditRecipe(null); setFpId(''); setLines([EMPTY_LINE()]); setError(''); setShowOverlay(true);
  };

  const openEdit = (r: Recipe) => {
    setEditRecipe(r); setFpId(r.finishedProductId);
    setLines(r.components.map(c => {
      const p = productMap.get(c.productId);
      return {
        productId: c.productId, productName: p?.name ?? '', sku: p?.sku ?? '',
        quantity: String(c.quantity), search: p?.name ?? c.productId,
        showSuggestions: false, highlightIdx: -1,
      };
    }));
    setError(''); setShowOverlay(true);
  };

  const handleClone = async (recipe: Recipe) => {
    await createRecipe({ finishedProductId: recipe.finishedProductId, components: recipe.components });
    load();
  };

  const handleDelete = async (recipe: Recipe) => {
    const name = productMap.get(recipe.finishedProductId)?.name ?? recipe.id;
    if (!confirm(`Delete recipe for "${name}"? This cannot be undone.`)) return;
    await deleteRecipe(recipe.id);
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
      if (editRecipe) await updateRecipe({ id: editRecipe.id, finishedProductId: fpId, components });
      else await createRecipe({ finishedProductId: fpId, components });
      setShowOverlay(false); load();
    } catch { setError('Failed to save recipe.'); }
    finally { setSaving(false); }
  };

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

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
        <button onClick={openCreate}
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
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button onClick={() => toggleExpand(recipe.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left group">
                    {isOpen
                      ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
                      : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                        {finished?.name ?? recipe.finishedProductId}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline text-xs text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded">
                      {finished?.sku ?? '—'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {recipe.components.length} component{recipe.components.length !== 1 ? 's' : ''}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${feasible ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {feasible ? `${qty} producible` : 'No stock'}
                    </span>
                    <button onClick={() => handleClone(recipe)} title="Clone recipe"
                      className="p-1.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                      <Copy size={13} />
                    </button>
                    <button onClick={() => openEdit(recipe)}
                      className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(recipe)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

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

      {showOverlay && (
        <RecipeOverlay
          editRecipe={editRecipe}
          products={[...productMap.values()]}
          fpId={fpId} setFpId={setFpId}
          lines={lines} saving={saving} error={error}
          onSave={handleSubmit}
          onClose={() => setShowOverlay(false)}
          onAddLine={addLine} onRemoveLine={removeLine}
          onUpdateLine={updateLine} onSelectProduct={selectProduct}
          onImport={importLines}
        />
      )}
    </div>
  );
}
