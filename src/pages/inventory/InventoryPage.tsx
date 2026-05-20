import { useEffect, useState, type FormEvent } from 'react';
import { Plus, FlaskConical, ArrowDownToLine, ChevronDown, Search, FileText, X, Pencil, Trash2, PackagePlus, FileDown } from 'lucide-react';
import ProductPickerDropdown from '@/components/ui/ProductPickerDropdown';
import { getProducts, addProduct, adjustStock, getMovements, deleteProduct, updateProduct, receiveSupplyBatch } from '@/services/inventory.service';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import type { Product, ProductType, InventoryMovement } from '@/types';

const RAW_CATEGORIES = ['Aluminium Disc', 'Accessories', 'Packaging'] as const;
type RawCategory = typeof RAW_CATEGORIES[number];
const RAW_CATEGORY_ORDER = [...RAW_CATEGORIES];

function sortCategories(cats: string[], order: string[]): string[] {
  return [...cats].sort((a, b) => {
    const ai = order.indexOf(a), bi = order.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });
}

function tsToDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: unknown }).toDate === 'function')
    return (v as { toDate: () => Date }).toDate();
  return new Date();
}

function stockBadge(p: Product) {
  if (p.stock_level <= 0) return <Badge label="Empty" variant="red" />;
  if (p.stock_level <= p.min_stock) return <Badge label="Low" variant="yellow" />;
  return <Badge label="In Stock" variant="green" />;
}

// ── Shipping group types ──────────────────────────────────────────
interface ShippingGroup {
  ref: string;
  date: Date;
  totalQty: number;
  items: { sku: string; name: string; qty: number }[];
}

function openShippingDoc(group: ShippingGroup) {
  const fmt = group.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const rows = group.items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.name}</td>
      <td class="mono">${item.sku}</td>
      <td class="num">${item.qty.toLocaleString('fr-FR')}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Bon de réception ${group.ref}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;padding:40px 60px;font-size:13px; }
  .header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;border-bottom:2px solid #1a1a2e;padding-bottom:20px; }
  .doc-title { font-size:22px;font-weight:900;letter-spacing:1px; }
  .doc-info { text-align:right; }
  .doc-info .ref { font-size:18px;font-weight:700;margin-bottom:4px; }
  .doc-info .date { color:#555; }
  .meta { display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px; }
  .meta-block label { font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;display:block;margin-bottom:4px; }
  .meta-block span { font-size:15px;font-weight:600; }
  table { width:100%;border-collapse:collapse;margin-bottom:24px; }
  thead tr { background:#1a1a2e;color:white; }
  thead th { padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px; }
  thead th:last-child { text-align:right; }
  tbody tr:nth-child(even) { background:#f7f8fc; }
  tbody td { padding:10px 14px;border-bottom:1px solid #eee; }
  td.mono { font-family:monospace;color:#555;font-size:12px; }
  td.num { text-align:right;font-weight:600; }
  .footer { display:flex;justify-content:flex-end; }
  .total-box { background:#1a1a2e;color:white;padding:14px 24px;border-radius:6px;min-width:200px; }
  .total-box .label { font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:0.7;margin-bottom:4px; }
  .total-box .value { font-size:22px;font-weight:700; }
  .stamp { margin-top:60px;text-align:center;font-size:10px;color:#ccc; }
  @media print { body { padding:20px 40px; } }
</style></head><body>
  <div class="header">
    <div class="doc-title">Bon de réception matière</div>
    <div class="doc-info"><div class="ref">${group.ref}</div><div class="date">${fmt}</div></div>
  </div>
  <div class="meta">
    <div class="meta-block"><label>Matière</label><span>Disque aluminium</span></div>
    <div class="meta-block"><label>Nombre de références</label><span>${group.items.length}</span></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Désignation</th><th>Référence</th><th style="text-align:right">Quantité</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <div class="total-box">
      <div class="label">Total pièces</div>
      <div class="value">${group.totalQty.toLocaleString('fr-FR')}</div>
    </div>
  </div>
  <div class="stamp">Document généré par Granitec ERP · ${new Date().toLocaleDateString('fr-FR')}</div>
</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

function ShippingRow({ group }: { group: ShippingGroup }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3 text-sm text-slate-500 tabular-nums whitespace-nowrap">
          {group.date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-slate-800 font-mono">{group.ref}</td>
        <td className="px-4 py-3 text-sm font-semibold tabular-nums text-right text-green-600">
          +{group.totalQty.toLocaleString()} pcs
        </td>
        <td className="px-4 py-3 text-sm text-slate-400">{group.items.length} items</td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <button onClick={e => { e.stopPropagation(); openShippingDoc(group); }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors">
              <FileText size={12} /> View
            </button>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 border-b border-slate-100">
          <td colSpan={5} className="px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {group.items.map(item => (
                <div key={item.sku} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5 border border-slate-100">
                  <span className="font-mono text-slate-500 truncate">{item.sku}</span>
                  <span className="font-semibold text-slate-700 tabular-nums ml-2 shrink-0">{item.qty.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Supply Receipt Full Report ────────────────────────────────────
function downloadSupplyReport(shippingHistory: ShippingGroup[]) {
  const now = new Date();
  const totalPcs = shippingHistory.reduce((s, g) => s + g.totalQty, 0);

  const dates = shippingHistory.map(g => g.date);
  const minDate = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
  const maxDate = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
  const dateRange = minDate && maxDate
    ? `${minDate.toLocaleDateString('fr-FR')} – ${maxDate.toLocaleDateString('fr-FR')}`
    : '—';

  const bySku = new Map<string, { name: string; sku: string; receipts: number; qty: number }>();
  for (const g of shippingHistory) {
    for (const item of g.items) {
      if (!bySku.has(item.sku)) bySku.set(item.sku, { name: item.name, sku: item.sku, receipts: 0, qty: 0 });
      const s = bySku.get(item.sku)!;
      s.receipts++;
      s.qty += item.qty;
    }
  }
  const skuRows = Array.from(bySku.values()).sort((a, b) => b.qty - a.qty);

  const byYear = new Map<number, { receipts: number; qty: number }>();
  for (const g of shippingHistory) {
    const y = g.date.getFullYear();
    if (!byYear.has(y)) byYear.set(y, { receipts: 0, qty: 0 });
    byYear.get(y)!.receipts++;
    byYear.get(y)!.qty += g.totalQty;
  }
  const yearRows = Array.from(byYear.entries()).sort((a, b) => b[0] - a[0]);

  const skuHtml = skuRows.map((s, i) => `<tr>
    <td>${i + 1}</td>
    <td>${s.name}</td>
    <td class="mono">${s.sku}</td>
    <td class="num">${s.receipts.toLocaleString('fr-FR')}</td>
    <td class="num">${s.qty.toLocaleString('fr-FR')}</td>
    <td class="num">${totalPcs > 0 ? ((s.qty / totalPcs) * 100).toFixed(1) : 0}%</td>
  </tr>`).join('');

  const yearHtml = yearRows.map(([y, s]) => `<tr>
    <td>${y}</td>
    <td class="num">${s.receipts.toLocaleString('fr-FR')}</td>
    <td class="num">${s.qty.toLocaleString('fr-FR')}</td>
  </tr>`).join('');

  const receiptsHtml = shippingHistory.map(g => `<tr>
    <td class="mono" style="white-space:nowrap">${g.date.toLocaleDateString('fr-FR')}</td>
    <td class="mono">${g.ref}</td>
    <td class="num">${g.items.length}</td>
    <td class="num">${g.totalQty.toLocaleString('fr-FR')}</td>
    <td style="font-size:11px;color:#666">${g.items.map(i => i.sku).join(', ')}</td>
  </tr>`).join('');

  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;padding:40px 60px;font-size:13px}
    .rh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:3px solid #1a1a2e}
    .brand{font-size:32px;font-weight:900;letter-spacing:3px}.brand span{color:#4f46e5}
    .rm{text-align:right}.rm .title{font-size:18px;font-weight:700;margin-bottom:6px}.rm .sub{color:#888;font-size:12px;margin-top:2px}
    .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:40px}
    .kpi-box{background:#f7f8fc;border:1px solid #e8eaf0;border-radius:8px;padding:16px}
    .kpi-box .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px}
    .kpi-box .val{font-size:22px;font-weight:800;color:#1a1a2e}
    .sec{margin-bottom:40px}
    .sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e8eaf0;display:flex;align-items:center;gap:8px}
    .acc{display:inline-block;width:4px;height:14px;background:#4f46e5;border-radius:2px;flex-shrink:0}
    table{width:100%;border-collapse:collapse;font-size:12px}
    thead tr{background:#1a1a2e;color:#fff}
    thead th{padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
    thead th.r{text-align:right}
    tbody tr:nth-child(even){background:#f7f8fc}
    tbody td{padding:9px 12px;border-bottom:1px solid #eee;vertical-align:middle}
    td.mono{font-family:monospace;font-size:11px;color:#555}
    td.num{text-align:right;font-weight:600;font-variant-numeric:tabular-nums}
    tfoot tr{background:#1a1a2e;color:#fff}
    tfoot td{padding:10px 12px;font-weight:700}
    tfoot td.num{text-align:right}
    .foot{margin-top:60px;padding-top:16px;border-top:1px solid #e8eaf0;text-align:center;font-size:10px;color:#bbb}
    @media print{body{padding:20px 40px}}@page{margin:1cm}`;

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Granitec — Supply Report ${now.toISOString().slice(0,10)}</title>
<style>${css}</style></head><body>
<div class="rh">
  <div class="brand">GRANITE<span>C</span></div>
  <div class="rm">
    <div class="title">Supply Receipts Report</div>
    <div class="sub">Période : ${dateRange}</div>
    <div class="sub">Généré le ${now.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}</div>
  </div>
</div>
<div class="kpi">
  <div class="kpi-box"><div class="lbl">Total Receipts</div><div class="val">${shippingHistory.length.toLocaleString('fr-FR')}</div></div>
  <div class="kpi-box"><div class="lbl">Total Pieces In</div><div class="val">${totalPcs.toLocaleString('fr-FR')}</div></div>
  <div class="kpi-box"><div class="lbl">Material References</div><div class="val">${skuRows.length.toLocaleString('fr-FR')}</div></div>
  <div class="kpi-box"><div class="lbl">Avg per Receipt</div><div class="val">${shippingHistory.length ? Math.round(totalPcs / shippingHistory.length).toLocaleString('fr-FR') : 0}</div></div>
</div>
<div class="sec">
  <div class="sec-title"><span class="acc"></span>Inbound by Year</div>
  <table>
    <thead><tr><th>Year</th><th class="r">Receipts</th><th class="r">Total Pieces</th></tr></thead>
    <tbody>${yearHtml}</tbody>
    <tfoot><tr><td>TOTAL</td><td class="num">${shippingHistory.length.toLocaleString('fr-FR')}</td><td class="num">${totalPcs.toLocaleString('fr-FR')}</td></tr></tfoot>
  </table>
</div>
<div class="sec">
  <div class="sec-title"><span class="acc"></span>Material Summary — ${skuRows.length} references</div>
  <table>
    <thead><tr><th>#</th><th>Material</th><th>SKU</th><th class="r">Appearances</th><th class="r">Total Received</th><th class="r">Share</th></tr></thead>
    <tbody>${skuHtml}</tbody>
  </table>
</div>
<div class="sec">
  <div class="sec-title"><span class="acc"></span>All Supply Receipts — Full Detail (${shippingHistory.length} receipts)</div>
  <table>
    <thead><tr><th>Date</th><th>Ref</th><th class="r">Lines</th><th class="r">Total Pcs</th><th>Materials (SKU)</th></tr></thead>
    <tbody>${receiptsHtml}</tbody>
    <tfoot><tr><td colspan="3">TOTAL</td><td class="num">${totalPcs.toLocaleString('fr-FR')}</td><td></td></tr></tfoot>
  </table>
</div>
<div class="foot">Confidentiel — Document généré par Granitec ERP · ${now.toLocaleDateString('fr-FR')} · Granitec</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `granitec_supply_report_${now.toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Color grouping helpers ────────────────────────────────────────
const COLOR_NAMES = ['Black-Tf', 'Black', 'Gray', 'Cream', 'Blue', 'Red'] as const;
type ColorName = typeof COLOR_NAMES[number];
const COLOR_DOT: Record<ColorName, string> = {
  'Black-Tf': 'bg-gray-900 ring-2 ring-offset-1 ring-indigo-400',
  Black: 'bg-gray-900', Gray: 'bg-gray-400',
  Cream: 'bg-amber-100 border border-amber-300', Blue: 'bg-blue-500', Red: 'bg-red-500',
};

function extractColor(name: string): { base: string; color: ColorName } | null {
  for (const color of COLOR_NAMES) {
    if (name.endsWith(color))
      return { base: name.slice(0, name.length - color.length).replace(/[\s—\-]+$/, '').trim(), color };
  }
  return null;
}

interface RawMaterialGroup {
  base: string; category: string;
  variants: { product: Product; color: ColorName | null }[];
}

function groupRawMaterials(products: Product[]): RawMaterialGroup[] {
  const map = new Map<string, RawMaterialGroup>();
  for (const p of products) {
    const parsed = extractColor(p.name);
    const base = parsed ? parsed.base : p.name;
    const color = parsed ? parsed.color : null;
    const key = `${base}__${p.category ?? ''}`;
    if (!map.has(key)) map.set(key, { base, category: p.category ?? '', variants: [] });
    map.get(key)!.variants.push({ product: p, color });
  }
  return Array.from(map.values()).map(group => ({
    ...group,
    variants: group.variants.sort((a, b) =>
      (a.product.sort_order ?? 999) - (b.product.sort_order ?? 999)
    ),
  }));
}

function groupBadge(group: RawMaterialGroup) {
  const ps = group.variants.map(v => v.product);
  if (ps.every(p => p.stock_level <= 0)) return <Badge label="Empty" variant="red" />;
  if (ps.some(p => p.stock_level > 0 && p.stock_level <= p.min_stock)) return <Badge label="Low" variant="yellow" />;
  return <Badge label="In Stock" variant="green" />;
}

// ── Raw material group card ───────────────────────────────────────
function RawMaterialGroupCard({ group, onReceive, onEdit, onDelete }: {
  group: RawMaterialGroup;
  onReceive: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          {group.category && (
            <span className="inline-block mb-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
              {group.category}
            </span>
          )}
          <p className="text-sm font-semibold text-slate-800">{group.base}</p>
        </div>
        {groupBadge(group)}
      </div>
      <div className="space-y-2 mt-1">
        {group.variants.map(({ product: p, color }) => {
          const empty = p.stock_level <= 0;
          const low = p.stock_level > 0 && p.stock_level <= p.min_stock;
          return (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              {color ? <span className={`w-3 h-3 rounded-full shrink-0 ${COLOR_DOT[color]}`} /> : <span className="w-3 h-3 shrink-0" />}
              <span className="text-slate-500 w-16 shrink-0">{color ?? '—'}</span>
              <span className={`font-bold tabular-nums text-sm ${empty ? 'text-red-500' : low ? 'text-yellow-600' : 'text-slate-800'}`}>
                {p.stock_level.toLocaleString()}
              </span>
              <span className="text-slate-400">{p.unit}</span>
              <div className="ml-auto flex items-center gap-1">
                {stockBadge(p)}
                <button onClick={() => onReceive(p)} title="Quick receive"
                  className="p-1 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <ArrowDownToLine size={11} />
                </button>
                <button onClick={() => onEdit(p)} title="Edit"
                  className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <Pencil size={11} />
                </button>
                <button onClick={() => onDelete(p)} title="Delete"
                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Today as YYYY-MM-DD ───────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type ReceiptLine = { productId: string; qty: string };

// ── Main page ─────────────────────────────────────────────────────
export default function InventoryPage() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading]     = useState(true);
  const [rawCategory, setRawCategory] = useState('All');
  const [search, setSearch]           = useState('');

  // ── New Supply Receipt modal ──────────────────────────────────
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptRef, setReceiptRef]   = useState('');
  const [receiptDate, setReceiptDate] = useState(todayISO());
  const [receiptLines, setReceiptLines] = useState<ReceiptLine[]>([{ productId: '', qty: '' }]);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptError, setReceiptError]   = useState('');

  const openReceipt = () => {
    setReceiptRef('');
    setReceiptDate(todayISO());
    setReceiptLines([{ productId: '', qty: '' }]);
    setReceiptError('');
    setShowReceipt(true);
  };

  const addReceiptLine = () => setReceiptLines(l => [...l, { productId: '', qty: '' }]);
  const removeReceiptLine = (i: number) => setReceiptLines(l => l.filter((_, idx) => idx !== i));
  const updateReceiptLine = (i: number, patch: Partial<ReceiptLine>) =>
    setReceiptLines(l => l.map((row, idx) => idx === i ? { ...row, ...patch } : row));

  const handleReceiptSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setReceiptError('');
    if (!receiptRef.trim()) { setReceiptError('Shipping reference is required.'); return; }
    const validLines = receiptLines.filter(l => l.productId && Number(l.qty) > 0);
    if (validLines.length === 0) { setReceiptError('Add at least one line with product and quantity.'); return; }
    setReceiptSaving(true);
    try {
      await receiveSupplyBatch(
        validLines.map(l => ({ productId: l.productId, qty: Number(l.qty) })),
        receiptRef.trim(),
        new Date(receiptDate)
      );
      setShowReceipt(false);
      load();
    } catch { setReceiptError('Failed to save receipt.'); }
    finally { setReceiptSaving(false); }
  };

  // ── Add material modal ────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState('');
  const [form, setForm] = useState<{
    name: string; sku: string; category: RawCategory | ''; unit: string; stock_level: string; min_stock: string; cost: string;
  }>({ name: '', sku: '', category: '', unit: 'pcs', stock_level: '0', min_stock: '10', cost: '0' });

  // ── Edit material modal ───────────────────────────────────────
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm]       = useState({ name: '', sku: '', category: '' as RawCategory | '', unit: '', min_stock: '', cost: '' });
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState('');

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({ name: p.name, sku: p.sku, category: (p.category as RawCategory | undefined) ?? '', unit: p.unit, min_stock: String(p.min_stock), cost: String(p.cost ?? 0) });
    setEditError('');
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setEditError(''); setEditSaving(true);
    try {
      await updateProduct(editProduct.id, {
        name: editForm.name, sku: editForm.sku,
        category: editForm.category || undefined,
        unit: editForm.unit, min_stock: Number(editForm.min_stock), cost: Number(editForm.cost),
      });
      setEditProduct(null); load();
    } catch { setEditError('Failed to save.'); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await deleteProduct(p.id); load();
  };

  // ── Quick single-item receive ─────────────────────────────────
  const [receiveProduct, setReceiveProduct] = useState<Product | null>(null);
  const [receiveForm, setReceiveForm]       = useState({ qty: '1', note: '' });
  const [receiveSaving, setReceiveSaving]   = useState(false);
  const [receiveError, setReceiveError]     = useState('');

  const handleReceive = async (e: FormEvent) => {
    e.preventDefault();
    if (!receiveProduct) return;
    setReceiveError(''); setReceiveSaving(true);
    try {
      await adjustStock(receiveProduct.id, Number(receiveForm.qty), 'PURCHASE', receiveForm.note || undefined);
      setReceiveProduct(null); setReceiveForm({ qty: '1', note: '' }); load();
    } catch { setReceiveError('Failed to record receipt.'); }
    finally { setReceiveSaving(false); }
  };

  // ── Data load ─────────────────────────────────────────────────
  const load = () => {
    setLoading(true);
    Promise.all([getProducts(), getMovements()])
      .then(([prods, movs]) => { setProducts(prods); setMovements(movs); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const rawMaterials = products.filter(p => p.type === 'RAW');
  const rawCats = ['All', ...sortCategories(
    Array.from(new Set(rawMaterials.map(p => p.category ?? 'Other'))),
    RAW_CATEGORY_ORDER
  )];
  const filteredRaw = rawMaterials.filter(p => {
    const matchCat = rawCategory === 'All' || (p.category ?? 'Other') === rawCategory;
    const q = search.toLowerCase();
    return matchCat && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  });
  const rawGrouped = sortCategories(
    Array.from(new Set(filteredRaw.map(p => p.category ?? 'Other'))), RAW_CATEGORY_ORDER
  ).map(cat => ({
    cat,
    groups: groupRawMaterials(filteredRaw.filter(p => (p.category ?? 'Other') === cat))
      .sort((a, b) => {
        const minA = Math.min(...a.variants.map(v => v.product.sort_order ?? 999));
        const minB = Math.min(...b.variants.map(v => v.product.sort_order ?? 999));
        return minA - minB;
      }),
  }));

  const rawIds = new Set(rawMaterials.map(p => p.id));
  const shippingHistory: ShippingGroup[] = (() => {
    const map = new Map<string, ShippingGroup>();
    for (const m of movements.filter(m => m.reason === 'PURCHASE' && rawIds.has(m.productId))) {
      const ref = m.note ?? '—';
      if (!map.has(ref)) map.set(ref, { ref, date: tsToDate(m.createdAt), totalQty: 0, items: [] });
      const g = map.get(ref)!;
      const prod = products.find(p => p.id === m.productId);
      g.items.push({ sku: prod?.sku ?? m.productId, name: prod?.name ?? m.productId, qty: m.quantity });
      g.totalQty += m.quantity;
    }
    return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  })();

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      await addProduct({
        name: form.name, sku: form.sku, type: 'RAW' as ProductType,
        category: form.category || undefined, unit: form.unit,
        stock_level: Number(form.stock_level), min_stock: Number(form.min_stock), cost: Number(form.cost),
      });
      setShowAddModal(false);
      setForm({ name: '', sku: '', category: '', unit: 'pcs', stock_level: '0', min_stock: '10', cost: '0' });
      load();
    } catch { setFormError('Failed to save.'); }
    finally { setSaving(false); }
  };

  const receiptTotal = receiptLines.reduce((s, l) => s + (Number(l.qty) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
          <p className="text-slate-500 text-sm mt-1">
            {rawMaterials.length} material{rawMaterials.length !== 1 ? 's' : ''} · {RAW_CATEGORIES.length} categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <Plus size={14} /> Add Material
          </button>
          <button onClick={openReceipt}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <PackagePlus size={16} /> New Supply Receipt
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search by name or SKU…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {rawCats.map(cat => (
          <button key={cat} onClick={() => setRawCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              rawCategory === cat ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center text-slate-400 py-20 text-sm">Loading…</div>
      ) : rawMaterials.length === 0 ? (
        <div className="text-center py-20">
          <FlaskConical size={44} className="mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 text-sm font-medium">No raw materials yet.</p>
          <p className="text-slate-400 text-xs mt-1">Add materials then create a supply receipt.</p>
        </div>
      ) : (
        <>
          {filteredRaw.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-10">No materials in this category.</p>
          ) : (
            rawGrouped.map(({ cat, groups }) => (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{cat}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groups.map(g => (
                    <RawMaterialGroupCard key={g.base + g.category} group={g}
                      onReceive={p => { setReceiveProduct(p); setReceiveForm({ qty: '1', note: '' }); setReceiveError(''); }}
                      onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Supply Receipt History */}
          {shippingHistory.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <ArrowDownToLine size={15} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-700">Supply Receipt History</h2>
                <span className="text-xs text-slate-400 ml-1">{shippingHistory.length} receipts · click to expand</span>
                <button
                  onClick={() => downloadSupplyReport(shippingHistory)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors"
                >
                  <FileDown size={13} /> Download Report
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ref</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Qty</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Lines</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {shippingHistory.map(g => <ShippingRow key={g.ref} group={g} />)}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── New Supply Receipt Modal ─────────────────────────────── */}
      {showReceipt && (
        <Modal title="New Supply Receipt" onClose={() => setShowReceipt(false)}>
          <form onSubmit={handleReceiptSubmit} className="space-y-5">
            {/* Ref + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shipping Ref <span className="text-red-500">*</span></label>
                <input type="text" value={receiptRef} required
                  onChange={e => setReceiptRef(e.target.value)}
                  placeholder="e.g. DISC-2025-S5"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input type="date" value={receiptDate}
                  onChange={e => setReceiptDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            {/* Lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Lines</label>
                {receiptTotal > 0 && (
                  <span className="text-xs text-indigo-600 font-semibold">
                    {receiptLines.filter(l => l.productId && Number(l.qty) > 0).length} items · {receiptTotal.toLocaleString('fr-FR')} pcs
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {receiptLines.map((line, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <ProductPickerDropdown
                        products={rawMaterials}
                        value={line.productId}
                        onChange={p => updateReceiptLine(i, { productId: p.id })}
                        placeholder="Select material…"
                      />
                    </div>
                    <input type="number" min="1" placeholder="Qty"
                      value={line.qty}
                      onChange={e => updateReceiptLine(i, { qty: e.target.value })}
                      className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0" />
                    <button type="button" onClick={() => removeReceiptLine(i)}
                      disabled={receiptLines.length === 1}
                      className="p-1.5 mt-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addReceiptLine}
                className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                <Plus size={13} /> Add line
              </button>
            </div>

            {receiptError && <p className="text-red-600 text-sm">{receiptError}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={receiptSaving}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {receiptSaving ? 'Saving…' : 'Confirm Receipt'}
              </button>
              <button type="button" onClick={() => setShowReceipt(false)}
                className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add Raw Material Modal ───────────────────────────────── */}
      {showAddModal && (
        <Modal title="Add Raw Material" onClose={() => { setShowAddModal(false); setFormError(''); }}>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Material Name</label>
              <input type="text" value={form.name} required
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Aluminium Disc 20cm"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SKU / Ref</label>
                <input type="text" value={form.sku} required
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                <input type="text" value={form.unit} required
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} required
                onChange={e => setForm(f => ({ ...f, category: e.target.value as RawCategory | '' }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select category…</option>
                {RAW_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Initial Stock</label>
                <input type="number" min="0" value={form.stock_level} required
                  onChange={e => setForm(f => ({ ...f, stock_level: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock</label>
                <input type="number" min="0" value={form.min_stock} required
                  onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit Cost (DH)</label>
                <input type="number" min="0" step="0.01" value={form.cost}
                  onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            {formError && <p className="text-red-600 text-sm">{formError}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Material'}
              </button>
              <button type="button" onClick={() => { setShowAddModal(false); setFormError(''); }}
                className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Material Modal ──────────────────────────────────── */}
      {editProduct && (
        <Modal title="Edit Raw Material" onClose={() => setEditProduct(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Material Name</label>
              <input type="text" value={editForm.name} required
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
                <input type="text" value={editForm.sku} required
                  onChange={e => setEditForm(f => ({ ...f, sku: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                <input type="text" value={editForm.unit} required
                  onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value as RawCategory | '' }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">No category</option>
                  {RAW_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock</label>
                <input type="number" min="0" value={editForm.min_stock} required
                  onChange={e => setEditForm(f => ({ ...f, min_stock: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit Cost (DH)</label>
                <input type="number" min="0" step="0.01" value={editForm.cost}
                  onChange={e => setEditForm(f => ({ ...f, cost: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            {editError && <p className="text-red-600 text-sm">{editError}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={editSaving}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => setEditProduct(null)}
                className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Quick Single-Item Receive Modal ─────────────────────── */}
      {receiveProduct && (
        <Modal title="Quick Receive" onClose={() => { setReceiveProduct(null); setReceiveError(''); }}>
          <form onSubmit={handleReceive} className="space-y-4">
            <div className="bg-slate-50 rounded-lg px-4 py-3">
              {receiveProduct.category && (
                <span className="inline-block mb-1 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                  {receiveProduct.category}
                </span>
              )}
              <p className="text-sm font-semibold text-slate-800">{receiveProduct.name}</p>
              <p className="text-xs font-mono text-slate-400">{receiveProduct.sku}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity Received</label>
              <div className="flex items-center gap-2">
                <input type="number" min="1" step="any" value={receiveForm.qty} required
                  onChange={e => setReceiveForm(f => ({ ...f, qty: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-sm text-slate-400 shrink-0">{receiveProduct.unit}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ref / Note <span className="text-slate-400 font-normal">(optional)</span></label>
              <input type="text" value={receiveForm.note}
                onChange={e => setReceiveForm(f => ({ ...f, note: e.target.value }))}
                placeholder="e.g. DISC-2025-S5"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {receiveError && <p className="text-red-600 text-sm">{receiveError}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={receiveSaving}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {receiveSaving ? 'Saving…' : 'Confirm'}
              </button>
              <button type="button" onClick={() => { setReceiveProduct(null); setReceiveError(''); }}
                className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
