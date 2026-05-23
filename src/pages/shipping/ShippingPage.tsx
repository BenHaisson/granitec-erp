import { useEffect, useRef, useState } from 'react';
import {
  Truck, Plus, ChevronDown, CheckCircle2, Clock, Trash2,
  Search, X, FileText, PackagePlus, AlertCircle,
} from 'lucide-react';
import { getProducts } from '@/services/inventory.service';
import {
  getShippingOrders, createShippingOrder, receiveShippingOrder, deleteShippingOrder,
} from '@/services/shipping.service';
import type { Product, ShippingOrder, ShippingOrderLine } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function autoRef(orders: ShippingOrder[]) {
  const year = new Date().getFullYear();
  const prefix = `SH-${year}-`;
  const max = orders
    .map(o => o.ref)
    .filter(r => r.startsWith(prefix))
    .map(r => parseInt(r.slice(prefix.length), 10))
    .filter(n => !isNaN(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

// ── Draft line type ───────────────────────────────────────────────
type DraftLine = {
  productId: string;
  productName: string;
  sku: string;
  qty: string;
  search: string;
  showSuggestions: boolean;
  highlightIdx: number;
};

const EMPTY_LINE = (): DraftLine => ({
  productId: '', productName: '', sku: '', qty: '',
  search: '', showSuggestions: false, highlightIdx: -1,
});

// ── Row component ─────────────────────────────────────────────────
interface RowProps {
  line: DraftLine;
  rowNum: number;
  products: Product[];
  qtyRef: (el: HTMLInputElement | null) => void;
  onUpdate: (patch: Partial<DraftLine>) => void;
  onSelect: (p: Product) => void;
  onRemove: () => void;
  onQtyTab: () => void;
}
function DraftRow({ line, rowNum, products, qtyRef, onUpdate, onSelect, onRemove, onQtyTab }: RowProps) {
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

      {/* Smart search */}
      <div ref={containerRef} className="relative">
        {line.productId ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer"
            onClick={() => onUpdate({ productId: '', productName: '', sku: '', search: '', showSuggestions: true, highlightIdx: -1 })}>
            <span className="flex-1 text-sm font-semibold text-slate-800 truncate">{selected?.name}</span>
            <X size={13} className="text-indigo-400 shrink-0" />
          </div>
        ) : (
          <input
            type="text" data-shipping-search
            value={line.search}
            onChange={e => onUpdate({ search: e.target.value, showSuggestions: true, highlightIdx: -1 })}
            onFocus={() => onUpdate({ showSuggestions: true })}
            onKeyDown={handleKeyDown}
            placeholder="Type to search material…"
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

      <input ref={qtyRef} type="number" min="1" placeholder="0"
        value={line.qty}
        onChange={e => onUpdate({ qty: e.target.value })}
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

// ── Create Order Overlay ──────────────────────────────────────────
interface CreateOverlayProps {
  rawMaterials: Product[];
  ref_: string; setRef: (v: string) => void;
  supplier: string; setSupplier: (v: string) => void;
  date: string; setDate: (v: string) => void;
  lines: DraftLine[];
  saving: boolean;
  error: string;
  refInputRef: React.RefObject<HTMLInputElement | null>;
  showImport: boolean; setShowImport: (v: boolean) => void;
  importText: string; setImportText: (v: string) => void;
  importWarnings: string[];
  onAddLine: () => void;
  onRemoveLine: (i: number) => void;
  onUpdateLine: (i: number, patch: Partial<DraftLine>) => void;
  onSelectProduct: (i: number, p: Product) => void;
  onConfirm: () => void;
  onClose: () => void;
  onParseImport: () => void;
}
function CreateOrderOverlay({
  rawMaterials, ref_, setRef, supplier, setSupplier, date, setDate,
  lines, saving, error, refInputRef, showImport, setShowImport,
  importText, setImportText, importWarnings,
  onAddLine, onRemoveLine, onUpdateLine, onSelectProduct, onConfirm, onClose, onParseImport,
}: CreateOverlayProps) {
  const qtyRefs = useRef<HTMLInputElement[]>([]);
  const pendingQuickAdd = useRef<{ idx: number; data: Partial<DraftLine> } | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const validCount = lines.filter(l => l.productId && Number(l.qty) > 0).length;
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);

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
        const inputs = document.querySelectorAll<HTMLInputElement>('[data-shipping-search]');
        inputs[inputs.length - 1]?.focus();
      }, 50);
    } else {
      qtyRefs.current[i + 1]?.focus();
    }
  };

  const handleQuickAdd = (p: Product) => {
    const data: Partial<DraftLine> = { productId: p.id, productName: p.name, sku: p.sku, search: p.name, showSuggestions: false, highlightIdx: -1 };
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
    ? rawMaterials.filter(p => p.name.toLowerCase().includes(qs) || p.sku.toLowerCase().includes(qs))
    : rawMaterials;
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
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
          <h1 className="text-lg font-bold text-slate-800">New Shipping Order</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ref *</label>
            <input ref={refInputRef} type="text" value={ref_} onChange={e => setRef(e.target.value)}
              placeholder="SH-2026-0001"
              className="w-40 px-3 py-2 border-2 border-slate-200 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier</label>
            <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)}
              placeholder="Supplier name"
              className="w-40 px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
          </div>
          <button onClick={onConfirm} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-indigo-200">
            {saving ? 'Saving…' : `Save Order${validCount > 0 ? ` (${validCount})` : ''}`}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — quick product list */}
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
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 text-left rounded-lg hover:bg-slate-200/60 transition-colors group">
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
            <span>Material</span>
            <span>SKU</span>
            <span className="text-right pr-2">Stock</span>
            <span className="text-right pr-4">Qty to Order</span>
            <span />
          </div>

          {/* Lines */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
            {lines.map((line, i) => (
              <DraftRow
                key={i}
                line={line} rowNum={i + 1}
                products={rawMaterials}
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
            <div className="flex items-center gap-3">
              <button type="button" onClick={onAddLine}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                <Plus size={15} /> Add Line
              </button>
              <button type="button" onClick={() => setShowImport(!showImport)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                <FileText size={14} /> Import TXT
              </button>
            </div>
            {total > 0 && (
              <p className="text-sm font-semibold text-slate-500">
                {validCount} item{validCount !== 1 ? 's' : ''} ·{' '}
                <span className="text-slate-800 font-bold">{total.toLocaleString('fr-FR')} pcs</span>
              </p>
            )}
          </div>

          {/* Import panel */}
          {showImport && (
            <div className="border-t border-slate-200 bg-white px-4 py-3 shrink-0">
              <p className="text-xs font-semibold text-slate-500 mb-2">
                Paste <code className="bg-slate-100 px-1 rounded">SKU qty</code> per line — e.g. <code className="bg-slate-100 px-1 rounded">DISC-200X2-N 500</code>
              </p>
              <div className="flex gap-3">
                <textarea
                  value={importText} onChange={e => setImportText(e.target.value)}
                  rows={4} placeholder={'DISC-200X2-N 500\nDISC-240X2-CR 300'}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <div className="flex flex-col gap-2">
                  <button onClick={onParseImport}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors whitespace-nowrap">
                    Parse & Add
                  </button>
                  <button onClick={() => { setShowImport(false); setImportText(''); }}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
              {importWarnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {importWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-600">⚠ {w}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Expanded order detail row ─────────────────────────────────────
function OrderDetail({ lines }: { lines: ShippingOrderLine[] }) {
  return (
    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {lines.map(l => (
          <div key={l.sku} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-slate-100">
            <div className="min-w-0">
              <p className="text-slate-600 font-medium truncate">{l.productName}</p>
              <p className="font-mono text-slate-400 text-[10px]">{l.sku}</p>
            </div>
            <span className="font-bold text-slate-700 tabular-nums ml-2 shrink-0">{l.qty.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function ShippingPage() {
  const [orders, setOrders]           = useState<ShippingOrder[]>([]);
  const [rawMaterials, setRawMaterials] = useState<Product[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [receiving, setReceiving]     = useState<Set<string>>(new Set());
  const [deleting, setDeleting]       = useState<Set<string>>(new Set());

  // Create order overlay state
  const [showCreate, setShowCreate]   = useState(false);
  const [ref_, setRef]                = useState('');
  const [supplier, setSupplier]       = useState('');
  const [date, setDate]               = useState(todayISO());
  const [lines, setLines]             = useState<DraftLine[]>([EMPTY_LINE()]);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');
  const [showImport, setShowImport]   = useState(false);
  const [importText, setImportText]   = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const refInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [ords, prods] = await Promise.all([getShippingOrders(), getProducts()]);
    setOrders(ords);
    setRawMaterials(prods.filter(p => p.type === 'RAW'));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setRef(autoRef(orders));
    setSupplier('');
    setDate(todayISO());
    setLines([EMPTY_LINE()]);
    setSaveError('');
    setShowImport(false);
    setImportText('');
    setImportWarnings([]);
    setShowCreate(true);
    setTimeout(() => refInputRef.current?.focus(), 80);
  };

  const addLine = () => setLines(l => [...l, EMPTY_LINE()]);
  const removeLine = (i: number) => setLines(l => l.length === 1 ? [EMPTY_LINE()] : l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<DraftLine>) =>
    setLines(l => l.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  const selectProduct = (i: number, p: Product) =>
    setLines(l => l.map((row, idx) => idx === i
      ? { ...row, productId: p.id, productName: p.name, sku: p.sku, search: p.name, showSuggestions: false, highlightIdx: -1 }
      : row));

  const parseImport = () => {
    const skuMap = new Map(rawMaterials.map(p => [p.sku.toUpperCase(), p]));
    const valid: DraftLine[] = [];
    const warnings: string[] = [];
    for (const raw of importText.split('\n').map(l => l.trim()).filter(Boolean)) {
      const [sku, qtyStr] = raw.split(/[\s\t]+/);
      const p = skuMap.get(sku?.toUpperCase());
      const qty = Number(qtyStr);
      if (p && qty > 0) valid.push({ productId: p.id, productName: p.name, sku: p.sku, qty: String(qty), search: p.name, showSuggestions: false, highlightIdx: -1 });
      else warnings.push(`${sku}: ${!p ? 'SKU not found' : 'invalid qty'}`);
    }
    setImportWarnings(warnings);
    if (valid.length > 0) {
      setLines(prev => {
        const empties = prev.filter(l => !l.productId);
        const kept = prev.filter(l => !!l.productId);
        const combined = [...kept, ...valid];
        return empties.length > 0 ? combined : [...combined, EMPTY_LINE()];
      });
      if (warnings.length === 0) { setShowImport(false); setImportText(''); }
    }
  };

  const handleConfirm = async () => {
    setSaveError('');
    if (!ref_.trim()) { setSaveError('Reference is required.'); return; }
    const validLines = lines.filter(l => l.productId && Number(l.qty) > 0);
    if (validLines.length === 0) { setSaveError('Add at least one line with a product and quantity.'); return; }
    setSaving(true);
    try {
      await createShippingOrder({
        ref: ref_.trim(),
        supplier: supplier.trim() || undefined,
        date,
        lines: validLines.map(l => ({ productId: l.productId, productName: l.productName, sku: l.sku, qty: Number(l.qty) })),
      });
      setShowCreate(false);
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save order.');
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async (order: ShippingOrder) => {
    setReceiving(s => new Set(s).add(order.id));
    try {
      await receiveShippingOrder(order);
      await load();
    } finally {
      setReceiving(s => { const n = new Set(s); n.delete(order.id); return n; });
    }
  };

  const handleDelete = async (order: ShippingOrder) => {
    if (!confirm(`Delete order ${order.ref}?`)) return;
    setDeleting(s => new Set(s).add(order.id));
    try {
      await deleteShippingOrder(order.id);
      setOrders(o => o.filter(x => x.id !== order.id));
    } finally {
      setDeleting(s => { const n = new Set(s); n.delete(order.id); return n; });
    }
  };

  const toggleExpand = (id: string) => setExpanded(s => {
    const n = new Set(s);
    s.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const planned = orders.filter(o => o.status === 'PLANNED');
  const received = orders.filter(o => o.status === 'RECEIVED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Shipping</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Loading…' : `${planned.length} planned · ${received.length} received`}
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
          <Plus size={16} /> New Order
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 text-sm animate-pulse">
          Loading orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
          <Truck size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No shipping orders yet</p>
          <p className="text-slate-400 text-sm mt-1">Create a new order to plan your next delivery</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest w-8" />
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Reference</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Items</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Total Qty</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.map(order => {
                const isExpanded = expanded.has(order.id);
                const totalQty = order.lines.reduce((s, l) => s + l.qty, 0);
                const isReceiving = receiving.has(order.id);
                const isDeleting = deleting.has(order.id);
                return (
                  <>
                    <tr key={order.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(order.id)}>
                      <td className="px-4 py-3">
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-slate-800">{order.ref}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{order.supplier || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(order.date)}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-600">{order.lines.length}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700 tabular-nums">{totalQty.toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-3 text-center">
                        {order.status === 'PLANNED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                            <Clock size={10} /> Planned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 size={10} /> Received
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {order.status === 'PLANNED' && (
                            <button
                              onClick={() => handleReceive(order)}
                              disabled={isReceiving}
                              title="Mark as Received"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                              {isReceiving
                                ? <span className="flex items-center gap-1"><span className="animate-spin">↻</span> Receiving…</span>
                                : <><CheckCircle2 size={12} /> Receive</>}
                            </button>
                          )}
                          {order.status === 'PLANNED' && (
                            <button
                              onClick={() => handleDelete(order)}
                              disabled={isDeleting}
                              title="Delete order"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${order.id}-detail`}>
                        <td colSpan={8} className="p-0">
                          <OrderDetail lines={order.lines} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Order Overlay */}
      {showCreate && (
        <CreateOrderOverlay
          rawMaterials={rawMaterials}
          ref_={ref_} setRef={setRef}
          supplier={supplier} setSupplier={setSupplier}
          date={date} setDate={setDate}
          lines={lines}
          saving={saving}
          error={saveError}
          refInputRef={refInputRef}
          showImport={showImport} setShowImport={setShowImport}
          importText={importText} setImportText={setImportText}
          importWarnings={importWarnings}
          onAddLine={addLine}
          onRemoveLine={removeLine}
          onUpdateLine={updateLine}
          onSelectProduct={selectProduct}
          onConfirm={handleConfirm}
          onClose={() => setShowCreate(false)}
          onParseImport={parseImport}
        />
      )}
    </div>
  );
}
