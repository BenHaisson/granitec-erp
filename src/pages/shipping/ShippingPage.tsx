import { useEffect, useRef, useState } from 'react';
import {
  Truck, Plus, ChevronDown, CheckCircle2, Clock, Trash2,
  Search, X, FileText, PackagePlus, AlertCircle, Sparkles,
  ArrowLeft, ToggleLeft, ToggleRight, Pencil, Upload, ExternalLink,
  Download, FileDown, CalendarCheck, History, PackageCheck, Ban,
} from 'lucide-react';
import { useDraft, getLastEntryDate, saveLastEntryDate } from '@/hooks/useDraft';
import DraftBanner from '@/components/ui/DraftBanner';
import { getProducts } from '@/services/inventory.service';
import {
  getShippingOrders, createShippingOrder, receiveShippingOrder,
  deleteShippingOrder, updateShippingOrder, deleteReceivedShippingOrder, updateReceivedShippingOrder,
  uploadReceiptDocument, addShipmentReceipt, updateShipmentReceipt, deleteShipmentReceipt,
  cancelRemainingAndClose, computeOrderReceiptPercent,
} from '@/services/shipping.service';
import { getSuppliers, createSupplier } from '@/services/supplier.service';
import { getRecipes } from '@/services/production.service';
import { getShippedSupplies, createShippedSupply, uploadShippedSupplyDocument, deleteShippedSupply } from '@/services/shippedSupply.service';
import { openAttachment, resolveAttachmentHref, deleteAttachmentObject } from '@/lib/r2Storage';
import type { Product, ShippingOrder, ShippingOrderLine, ShipmentReceipt, ShipmentReceiptLine, Recipe, Supplier, ShippedSupply, ShippedSupplyLine } from '@/types';
import { todayISO, fmtDate } from '@/utils/dates';
import EntityPicker from '@/components/ui/EntityPicker';
import ProductPickerDropdown from '@/components/ui/ProductPickerDropdown';
import { SupplierModal } from '@/pages/suppliers/SuppliersPage';

const PREFIX_LABEL: Record<string, string> = {
  DISC: 'Aluminium Disc', PKG: 'Packaging', ACC: 'Accessories', SH: 'General',
};
function refToCategory(ref: string) {
  const p = ref.split('-')[0].toUpperCase();
  return PREFIX_LABEL[p] ?? 'General';
}

type ExportFormat = 'web' | 'pdf' | 'excel';

function buildShippingReportHtml(rows: ShippingOrder[], title = '') {
  const totalQty = rows.reduce((s, o) => s + o.lines.reduce((ss, l) => ss + l.qty, 0), 0);
  const now = new Date();
  const tableRows = rows.map(o => `<tr>
    <td class="mono">${o.date}</td>
    <td class="mono">${o.ref}</td>
    <td>${refToCategory(o.ref)}</td>
    <td>${o.supplier ?? '—'}</td>
    <td style="color:${o.status==='RECEIVED'?'#16a34a':'#d97706'}">${o.status==='RECEIVED'?'✓ Reçu':'Planifié'}</td>
    <td class="mono">${o.blNumber ?? '—'}</td>
    <td style="text-align:right">${o.lines.length}</td>
    <td style="text-align:right;font-weight:600">${o.lines.reduce((s,l)=>s+l.qty,0).toLocaleString('fr-FR')}</td>
  </tr>`).join('');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Shipping Report${title ? ` — ${title}` : ''}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;padding:40px 60px;font-size:13px}
  .rh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #1a1a2e}
  .brand{font-size:28px;font-weight:900;letter-spacing:2px}.brand span{color:#4f46e5}
  .rm{text-align:right}.rm .title{font-size:16px;font-weight:700}.rm .sub{font-size:11px;color:#888;margin-top:3px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  thead tr{background:#1a1a2e;color:#fff}
  thead th{padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
  tbody tr:nth-child(even){background:#f7f8fc}
  tbody td{padding:8px 12px;border-bottom:1px solid #eee}
  td.mono{font-family:monospace;font-size:11px;color:#555}
  tfoot tr{background:#1a1a2e;color:#fff}
  tfoot td{padding:9px 12px;font-weight:700}
  .foot{margin-top:40px;text-align:center;font-size:10px;color:#ccc;border-top:1px solid #eee;padding-top:16px}
  @media print{body{padding:20px 40px}}
</style></head><body>
<div class="rh">
  <div class="brand">GRANITE<span>C</span></div>
  <div class="rm">
    <div class="title">Rapport Expéditions${title ? ` — ${title}` : ''}</div>
    <div class="sub">${rows.length} commande${rows.length!==1?'s':''} · ${totalQty.toLocaleString('fr-FR')} pcs</div>
    <div class="sub">Généré le ${fmtDate(now)}</div>
  </div>
</div>
<table>
  <thead><tr><th>Date</th><th>Référence</th><th>Catégorie</th><th>Fournisseur</th><th>Statut</th><th>N° BL</th><th style="text-align:right">Articles</th><th style="text-align:right">Qté</th></tr></thead>
  <tbody>${tableRows}</tbody>
  <tfoot><tr><td colspan="7">TOTAL</td><td style="text-align:right">${totalQty.toLocaleString('fr-FR')}</td></tr></tfoot>
</table>
<div class="foot">Granitec ERP · ${now.toLocaleDateString('fr-FR')}</div>
</body></html>`;
}

function exportShipping(rows: ShippingOrder[], format: ExportFormat, label = '') {
  const slug = label.toLowerCase().replace(/ /g, '-') || 'orders';
  if (format === 'excel') {
    const header = ['Date', 'Ref', 'Catégorie', 'Fournisseur', 'Statut', 'N° BL', 'Articles', 'Qté totale', 'Remarques'];
    const data = rows.map(o => [o.date, o.ref, refToCategory(o.ref), o.supplier ?? '', o.status,
      o.blNumber ?? '', o.lines.length, o.lines.reduce((s,l)=>s+l.qty,0), o.remarks ?? '']);
    const tableHtml = [header, ...data].map(r =>
      `<tr>${r.map(c=>`<td>${String(c).replace(/</g,'&lt;')}</td>`).join('')}</tr>`
    ).join('');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob(
        [`<html><head><meta charset="UTF-8"></head><body><table>${tableHtml}</table></body></html>`],
        { type: 'application/vnd.ms-excel' }
      )),
      download: `shipping-${slug}.xls`,
    });
    a.click(); URL.revokeObjectURL(a.href);
    return;
  }
  const html = buildShippingReportHtml(rows, label);
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    if (format === 'pdf') setTimeout(() => w.print(), 500);
  }
}



const CAT_PREFIX: Record<string, string> = {
  'Aluminium Disc': 'DISC',
  'Accessories': 'ACC',
  'Packaging': 'PKG',
};

const REF_PREFIXES = ['SH', 'DISC', 'PKG', 'ACC'] as const;
type RefPrefix = typeof REF_PREFIXES[number];

function autoRefByPrefix(orders: ShippingOrder[], prefix: string, year = new Date().getFullYear(), offset = 0) {
  const fullPrefix = `${prefix}-${year}-`;
  const max = orders
    .map(o => o.ref)
    .filter(r => r.startsWith(fullPrefix))
    .map(r => parseInt(r.slice(fullPrefix.length), 10))
    .filter(n => !isNaN(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `${fullPrefix}${String(max + 1 + offset).padStart(4, '0')}`;
}

function autoRef(orders: ShippingOrder[], category?: string, year = new Date().getFullYear(), offset = 0) {
  const prefix = category ? (CAT_PREFIX[category] ?? 'SH') : 'SH';
  return autoRefByPrefix(orders, prefix, year, offset);
}

function nextShippedSupplyRef(existing: ShippedSupply[], year = new Date().getFullYear()) {
  const fullPrefix = `SUP-${year}-`;
  const max = existing
    .map(s => s.ref)
    .filter(r => r.startsWith(fullPrefix))
    .map(r => parseInt(r.slice(fullPrefix.length), 10))
    .filter(n => !isNaN(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `${fullPrefix}${String(max + 1).padStart(4, '0')}`;
}

// ── Smart Order types ─────────────────────────────────────────────
type ComponentRow = {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  needed: number;
  inStock: number;
  toOrder: number;
};

type CategoryGroup = {
  category: string;
  rows: ComponentRow[];
  ref: string;
  supplier: string;
  enabled: boolean;
};

const CAT_ORDER = ['Aluminium Disc', 'Accessories', 'Packaging'];

function calcRequirements(
  recipe: Recipe,
  targetQty: number,
  allProducts: Product[],
  orders: ShippingOrder[],
): CategoryGroup[] {
  const prodMap = new Map(allProducts.map(p => [p.id, p]));
  const rows: ComponentRow[] = recipe.components.flatMap(c => {
    const p = prodMap.get(c.productId);
    if (!p) return [];
    const needed = targetQty * c.quantity;
    return [{ productId: p.id, productName: p.name, sku: p.sku, category: p.category ?? 'Other', needed, inStock: p.stock_level, toOrder: Math.max(0, needed - p.stock_level) }];
  });
  const catMap = new Map<string, ComponentRow[]>();
  for (const r of rows) {
    if (!catMap.has(r.category)) catMap.set(r.category, []);
    catMap.get(r.category)!.push(r);
  }
  const cats = Array.from(catMap.keys()).sort((a, b) => {
    const ai = CAT_ORDER.indexOf(a), bi = CAT_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });
  return cats.map((cat) => {
    const catRows = catMap.get(cat)!;
    return { category: cat, rows: catRows, ref: autoRef(orders, cat), supplier: '', enabled: catRows.some(r => r.toOrder > 0) };
  });
}

// ── Draft line type ───────────────────────────────────────────────
type DraftLine = {
  uid: string;          // stable identity for React key — never changes after creation
  productId: string;
  productName: string;
  sku: string;
  qty: string;
  reconcile: boolean;
  search: string;
  showSuggestions: boolean;
  highlightIdx: number;
};
const newUid = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const EMPTY_LINE = (): DraftLine => ({
  uid: newUid(),
  productId: '', productName: '', sku: '', qty: '',
  reconcile: false,
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
  // Latest-ref pattern: keeps onUpdate current without re-registering the event listener every render
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; });

  useEffect(() => {
    if (!line.showSuggestions) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        onUpdateRef.current({ showSuggestions: false }); // always calls latest onUpdate
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
    <div className="grid grid-cols-[40px_1fr_120px_80px_160px_100px_36px] gap-3 items-center px-4 py-2.5 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all group">
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

      <button
        type="button"
        onClick={() => onUpdate({ reconcile: !line.reconcile })}
        title={line.reconcile ? 'Backs unverified stock — click to add to live stock instead' : 'Adds to live stock — click to back unverified stock instead'}
        className={`flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
          line.reconcile
            ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
        }`}>
        {line.reconcile ? 'Unverified' : 'Live Stock'}
      </button>

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
  refPrefix: RefPrefix; onPrefixChange: (p: RefPrefix) => void;
  supplier: string; setSupplier: (v: string) => void;
  suppliers: Supplier[];
  onAddSupplier: () => void;
  date: string; onDateChange: (v: string) => void;
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
  onImportLines: (newLines: DraftLine[]) => void;
  isEditing?: boolean;
}
function CreateOrderOverlay({
  rawMaterials, ref_, setRef, refPrefix, onPrefixChange, supplier, setSupplier, suppliers, onAddSupplier, date, onDateChange,
  lines, saving, error, refInputRef, showImport, setShowImport,
  importText, setImportText, importWarnings,
  onAddLine, onRemoveLine, onUpdateLine, onSelectProduct, onConfirm, onClose, onParseImport, onImportLines,
  isEditing = false,
}: CreateOverlayProps) {
  const qtyRefs = useRef<HTMLInputElement[]>([]);
  const pendingQuickAdd = useRef<{ idx: number; data: Partial<DraftLine> } | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importModalText, setImportModalText] = useState('');
  const [parsedItems, setParsedItems] = useState<DraftLine[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const parsedItemsRef = useRef<DraftLine[]>([]);
  const validCount = lines.filter(l => l.productId && Number(l.qty) > 0).length;
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);

  // Keep ref in sync with state for latest-ref pattern
  useEffect(() => { parsedItemsRef.current = parsedItems; }, [parsedItems]);

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

  const handleParseImportModal = () => {
    const skuMap = new Map(rawMaterials.map(p => [p.sku.toUpperCase(), p]));
    const valid: DraftLine[] = [];
    const errors: string[] = [];
    for (const raw of importModalText.split('\n').map(l => l.trim()).filter(Boolean)) {
      const [sku, qtyStr] = raw.split(/[\s\t]+/);
      const p = skuMap.get(sku?.toUpperCase());
      const qty = Number(qtyStr);
      if (p && qty > 0) {
        valid.push({
          uid: newUid(),
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          qty: String(qty),
          reconcile: false,
          search: p.name,
          showSuggestions: false,
          highlightIdx: -1
        });
      } else {
        errors.push(`${sku}: ${!p ? 'SKU not found' : 'invalid qty'}`);
      }
    }
    setParsedItems(valid);
    setParseErrors(errors);
  };

  const handleConfirmImport = () => {
    onImportLines(parsedItemsRef.current);
    setImportModalOpen(false);
    setImportModalText('');
    setParsedItems([]);
    setParseErrors([]);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
          <h1 className="text-lg font-bold text-slate-800">{isEditing ? 'Edit Shipping Order' : 'New Shipping Order'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-end">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ref *</label>
            <select
              value={refPrefix}
              onChange={e => onPrefixChange(e.target.value as RefPrefix)}
              disabled={isEditing}
              className="px-2 py-2 border-2 border-slate-200 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white disabled:opacity-50"
            >
              {REF_PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input ref={refInputRef} type="text" value={ref_} onChange={e => setRef(e.target.value)}
              className="w-36 px-3 py-2 border-2 border-slate-200 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier</label>
            <EntityPicker
              value={supplier}
              onChange={setSupplier}
              entities={suppliers.map(s => ({ id: s.id, name: s.name, subtitle: s.mainPhone }))}
              onAddNew={onAddSupplier}
              placeholder="Supplier name"
              addLabel="Add new supplier"
              className="w-48"
              inputClassName="px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
            <input type="date" value={date} onChange={e => onDateChange(e.target.value)}
              className="px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
            {date !== new Date().toISOString().slice(0, 10) && (
              <button type="button" onClick={() => onDateChange(new Date().toISOString().slice(0, 10))}
                className="flex items-center gap-1 px-2 py-2 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap">
                <CalendarCheck size={12} /> Today
              </button>
            )}
          </div>
          <button onClick={onConfirm} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-indigo-200">
            {saving ? 'Saving…' : isEditing ? `Save Changes${validCount > 0 ? ` (${validCount})` : ''}` : `Save Order${validCount > 0 ? ` (${validCount})` : ''}`}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0 flex-col">
        <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar — quick product list */}
        <aside className="w-64 shrink-0 border-r border-slate-100 flex flex-col overflow-hidden bg-slate-50 min-h-0">
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
        <div className="flex-1 flex flex-col overflow-hidden overflow-x-auto min-h-0">
          <div className="min-w-[640px] flex flex-col h-full">
          {/* Column headers */}
          <div className="grid grid-cols-[40px_1fr_120px_80px_160px_100px_36px] gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50 shrink-0 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span className="text-center">#</span>
            <span>Material</span>
            <span>SKU</span>
            <span className="text-right pr-2">Stock</span>
            <span className="text-right pr-4">Qty to Order</span>
            <span className="text-center">Destination</span>
            <span />
          </div>

          {/* Lines */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
            {lines.map((line, i) => (
              <DraftRow
                key={line.uid}
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
          </div>{/* end min-w wrapper */}
        </div>
        </div>{/* end sidebar + main content flex */}

        {/* Footer — always visible, not constrained by horizontal scroll */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={onAddLine}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
              <Plus size={15} /> Add Line
            </button>
            <button type="button" onClick={() => setImportModalOpen(true)}
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

        {/* Import Modal */}
        {importModalOpen && (
          <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <h2 className="text-lg font-bold text-slate-800">Import from Text</h2>
                <button onClick={() => { setImportModalOpen(false); setImportModalText(''); setParsedItems([]); setParseErrors([]); }}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {parsedItems.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      Paste SKU and quantity per line (e.g. <code className="bg-slate-100 px-2 py-1 rounded text-xs">DISC-200X2-N 500</code>)
                    </p>
                    <textarea
                      value={importModalText}
                      onChange={(e) => setImportModalText(e.target.value)}
                      placeholder={'DISC-200X2-N 500\nDISC-240X2-CR 300\nDISC-250X3-G 250'}
                      rows={6}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                      autoFocus
                    />
                    <button
                      onClick={handleParseImportModal}
                      disabled={!importModalText.trim()}
                      className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      Parse Items
                    </button>
                    {parseErrors.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-semibold text-slate-500">Issues found:</p>
                        {parseErrors.map((err, i) => (
                          <p key={i} className="text-xs text-red-600">⚠ {err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-3">
                      Found {parsedItems.length} item{parsedItems.length !== 1 ? 's' : ''} — confirm to add
                    </p>
                    <div className="space-y-2 bg-slate-50 rounded-xl p-3">
                      {parsedItems.map((item, i) => (
                        <div key={item.uid} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-slate-200">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{item.productName}</p>
                            <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <input
                              type="number"
                              value={item.qty}
                              onChange={(e) => {
                                const updated = [...parsedItems];
                                updated[i] = { ...item, qty: e.target.value };
                                setParsedItems(updated);
                              }}
                              className="w-20 px-2 py-1 text-right border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <span className="text-sm text-slate-500">pcs</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {parseErrors.length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-200">
                        <p className="text-xs font-semibold text-red-700 mb-2">Skipped items:</p>
                        <div className="space-y-1">
                          {parseErrors.map((err, i) => (
                            <p key={i} className="text-xs text-red-600">• {err}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50">
                <button onClick={() => { setImportModalOpen(false); setImportModalText(''); setParsedItems([]); setParseErrors([]); }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                  Cancel
                </button>
                {parsedItems.length > 0 && (
                  <button onClick={handleConfirmImport}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
                    ✓ Add {parsedItems.length} Item{parsedItems.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Partial Receive Modal ─────────────────────────────────────────
interface PartialReceiveModalProps {
  order: ShippingOrder;
  editingReceipt?: ShipmentReceipt | null;
  onConfirm: (data: {
    date: string;
    blNumber?: string;
    remarks?: string;
    file: File | null;
    lines: ShipmentReceiptLine[];
    addedToInventory: boolean;
  }) => Promise<void>;
  onClose: () => void;
}
function PartialReceiveModal({ order, editingReceipt, onConfirm, onClose }: PartialReceiveModalProps) {
  const [date, setDate] = useState(editingReceipt?.date ?? new Date().toISOString().split('T')[0]);
  const [blNumber, setBlNumber] = useState(editingReceipt?.blNumber ?? '');
  const [remarks, setRemarks] = useState(editingReceipt?.remarks ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [addToInventory, setAddToInventory] = useState(editingReceipt?.addedToInventory ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute already-received per product (excluding this receipt if editing)
  const alreadyReceived = new Map<string, number>();
  for (const r of (order.receipts ?? [])) {
    if (editingReceipt && r.id === editingReceipt.id) continue;
    for (const l of r.lines) {
      alreadyReceived.set(l.productId, (alreadyReceived.get(l.productId) ?? 0) + l.receivedQty);
    }
  }

  const [lineQtys, setLineQtys] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const l of order.lines) {
      if (editingReceipt) {
        const prev = editingReceipt.lines.find(el => el.productId === l.productId);
        init[l.productId] = prev ? String(prev.receivedQty) : '0';
      } else {
        const already = alreadyReceived.get(l.productId) ?? 0;
        init[l.productId] = String(Math.max(0, l.qty - already));
      }
    }
    return init;
  });

  const handleConfirm = async () => {
    const receiptLines: ShipmentReceiptLine[] = order.lines
      .map(l => ({
        productId: l.productId,
        productName: l.productName,
        sku: l.sku,
        receivedQty: Math.max(0, Number(lineQtys[l.productId] ?? 0)),
      }))
      .filter(l => l.receivedQty > 0);

    if (receiptLines.length === 0) {
      setError('Enter a received quantity for at least one item.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirm({ date, blNumber: blNumber.trim() || undefined, remarks: remarks.trim() || undefined, file, lines: receiptLines, addedToInventory: addToInventory });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save receipt.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-bold text-slate-800">{editingReceipt ? 'Edit Shipment Receipt' : 'Record Partial Shipment'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="font-mono font-semibold text-slate-600">{order.ref}</span>
              {order.supplier && <span> · {order.supplier}</span>}
            </p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Date & BL row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Receipt Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">BL Number</label>
              <input type="text" value={blNumber} onChange={e => setBlNumber(e.target.value)}
                placeholder="e.g. BL-2024-001"
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" />
            </div>
          </div>

          {/* Per-line quantities */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Items Received in This Shipment</label>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-widest">Product</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-widest">Ordered</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-widest">Prev. Rcvd</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-widest">Remaining</th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-widest w-32">This Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {order.lines.map(l => {
                    const prevRcvd = alreadyReceived.get(l.productId) ?? 0;
                    const remaining = Math.max(0, l.qty - prevRcvd);
                    const thisQty = Number(lineQtys[l.productId] ?? 0);
                    const over = thisQty > remaining;
                    return (
                      <tr key={l.productId} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800 text-sm">{l.productName}</p>
                          <p className="font-mono text-[10px] text-slate-400">{l.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">{l.qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">{prevRcvd > 0 ? prevRcvd.toLocaleString() : '—'}</td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${remaining === 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {remaining === 0 ? '✓ Done' : remaining.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number" min="0" max={remaining + (editingReceipt ? (editingReceipt.lines.find(el => el.productId === l.productId)?.receivedQty ?? 0) : 0)}
                            value={lineQtys[l.productId] ?? '0'}
                            onChange={e => setLineQtys(q => ({ ...q, [l.productId]: e.target.value }))}
                            disabled={remaining === 0 && !editingReceipt}
                            className={`w-28 px-2 py-1.5 border-2 rounded-lg text-sm text-right font-semibold tabular-nums focus:outline-none focus:ring-2 transition-colors
                              ${over ? 'border-red-400 bg-red-50 focus:ring-red-400' : 'border-slate-200 focus:ring-emerald-400 focus:border-emerald-400'}
                              ${remaining === 0 && !editingReceipt ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'bg-white'}`}
                          />
                          {over && <p className="text-[10px] text-red-500 mt-0.5 text-right">Exceeds remaining</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Remarks</label>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
              placeholder="Notes about this shipment…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" />
          </div>

          {/* Document */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              BL Document {(editingReceipt?.documentKey || editingReceipt?.documentUrl) && <span className="text-emerald-600 font-normal normal-case">(existing attached)</span>}
            </label>
            <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0] ?? null); }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-4 text-center hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors cursor-pointer">
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-emerald-700">
                  <FileText size={16} /><span className="font-medium truncate max-w-[260px]">{file.name}</span>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }} className="p-0.5 rounded text-slate-400 hover:text-red-500"><X size={13} /></button>
                </div>
              ) : (editingReceipt?.documentKey || editingReceipt?.documentUrl) ? (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <FileText size={14} className="text-emerald-600" />
                  <a href={editingReceipt?.documentUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); openAttachment({ documentKey: editingReceipt?.documentKey, documentUrl: editingReceipt?.documentUrl }); }}
                    className="text-emerald-700 font-medium hover:underline">
                    {editingReceipt?.documentName ?? 'View Document'}
                  </a>
                  <span className="text-slate-400 text-xs">· click here to replace</span>
                </div>
              ) : (
                <div className="text-slate-400">
                  <Upload size={20} className="mx-auto mb-1 text-slate-300" />
                  <p className="text-sm">Drop file or <span className="text-indigo-600 font-semibold">click to browse</span></p>
                  <p className="text-xs mt-0.5 text-slate-300">PDF, image, or any document</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>

          {/* Add to inventory toggle */}
          {!order.verification && (
            <div className={`rounded-xl border-2 p-4 transition-all cursor-pointer select-none ${addToInventory ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-200 bg-slate-50/60'}`}
              onClick={() => setAddToInventory(v => !v)}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">Add to Live Inventory</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {addToInventory ? 'Stock levels updated immediately for received items.' : 'Receipt recorded without updating stock levels.'}
                  </p>
                </div>
                <div className={`w-11 h-6 rounded-full flex items-center transition-colors shrink-0 ${addToInventory ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${addToInventory ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm shadow-emerald-200">
            {saving
              ? <><span className="animate-spin inline-block">↻</span> Saving…</>
              : <><PackageCheck size={14} /> {editingReceipt ? 'Update Receipt' : 'Save Shipment'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shipment History Modal ────────────────────────────────────────
interface ShipmentHistoryModalProps {
  order: ShippingOrder;
  onAddReceipt: () => void;
  onEditReceipt: (receipt: ShipmentReceipt) => void;
  onDeleteReceipt: (receipt: ShipmentReceipt) => void;
  onCancelRemaining: () => void;
  onClose: () => void;
}
function ShipmentHistoryModal({ order, onAddReceipt, onEditReceipt, onDeleteReceipt, onCancelRemaining, onClose }: ShipmentHistoryModalProps) {
  const receipts = order.receipts ?? [];
  const percent = computeOrderReceiptPercent(order);

  // Per-product stats
  const receivedMap = new Map<string, number>();
  for (const r of receipts) {
    for (const l of r.lines) {
      receivedMap.set(l.productId, (receivedMap.get(l.productId) ?? 0) + l.receivedQty);
    }
  }

  const totalOrdered = order.lines.reduce((s, l) => s + l.qty, 0);
  const totalReceived = order.lines.reduce((s, l) => s + Math.min(l.qty, receivedMap.get(l.productId) ?? 0), 0);
  const totalRemaining = totalOrdered - totalReceived;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <History size={16} className="text-indigo-500" />
              <h2 className="font-bold text-slate-800">Shipment History</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="font-mono font-semibold text-slate-600">{order.ref}</span>
              {order.supplier && <span> · {order.supplier}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>

        {/* Progress summary */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-500">Ordered: <strong className="text-slate-800">{totalOrdered.toLocaleString()}</strong></span>
              <span className="text-emerald-600">Received: <strong>{totalReceived.toLocaleString()}</strong></span>
              {totalRemaining > 0 && !order.cancelledRemaining && (
                <span className="text-amber-600">Remaining: <strong>{totalRemaining.toLocaleString()}</strong></span>
              )}
              {order.cancelledRemaining && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                  <Ban size={10} /> Remainder cancelled
                </span>
              )}
            </div>
            <span className={`text-sm font-bold ${percent >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{percent}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5">
            <div className={`h-2.5 rounded-full transition-all ${percent >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${percent}%` }} />
          </div>
        </div>

        {/* Per-product breakdown */}
        <div className="px-6 py-3 border-b border-slate-100 shrink-0">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Order Lines</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {order.lines.map(l => {
              const rcvd = Math.min(l.qty, receivedMap.get(l.productId) ?? 0);
              const pct = l.qty > 0 ? Math.round((rcvd / l.qty) * 100) : 100;
              return (
                <div key={l.productId} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{l.productName}</p>
                    <p className="font-mono text-[10px] text-slate-400">{l.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold tabular-nums ${pct >= 100 ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {rcvd.toLocaleString()} / {l.qty.toLocaleString()}
                    </p>
                    <p className={`text-[10px] ${pct >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>{pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Receipt list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Shipments ({receipts.length})
          </p>
          {receipts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No shipments recorded yet.</p>
          ) : receipts.map((r, idx) => {
            const rTotal = r.lines.reduce((s, l) => s + l.receivedQty, 0);
            const rDate = fmtDate(r.date);
            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{rDate}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {r.blNumber && <span className="font-mono text-xs text-indigo-600 font-semibold">BL: {r.blNumber}</span>}
                        <span className="text-xs text-slate-400">{rTotal.toLocaleString()} pcs · {r.lines.length} item{r.lines.length !== 1 ? 's' : ''}</span>
                        {r.addedToInventory && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold">+Stock</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(r.documentKey || r.documentUrl) && (
                      <a href={r.documentUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                        onClick={e => { e.preventDefault(); openAttachment(r); }}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" title="View document">
                        <FileText size={14} />
                      </a>
                    )}
                    <button onClick={() => onEditReceipt(r)} className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors" title="Edit receipt">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => onDeleteReceipt(r)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="Delete receipt">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {/* Receipt lines */}
                <div className="px-4 py-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {r.lines.map(l => (
                    <div key={l.productId} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-1.5">
                      <span className="truncate text-slate-600 mr-2">{l.productName}</span>
                      <span className="font-bold text-slate-700 tabular-nums shrink-0">{l.receivedQty.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                {r.remarks && (
                  <div className="px-4 pb-2">
                    <p className="text-xs text-slate-500 italic">{r.remarks}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <div>
            {order.status !== 'RECEIVED' && !order.cancelledRemaining && totalRemaining > 0 && (
              <button onClick={onCancelRemaining}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
                <Ban size={14} /> Cancel Remaining & Close
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors">
              Close
            </button>
            {order.status !== 'RECEIVED' && (
              <button onClick={onAddReceipt}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200">
                <Plus size={14} /> Add Shipment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Receive Modal ─────────────────────────────────────────────────
interface ReceiveModalProps {
  order: ShippingOrder;
  onConfirm: (data: { blNumber: string; remarks: string; file: File | null; addToInventory: boolean }) => Promise<void>;
  onClose: () => void;
}
function ReceiveModal({ order, onConfirm, onClose }: ReceiveModalProps) {
  const [blNumber, setBlNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [addToInventory, setAddToInventory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalQty = order.lines.reduce((s, l) => s + l.qty, 0);
  const reconcileCount = order.lines.filter(l => l.reconcile).length;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      await onConfirm({ blNumber, remarks, file, addToInventory });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark as received.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800">Confirm Receipt</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="font-mono font-semibold text-slate-600">{order.ref}</span>
              {order.supplier && <span> · {order.supplier}</span>}
              <span> · {order.lines.length} item{order.lines.length !== 1 ? 's' : ''} · {totalQty.toLocaleString('fr-FR')} pcs</span>
            </p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Destination summary (set at order creation) */}
          {reconcileCount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 flex items-center gap-2.5">
              <span className="text-amber-600 text-base">⚠</span>
              <p className="text-xs text-amber-700">
                <strong>{reconcileCount} line{reconcileCount !== 1 ? 's' : ''}</strong> will back unverified stock ·{' '}
                {order.lines.length - reconcileCount > 0 && (
                  <span>{order.lines.length - reconcileCount} will add to live stock</span>
                )}
                <span className="block text-amber-600 mt-0.5">Destination was set when the order was created.</span>
              </p>
            </div>
          )}

          {/* BL Number */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              BL Number <span className="text-slate-300 font-normal normal-case tracking-normal">(from supplier)</span>
            </label>
            <input
              type="text"
              value={blNumber}
              onChange={e => setBlNumber(e.target.value)}
              placeholder="e.g. BL-2024-001"
              autoFocus
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Remarks
            </label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              rows={3}
              placeholder="Any notes about this receipt…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
            />
          </div>

          {/* Document */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Attached Document
            </label>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-5 text-center hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors cursor-pointer"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-emerald-700">
                  <FileText size={16} className="shrink-0" />
                  <span className="font-medium truncate max-w-[260px]">{file.name}</span>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }}
                    className="p-0.5 rounded text-slate-400 hover:text-red-500 transition-colors shrink-0">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="text-slate-400">
                  <Upload size={22} className="mx-auto mb-1.5 text-slate-300" />
                  <p className="text-sm">Drop file or <span className="text-indigo-600 font-semibold">click to browse</span></p>
                  <p className="text-xs mt-0.5 text-slate-300">PDF, image, or any document</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>

          {/* Add to inventory toggle */}
          {!order.verification && (
            <div
              className={`rounded-xl border-2 p-4 transition-all cursor-pointer select-none ${
                addToInventory
                  ? 'border-emerald-400 bg-emerald-50/60'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
              onClick={() => setAddToInventory(v => !v)}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">Add to Live Inventory</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {addToInventory
                      ? 'Stock levels will be updated immediately for all items in this order.'
                      : 'Receipt will be recorded in history without updating stock levels.'}
                  </p>
                </div>
                <div className={`w-11 h-6 rounded-full flex items-center transition-colors shrink-0 ${addToInventory ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${addToInventory ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm shadow-emerald-200">
            {saving
              ? <><span className="animate-spin inline-block">↻</span> Processing…</>
              : <><CheckCircle2 size={14} /> Mark as Received</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Expanded order detail row ─────────────────────────────────────
function OrderDetail({ order }: { order: ShippingOrder }) {
  const receipts = order.receipts ?? [];
  const receivedMap = new Map<string, number>();
  for (const r of receipts) {
    for (const l of r.lines) {
      receivedMap.set(l.productId, (receivedMap.get(l.productId) ?? 0) + l.receivedQty);
    }
  }
  const hasPartialData = order.status === 'PARTIAL' || (receipts.length > 0);

  return (
    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {order.lines.map(l => {
          const rcvd = receivedMap.get(l.productId) ?? 0;
          const pct = l.qty > 0 ? Math.min(100, Math.round((rcvd / l.qty) * 100)) : 100;
          return (
            <div key={l.sku} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-slate-100">
              <div className="min-w-0 flex-1">
                <p className="text-slate-600 font-medium truncate">{l.productName}</p>
                <p className="font-mono text-slate-400 text-[10px]">{l.sku}</p>
                {hasPartialData && (
                  <div className="mt-1 w-full bg-slate-100 rounded-full h-1">
                    <div className={`h-1 rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
              <div className="ml-2 shrink-0 text-right">
                {hasPartialData ? (
                  <>
                    <span className={`font-bold tabular-nums ${pct >= 100 ? 'text-emerald-600' : 'text-slate-700'}`}>{rcvd.toLocaleString()}</span>
                    <span className="text-slate-300"> / {l.qty.toLocaleString()}</span>
                  </>
                ) : (
                  <span className="font-bold text-slate-700 tabular-nums">{l.qty.toLocaleString()}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Legacy receipt info (old orders without receipts array) */}
      {order.status === 'RECEIVED' && receipts.length === 0 && (order.blNumber || order.remarks || order.documentUrl || order.documentKey) && (
        <div className="mt-3 flex flex-wrap items-start gap-2">
          {order.blNumber && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs rounded-lg border border-indigo-100">
              <span className="font-bold">BL:</span>
              <span className="font-mono">{order.blNumber}</span>
            </span>
          )}
          {order.remarks && (
            <span className="inline-flex items-start gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg max-w-sm">
              <span className="font-bold shrink-0">Note:</span>
              <span>{order.remarks}</span>
            </span>
          )}
          {(order.documentKey || order.documentUrl) && (
            <a href={order.documentUrl ?? '#'} target="_blank" rel="noopener noreferrer"
              onClick={e => { e.preventDefault(); openAttachment(order); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors">
              <FileText size={12} />
              <span>{order.documentName ?? 'Document'}</span>
              <ExternalLink size={10} className="opacity-60" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared order table ────────────────────────────────────────────
interface OrderTableProps {
  orders: ShippingOrder[];
  expanded: Set<string>;
  receiving: Set<string>;
  deleting: Set<string>;
  onToggleExpand: (id: string) => void;
  onReceive: (order: ShippingOrder) => void;
  onViewHistory: (order: ShippingOrder) => void;
  onEdit: (order: ShippingOrder) => void;
  onDelete: (order: ShippingOrder) => void;
}
function OrderTable({ orders, expanded, receiving, deleting, onToggleExpand, onReceive, onViewHistory, onEdit, onDelete }: OrderTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest w-8" />
            <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Référence</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Catégorie</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Fournisseur</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Art.</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Qté totale</th>
            <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {orders.map(order => {
            const isExpanded = expanded.has(order.id);
            const totalQty = order.lines.reduce((s, l) => s + l.qty, 0);
            const isReceiving = receiving.has(order.id);
            const isDeleting = deleting.has(order.id);
            const percent = order.receipts && order.receipts.length > 0 ? computeOrderReceiptPercent(order) : (order.status === 'RECEIVED' ? 100 : 0);
            const isPartial = order.status === 'PARTIAL';
            const hasReceipts = (order.receipts?.length ?? 0) > 0;
            return (
              <>
                <tr key={order.id}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onToggleExpand(order.id)}>
                  <td className="px-4 py-3">
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-slate-800">{order.ref}</span>
                    {order.verification && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                        Verification
                      </span>
                    )}
                    {isPartial && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                        {percent}%
                      </span>
                    )}
                    {order.status === 'RECEIVED' && (order.blNumber || order.documentUrl || order.documentKey || hasReceipts) && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        <CheckCircle2 size={8} /> {hasReceipts ? '100%' : 'BL'}
                      </span>
                    )}
                    {order.cancelledRemaining && (
                      <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                        <Ban size={8} /> Closed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                      {refToCategory(order.ref)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{order.supplier || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(order.date)}</td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-600">{order.lines.length}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-slate-700 tabular-nums">{totalQty.toLocaleString('fr-FR')}</span>
                    {isPartial && (
                      <div className="mt-1 mx-auto w-16 bg-slate-200 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-amber-400 transition-all" style={{ width: `${percent}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {order.status === 'PLANNED' && (
                        <button
                          onClick={() => onReceive(order)}
                          disabled={isReceiving}
                          title="Record shipment receipt"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                          {isReceiving
                            ? <span className="flex items-center gap-1"><span className="animate-spin">↻</span> En cours…</span>
                            : <><PackageCheck size={12} /> Receive</>}
                        </button>
                      )}
                      {isPartial && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onReceive(order)}
                            disabled={isReceiving}
                            title="Add another shipment"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                            <Plus size={11} /> Shipment
                          </button>
                          <button
                            onClick={() => onViewHistory(order)}
                            title="View shipment history"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors">
                            <History size={11} /> History
                          </button>
                        </div>
                      )}
                      {order.status === 'RECEIVED' && (
                        <div className="flex items-center rounded-lg overflow-hidden border border-indigo-200">
                          {hasReceipts ? (
                            <button
                              onClick={() => onViewHistory(order)}
                              title="View shipment history"
                              className="flex items-center gap-1 px-2 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors">
                              <History size={12} /> View Shipments
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => openBonDeReception(order, 'web')}
                                title="Bon de réception (web)"
                                className="flex items-center gap-1 px-2 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors">
                                <FileText size={12} /> Bon de réception
                              </button>
                              <span className="w-px self-stretch bg-indigo-200 shrink-0" />
                              <button
                                onClick={() => openBonDeReception(order, 'pdf')}
                                title="Imprimer PDF"
                                className="px-2 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors">
                                PDF
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => onEdit(order)}
                        title="Modifier"
                        className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(order)}
                        disabled={isDeleting}
                        title="Supprimer"
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${order.id}-detail`}>
                    <td colSpan={8} className="p-0">
                      <OrderDetail order={order} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ── Shipped Supply history table ──────────────────────────────────
interface SupplyTableProps {
  supplies: ShippedSupply[];
  expanded: Set<string>;
  deleting: Set<string>;
  onToggleExpand: (id: string) => void;
  onDelete: (supply: ShippedSupply) => void;
}
function SupplyTable({ supplies, expanded, deleting, onToggleExpand, onDelete }: SupplyTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest w-8" />
            <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Référence</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Fournisseur</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Art.</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Qté totale</th>
            <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {supplies.map(supply => {
            const isExpanded = expanded.has(supply.id);
            const totalQty = supply.lines.reduce((s, l) => s + l.qty, 0);
            const isDeleting = deleting.has(supply.id);
            const hasDoc = !!(supply.documentKey || supply.documentUrl);
            return (
              <>
                <tr key={supply.id}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onToggleExpand(supply.id)}>
                  <td className="px-4 py-3">
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-slate-800">{supply.ref}</span>
                    <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                      <PackageCheck size={8} /> Supply
                    </span>
                    {supply.addedToInventory ? (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600">+Stock</span>
                    ) : (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">No stock</span>
                    )}
                    {!hasDoc && (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-400">No doc</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{supply.supplier || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(supply.date)}</td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-600">{supply.lines.length}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-slate-700 tabular-nums">{totalQty.toLocaleString('fr-FR')}</span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {hasDoc && (
                        <button onClick={() => openAttachment(supply)} title="Voir le document"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-bold hover:bg-emerald-100 transition-colors">
                          <FileText size={12} /> Document
                        </button>
                      )}
                      <button onClick={() => onDelete(supply)} disabled={isDeleting} title="Supprimer"
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${supply.id}-detail`}>
                    <td colSpan={7} className="p-0">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                          {supply.lines.map(l => (
                            <div key={l.sku} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-slate-100">
                              <div className="min-w-0 flex-1">
                                <p className="text-slate-600 font-medium truncate">{l.productName}</p>
                                <p className="font-mono text-slate-400 text-[10px]">{l.sku}</p>
                              </div>
                              <span className="ml-2 shrink-0 font-bold text-slate-700 tabular-nums">{l.qty.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        {supply.description && (
                          <p className="mt-2 text-xs text-slate-500 italic">{supply.description}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ── Bon de Réception — opens styled page in new tab ──────────────
async function openBonDeReception(order: ShippingOrder, format: 'web' | 'pdf' = 'web') {
  // Open the tab synchronously (inside the click gesture) so pop-up blockers
  // allow it; the signed document URL is resolved before writing the document.
  const w = window.open('', '_blank');
  const category = refToCategory(order.ref);
  const dateStr = fmtDate(order.date);
  const totalQty = order.lines.reduce((s, l) => s + l.qty, 0);
  const rows = order.lines.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${l.productName}</td>
      <td class="mono">${l.sku}</td>
      <td class="num">${l.qty.toLocaleString('fr-FR')}</td>
    </tr>`).join('');
  const docHref = await resolveAttachmentHref(order);
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Bon de réception ${order.ref}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;padding:40px 60px;font-size:13px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;border-bottom:2px solid #1a1a2e;padding-bottom:20px}
  .brand{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:6px}
  .doc-title{font-size:22px;font-weight:900;letter-spacing:1px}
  .doc-info{text-align:right}.doc-info .ref{font-size:18px;font-weight:700;margin-bottom:4px}.doc-info .date{color:#555}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:16px 32px;margin-bottom:32px}
  .meta-block label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;display:block;margin-bottom:4px}
  .meta-block span{font-size:15px;font-weight:600}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  thead tr{background:#1a1a2e;color:white}
  thead th{padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
  thead th:last-child{text-align:right}
  tbody tr:nth-child(even){background:#f7f8fc}
  tbody td{padding:10px 14px;border-bottom:1px solid #eee}
  td.mono{font-family:monospace;color:#555;font-size:12px}
  td.num{text-align:right;font-weight:600}
  tfoot tr{background:#1a1a2e;color:white}
  tfoot td{padding:10px 14px;font-weight:700}
  tfoot td.num{text-align:right}
  .footer{margin-bottom:32px}
  .remarks{background:#fffbf0;border:1px solid #f0e0a0;border-radius:6px;padding:16px;margin-bottom:24px}
  .remarks label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#a08020;display:block;margin-bottom:6px}
  .doc-link{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin-bottom:24px}
  .doc-link label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#166534;display:block;margin-bottom:6px}
  .doc-link a{color:#166534;font-weight:600}
  .stamp{margin-top:40px;text-align:center;font-size:10px;color:#ccc}
  @media print{body{padding:20px 40px}}
</style></head><body>
  <div class="header">
    <div><div class="brand">Granitec</div><div class="doc-title">Bon de Réception</div></div>
    <div class="doc-info"><div class="ref">${order.ref}</div><div class="date">${dateStr}</div></div>
  </div>
  <div class="meta">
    <div class="meta-block"><label>Catégorie</label><span>${category}</span></div>
    <div class="meta-block"><label>Statut</label><span style="color:#16a34a">✓ Reçu</span></div>
    ${order.supplier ? `<div class="meta-block"><label>Fournisseur</label><span>${order.supplier}</span></div>` : ''}
    ${order.blNumber ? `<div class="meta-block"><label>N° BL Fournisseur</label><span>${order.blNumber}</span></div>` : ''}
  </div>
  <table>
    <thead><tr><th>#</th><th>Désignation</th><th>Référence</th><th style="text-align:right">Quantité</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="3">Total</td><td class="num">${totalQty.toLocaleString('fr-FR')}</td></tr></tfoot>
  </table>
  ${order.remarks ? `<div class="remarks"><label>Remarques</label><p>${order.remarks.replace(/\n/g, '<br>')}</p></div>` : ''}
  ${docHref ? `<div class="doc-link"><label>Document joint</label><a href="${docHref}" target="_blank">📎 ${order.documentName ?? 'Document'}</a></div>` : ''}
  <div class="stamp">Document généré par Granitec ERP · ${new Date().toLocaleDateString('fr-FR')}</div>
</body></html>`;
  if (w) { w.document.write(html); w.document.close(); if (format === 'pdf') setTimeout(() => w.print(), 500); }
}

// ── Smart Order Wizard ────────────────────────────────────────────
interface SmartWizardProps {
  finishedProducts: Product[];
  allProducts: Product[];
  recipes: Recipe[];
  orders: ShippingOrder[];
  onClose: () => void;
  onCreated: () => void;
}
function SmartOrderWizard({ finishedProducts, allProducts, recipes, orders, onClose, onCreated }: SmartWizardProps) {
  const [step, setStep]               = useState<'select' | 'review'>('select');
  const [search, setSearch]           = useState('');
  const [showPicker, setShowPicker]   = useState(false);
  const [pickedProduct, setPickedProduct] = useState<Product | null>(null);
  const [targetQty, setTargetQty]     = useState('');
  const [calcError, setCalcError]     = useState('');
  const [groups, setGroups]           = useState<CategoryGroup[]>([]);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const filteredProducts = search.trim()
    ? finishedProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
    : finishedProducts;

  const handleCalculate = () => {
    setCalcError('');
    if (!pickedProduct) { setCalcError('Select a finished product.'); return; }
    const qty = Number(targetQty);
    if (!qty || qty <= 0) { setCalcError('Enter a valid target quantity.'); return; }
    const recipe = recipes.find(r => r.id === pickedProduct.id || r.finishedProductId === pickedProduct.id);
    if (!recipe) { setCalcError(`No BOM recipe found for ${pickedProduct.sku}. Add one in BOM Recipes first.`); return; }
    if (recipe.components.length === 0) { setCalcError('This recipe has no components.'); return; }
    setGroups(calcRequirements(recipe, qty, allProducts, orders));
    setStep('review');
  };

  const updateGroup = (i: number, patch: Partial<CategoryGroup>) =>
    setGroups(gs => gs.map((g, idx) => idx === i ? { ...g, ...patch } : g));

  const handleCreate = async () => {
    setSaveError('');
    const toCreate = groups.filter(g => g.enabled);
    if (toCreate.length === 0) { setSaveError('Enable at least one category group.'); return; }
    setSaving(true);
    try {
      for (const g of toCreate) {
        const lines = g.rows.filter(r => r.toOrder > 0).map(r => ({ productId: r.productId, productName: r.productName, sku: r.sku, qty: r.toOrder }));
        if (lines.length === 0) continue;
        await createShippingOrder({ ref: g.ref.trim(), supplier: g.supplier.trim() || undefined, date: todayISO(), lines });
      }
      onCreated();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to create orders.');
      setSaving(false);
    }
  };

  const enabledCount = groups.filter(g => g.enabled && g.rows.some(r => r.toOrder > 0)).length;

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-violet-500" />
            <h1 className="text-lg font-bold text-slate-800">Smart Order</h1>
          </div>
          <span className="text-slate-300">—</span>
          <span className="text-sm text-slate-400">{step === 'select' ? 'Select product & quantity' : 'Review requirements'}</span>
        </div>
        {step === 'review' && (
          <button onClick={handleCreate} disabled={saving || enabledCount === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm shadow-violet-200">
            {saving ? 'Creating…' : `Create ${enabledCount} Order${enabledCount !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Step 1: Select ── */}
        {step === 'select' && (
          <div className="max-w-lg mx-auto px-6 py-12">
            <h2 className="text-xl font-bold text-slate-800 mb-1">What do you want to produce?</h2>
            <p className="text-sm text-slate-400 mb-8">Select a finished product and enter the production target. The system will calculate all raw materials needed from the BOM recipe.</p>

            <div className="space-y-5">
              {/* Product picker */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Finished Product</label>
                <div ref={pickerRef} className="relative">
                  {pickedProduct ? (
                    <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 border-2 border-violet-300 rounded-xl">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800">{pickedProduct.name}</p>
                        <p className="text-xs font-mono text-slate-400">{pickedProduct.sku}</p>
                      </div>
                      <button onClick={() => { setPickedProduct(null); setSearch(''); }}
                        className="p-1 rounded-lg text-violet-400 hover:text-violet-700 hover:bg-violet-100 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text" value={search}
                        onChange={e => { setSearch(e.target.value); setShowPicker(true); }}
                        onFocus={() => setShowPicker(true)}
                        placeholder="Search by name or SKU…"
                        className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
                      />
                    </div>
                  )}
                  {showPicker && !pickedProduct && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                        {filteredProducts.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-slate-400">No products found</p>
                        ) : filteredProducts.map(p => (
                          <button key={p.id} type="button"
                            onMouseDown={() => { setPickedProduct(p); setSearch(p.name); setShowPicker(false); }}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-violet-50 transition-colors">
                            <div>
                              <p className="text-sm font-medium text-slate-800">{p.name}</p>
                              <p className="text-xs font-mono text-slate-400">{p.sku}</p>
                            </div>
                            <span className="text-xs text-slate-400 ml-3">{p.category}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Target qty */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Target Production Quantity</label>
                <input type="number" min="1" value={targetQty} onChange={e => setTargetQty(e.target.value)}
                  placeholder="e.g. 3000"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
                  onKeyDown={e => { if (e.key === 'Enter') handleCalculate(); }}
                />
              </div>

              {calcError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0" /> {calcError}
                </div>
              )}

              <button onClick={handleCalculate}
                className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition-colors text-sm flex items-center justify-center gap-2 shadow-sm shadow-violet-200">
                <Sparkles size={15} /> Calculate Requirements
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {step === 'review' && (
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('select')}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors">
                <ArrowLeft size={14} /> Back
              </button>
              <h2 className="text-base font-bold text-slate-700">
                To produce{' '}
                <span className="text-violet-700">{Number(targetQty).toLocaleString('fr-FR')} × {pickedProduct?.sku}</span>
                {' '}({pickedProduct?.name}) you need:
              </h2>
            </div>

            {saveError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertCircle size={15} className="shrink-0" /> {saveError}
              </div>
            )}

            {groups.map((g, gi) => {
              const totalToOrder = g.rows.reduce((s, r) => s + r.toOrder, 0);
              const allCovered = totalToOrder === 0;
              return (
                <div key={g.category}
                  className={`rounded-xl border overflow-hidden transition-opacity ${g.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                  {/* Group header */}
                  <div className={`flex items-center gap-3 px-4 py-3 ${g.enabled ? 'bg-slate-50' : 'bg-slate-50/50'}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      g.category === 'Aluminium Disc' ? 'bg-indigo-400' :
                      g.category === 'Accessories' ? 'bg-amber-400' :
                      g.category === 'Packaging' ? 'bg-teal-400' : 'bg-slate-400'
                    }`} />
                    <span className="font-bold text-slate-700 text-sm">{g.category}</span>
                    <span className="text-xs text-slate-400">{g.rows.length} item{g.rows.length !== 1 ? 's' : ''}</span>
                    {allCovered && <span className="ml-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">All in stock</span>}
                    {totalToOrder > 0 && <span className="ml-1 text-xs font-bold text-violet-600 tabular-nums">{totalToOrder.toLocaleString('fr-FR')} pcs to order</span>}
                    <div className="ml-auto flex items-center gap-3">
                      {/* Ref */}
                      <input type="text" value={g.ref} onChange={e => updateGroup(gi, { ref: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        className="w-36 px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                        disabled={!g.enabled}
                      />
                      {/* Supplier */}
                      <input type="text" value={g.supplier} onChange={e => updateGroup(gi, { supplier: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        placeholder="Supplier"
                        className="w-32 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                        disabled={!g.enabled}
                      />
                      {/* Toggle */}
                      <button onClick={() => updateGroup(gi, { enabled: !g.enabled })}
                        className={`flex items-center gap-1 text-xs font-semibold transition-colors ${g.enabled ? 'text-violet-600' : 'text-slate-400'}`}>
                        {g.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        {g.enabled ? 'On' : 'Off'}
                      </button>
                    </div>
                  </div>

                  {/* Rows */}
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Material</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest">SKU</th>
                        <th className="text-right px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Needed</th>
                        <th className="text-right px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest">In Stock</th>
                        <th className="text-right px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest">To Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {g.rows.map(r => (
                        <tr key={r.sku} className={r.toOrder === 0 ? 'opacity-40' : ''}>
                          <td className="px-4 py-2.5 text-slate-700 font-medium">{r.productName}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{r.sku}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{r.needed.toLocaleString('fr-FR')}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${r.inStock <= 0 ? 'text-red-500' : r.inStock >= r.needed ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {r.inStock.toLocaleString('fr-FR')}
                          </td>
                          <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${r.toOrder > 0 ? 'text-violet-700' : 'text-slate-300'}`}>
                            {r.toOrder > 0 ? r.toOrder.toLocaleString('fr-FR') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shipped Supply Modal ──────────────────────────────────────────
// Logs supply that has already physically arrived — no PLANNED/receive
// workflow, everything (amount, document, inventory choice) is entered in one step.
type SupplyDraftLine = { uid: string; productId: string; productName: string; sku: string; qty: string };
const EMPTY_SUPPLY_LINE = (): SupplyDraftLine => ({ uid: newUid(), productId: '', productName: '', sku: '', qty: '' });

interface ShippedSupplyModalProps {
  rawMaterials: Product[];
  suppliers: Supplier[];
  onAddSupplier: () => void;
  nextRef: string;
  onConfirm: (data: {
    ref: string;
    supplier: string;
    date: string;
    description: string;
    file: File | null;
    lines: ShippedSupplyLine[];
    addToInventory: boolean;
  }) => Promise<void>;
  onClose: () => void;
}
function ShippedSupplyModal({ rawMaterials, suppliers, onAddSupplier, nextRef, onConfirm, onClose }: ShippedSupplyModalProps) {
  const [ref_, setRef] = useState(nextRef);
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<SupplyDraftLine[]>([EMPTY_SUPPLY_LINE()]);
  const [file, setFile] = useState<File | null>(null);
  const [addToInventory, setAddToInventory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateLine = (i: number, patch: Partial<SupplyDraftLine>) =>
    setLines(l => l.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  const addLine = () => setLines(l => [...l, EMPTY_SUPPLY_LINE()]);
  const removeLine = (i: number) => setLines(l => l.length === 1 ? [EMPTY_SUPPLY_LINE()] : l.filter((_, idx) => idx !== i));

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);

  const handleConfirm = async () => {
    const validLines: ShippedSupplyLine[] = lines
      .filter(l => l.productId && Number(l.qty) > 0)
      .map(l => ({ productId: l.productId, productName: l.productName, sku: l.sku, qty: Number(l.qty) }));
    if (validLines.length === 0) {
      setError('Add at least one item with a product and quantity.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirm({
        ref: ref_.trim(), supplier: supplier.trim(), date, description: description.trim(),
        file, lines: validLines, addToInventory,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save shipped supply.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-bold text-slate-800">Shipped Supply</h2>
            <p className="text-xs text-slate-400 mt-0.5">Supply already received — logged in one step</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Ref, Date, Supplier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Reference</label>
              <input type="text" value={ref_} onChange={e => setRef(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Supplier</label>
            <EntityPicker
              value={supplier}
              onChange={setSupplier}
              entities={suppliers.map(s => ({ id: s.id, name: s.name, subtitle: s.mainPhone }))}
              onAddNew={onAddSupplier}
              placeholder="Supplier name"
              addLabel="Add new supplier"
              inputClassName="px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
            />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Items Received</label>
              {total > 0 && <span className="text-xs font-semibold text-slate-500">{total.toLocaleString('fr-FR')} pcs</span>}
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={line.uid} className="flex items-center gap-2">
                  <span className="w-5 text-xs font-bold text-slate-300 text-center shrink-0">{i + 1}</span>
                  <ProductPickerDropdown
                    products={rawMaterials}
                    value={line.productId}
                    onChange={p => updateLine(i, { productId: p.id, productName: p.name, sku: p.sku })}
                    placeholder="Select product…"
                    className="flex-1"
                  />
                  <input type="number" min="1" placeholder="Qty" value={line.qty}
                    onChange={e => updateLine(i, { qty: e.target.value })}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-white tabular-nums" />
                  <button type="button" onClick={() => removeLine(i)}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addLine}
              className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
              <Plus size={14} /> Add Item
            </button>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="What is this supply, where did it come from…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" />
          </div>

          {/* Document */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Document</label>
            <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0] ?? null); }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-4 text-center hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors cursor-pointer">
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-emerald-700">
                  <FileText size={16} /><span className="font-medium truncate max-w-[260px]">{file.name}</span>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }} className="p-0.5 rounded text-slate-400 hover:text-red-500"><X size={13} /></button>
                </div>
              ) : (
                <div className="text-slate-400">
                  <Upload size={20} className="mx-auto mb-1 text-slate-300" />
                  <p className="text-sm">Drop file or <span className="text-indigo-600 font-semibold">click to browse</span></p>
                  <p className="text-xs mt-0.5 text-slate-300">PDF, image, or any document</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>

          {/* Add to inventory toggle */}
          <div className={`rounded-xl border-2 p-4 transition-all cursor-pointer select-none ${addToInventory ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-200 bg-slate-50/60'}`}
            onClick={() => setAddToInventory(v => !v)}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Add to Live Inventory</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {addToInventory ? 'Stock levels updated immediately for these items.' : 'Logged without updating stock levels.'}
                </p>
              </div>
              <div className={`w-11 h-6 rounded-full flex items-center transition-colors shrink-0 ${addToInventory ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${addToInventory ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm shadow-emerald-200">
            {saving
              ? <><span className="animate-spin inline-block">↻</span> Saving…</>
              : <><PackageCheck size={14} /> Save Shipped Supply</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function ShippingPage() {
  const [orders, setOrders]           = useState<ShippingOrder[]>([]);
  const [supplies, setSupplies]       = useState<ShippedSupply[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<Product[]>([]);
  const [recipes, setRecipes]         = useState<Recipe[]>([]);
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showSmartOrder, setShowSmartOrder] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showShippedSupply, setShowShippedSupply] = useState(false);
  const [shippedSupplyRef, setShippedSupplyRef] = useState('');
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [receiving, setReceiving]     = useState<Set<string>>(new Set());
  const [deleting, setDeleting]       = useState<Set<string>>(new Set());
  const [editingOrder, setEditingOrder] = useState<ShippingOrder | null>(null);
  const [receivingOrder, setReceivingOrder] = useState<ShippingOrder | null>(null);
  const [historyOrder, setHistoryOrder] = useState<ShippingOrder | null>(null);
  const [editingReceiptData, setEditingReceiptData] = useState<{ order: ShippingOrder; receipt: ShipmentReceipt } | null>(null);

  // Filters
  const [filterCat, setFilterCat]           = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus]     = useState<'all' | 'PLANNED' | 'PARTIAL' | 'RECEIVED'>('all');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');
  const [search, setSearch]                 = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Create/edit order overlay state
  const [showCreate, setShowCreate]   = useState(false);
  const [ref_, setRef]                = useState('');
  const [refPrefix, setRefPrefix]     = useState<RefPrefix>('SH');
  const [supplier, setSupplier]       = useState('');
  const [date, setDate]               = useState(getLastEntryDate());
  const [lines, setLines]             = useState<DraftLine[]>([EMPTY_LINE()]);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');
  const [showImport, setShowImport]   = useState(false);
  const [importText, setImportText]   = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const refInputRef = useRef<HTMLInputElement>(null);

  // Draft persistence for new shipping orders
  type ShipDraft = { supplier: string; date: string; lineData: Array<{ productId: string; productName: string; sku: string; qty: string }> };
  const { draft: sd, update: updateSd, clearDraft: clearShipDraft, hasDraft: hasShipDraft, isReady: shipReady, savedAt: shipSavedAt, continueDraft: continueShip, discardDraft: discardShip } =
    useDraft<ShipDraft>('shipping-new-order', { supplier: '', date: getLastEntryDate(), lineData: [] });

  // Sync lines → draft
  useEffect(() => {
    if (!editingOrder) {
      updateSd({ lineData: lines.filter(l => l.productId).map(l => ({ productId: l.productId, productName: l.productName, sku: l.sku, qty: l.qty })) });
    }
  }, [lines, editingOrder]);
  useEffect(() => { if (!editingOrder) updateSd({ supplier, date }); }, [supplier, date, editingOrder]);

  const handleContinueShipDraft = () => {
    continueShip();
    setSupplier(sd.supplier);
    setDate(sd.date);
    if (sd.lineData.length > 0) {
      setLines(sd.lineData.map(l => ({ ...EMPTY_LINE(), productId: l.productId, productName: l.productName, sku: l.sku, search: l.productName, qty: l.qty })));
    }
  };
  const handleDiscardShipDraft = () => { discardShip(); setSupplier(''); setDate(todayISO()); setLines([EMPTY_LINE()]); };

  const handlePrefixChange = (p: RefPrefix) => {
    setRefPrefix(p);
    setRef(autoRefByPrefix(orders, p, new Date(date + 'T00:00:00').getFullYear()));
  };

  const handleDateChange = (d: string) => {
    setDate(d);
    saveLastEntryDate(d);
    if (!editingOrder) {
      setRef(autoRefByPrefix(orders, refPrefix, new Date(d + 'T00:00:00').getFullYear()));
    }
  };

  const loadSuppliers = async () => {
    try { setSuppliers(await getSuppliers()); } catch { /* ignore */ }
  };

  const load = async () => {
    setLoading(true);
    const [ords, prods, recs, sups] = await Promise.all([getShippingOrders(), getProducts(), getRecipes(), getShippedSupplies()]);
    setOrders(ords);
    setSupplies(sups);
    setAllProducts(prods);
    setRawMaterials(prods.filter(p => p.type === 'RAW'));
    setRecipes(recs);
    setLoading(false);
    loadSuppliers();
    return ords;
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingOrder(null);
    const initialPrefix: RefPrefix = 'SH';
    const today = todayISO();
    setRefPrefix(initialPrefix);
    setDate(today);
    setRef(autoRefByPrefix(orders, initialPrefix, new Date(today + 'T00:00:00').getFullYear()));
    setSupplier(localStorage.getItem('granitec:lastSupplier') ?? '');
    setLines([EMPTY_LINE()]);
    setSaveError('');
    setShowImport(false);
    setImportText('');
    setImportWarnings([]);
    setShowCreate(true);
    setTimeout(() => refInputRef.current?.focus(), 80);
  };

  const openEdit = (order: ShippingOrder) => {
    setEditingOrder(order);
    const derived = order.ref.split('-')[0].toUpperCase() as RefPrefix;
    setRefPrefix((REF_PREFIXES as readonly string[]).includes(derived) ? derived : 'SH');
    setRef(order.ref);
    setSupplier(order.supplier ?? '');
    setDate(order.date);
    setLines(order.lines.map(l => ({
      uid: newUid(),
      productId: l.productId,
      productName: l.productName,
      sku: l.sku,
      qty: String(l.qty),
      reconcile: l.reconcile ?? false,
      search: l.productName,
      showSuggestions: false,
      highlightIdx: -1,
    })));
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
      if (p && qty > 0) valid.push({ uid: newUid(), productId: p.id, productName: p.name, sku: p.sku, qty: String(qty), reconcile: false, search: p.name, showSuggestions: false, highlightIdx: -1 });
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
    const validLines = lines.filter(l => l.productId && Number(l.qty) > 0);
    if (validLines.length === 0) { setSaveError('Add at least one line with a product and quantity.'); return; }
    setSaving(true);
    try {
      const mappedLines = validLines.map(l => ({
        productId: l.productId,
        productName: l.productName,
        sku: l.sku,
        qty: Number(l.qty),
        ...(l.reconcile ? { reconcile: true } : {}),
      }));
      if (editingOrder) {
        const patch = { ref: ref_.trim(), supplier: supplier.trim() || undefined, date, lines: mappedLines };
        if (editingOrder.status === 'RECEIVED') {
          await updateReceivedShippingOrder(editingOrder, patch);
        } else {
          await updateShippingOrder(editingOrder.id, patch);
        }
        setEditingOrder(null);
      } else {
        const detectedCat = (() => {
          const cats = validLines
            .map(l => rawMaterials.find(p => p.id === l.productId)?.category)
            .filter(Boolean) as string[];
          return cats.length > 0 && cats.every(c => c === cats[0]) ? cats[0] : undefined;
        })();
        const finalRef = ref_.trim() || autoRef(orders, detectedCat);
        if (supplier.trim()) localStorage.setItem('granitec:lastSupplier', supplier.trim());
        await createShippingOrder({
          ref: finalRef,
          supplier: supplier.trim() || undefined,
          date,
          lines: mappedLines,
        });
      }
      if (!editingOrder) clearShipDraft();
      setShowCreate(false);
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save order.');
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = (order: ShippingOrder) => {
    setReceivingOrder(order);
  };

  const handlePartialReceiveConfirm = async (data: {
    date: string;
    blNumber?: string;
    remarks?: string;
    file: File | null;
    lines: ShipmentReceiptLine[];
    addedToInventory: boolean;
  }) => {
    const order = receivingOrder ?? editingReceiptData?.order;
    const editingReceipt = editingReceiptData?.receipt ?? null;
    if (!order) return;
    setReceiving(s => new Set(s).add(order.id));
    try {
      let documentUrl = editingReceipt?.documentUrl;
      let documentName = editingReceipt?.documentName;
      let documentKey = editingReceipt?.documentKey;
      let storageProvider = editingReceipt?.storageProvider;
      let uploadError = '';
      if (data.file) {
        // Document upload must never discard the recorded shipment. If the R2
        // upload fails (e.g. bucket CORS), we still save the receipt quantities
        // and let the user re-attach the file later.
        try {
          if (editingReceipt) await deleteAttachmentObject(editingReceipt);
          const uploaded = await uploadReceiptDocument(data.file);
          documentKey = uploaded.objectKey;
          documentName = uploaded.originalName;
          storageProvider = 'r2';
        } catch (e) {
          uploadError = e instanceof Error ? e.message : 'Document upload failed.';
          console.error('Receipt document upload failed — saving receipt without it.', e);
        }
      }
      const receiptData = { date: data.date, blNumber: data.blNumber, remarks: data.remarks, documentUrl, documentName, documentKey, storageProvider, lines: data.lines, addedToInventory: data.addedToInventory };
      if (editingReceipt) {
        await updateShipmentReceipt(order, editingReceipt.id, receiptData);
      } else {
        await addShipmentReceipt(order, receiptData);
      }
      setReceivingOrder(null);
      setEditingReceiptData(null);
      const freshOrders = await load();
      // Auto-open history so the user can immediately see the updated receipts
      const freshOrder = freshOrders?.find(o => o.id === order.id);
      if (freshOrder) setHistoryOrder(freshOrder);
      if (uploadError) {
        alert(`Shipment saved, but the document could not be uploaded:\n${uploadError}\n\nThe receipt and its quantities were recorded. Edit the receipt to attach the document once storage is reachable.`);
      }
    } catch (e) {
      throw e;
    } finally {
      setReceiving(s => { const n = new Set(s); n.delete(order.id); return n; });
    }
  };

  const openShippedSupply = async () => {
    const existing = await getShippedSupplies();
    setShippedSupplyRef(nextShippedSupplyRef(existing));
    setShowShippedSupply(true);
  };

  const handleCreateShippedSupply = async (data: {
    ref: string;
    supplier: string;
    date: string;
    description: string;
    file: File | null;
    lines: ShippedSupplyLine[];
    addToInventory: boolean;
  }) => {
    let documentName: string | undefined;
    let documentKey: string | undefined;
    let storageProvider: 'r2' | undefined;
    let uploadError = '';
    if (data.file) {
      // Never lose the logged supply because the document upload failed.
      try {
        const uploaded = await uploadShippedSupplyDocument(data.file);
        documentKey = uploaded.objectKey;
        documentName = uploaded.originalName;
        storageProvider = 'r2';
      } catch (e) {
        uploadError = e instanceof Error ? e.message : 'Document upload failed.';
        console.error('Shipped-supply document upload failed — saving without it.', e);
      }
    }
    await createShippedSupply({
      ref: data.ref,
      supplier: data.supplier || undefined,
      date: data.date,
      description: data.description || undefined,
      lines: data.lines,
      documentName,
      documentKey,
      storageProvider,
    }, data.addToInventory);
    setShowShippedSupply(false);
    await load();
    if (uploadError) {
      alert(`Supply saved, but the document could not be uploaded:\n${uploadError}\n\nThe supply was recorded (visible in Documents, flagged "Without document"). You can attach the document later once storage is reachable.`);
    }
  };

  const handleReceiveConfirm = async (data: { blNumber: string; remarks: string; file: File | null; addToInventory: boolean }) => {
    if (!receivingOrder) return;
    const order = receivingOrder;
    setReceiving(s => new Set(s).add(order.id));
    try {
      let documentName: string | undefined;
      let documentKey: string | undefined;
      let storageProvider: 'r2' | undefined;
      let uploadError = '';
      if (data.file) {
        // Never lose the receipt because the document upload failed.
        try {
          const uploaded = await uploadReceiptDocument(data.file);
          documentKey = uploaded.objectKey;
          documentName = uploaded.originalName;
          storageProvider = 'r2';
        } catch (e) {
          uploadError = e instanceof Error ? e.message : 'Document upload failed.';
          console.error('Receipt document upload failed — receiving without it.', e);
        }
      }
      const failedIds = await receiveShippingOrder(order, {
        blNumber: data.blNumber.trim() || undefined,
        remarks: data.remarks.trim() || undefined,
        documentName,
        documentKey,
        storageProvider,
      }, data.addToInventory);
      setReceivingOrder(null);
      if (failedIds.length > 0) {
        alert(`⚠ ${failedIds.length} product(s) could not be received (not found in inventory): ${failedIds.join(', ')}`);
      }
      if (uploadError) {
        alert(`Order received, but the document could not be uploaded:\n${uploadError}\n\nThe receipt was recorded. Edit the order to attach the document once storage is reachable.`);
      }
      await load();
    } catch (e) {
      alert(`Failed to receive order: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setReceiving(s => { const n = new Set(s); n.delete(order.id); return n; });
    }
  };

  const handleViewHistory = (order: ShippingOrder) => {
    setHistoryOrder(order);
  };

  const handleHistoryEditReceipt = (receipt: ShipmentReceipt) => {
    if (!historyOrder) return;
    setEditingReceiptData({ order: historyOrder, receipt });
    setHistoryOrder(null);
  };

  const handleHistoryDeleteReceipt = async (receipt: ShipmentReceipt) => {
    if (!historyOrder) return;
    if (!confirm(`Delete this shipment receipt (${receipt.lines.reduce((s, l) => s + l.receivedQty, 0).toLocaleString()} pcs)? Stock will be reversed.`)) return;
    const order = historyOrder;
    try {
      await deleteShipmentReceipt(order, receipt.id);
      const freshOrders = await load();
      const freshOrder = freshOrders?.find(o => o.id === order.id);
      setHistoryOrder(freshOrder ?? null);
    } catch (e) {
      alert(`Failed to delete receipt: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleCancelRemaining = async () => {
    if (!historyOrder) return;
    const percent = computeOrderReceiptPercent(historyOrder);
    if (!confirm(`Cancel remaining ${(historyOrder.lines.reduce((s,l)=>s+l.qty,0) - historyOrder.lines.reduce((s,l)=>s+Math.min(l.qty, (historyOrder.receipts??[]).reduce((t,r)=>t+(r.lines.find(rl=>rl.productId===l.productId)?.receivedQty??0),0)),0)).toLocaleString()} pcs and close this order at ${percent}%?`)) return;
    try {
      await cancelRemainingAndClose(historyOrder);
      setHistoryOrder(null);
      await load();
    } catch (e) {
      alert(`Failed to close order: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (order: ShippingOrder) => {
    const hasMovements = order.status === 'RECEIVED' || order.status === 'PARTIAL';
    const warning = hasMovements
      ? `Delete ${order.status === 'PARTIAL' ? 'partial' : 'received'} order ${order.ref}? This will reverse stock for all recorded receipts.`
      : `Delete order ${order.ref}?`;
    if (!confirm(warning)) return;
    setDeleting(s => new Set(s).add(order.id));
    try {
      if (hasMovements) {
        await deleteReceivedShippingOrder(order);
      } else {
        await deleteShippingOrder(order.id);
      }
      // Only remove from local state after Firestore confirms success
      setOrders(o => o.filter(x => x.id !== order.id));
    } catch (e) {
      alert(`Failed to delete order: ${e instanceof Error ? e.message : 'Unknown error'}`);
      await load(); // Re-sync with Firestore to ensure UI is accurate
    } finally {
      setDeleting(s => { const n = new Set(s); n.delete(order.id); return n; });
    }
  };

  const handleDeleteSupply = async (supply: ShippedSupply) => {
    if (!confirm(`Supprimer l'approvisionnement ${supply.ref}?${supply.addedToInventory ? ' Le stock qu\'il a ajouté sera annulé.' : ''}`)) return;
    setDeleting(s => new Set(s).add(supply.id));
    try {
      await deleteShippedSupply(supply);
      setSupplies(prev => prev.filter(x => x.id !== supply.id));
    } catch (e) {
      alert(`Échec de la suppression : ${e instanceof Error ? e.message : 'Unknown error'}`);
      await load();
    } finally {
      setDeleting(s => { const n = new Set(s); n.delete(supply.id); return n; });
    }
  };

  const toggleExpand = (id: string) => setExpanded(s => {
    const n = new Set(s);
    s.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // Click-outside for export dropdown
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  const SUPPLY_CAT = 'Shipped Supply';
  const allCategories = Array.from(new Set([
    ...orders.map(o => refToCategory(o.ref)),
    ...(supplies.length > 0 ? [SUPPLY_CAT] : []),
  ])).sort();
  const allSuppliers  = Array.from(new Set([
    ...orders.map(o => o.supplier ?? '').filter(Boolean),
    ...supplies.map(s => s.supplier ?? '').filter(Boolean),
  ])).sort() as string[];

  const displaySupplies = supplies.filter(s => {
    // Shipped supplies are already received — hide them under planning/partial filters.
    if (filterStatus === 'PLANNED' || filterStatus === 'PARTIAL') return false;
    // Category pills are order-centric; supplies live under their own pseudo-category.
    if (filterCat && filterCat !== SUPPLY_CAT) return false;
    if (filterSupplier && (s.supplier ?? '') !== filterSupplier) return false;
    if (dateFrom && s.date < dateFrom) return false;
    if (dateTo && s.date > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      const match = s.ref.toLowerCase().includes(q)
        || (s.supplier ?? '').toLowerCase().includes(q)
        || (s.description ?? '').toLowerCase().includes(q)
        || s.date.includes(search)
        || s.lines.some(l => l.sku.toLowerCase().includes(q) || l.productName.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const displayOrders = orders.filter(o => {
    if (filterCat && refToCategory(o.ref) !== filterCat) return false;
    if (filterSupplier && (o.supplier ?? '') !== filterSupplier) return false;
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (dateFrom && o.date < dateFrom) return false;
    if (dateTo && o.date > dateTo) return false;

    if (search) {
      const searchLower = search.toLowerCase();
      const matchRef = o.ref.toLowerCase().includes(searchLower);
      const matchSupplier = (o.supplier ?? '').toLowerCase().includes(searchLower);
      const matchDate = o.date.includes(search);
      const matchProduct = o.lines.some(l =>
        l.sku.toLowerCase().includes(searchLower) ||
        l.productName.toLowerCase().includes(searchLower)
      );
      if (!matchRef && !matchSupplier && !matchDate && !matchProduct) return false;
    }

    return true;
  });

  const planned  = displayOrders.filter(o => o.status === 'PLANNED' || o.status === 'PARTIAL');
  const received = displayOrders.filter(o => o.status === 'RECEIVED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Shipping</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Loading…' : `${planned.filter(o=>o.status==='PLANNED').length} planned · ${planned.filter(o=>o.status==='PARTIAL').length} in progress · ${received.length} received${supplies.length > 0 ? ` · ${supplies.length} shipped supply` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSmartOrder(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors shadow-sm shadow-violet-200">
            <Sparkles size={15} /> Smart Order
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
            <Plus size={16} /> New Order
          </button>
          <button onClick={openShippedSupply}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200">
            <PackagePlus size={16} /> Shipped Supply
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {!loading && (orders.length > 0 || supplies.length > 0) && (
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ref, supplier, date, or product…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setFilterCat('')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${!filterCat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              Tout
            </button>
            {allCategories.map(cat => (
              <button key={cat} onClick={() => setFilterCat(filterCat === cat ? '' : cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filterCat === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Supplier select */}
          {allSuppliers.length > 0 && (
            <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">Tous les fournisseurs</option>
              {allSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {/* Status filter */}
          <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
            {([['all', 'Tous'], ['PLANNED', 'Planifié'], ['PARTIAL', 'En cours'], ['RECEIVED', 'Reçu']] as [typeof filterStatus, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setFilterStatus(val)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${filterStatus === val ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="inline-flex items-center gap-1.5">
            <CalendarCheck size={13} className="text-slate-400" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              title="Date de début"
              className="px-2 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <span className="text-slate-300 text-xs">→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              title="Date de fin"
              className="px-2 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Effacer les dates">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Export */}
          <div className="ml-auto relative" ref={exportMenuRef}>
            <button onClick={() => setShowExportMenu(e => !e)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
              <Download size={13} /> Export
              <ChevronDown size={11} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[270px]">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><FileDown size={12} /> Vue actuelle</span>
                  <div className="flex gap-1">
                    {(['web', 'pdf', 'excel'] as ExportFormat[]).map(fmt => (
                      <button key={fmt} onClick={() => { exportShipping(displayOrders, fmt, filterCat || filterSupplier || 'Toutes'); setShowExportMenu(false); }}
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 transition-colors">
                        {fmt === 'excel' ? 'XLS' : fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                {allCategories.map(cat => (
                  <div key={cat} className="flex items-center justify-between px-4 py-2 border-b border-slate-50">
                    <span className="text-xs text-slate-700">{cat}</span>
                    <div className="flex gap-1">
                      {(['web', 'pdf', 'excel'] as ExportFormat[]).map(fmt => (
                        <button key={fmt} onClick={() => { exportShipping(orders.filter(o => refToCategory(o.ref) === cat), fmt, cat); setShowExportMenu(false); }}
                          className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 transition-colors">
                          {fmt === 'excel' ? 'XLS' : fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {allSuppliers.length > 0 && <div className="border-t border-slate-100" />}
                {allSuppliers.map(s => (
                  <div key={s} className="flex items-center justify-between px-4 py-2 border-b border-slate-50">
                    <span className="text-xs text-slate-700 truncate mr-2 max-w-[120px]">{s}</span>
                    <div className="flex gap-1 shrink-0">
                      {(['web', 'pdf', 'excel'] as ExportFormat[]).map(fmt => (
                        <button key={fmt} onClick={() => { exportShipping(orders.filter(o => (o.supplier ?? '') === s), fmt, s); setShowExportMenu(false); }}
                          className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 transition-colors">
                          {fmt === 'excel' ? 'XLS' : fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
            </div>
          </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 text-sm animate-pulse">
          Loading orders…
        </div>
      ) : orders.length === 0 && supplies.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
          <Truck size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No shipping orders yet</p>
          <p className="text-slate-400 text-sm mt-1">Create a new order to plan your next delivery</p>
        </div>
      ) : (
        <>
          {/* ── Planned orders ── */}
          {planned.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                En attente · {planned.length}
              </h2>
              <OrderTable
                orders={planned}
                expanded={expanded}
                receiving={receiving}
                deleting={deleting}
                onToggleExpand={toggleExpand}
                onReceive={handleReceive}
                onViewHistory={handleViewHistory}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            </div>
          )}

          {/* ── Reception history ── */}
          {received.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                Historique réceptions · {received.length}
              </h2>
              <OrderTable
                orders={received}
                expanded={expanded}
                receiving={receiving}
                deleting={deleting}
                onToggleExpand={toggleExpand}
                onReceive={handleReceive}
                onViewHistory={handleViewHistory}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            </div>
          )}

          {/* ── Shipped supply history ── */}
          {displaySupplies.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                Approvisionnements reçus · {displaySupplies.length}
              </h2>
              <SupplyTable
                supplies={displaySupplies}
                expanded={expanded}
                deleting={deleting}
                onToggleExpand={toggleExpand}
                onDelete={handleDeleteSupply}
              />
            </div>
          )}

          {planned.length === 0 && received.length === 0 && displaySupplies.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 text-sm">
              Aucun résultat pour les filtres sélectionnés.
            </div>
          )}
        </>
      )}

      {/* Partial Receive Modal (new flow) */}
      {receivingOrder && (
        <PartialReceiveModal
          order={receivingOrder}
          onConfirm={handlePartialReceiveConfirm}
          onClose={() => setReceivingOrder(null)}
        />
      )}

      {/* Edit Receipt Modal */}
      {editingReceiptData && (
        <PartialReceiveModal
          order={editingReceiptData.order}
          editingReceipt={editingReceiptData.receipt}
          onConfirm={handlePartialReceiveConfirm}
          onClose={() => setEditingReceiptData(null)}
        />
      )}

      {/* Shipment History Modal */}
      {historyOrder && (
        <ShipmentHistoryModal
          order={historyOrder}
          onAddReceipt={() => { setReceivingOrder(historyOrder); setHistoryOrder(null); }}
          onEditReceipt={handleHistoryEditReceipt}
          onDeleteReceipt={handleHistoryDeleteReceipt}
          onCancelRemaining={handleCancelRemaining}
          onClose={() => setHistoryOrder(null)}
        />
      )}


      {/* Smart Order Wizard */}
      {showSmartOrder && (
        <SmartOrderWizard
          finishedProducts={allProducts.filter(p => p.type === 'FINISHED')}
          allProducts={allProducts}
          recipes={recipes}
          orders={orders}
          onClose={() => setShowSmartOrder(false)}
          onCreated={async () => { setShowSmartOrder(false); await load(); }}
        />
      )}

      {/* Shipped Supply Modal */}
      {showShippedSupply && (
        <ShippedSupplyModal
          rawMaterials={rawMaterials}
          suppliers={suppliers}
          onAddSupplier={() => setShowAddSupplierModal(true)}
          nextRef={shippedSupplyRef}
          onConfirm={handleCreateShippedSupply}
          onClose={() => setShowShippedSupply(false)}
        />
      )}

      {/* Draft banner for new shipping order */}
      {showCreate && !editingOrder && hasShipDraft && !shipReady && (
        <div className="fixed inset-0 z-[101] flex items-start justify-center pt-20 px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xl">
            <DraftBanner savedAt={shipSavedAt} onContinue={handleContinueShipDraft} onDiscard={handleDiscardShipDraft} />
          </div>
        </div>
      )}

      {/* Create / Edit Order Overlay */}
      {showCreate && (
        <CreateOrderOverlay
          rawMaterials={rawMaterials}
          ref_={ref_} setRef={setRef}
          refPrefix={refPrefix} onPrefixChange={handlePrefixChange}
          supplier={supplier} setSupplier={setSupplier}
          suppliers={suppliers} onAddSupplier={() => setShowAddSupplierModal(true)}
          date={date} onDateChange={handleDateChange}
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
          onClose={() => { setShowCreate(false); setEditingOrder(null); }}
          onParseImport={parseImport}
          onImportLines={(newLines) => {
            setLines(prev => {
              const kept = prev.filter(l => !!l.productId);
              const combined = [...kept, ...newLines];
              return [...combined, EMPTY_LINE()];
            });
          }}
          isEditing={!!editingOrder}
        />
      )}

      {/* Add Supplier Modal (from within create overlay) */}
      {showAddSupplierModal && (
        <SupplierModal
          onSave={async (data) => {
            const id = await createSupplier(data);
            await loadSuppliers();
            // Auto-select the newly created supplier
            setSupplier(data.name);
            return id as unknown as void;
          }}
          onClose={() => setShowAddSupplierModal(false)}
        />
      )}
    </div>
  );
}
