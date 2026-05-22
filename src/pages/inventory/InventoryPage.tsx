import { useEffect, useState, useRef, type FormEvent } from 'react';
import { Plus, FlaskConical, ArrowDownToLine, ChevronDown, Search, FileText, X, Pencil, Trash2, PackagePlus, FileDown } from 'lucide-react';
import ProductPickerDropdown from '@/components/ui/ProductPickerDropdown';
import { getProducts, addProduct, adjustStock, getMovements, deleteProduct, updateProduct, receiveSupplyBatch, reconcileUnverifiedStock } from '@/services/inventory.service';
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
  if (ps.some(p => p.stock_level < 0)) return <Badge label="Negative" variant="red" />;
  if (ps.every(p => p.stock_level === 0)) return <Badge label="Empty" variant="red" />;
  if (ps.some(p => p.stock_level > 0 && p.stock_level <= p.min_stock)) return <Badge label="Low" variant="yellow" />;
  return <Badge label="In Stock" variant="green" />;
}

// ── Category accent colours ───────────────────────────────────────
const CATEGORY_ACCENT: Record<string, { border: string; badge: string; dot: string }> = {
  'Aluminium Disc': { border: 'border-l-indigo-500', badge: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  'Accessories':    { border: 'border-l-amber-400',  badge: 'bg-amber-50 text-amber-700',   dot: 'bg-amber-400' },
  'Packaging':      { border: 'border-l-violet-500',  badge: 'bg-violet-50 text-violet-700',   dot: 'bg-violet-500' },
};
const DEFAULT_ACCENT = { border: 'border-l-slate-300', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };

// ── Raw material group card ───────────────────────────────────────
function RawMaterialGroupCard({ group, onReceive, onEdit, onDelete }: {
  group: RawMaterialGroup;
  onReceive: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  const accent = CATEGORY_ACCENT[group.category] ?? DEFAULT_ACCENT;
  const totalStock = group.variants.reduce((s, v) => s + v.product.stock_level, 0);
  const multi = group.variants.length > 1;

  return (
    <div className={`bg-white rounded-xl border border-slate-100 border-l-4 ${accent.border} shadow-sm hover:shadow-md transition-all`}>

      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-slate-50 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {group.category && (
            <span className={`inline-flex items-center gap-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${accent.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
              {group.category}
            </span>
          )}
          <p className="text-sm font-bold text-slate-800 leading-snug">{group.base}</p>

          {/* Single variant: show REF prominently below name */}
          {!multi && (
            <p className="mt-1.5 font-mono text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md w-fit tracking-wide">
              {group.variants[0]?.product.sku}
            </p>
          )}

          {/* Multi variant: show total */}
          {multi && (
            <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
              {group.variants.length} variants · <span className="font-semibold text-slate-600">{totalStock.toLocaleString()}</span> {group.variants[0]?.product.unit} total
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {groupBadge(group)}
          {/* Single variant: show stock as big number */}
          {!multi && (() => {
            const p = group.variants[0].product;
            const negative = p.stock_level < 0;
            const empty = p.stock_level === 0;
            const low = !negative && !empty && p.stock_level <= p.min_stock;
            return (
              <div className="text-right mt-0.5">
                {negative && (
                  <span className="block text-[9px] font-bold text-red-400 uppercase tracking-wide mb-0.5">Negative</span>
                )}
                <span className={`text-2xl font-black tabular-nums leading-none ${negative || empty ? 'text-red-500' : low ? 'text-yellow-600' : 'text-slate-800'}`}>
                  {p.stock_level.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 ml-1">{p.unit}</span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Variant rows */}
      <div className="divide-y divide-slate-50">
        {group.variants.map(({ product: p, color }) => {
          const negative = p.stock_level < 0;
          const empty = p.stock_level === 0;
          const low = !negative && !empty && p.stock_level <= p.min_stock;
          return (
            <div key={p.id} className={`px-3 py-2 flex items-center gap-2 ${negative ? 'bg-red-50/50' : ''}`}>

              {/* Color dot */}
              {color
                ? <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_DOT[color]}`} />
                : <span className="w-2 h-2 shrink-0" />}

              {/* Label: stacked color + SKU */}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                {multi && color && (
                  <span className="text-[11px] font-semibold text-slate-700 leading-none">{color}</span>
                )}
                <span className="font-mono text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded w-fit leading-none truncate max-w-full">
                  {p.sku}
                </span>
              </div>

              {/* Stock (multi only) */}
              {multi && (
                <span className={`text-sm font-bold tabular-nums shrink-0 ${negative || empty ? 'text-red-500' : low ? 'text-yellow-600' : 'text-slate-800'}`}>
                  {p.stock_level.toLocaleString()}
                  <span className="text-[10px] font-normal text-slate-400 ml-0.5">{p.unit}</span>
                </span>
              )}

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0 ml-1">
                <button onClick={() => onReceive(p)} title="Receive stock"
                  className="p-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <ArrowDownToLine size={11} />
                </button>
                <button onClick={() => onEdit(p)} title="Edit"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <Pencil size={11} />
                </button>
                <button onClick={() => onDelete(p)} title="Delete"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
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

type ReceiptLine = { productId: string; qty: string; search: string; showSuggestions: boolean; highlightIdx: number };

// ── Supply Receipt Row — inline smart search ──────────────────────
interface ReceiptRowProps {
  line: ReceiptLine;
  index: number;
  rowNum: number;
  products: Product[];
  qtyRef: (el: HTMLInputElement | null) => void;
  onUpdate: (patch: Partial<ReceiptLine>) => void;
  onSelect: (p: Product) => void;
  onRemove: () => void;
  onQtyTab: () => void;
}
function ReceiptRow({ line, index, rowNum, products, qtyRef, onUpdate, onSelect, onRemove, onQtyTab }: ReceiptRowProps) {
  const q = line.search.toLowerCase();
  const suggestions = line.search.length > 0
    ? products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 10)
    : [];
  const selectedProduct = products.find(p => p.id === line.productId);
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
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onUpdate({ highlightIdx: Math.min(line.highlightIdx + 1, suggestions.length - 1) });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onUpdate({ highlightIdx: Math.max(line.highlightIdx - 1, 0) });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = suggestions[line.highlightIdx >= 0 ? line.highlightIdx : 0];
      if (picked) onSelect(picked);
    } else if (e.key === 'Escape') {
      onUpdate({ showSuggestions: false });
    }
  };

  return (
    <div className="grid grid-cols-[40px_1fr_160px_100px_180px_44px] gap-3 items-center px-4 py-2.5 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all group">
      {/* Row number */}
      <span className="text-sm font-bold text-slate-300 tabular-nums text-center">{rowNum}</span>

      {/* Smart search */}
      <div ref={containerRef} className="relative">
        {line.productId ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer"
            onClick={() => onUpdate({ productId: '', search: '', showSuggestions: true, highlightIdx: -1 })}>
            <span className="flex-1 text-sm font-semibold text-slate-800 truncate">{selectedProduct?.name}</span>
            <X size={13} className="text-indigo-400 shrink-0" />
          </div>
        ) : (
          <input
            type="text"
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
                <button
                  key={p.id} type="button"
                  onMouseDown={() => onSelect(p)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${si === line.highlightIdx ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                >
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

      {/* SKU */}
      <span className="text-xs font-mono text-slate-400 truncate px-1">
        {selectedProduct?.sku ?? '—'}
      </span>

      {/* Current stock */}
      <span className={`text-sm font-bold tabular-nums text-right pr-2 ${
        !selectedProduct ? 'text-slate-200' :
        selectedProduct.stock_level < 0 ? 'text-red-500' :
        selectedProduct.stock_level === 0 ? 'text-orange-400' : 'text-slate-600'
      }`}>
        {selectedProduct ? selectedProduct.stock_level.toLocaleString() : '—'}
      </span>

      {/* Qty input */}
      <input
        ref={qtyRef}
        type="number" min="1" placeholder="0"
        value={line.qty}
        onChange={e => onUpdate({ qty: e.target.value })}
        onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); onQtyTab(); } }}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg text-base font-bold text-right focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white tabular-nums"
      />

      {/* Remove */}
      <button type="button" onClick={onRemove}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

// ── Full-Screen Supply Receipt ────────────────────────────────────
interface SupplyReceiptScreenProps {
  rawMaterials: Product[];
  receiptRef: string; setReceiptRef: (v: string) => void;
  receiptDate: string; setReceiptDate: (v: string) => void;
  receiptLines: ReceiptLine[];
  receiptTotal: number;
  receiptSaving: boolean;
  receiptError: string;
  receiptRefInputRef: React.RefObject<HTMLInputElement>;
  showImport: boolean; setShowImport: (v: boolean) => void;
  importText: string; setImportText: (v: string) => void;
  importWarnings: string[];
  onAddLine: () => void;
  onRemoveLine: (i: number) => void;
  onUpdateLine: (i: number, patch: Partial<ReceiptLine>) => void;
  onSelectProduct: (i: number, p: Product, refs: React.RefObject<HTMLInputElement[]>) => void;
  onConfirm: () => void;
  onClose: () => void;
  onParseImport: () => void;
}
function SupplyReceiptScreen({
  rawMaterials, receiptRef, setReceiptRef, receiptDate, setReceiptDate,
  receiptLines, receiptTotal, receiptSaving, receiptError, receiptRefInputRef,
  showImport, setShowImport, importText, setImportText, importWarnings,
  onAddLine, onRemoveLine, onUpdateLine, onSelectProduct, onConfirm, onClose, onParseImport,
}: SupplyReceiptScreenProps) {
  const qtyRefs = useRef<HTMLInputElement[]>([]);
  const validCount = receiptLines.filter(l => l.productId && Number(l.qty) > 0).length;

  const handleQtyTab = (i: number) => {
    if (i === receiptLines.length - 1) {
      onAddLine();
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('[data-receipt-search]');
        inputs[i + 1]?.focus();
      }, 40);
    } else {
      qtyRefs.current[i + 1]?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex items-center gap-6 max-w-screen-xl mx-auto">
          <button type="button" onClick={onClose}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium text-sm shrink-0">
            <X size={16} /> Cancel
          </button>
          <h1 className="text-lg font-bold text-slate-800 shrink-0">New Supply Receipt</h1>
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-1 max-w-xs">
              <input
                ref={receiptRefInputRef}
                type="text" value={receiptRef}
                onChange={e => setReceiptRef(e.target.value)}
                placeholder="Shipping Reference *"
                className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400"
              />
            </div>
            <input
              type="date" value={receiptDate}
              onChange={e => setReceiptDate(e.target.value)}
              className="px-4 py-2.5 border-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
            />
          </div>
          {validCount > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-4 py-1.5 rounded-full">
                {validCount} item{validCount !== 1 ? 's' : ''} · {receiptTotal.toLocaleString('fr-FR')} pcs
              </span>
            </div>
          )}
          <button
            type="button" onClick={onConfirm} disabled={receiptSaving}
            className="shrink-0 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {receiptSaving ? 'Saving…' : '✓ Confirm Receipt'}
          </button>
        </div>
        {receiptError && (
          <p className="mt-2 text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-lg px-4 py-2 max-w-screen-xl mx-auto">{receiptError}</p>
        )}
      </div>

      {/* ── Column headers ── */}
      <div className="shrink-0 bg-slate-50 border-b border-slate-200 px-6 py-2">
        <div className="grid grid-cols-[40px_1fr_160px_100px_180px_44px] gap-3 max-w-screen-xl mx-auto">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">#</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Material</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">SKU</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-right pr-2">Stock</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-right pr-1">Qty Received</span>
          <span />
        </div>
      </div>

      {/* ── Rows ── */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        <div className="space-y-1.5 max-w-screen-xl mx-auto">
          {receiptLines.map((line, i) => (
            <ReceiptRow
              key={i}
              line={line} index={i} rowNum={i + 1}
              products={rawMaterials}
              qtyRef={el => { if (el) qtyRefs.current[i] = el; }}
              onUpdate={patch => onUpdateLine(i, patch)}
              onSelect={p => onSelectProduct(i, p, qtyRefs)}
              onRemove={() => onRemoveLine(i)}
              onQtyTab={() => handleQtyTab(i)}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4 max-w-screen-xl mx-auto">
          <button type="button" onClick={onAddLine}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-sm font-semibold">
            <Plus size={15} /> Add Line
          </button>
          <button type="button" onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium">
            <FileDown size={15} /> Import from TXT
          </button>
          <span className="ml-auto text-xs text-slate-400">Tab from Qty field to add next line · Esc to close search</span>
        </div>
      </div>

      {/* ── Import TXT panel ── */}
      {showImport && (
        <div className="absolute inset-x-0 bottom-0 z-[110] bg-white border-t-2 border-indigo-200 shadow-2xl rounded-t-2xl px-6 pt-5 pb-6 max-w-2xl mx-auto left-0 right-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-800">Import from TXT</h3>
            <button onClick={() => { setShowImport(false); setImportText(''); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            One item per line — <code className="bg-slate-100 px-1 rounded">SKU QUANTITY</code> or <code className="bg-slate-100 px-1 rounded">SKU TAB QUANTITY</code>
          </p>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder={"DISC-175X2-B\t100\nDISC-200X2-CR\t50\nHCR-S-BK\t30"}
            rows={6}
            autoFocus
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 resize-none"
          />
          {importWarnings.length > 0 && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-amber-700 mb-1">⚠ Unmatched lines:</p>
              {importWarnings.map((w, i) => <p key={i} className="text-xs text-amber-600 font-mono">{w}</p>)}
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button
              type="button" onClick={onParseImport} disabled={!importText.trim()}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              Parse &amp; Add Lines
            </button>
            <button
              type="button" onClick={() => { setShowImport(false); setImportText(''); }}
              className="flex-1 py-2.5 border-2 border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function InventoryPage() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading]     = useState(true);
  const [rawCategory, setRawCategory] = useState('All');
  const [search, setSearch]           = useState('');

  // ── New Supply Receipt full-screen ───────────────────────────
  const EMPTY_LINE = (): ReceiptLine => ({ productId: '', qty: '', search: '', showSuggestions: false, highlightIdx: -1 });

  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptRef, setReceiptRef]   = useState('');
  const [receiptDate, setReceiptDate] = useState(todayISO());
  const [receiptLines, setReceiptLines] = useState<ReceiptLine[]>([EMPTY_LINE()]);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptError, setReceiptError]   = useState('');
  const [showImport, setShowImport]       = useState(false);
  const [importText, setImportText]       = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  const receiptRefInputRef = useRef<HTMLInputElement>(null);

  const openReceipt = () => {
    setReceiptRef('');
    setReceiptDate(todayISO());
    setReceiptLines([EMPTY_LINE()]);
    setReceiptError('');
    setShowImport(false);
    setImportText('');
    setImportWarnings([]);
    setShowReceipt(true);
    setTimeout(() => receiptRefInputRef.current?.focus(), 80);
  };

  const addReceiptLine = () => setReceiptLines(l => [...l, EMPTY_LINE()]);
  const removeReceiptLine = (i: number) => setReceiptLines(l => l.length === 1 ? [EMPTY_LINE()] : l.filter((_, idx) => idx !== i));
  const updateReceiptLine = (i: number, patch: Partial<ReceiptLine>) =>
    setReceiptLines(l => l.map((row, idx) => idx === i ? { ...row, ...patch } : row));

  const selectReceiptProduct = (i: number, p: Product, qtyRefs: React.RefObject<HTMLInputElement[]>) => {
    updateReceiptLine(i, { productId: p.id, search: p.name, showSuggestions: false, highlightIdx: -1 });
    setTimeout(() => qtyRefs.current?.[i]?.focus(), 30);
  };

  const parseImportText = () => {
    const skuMap = new Map(rawMaterials.map(p => [p.sku.toUpperCase(), p]));
    const valid: ReceiptLine[] = [];
    const warnings: string[] = [];
    for (const line of importText.split('\n').map(l => l.trim()).filter(Boolean)) {
      const parts = line.split(/[\s\t]+/);
      const sku = parts[0];
      const qty = Number(parts[1]);
      const p = skuMap.get(sku?.toUpperCase());
      if (p && qty > 0) valid.push({ productId: p.id, qty: String(qty), search: p.name, showSuggestions: false, highlightIdx: -1 });
      else warnings.push(`${sku}: ${!p ? 'not found in catalog' : 'invalid quantity'}`);
    }
    setImportWarnings(warnings);
    if (valid.length > 0) {
      setReceiptLines(prev => {
        const filled = prev.filter(l => l.productId);
        return [...filled, ...valid];
      });
      setShowImport(false);
      setImportText('');
    }
  };

  const handleReceiptConfirm = async () => {
    setReceiptError('');
    if (!receiptRef.trim()) { setReceiptError('Shipping reference is required.'); return; }
    const validLines = receiptLines.filter(l => l.productId && Number(l.qty) > 0);
    if (validLines.length === 0) { setReceiptError('Add at least one line with a product and quantity.'); return; }
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
  const [reconcileOnReceive, setReconcileOnReceive] = useState(false);

  const handleReceive = async (e: FormEvent) => {
    e.preventDefault();
    if (!receiveProduct) return;
    setReceiveError(''); setReceiveSaving(true);
    try {
      const qty = Number(receiveForm.qty);
      await adjustStock(receiveProduct.id, qty, 'PURCHASE', receiveForm.note || undefined);
      if (reconcileOnReceive && (receiveProduct.unverified_stock ?? 0) > 0) {
        await reconcileUnverifiedStock(receiveProduct.id, Math.min(qty, receiveProduct.unverified_stock ?? 0));
      }
      setReceiveProduct(null); setReceiveForm({ qty: '1', note: '' }); setReconcileOnReceive(false); load();
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {groups.map(g => (
                    <RawMaterialGroupCard key={g.base + g.category} group={g}
                      onReceive={p => { setReceiveProduct(p); setReceiveForm({ qty: '1', note: '' }); setReceiveError(''); }}
                      onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Unverified Stock Section */}
          {rawMaterials.some(p => (p.unverified_stock ?? 0) > 0) && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-amber-200 flex items-center gap-2">
                <span className="text-amber-600 font-bold text-base">⚠</span>
                <h2 className="text-sm font-semibold text-amber-800">Unverified Stock</h2>
                <span className="text-xs text-amber-600 ml-1">Stock used in production without a matching supply receipt</span>
              </div>
              <div className="divide-y divide-amber-100">
                {rawMaterials.filter(p => (p.unverified_stock ?? 0) > 0).map(p => (
                  <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{p.name}</p>
                      <p className="text-xs font-mono text-slate-400">{p.sku}</p>
                    </div>
                    <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold tabular-nums">
                      {p.unverified_stock} {p.unit}
                    </span>
                    <button
                      onClick={async () => {
                        if (!confirm(`Reconcile all ${p.unverified_stock} ${p.unit} of unverified stock for "${p.name}"?`)) return;
                        await reconcileUnverifiedStock(p.id, p.unverified_stock ?? 0);
                        load();
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      Reconcile
                    </button>
                  </div>
                ))}
              </div>
            </div>
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

      {/* ── New Supply Receipt — Full-Screen Overlay ─────────────── */}
      {showReceipt && (
        <SupplyReceiptScreen
          rawMaterials={rawMaterials}
          receiptRef={receiptRef} setReceiptRef={setReceiptRef}
          receiptDate={receiptDate} setReceiptDate={setReceiptDate}
          receiptLines={receiptLines}
          receiptTotal={receiptTotal}
          receiptSaving={receiptSaving}
          receiptError={receiptError}
          receiptRefInputRef={receiptRefInputRef}
          showImport={showImport} setShowImport={setShowImport}
          importText={importText} setImportText={setImportText}
          importWarnings={importWarnings}
          onAddLine={addReceiptLine}
          onRemoveLine={removeReceiptLine}
          onUpdateLine={updateReceiptLine}
          onSelectProduct={selectReceiptProduct}
          onConfirm={handleReceiptConfirm}
          onClose={() => setShowReceipt(false)}
          onParseImport={parseImportText}
        />
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
        <Modal title="Quick Receive" onClose={() => { setReceiveProduct(null); setReceiveError(''); setReconcileOnReceive(false); }}>
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
            {(receiveProduct.unverified_stock ?? 0) > 0 && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <input
                  type="checkbox"
                  id="reconcile-toggle"
                  checked={reconcileOnReceive}
                  onChange={e => setReconcileOnReceive(e.target.checked)}
                  className="mt-0.5 accent-amber-600"
                />
                <label htmlFor="reconcile-toggle" className="text-xs text-amber-800 cursor-pointer">
                  <span className="font-semibold">Apply {Math.min(Number(receiveForm.qty) || 0, receiveProduct.unverified_stock ?? 0)} {receiveProduct.unit} to reconcile unverified stock</span>
                  <span className="block text-amber-600 mt-0.5">This product has {receiveProduct.unverified_stock} {receiveProduct.unit} of unverified stock</span>
                </label>
              </div>
            )}
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
