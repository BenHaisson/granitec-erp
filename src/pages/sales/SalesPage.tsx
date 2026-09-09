import { useEffect, useState, useRef, type FormEvent } from 'react';
import { Plus, X, ShoppingBag, Download, Eye, Pencil, FileDown, Search, Trash2, CalendarCheck, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getOrders, createOrder, updateOrder, deleteOrder, generateOrderRef } from '@/services/orders.service';
import { getProducts } from '@/services/inventory.service';
import { getRecipes } from '@/services/production.service';
import { getClients, createClient } from '@/services/client.service';
import { createTarget } from '@/services/productionTargets.service';
import Modal from '@/components/ui/Modal';
import EntityPicker from '@/components/ui/EntityPicker';
import { ClientModal } from '@/pages/clients/ClientsPage';
import type { SalesOrder, SalesOrderLine, Product, Recipe, Client } from '@/types';
import { todayISO, fmtDate } from '@/utils/dates';
import { useDraft, getLastEntryDate, saveLastEntryDate } from '@/hooks/useDraft';
import DraftBanner from '@/components/ui/DraftBanner';

// ── Color helpers (mirrors WarehousePage) ────────────────────────
import { COLOR_NAMES, COLOR_DOT, extractColor } from '@/utils/productColor';
import type { ColorName } from '@/utils/productColor';

// ── Summary card data ─────────────────────────────────────────────
interface VariantStats {
  sku: string;
  color: ColorName | null;
  orderCount: number;
  totalQty: number;
}

interface GroupStats {
  base: string;
  variants: VariantStats[];
  lastDate: Date | null;
}

function buildGroupStats(orders: SalesOrder[]): GroupStats[] {
  const map = new Map<string, GroupStats>();

  for (const order of orders) {
    for (const line of order.lines) {
      const parsed = extractColor(line.productName);
      const base = parsed ? parsed.base : line.productName;
      const color = parsed ? parsed.color : null;

      if (!map.has(base)) map.set(base, { base, variants: [], lastDate: null });
      const group = map.get(base)!;

      let variant = group.variants.find(v => v.sku === line.sku);
      if (!variant) {
        variant = { sku: line.sku, color, orderCount: 0, totalQty: 0 };
        group.variants.push(variant);
      }
      variant.orderCount++;
      variant.totalQty += line.totalQty;

      const d = order.date instanceof Date ? order.date : new Date(order.date);
      if (!group.lastDate || d > group.lastDate) group.lastDate = d;
    }
  }

  return Array.from(map.values());
}

// ── Merge orders with same date + client ─────────────────────────
function mergeByDateClient(orders: SalesOrder[]): SalesOrder[] {
  const map = new Map<string, SalesOrder>();
  for (const order of orders) {
    const d = order.date instanceof Date ? order.date : new Date(order.date);
    const key = `${d.toISOString().slice(0, 10)}__${order.client.toLowerCase().trim()}`;
    if (!map.has(key)) {
      map.set(key, { ...order, lines: [...order.lines] });
    } else {
      map.get(key)!.lines.push(...order.lines);
    }
  }
  return Array.from(map.values());
}

// ── Invoice download ──────────────────────────────────────────────
function downloadInvoice(order: SalesOrder) {
  const date = order.date instanceof Date ? order.date : new Date(order.date);
  const fmt = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const totalQty = order.lines.reduce((s, l) => s + l.totalQty, 0);
  const totalBoxes = order.lines.reduce((s, l) => s + l.boxes, 0);

  const rows = order.lines.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${l.productName}</td>
      <td class="mono">${l.sku}</td>
      <td class="num">${l.boxes}</td>
      <td class="num">${l.qtyPerBox}</td>
      <td class="num">${l.totalQty}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bon de commande ${order.ref}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px 60px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
  .brand { font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #1a1a2e; }
  .brand span { color: #e63946; }
  .doc-info { text-align: right; }
  .doc-info .ref { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .doc-info .date { color: #555; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
  .meta-block label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; display: block; margin-bottom: 4px; }
  .meta-block span { font-size: 15px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #1a1a2e; color: white; }
  thead th { padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  thead th:last-child { text-align: right; }
  tbody tr:nth-child(even) { background: #f7f8fc; }
  tbody td { padding: 10px 14px; border-bottom: 1px solid #eee; }
  td.mono { font-family: monospace; color: #555; font-size: 12px; }
  td.num { text-align: right; font-weight: 600; }
  .footer { display: flex; justify-content: flex-end; }
  .total-box { background: #1a1a2e; color: white; padding: 14px 24px; border-radius: 6px; min-width: 200px; }
  .total-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; margin-bottom: 4px; }
  .total-box .value { font-size: 22px; font-weight: 700; }
  .stamp { margin-top: 60px; text-align: center; font-size: 10px; color: #ccc; }
  @media print { body { padding: 20px 40px; } }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">GRANITE<span>C</span></div>
    <div class="doc-info">
      <div class="ref">Bon de livraison</div>
      <div class="ref" style="font-size:14px">${order.ref}</div>
      <div class="date">${fmt}</div>
    </div>
  </div>
  <div class="meta">
    <div class="meta-block">
      <label>Client</label>
      <span>${order.client}</span>
    </div>
    <div class="meta-block">
      <label>Nombre de références</label>
      <span>${order.lines.length}</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Produit</th>
        <th>Référence</th>
        <th style="text-align:right">Boîtes</th>
        <th style="text-align:right">Qté/Boîte</th>
        <th style="text-align:right">Quantité</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <div class="total-box">
      <div class="label">Total boîtes</div>
      <div class="value">${totalBoxes.toLocaleString('fr-FR')}</div>
    </div>
    <div class="total-box" style="margin-left:16px">
      <div class="label">Total pièces</div>
      <div class="value">${totalQty.toLocaleString('fr-FR')}</div>
    </div>
  </div>
  <div class="stamp">Document généré par Granitec ERP · ${new Date().toLocaleDateString('fr-FR')}</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${order.ref}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Full Sales Report ─────────────────────────────────────────────
function downloadSalesReport(orders: SalesOrder[], products: Product[]) {
  const now = new Date();
  const sorted = [...orders].sort((a, b) => {
    const da = a.date instanceof Date ? a.date : new Date(a.date);
    const db = b.date instanceof Date ? b.date : new Date(b.date);
    return db.getTime() - da.getTime();
  });

  const productCatMap = new Map<string, string>();
  for (const p of products) {
    productCatMap.set(p.id, p.category ?? 'Other');
    productCatMap.set(p.sku, p.category ?? 'Other');
  }

  const allLines = orders.flatMap(o => o.lines);
  const totalPcs = allLines.reduce((s, l) => s + l.totalQty, 0);
  const uniqueClients = new Set(orders.map(o => o.client.toLowerCase().trim())).size;

  const dates = orders.map(o => (o.date instanceof Date ? o.date : new Date(o.date)));
  const minDate = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
  const maxDate = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
  const dateRange = minDate && maxDate
    ? `${minDate.toLocaleDateString('fr-FR')} – ${maxDate.toLocaleDateString('fr-FR')}`
    : '—';

  const bySku = new Map<string, { name: string; sku: string; cat: string; orders: number; qty: number }>();
  for (const order of orders) {
    for (const line of order.lines) {
      const cat = productCatMap.get(line.productId) ?? productCatMap.get(line.sku) ?? 'Other';
      if (!bySku.has(line.sku)) bySku.set(line.sku, { name: line.productName, sku: line.sku, cat, orders: 0, qty: 0 });
      const s = bySku.get(line.sku)!;
      s.orders++;
      s.qty += line.totalQty;
    }
  }
  const skuRows = Array.from(bySku.values()).sort((a, b) => b.qty - a.qty);

  const byCat = new Map<string, { orders: number; qty: number }>();
  for (const s of skuRows) {
    if (!byCat.has(s.cat)) byCat.set(s.cat, { orders: 0, qty: 0 });
    byCat.get(s.cat)!.orders += s.orders;
    byCat.get(s.cat)!.qty += s.qty;
  }
  const catRows = Array.from(byCat.entries()).sort((a, b) => b[1].qty - a[1].qty);

  const byYear = new Map<number, { orders: number; qty: number }>();
  for (const order of orders) {
    const y = (order.date instanceof Date ? order.date : new Date(order.date)).getFullYear();
    if (!byYear.has(y)) byYear.set(y, { orders: 0, qty: 0 });
    byYear.get(y)!.orders++;
    byYear.get(y)!.qty += order.lines.reduce((s, l) => s + l.totalQty, 0);
  }
  const yearRows = Array.from(byYear.entries()).sort((a, b) => b[0] - a[0]);

  const catHtml = catRows.map(([cat, s]) => `<tr>
    <td>${cat}</td>
    <td class="num">${s.orders.toLocaleString('fr-FR')}</td>
    <td class="num">${s.qty.toLocaleString('fr-FR')}</td>
    <td class="num">${totalPcs > 0 ? ((s.qty / totalPcs) * 100).toFixed(1) : 0}%</td>
  </tr>`).join('');

  const yearHtml = yearRows.map(([y, s]) => `<tr>
    <td>${y}</td>
    <td class="num">${s.orders.toLocaleString('fr-FR')}</td>
    <td class="num">${s.qty.toLocaleString('fr-FR')}</td>
  </tr>`).join('');

  const skuHtml = skuRows.map((s, i) => `<tr>
    <td>${i + 1}</td>
    <td>${s.name}</td>
    <td class="mono">${s.sku}</td>
    <td>${s.cat}</td>
    <td class="num">${s.orders.toLocaleString('fr-FR')}</td>
    <td class="num">${s.qty.toLocaleString('fr-FR')}</td>
    <td class="num">${totalPcs > 0 ? ((s.qty / totalPcs) * 100).toFixed(1) : 0}%</td>
  </tr>`).join('');

  const ordersHtml = sorted.map(order => {
    const d = order.date instanceof Date ? order.date : new Date(order.date);
    const qty = order.lines.reduce((s, l) => s + l.totalQty, 0);
    return `<tr>
      <td class="mono" style="white-space:nowrap">${d.toLocaleDateString('fr-FR')}</td>
      <td class="mono">${order.ref}</td>
      <td>${order.client}</td>
      <td style="font-size:11px;color:#666">${order.lines.map(l => l.sku).join(', ')}</td>
      <td class="num">${order.lines.length}</td>
      <td class="num">${qty.toLocaleString('fr-FR')}</td>
    </tr>`;
  }).join('');

  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;padding:40px 60px;font-size:13px}
    .rh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:3px solid #1a1a2e}
    .brand{font-size:32px;font-weight:900;letter-spacing:3px}.brand span{color:#e63946}
    .rm{text-align:right}.rm .title{font-size:18px;font-weight:700;margin-bottom:6px}.rm .sub{color:#888;font-size:12px;margin-top:2px}
    .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:40px}
    .kpi-box{background:#f7f8fc;border:1px solid #e8eaf0;border-radius:8px;padding:16px}
    .kpi-box .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px}
    .kpi-box .val{font-size:22px;font-weight:800;color:#1a1a2e}
    .sec{margin-bottom:40px}
    .sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e8eaf0;display:flex;align-items:center;gap:8px}
    .acc{display:inline-block;width:4px;height:14px;background:#e63946;border-radius:2px;flex-shrink:0}
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
<title>Granitec — Sales Report ${now.toISOString().slice(0,10)}</title>
<style>${css}</style></head><body>
<div class="rh">
  <div class="brand">GRANITE<span>C</span></div>
  <div class="rm">
    <div class="title">Sales Activity Report</div>
    <div class="sub">Période : ${dateRange}</div>
    <div class="sub">Généré le ${fmtDate(now)}</div>
  </div>
</div>
<div class="kpi">
  <div class="kpi-box"><div class="lbl">Total Orders</div><div class="val">${orders.length.toLocaleString('fr-FR')}</div></div>
  <div class="kpi-box"><div class="lbl">Total Pieces</div><div class="val">${totalPcs.toLocaleString('fr-FR')}</div></div>
  <div class="kpi-box"><div class="lbl">Unique Clients</div><div class="val">${uniqueClients.toLocaleString('fr-FR')}</div></div>
  <div class="kpi-box"><div class="lbl">Product References</div><div class="val">${skuRows.length.toLocaleString('fr-FR')}</div></div>
</div>
<div class="sec">
  <div class="sec-title"><span class="acc"></span>Output by Category</div>
  <table>
    <thead><tr><th>Category</th><th class="r">Orders</th><th class="r">Total Pieces</th><th class="r">% of Total</th></tr></thead>
    <tbody>${catHtml}</tbody>
    <tfoot><tr><td>TOTAL</td><td class="num">${orders.length.toLocaleString('fr-FR')}</td><td class="num">${totalPcs.toLocaleString('fr-FR')}</td><td class="num">100%</td></tr></tfoot>
  </table>
</div>
<div class="sec">
  <div class="sec-title"><span class="acc"></span>Sales by Year</div>
  <table>
    <thead><tr><th>Year</th><th class="r">Orders</th><th class="r">Total Pieces</th></tr></thead>
    <tbody>${yearHtml}</tbody>
  </table>
</div>
<div class="sec">
  <div class="sec-title"><span class="acc"></span>Product Summary — ${skuRows.length} references</div>
  <table>
    <thead><tr><th>#</th><th>Product</th><th>SKU</th><th>Category</th><th class="r">Orders</th><th class="r">Total Pieces</th><th class="r">Share</th></tr></thead>
    <tbody>${skuHtml}</tbody>
  </table>
</div>
<div class="sec">
  <div class="sec-title"><span class="acc"></span>All Sales Orders — Full Detail (${sorted.length} orders)</div>
  <table>
    <thead><tr><th>Date</th><th>Ref</th><th>Client</th><th>Products (SKU)</th><th class="r">Lines</th><th class="r">Total Pcs</th></tr></thead>
    <tbody>${ordersHtml}</tbody>
    <tfoot><tr><td colspan="5">TOTAL</td><td class="num">${totalPcs.toLocaleString('fr-FR')}</td></tr></tfoot>
  </table>
</div>
<div class="foot">Confidentiel — Document généré par Granitec ERP · ${now.toLocaleDateString('fr-FR')} · Granitec</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `granitec_sales_report_${now.toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}


// ── Category order for finished goods ────────────────────────────
const CATEGORY_ORDER = ['Sets & Packs', 'Marmite', 'Crepe & Specialty', 'Frypans', 'Saucepots', 'Cake & Molds'];

// ── Draft line (internal form state) ─────────────────────────────
interface DraftLine {
  uid: string;          // stable identity for React key — never changes after creation
  productId: string;
  productName: string;
  sku: string;
  boxes: number;
  qtyPerBox: number;
  totalQty: number;
  search: string;
  showSuggestions: boolean;
  highlightIdx: number;
}
const newUid = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const EMPTY_DRAFT = (): DraftLine => ({
  uid: newUid(),
  productId: '', productName: '', sku: '',
  boxes: 1, qtyPerBox: 1, totalQty: 1,
  search: '', showSuggestions: false, highlightIdx: -1,
});

// ── Sales Order Line Row ──────────────────────────────────────────
function SalesOrderRow({ line, rowNum, products, boxesRef, onUpdate, onSelect, onRemove, onBoxesTab }: {
  line: DraftLine; rowNum: number; products: Product[];
  boxesRef: (el: HTMLInputElement | null) => void;
  onUpdate: (patch: Partial<DraftLine>) => void;
  onSelect: (p: Product) => void;
  onRemove: () => void;
  onBoxesTab: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Latest-ref pattern: keeps onUpdate current without re-registering the event listener every render
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; });

  const q = line.search.toLowerCase();
  const suggestions = line.search.length > 0
    ? products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 10)
    : [];
  const selectedProduct = products.find(p => p.id === line.productId);

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
    else if (e.key === 'Enter') { e.preventDefault(); const p = suggestions[line.highlightIdx >= 0 ? line.highlightIdx : 0]; if (p) onSelect(p); }
    else if (e.key === 'Escape') onUpdate({ showSuggestions: false });
  };

  return (
    <div className="grid grid-cols-[40px_1fr_140px_90px_110px_110px_90px_44px] gap-2 items-center px-4 py-2.5 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all group">
      <span className="text-sm font-bold text-slate-300 tabular-nums text-center">{rowNum}</span>

      {/* Smart search / selected chip */}
      <div ref={containerRef} className="relative">
        {line.productId ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer"
            onClick={() => onUpdate({ productId: '', productName: '', sku: '', search: '', showSuggestions: true, highlightIdx: -1 })}>
            <span className="flex-1 text-sm font-semibold text-slate-800 truncate">{selectedProduct?.name}</span>
            <X size={13} className="text-blue-400 shrink-0" />
          </div>
        ) : (
          <input
            type="text" value={line.search}
            onChange={e => onUpdate({ search: e.target.value, showSuggestions: true, highlightIdx: -1 })}
            onFocus={() => onUpdate({ showSuggestions: true })}
            onKeyDown={handleKeyDown}
            placeholder="Type to search product…"
            autoComplete="off"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
        )}
        {line.showSuggestions && suggestions.length > 0 && !line.productId && (
          <div className="absolute z-[300] left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
              {suggestions.map((p, si) => (
                <button key={p.id} type="button" onMouseDown={() => onSelect(p)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${si === line.highlightIdx ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{p.sku}</p>
                  </div>
                  <span className={`ml-3 text-xs font-semibold tabular-nums shrink-0 ${p.stock_level < 0 ? 'text-red-500' : p.stock_level === 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                    {p.stock_level}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <span className="text-xs font-mono text-slate-400 truncate px-1">{line.sku || '—'}</span>
      <span className={`text-sm font-bold tabular-nums text-right pr-2 ${
        !selectedProduct ? 'text-slate-200' :
        selectedProduct.stock_level < 0 ? 'text-red-500' :
        selectedProduct.stock_level === 0 ? 'text-orange-400' : 'text-slate-600'
      }`}>{selectedProduct ? selectedProduct.stock_level.toLocaleString() : '—'}</span>

      <input ref={boxesRef} type="number" min="1" value={line.boxes}
        onChange={e => { const b = Math.max(1, Number(e.target.value) || 1); onUpdate({ boxes: b, totalQty: b * line.qtyPerBox }); }}
        onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); onBoxesTab(); } }}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base font-bold text-right focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white tabular-nums" />

      <input type="number" min="1" value={line.qtyPerBox}
        onChange={e => { const q2 = Math.max(1, Number(e.target.value) || 1); onUpdate({ qtyPerBox: q2, totalQty: line.boxes * q2 }); }}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base font-bold text-right focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white tabular-nums" />

      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-base font-black text-right text-blue-700 tabular-nums">
        {line.totalQty.toLocaleString()}
      </div>

      <button type="button" onClick={onRemove}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
        <X size={15} />
      </button>
    </div>
  );
}

// ── New Sales Order Full-Screen ───────────────────────────────────
function NewOrderModal({ products, recipes, onClose, onSaved }: {
  products: Product[]; recipes: Recipe[]; onClose: () => void; onSaved: () => void;
}) {
  const navigate = useNavigate();
  const [orderRef, setOrderRef] = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Shortfall dialog state — shown when stock < order qty AND a recipe exists
  type ShortfallTarget = {
    productId: string; productName: string;
    recipeId: string;  recipeName: string;
    need: number; have: number;
  };
  const [shortfalls, setShortfalls] = useState<ShortfallTarget[]>([]);
  const [creatingTargets, setCreatingTargets] = useState(false);

  type SalesDraft = { client: string; date: string; lineData: Array<{ productId: string; productName: string; sku: string; boxes: number; qtyPerBox: number; totalQty: number }> };
  const { draft: sd, update: updateSd, clearDraft: clearSalesDraft, hasDraft, isReady, savedAt, continueDraft, discardDraft } =
    useDraft<SalesDraft>('sales-new-order', { client: '', date: getLastEntryDate(), lineData: [] });

  const client = sd.client;
  const date   = sd.date;
  const setClient = (v: string) => updateSd({ client: v });
  const setDate   = (v: string) => { updateSd({ date: v }); saveLastEntryDate(v); };

  const [lines, setLines] = useState<DraftLine[]>([EMPTY_DRAFT()]);

  // Sync lines → draft with 400ms debounce — avoids writing localStorage on every keystroke
  const draftSyncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(draftSyncTimer.current);
    draftSyncTimer.current = setTimeout(() => {
      updateSd({ lineData: lines.filter(l => l.productId).map(l => ({ productId: l.productId, productName: l.productName, sku: l.sku, boxes: l.boxes, qtyPerBox: l.qtyPerBox, totalQty: l.totalQty })) });
    }, 400);
    return () => clearTimeout(draftSyncTimer.current);
  }, [lines]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [reduceFromStock, setReduceFromStock] = useState(true);
  const [quickSearch, setQuickSearch] = useState('');
  const [hideZero, setHideZero]       = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [showImport, setShowImport]   = useState(false);
  const [importText, setImportText]   = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const clientRef = useRef<HTMLInputElement>(null);
  const boxesRefs = useRef<HTMLInputElement[]>([]);
  const pendingQuickAdd = useRef<{ idx: number; data: Partial<DraftLine> } | null>(null);

  useEffect(() => { getClients().then(setClients).catch(() => {}); }, []);

  const dateYear = date ? new Date(date + 'T12:00:00').getFullYear() : new Date().getFullYear();
  useEffect(() => { generateOrderRef(dateYear).then(setOrderRef); }, [dateYear]);
  useEffect(() => { setTimeout(() => clientRef.current?.focus(), 80); }, []);

  useEffect(() => {
    if (!pendingQuickAdd.current) return;
    const { idx, data } = pendingQuickAdd.current;
    if (lines.length > idx) {
      setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...data } : l));
      pendingQuickAdd.current = null;
      setTimeout(() => boxesRefs.current[idx]?.focus(), 40);
    }
  }, [lines.length]);

  const addLine = () => setLines(l => [...l, EMPTY_DRAFT()]);

  const updateLine = (idx: number, patch: Partial<DraftLine>) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));

  const selectProduct = (idx: number, p: Product) => {
    updateLine(idx, { productId: p.id, productName: p.name, sku: p.sku, search: p.name, showSuggestions: false, highlightIdx: -1 });
    setTimeout(() => boxesRefs.current[idx]?.focus(), 30);
  };

  const removeLine = (idx: number) =>
    setLines(prev => prev.length === 1 ? [EMPTY_DRAFT()] : prev.filter((_, i) => i !== idx));

  const handleQuickAdd = (p: Product) => {
    const data: Partial<DraftLine> = { productId: p.id, productName: p.name, sku: p.sku, search: p.name, showSuggestions: false, highlightIdx: -1 };
    const emptyIdx = lines.findIndex(l => !l.productId);
    if (emptyIdx >= 0) {
      updateLine(emptyIdx, data);
      setTimeout(() => boxesRefs.current[emptyIdx]?.focus(), 40);
    } else {
      pendingQuickAdd.current = { idx: lines.length, data };
      addLine();
    }
  };

  const parseImportText = () => {
    const skuMap = new Map(products.map(p => [p.sku.toUpperCase(), p]));
    const valid: DraftLine[] = [];
    const warnings: string[] = [];
    for (const line of importText.split('\n').map(l => l.trim()).filter(Boolean)) {
      const parts = line.split(/[\s\t]+/);
      const sku = parts[0]; const qty = Number(parts[1]);
      const p = skuMap.get(sku?.toUpperCase());
      if (p && qty > 0) valid.push({ ...EMPTY_DRAFT(), productId: p.id, productName: p.name, sku: p.sku, search: p.name, boxes: 1, qtyPerBox: qty, totalQty: qty });
      else warnings.push(`${sku}: ${!p ? 'not found' : 'invalid qty'}`);
    }
    setImportWarnings(warnings);
    if (valid.length > 0) {
      setLines(prev => [...prev.filter(l => l.productId), ...valid]);
      setShowImport(false); setImportText('');
    }
  };

  const handleContinueDraft = () => {
    continueDraft();
    if (sd.lineData.length > 0) {
      setLines(sd.lineData.map(l => ({ ...EMPTY_DRAFT(), productId: l.productId, productName: l.productName, sku: l.sku, search: l.productName, boxes: l.boxes, qtyPerBox: l.qtyPerBox, totalQty: l.totalQty })));
    }
  };

  const handleDiscardDraft = () => {
    discardDraft();
    setLines([EMPTY_DRAFT()]);
  };

  const handleSave = async () => {
    const validLines = lines.filter(l => l.productId && l.totalQty > 0);
    if (!client.trim()) { setError('Client name is required.'); return; }
    if (validLines.length === 0) { setError('Add at least one product line.'); return; }
    const seenIds = new Set<string>();
    const dup = validLines.find(l => seenIds.size === seenIds.add(l.productId).size);
    if (dup) { setError(`Duplicate product: "${dup.productName}" appears more than once. Merge the quantities into one line.`); return; }

    // ── Stock shortfall check (only when reducing stock) ──────────────────
    if (reduceFromStock) {
      const detected: ShortfallTarget[] = [];
      for (const line of validLines) {
        const product = products.find(p => p.id === line.productId);
        if (!product) continue;
        const available = product.stock_level;
        if (available < line.totalQty) {
          const recipe = recipes.find(r => r.finishedProductId === line.productId);
          if (recipe) {
            detected.push({
              productId: line.productId,
              productName: line.productName,
              recipeId: recipe.id,
              recipeName: line.productName,
              need: line.totalQty,
              have: available,
            });
          }
        }
      }
      if (detected.length > 0) {
        setShortfalls(detected);
        return; // show the shortfall dialog instead of saving
      }
    }

    setError(''); setSaving(true);
    try {
      await createOrder({ ref: orderRef, client, date: new Date(date), lines: validLines as SalesOrderLine[], reduceStock: reduceFromStock });
      clearSalesDraft();
      onSaved(); onClose();
    } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Failed to save order.'); }
    finally { setSaving(false); }
  };

  const handleCreateProductionTargets = async () => {
    clearSalesDraft();
    onClose();
    // Pass shortfall data to Production page so user can review & confirm before creating targets
    navigate('/production', {
      state: {
        tab: 'planning',
        shortfalls: shortfalls.map(sf => ({
          recipeId: sf.recipeId,
          recipeName: sf.recipeName,
          targetQty: sf.need - sf.have,
        }))
      }
    });
  };

  const totalPcs = lines.reduce((s, l) => s + (l.productId ? l.totalQty : 0), 0);
  const validCount = lines.filter(l => l.productId && l.totalQty > 0).length;

  const qs = quickSearch.toLowerCase();
  const addedIds = new Set(lines.map(l => l.productId).filter(Boolean));
  const sidebarProducts = products.filter(p => {
    if (addedIds.has(p.id)) return false;
    if (hideZero && p.stock_level <= 0) return false;
    if (qs && !p.name.toLowerCase().includes(qs) && !p.sku.toLowerCase().includes(qs)) return false;
    return true;
  });
  const sidebarCats = [...CATEGORY_ORDER.filter(c => sidebarProducts.some(p => p.category === c)),
    ...Array.from(new Set(sidebarProducts.map(p => p.category ?? 'Other'))).filter(c => !CATEGORY_ORDER.includes(c))];

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden">

      {/* Draft banner */}
      {hasDraft && isReady === false && (
        <div className="shrink-0 px-6 pt-4">
          <DraftBanner savedAt={savedAt} onContinue={handleContinueDraft} onDiscard={handleDiscardDraft} />
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onClose}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium text-sm shrink-0">
            <X size={16} /> Cancel
          </button>
          <h1 className="text-lg font-bold text-slate-800 shrink-0">New Sales Order</h1>
          <span className="text-sm font-mono text-slate-400 shrink-0 bg-white border border-slate-200 px-3 py-2 rounded-xl">{orderRef}</span>
          <EntityPicker
            value={client}
            onChange={setClient}
            entities={clients.map(c => ({ id: c.id, name: c.name, subtitle: c.mainPhone }))}
            onAddNew={() => setShowAddClientModal(true)}
            placeholder="Client name *"
            addLabel="Add new client"
            className="flex-1 min-w-[140px] max-w-xs"
            inputClassName="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
          />
          <div className="flex items-center gap-1 shrink-0">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-4 py-2.5 border-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {date !== todayStr && (
              <button type="button" onClick={() => setDate(todayStr)}
                className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors whitespace-nowrap">
                <CalendarCheck size={12} /> Today
              </button>
            )}
          </div>
          {/* Reduce from stock toggle */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer select-none transition-all shrink-0 ${
              reduceFromStock
                ? 'border-blue-400 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
            onClick={() => setReduceFromStock(v => !v)}
            title={reduceFromStock ? 'Stock will be deducted from inventory' : 'Order will be recorded without deducting stock'}
          >
            <div className={`w-8 h-4 rounded-full flex items-center transition-colors ${reduceFromStock ? 'bg-blue-500' : 'bg-slate-300'}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${reduceFromStock ? 'translate-x-3.5' : 'translate-x-0'}`} />
            </div>
            <span className="text-xs font-semibold whitespace-nowrap">Reduce Stock</span>
          </div>

          {validCount > 0 && (
            <span className="text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 px-4 py-1.5 rounded-full shrink-0">
              {validCount} SKU{validCount !== 1 ? 's' : ''} · {totalPcs.toLocaleString('fr-FR')} pcs
            </span>
          )}
          <button type="button" onClick={handleSave} disabled={saving}
            className="ml-auto shrink-0 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? 'Saving…' : '✓ Save Order'}
          </button>
        </div>
        {error && <p className="mt-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Quick Access Sidebar */}
        <div className="w-72 shrink-0 border-r border-slate-200 flex flex-col bg-slate-50 overflow-hidden">
          <div className="px-3 py-3 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Quick Add</p>
              <button type="button" onClick={() => setHideZero(h => !h)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${hideZero ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>
                Hide zero
              </button>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={quickSearch} onChange={e => setQuickSearch(e.target.value)}
                placeholder="Search products…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sidebarCats.map(cat => {
              const items = sidebarProducts.filter(p => (p.category ?? 'Other') === cat)
                .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
              const collapsed = collapsedCats.has(cat);
              const toggle = () => setCollapsedCats(prev => {
                const next = new Set(prev);
                collapsed ? next.delete(cat) : next.add(cat);
                return next;
              });
              return (
                <div key={cat}>
                  <button type="button" onClick={toggle}
                    className="sticky top-0 w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 border-b border-slate-200 hover:bg-slate-200 transition-colors">
                    <span>{cat}</span>
                    <span className="text-slate-400">{collapsed ? '▸' : '▾'}</span>
                  </button>
                  {!collapsed && items.map(p => {
                    const parsed = extractColor(p.name);
                    return (
                      <button key={p.id} type="button" onClick={() => handleQuickAdd(p)}
                        className="w-full text-left px-3 py-2 border-b border-slate-100 hover:bg-white transition-colors">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {parsed?.color && <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_DOT[parsed.color]}`} />}
                          <span className="text-xs font-medium text-slate-700 truncate">{p.name}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[10px] font-mono text-slate-400">{p.sku}</span>
                          <span className={`text-[10px] font-bold tabular-nums ${p.stock_level < 0 ? 'text-red-500' : p.stock_level === 0 ? 'text-orange-400' : 'text-slate-400'}`}>
                            {p.stock_level}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="shrink-0 border-t border-slate-200 p-3">
            <button type="button" onClick={() => setShowImport(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white transition-colors text-xs font-semibold">
              <FileDown size={13} /> Import from TXT
            </button>
          </div>
        </div>

        {/* Main table */}
        <div className="flex-1 min-w-0 flex flex-col overflow-x-auto overflow-y-hidden">
          {/* min-h-0 + flex chain: without it the row list can't own the leftover
              height, so it grows past the viewport and gets clipped unscrollable */}
          <div className="min-w-[720px] flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 bg-white border-b border-slate-100 px-4 py-2">
            <div className="grid grid-cols-[40px_1fr_140px_90px_110px_110px_90px_44px] gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">#</span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Product</span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">SKU</span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-right pr-2">Stock</span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-right pr-1">Boxes</span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-right pr-1">Qty/Box</span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-right pr-1">Total</span>
              <span />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 pb-6 space-y-1.5">
            {lines.map((line, i) => (
              <SalesOrderRow
                key={line.uid} line={line} rowNum={i + 1} products={products}
                boxesRef={el => { if (el) boxesRefs.current[i] = el; }}
                onUpdate={patch => updateLine(i, patch)}
                onSelect={p => selectProduct(i, p)}
                onRemove={() => removeLine(i)}
                onBoxesTab={() => {
                  if (i === lines.length - 1) { addLine(); setTimeout(() => { /* focus search of new row */ }, 40); }
                  else boxesRefs.current[i + 1]?.focus();
                }}
              />
            ))}
            <button type="button" onClick={addLine}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors text-sm font-medium mt-1">
              <Plus size={14} /> Add Line
            </button>
          </div>
          </div>{/* end min-w wrapper */}
        </div>
      </div>

      {/* Import TXT */}
      {showImport && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-800">Import from TXT</h3>
              <button onClick={() => { setShowImport(false); setImportText(''); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              One item per line — <code className="bg-slate-100 px-1 rounded">SKU TOTAL_QTY</code>
              <span className="ml-2 text-slate-400">(qty treated as qty-per-box, boxes = 1)</span>
            </p>
            <textarea value={importText} onChange={e => setImportText(e.target.value)}
              placeholder={"JSM-0905C\t20\nJSM-0905N\t20\nJSM-1109C\t20"}
              rows={7} autoFocus
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
            {importWarnings.length > 0 && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-amber-700 mb-1">⚠ Unmatched:</p>
                {importWarnings.map((w, wi) => <p key={wi} className="text-xs text-amber-600 font-mono">{w}</p>)}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={parseImportText} disabled={!importText.trim()}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition-colors">
                Parse &amp; Add Lines
              </button>
              <button type="button" onClick={() => { setShowImport(false); setImportText(''); }}
                className="flex-1 py-2.5 border-2 border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClientModal && (
        <ClientModal
          onSave={async (data) => {
            await createClient(data);
            const updated = await getClients();
            setClients(updated);
            setClient(data.name);
          }}
          onClose={() => setShowAddClientModal(false)}
        />
      )}

      {/* Shortfall dialog — shown when warehouse stock < ordered qty */}
      {shortfalls.length > 0 && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Insufficient Warehouse Stock</h3>
                <p className="text-sm text-slate-500 mt-1">
                  The following products don't have enough stock. A production target will be created automatically.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden divide-y divide-amber-100">
              {shortfalls.map(sf => (
                <div key={sf.productId} className="px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{sf.productName}</p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs">
                    <span className="text-slate-500">Ordered: <strong className="text-slate-700 tabular-nums">{sf.need.toLocaleString()}</strong></span>
                    <span className="text-slate-500">In stock: <strong className="text-slate-700 tabular-nums">{sf.have.toLocaleString()}</strong></span>
                    <span className="text-red-600 font-semibold">Short: {(sf.need - sf.have).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-indigo-600 mt-1.5">
                    → Will create production target for <strong>{(sf.need - sf.have).toLocaleString()} units</strong>
                  </p>
                </div>
              ))}
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleCreateProductionTargets}
                disabled={creatingTargets}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {creatingTargets ? 'Creating…' : '▶ Create Production Target'}
              </button>
              <button
                onClick={() => setShortfalls([])}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors">
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Order detail modal ────────────────────────────────────────────
function OrderDetailModal({ order, onClose }: { order: SalesOrder; onClose: () => void }) {
  const date = order.date instanceof Date ? order.date : new Date(order.date);
  const totalQty = order.lines.reduce((s, l) => s + l.totalQty, 0);

  return (
    <Modal title={order.ref} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-slate-400">Client</span><p className="font-semibold text-slate-800 mt-0.5">{order.client}</p></div>
          <div><span className="text-slate-400">Date</span><p className="font-semibold text-slate-800 mt-0.5">{date.toLocaleDateString('fr-FR')}</p></div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-400 uppercase tracking-wide">
              <th className="pb-2">#</th>
              <th className="pb-2">Product</th>
              <th className="pb-2">SKU</th>
              <th className="pb-2 text-right">Qty</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l, i) => (
              <tr key={l.productId} className="border-b border-slate-100">
                <td className="py-2 text-slate-400">{i + 1}</td>
                <td className="py-2 text-slate-700">{l.productName}</td>
                <td className="py-2 font-mono text-slate-500 text-xs">{l.sku}</td>
                <td className="py-2 text-right font-semibold text-slate-800">{l.totalQty}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 text-xs text-slate-400 uppercase tracking-wide font-medium">Total</td>
              <td className="pt-3 text-right font-bold text-slate-800">{totalQty}</td>
            </tr>
          </tfoot>
        </table>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={() => downloadInvoice(order)}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
            <Download size={14} /> Download
          </button>
          <button onClick={onClose}
            className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Product picker for edit modal ────────────────────────────────
function ProductPicker({ products, onSelect }: { products: Product[]; onSelect: (p: Product) => void }) {
  const [q, setQ] = useState('');
  const filtered = q.trim()
    ? products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()))
    : products;
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="p-2 border-b border-slate-100">
        <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search product…" autoFocus
          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400" />
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
        {filtered.slice(0, 20).map(p => (
          <button key={p.id} type="button" onMouseDown={() => onSelect(p)}
            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 transition-colors">
            <span className="text-sm text-slate-700">{p.name}</span>
            <span className="text-xs font-mono text-slate-400 ml-2">{p.sku}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No results</p>}
      </div>
    </div>
  );
}

// ── Edit Order Modal ──────────────────────────────────────────────
function EditOrderModal({ order, products, onClose, onSaved }: {
  order: SalesOrder;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toDateStr = (d: Date | string) =>
    (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);

  const [ref] = useState(order.ref);
  const [client, setClient] = useState(order.client);
  const [date, setDate] = useState(toDateStr(order.date));
  const [lines, setLines] = useState<DraftLine[]>(
    order.lines.map(l => ({
      ...l,
      productName: l.productName ?? '', sku: l.sku ?? '',
      boxes: Number(l.boxes) || 0, qtyPerBox: Number(l.qtyPerBox) || 0, totalQty: Number(l.totalQty) || 0,
      uid: newUid(), search: l.productName ?? '', showSuggestions: false, highlightIdx: -1,
    }))
  );
  const [openPicker, setOpenPicker] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addLine = () => {
    const idx = lines.length;
    setLines(prev => [...prev, EMPTY_DRAFT()]);
    setOpenPicker(idx);
  };

  const selectProduct = (idx: number, p: Product) => {
    setLines(prev => prev.map((l, i) => i === idx
      ? { ...l, productId: p.id, productName: p.name, sku: p.sku }
      : l));
    setOpenPicker(null);
  };

  const updateLine = (idx: number, field: 'boxes' | 'qtyPerBox', val: number) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const boxes = field === 'boxes' ? val : l.boxes;
      const qtyPerBox = field === 'qtyPerBox' ? val : l.qtyPerBox;
      return { ...l, boxes, qtyPerBox, totalQty: boxes * qtyPerBox };
    }));
  };

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) { setError('Add at least one product line'); return; }
    if (lines.some(l => !l.productId)) { setError('Select a product for each line'); return; }
    setError('');
    setSaving(true);
    try {
      await updateOrder({ ...order, ref, client, date: new Date(date), lines: lines as SalesOrderLine[] });
      onSaved();
      onClose();
    } catch (e) {
      // Surface the real reason (missing product, insufficient stock, permissions…) —
      // a bare "failed to save" leaves nothing to act on
      setError(e instanceof Error && e.message ? e.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit ${ref}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Order Ref</label>
            <input value={ref} readOnly className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client</label>
            <input value={client} onChange={e => setClient(e.target.value)} required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setOpenPicker(openPicker === idx ? null : idx)}
                  className="flex-1 text-left text-sm px-2 py-1.5 rounded border border-slate-200 hover:bg-slate-50 transition-colors">
                  {line.productName
                    ? <span className="text-slate-700">{line.productName} <span className="text-slate-400 font-mono text-xs">{line.sku}</span></span>
                    : <span className="text-slate-400">Click to select product…</span>}
                </button>
                <button type="button" onClick={() => removeLine(idx)}
                  className="ml-2 p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                  <X size={14} />
                </button>
              </div>
              {openPicker === idx && (
                <ProductPicker products={products} onSelect={p => selectProduct(idx, p)} />
              )}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1">Boxes</label>
                  <input type="number" min="1" value={line.boxes} onChange={e => updateLine(idx, 'boxes', Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Qty/Box</label>
                  <input type="number" min="1" value={line.qtyPerBox} onChange={e => updateLine(idx, 'qtyPerBox', Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Total</label>
                  <div className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-slate-50 text-slate-700 font-semibold tabular-nums">{line.totalQty}</div>
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={addLine}
            className="w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5">
            <Plus size={14} /> Add product line
          </button>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
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
export default function SalesPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<SalesOrder | null>(null);
  const [editing, setEditing] = useState<SalesOrder | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filterBase, setFilterBase] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getOrders(), getProducts(), getRecipes()])
      .then(([o, p, r]) => { setOrders(o); setProducts(p.filter(x => x.type === 'FINISHED')); setRecipes(r); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (order: SalesOrder) => {
    if (!confirm(`Delete order ${order.ref}? Stock will be restored automatically.`)) return;
    setDeleting(order.id);
    try {
      await deleteOrder(order);
      // Only remove from local state after Firestore confirms success
      setOrders(o => o.filter(x => x.id !== order.id));
    } catch (e) {
      alert(`Failed to delete order: ${e instanceof Error ? e.message : 'Unknown error'}`);
      load(); // Re-sync with Firestore to ensure UI matches actual state
    } finally {
      setDeleting(null);
    }
  };

  const groupStats = buildGroupStats(orders);

  const filteredOrders = filterBase
    ? orders.filter(o => o.lines.some(l => {
        const parsed = extractColor(l.productName);
        const base = parsed ? parsed.base : l.productName;
        return base === filterBase;
      }))
    : mergeByDateClient(orders);

  const totalPcs = filteredOrders.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.totalQty, 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Orders</h1>
          <p className="text-slate-500 text-sm mt-1">
            {orders.length} orders · {totalPcs.toLocaleString('fr-FR')} pcs total
          </p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> New Order
        </button>
      </div>

      {/* Summary cards */}
      {!loading && groupStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {groupStats.map(group => {
            const isActive = filterBase === group.base;
            const lastFmt = group.lastDate
              ? (group.lastDate instanceof Date ? group.lastDate : new Date(group.lastDate))
                  .toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : '—';
            return (
              <button key={group.base} type="button"
                onClick={() => setFilterBase(isActive ? null : group.base)}
                className={`text-left bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-all ${
                  isActive ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-100'
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{group.base}</p>
                  <ShoppingBag size={16} className="text-slate-300 shrink-0 mt-0.5" />
                </div>
                <div className="space-y-1.5">
                  {group.variants.map(v => (
                    <div key={v.sku} className="flex items-center gap-2 text-xs">
                      {v.color && <span className={`w-3 h-3 rounded-full shrink-0 ${COLOR_DOT[v.color]}`} />}
                      <span className="font-mono text-slate-500 flex-1">{v.sku}</span>
                      <span className="text-slate-400">{v.orderCount} orders</span>
                      <span className="font-semibold text-slate-700 tabular-nums">{v.totalQty.toLocaleString('fr-FR')}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 pt-2 mt-auto flex items-center justify-between">
                  <span className="text-xs text-slate-400">Last: {lastFmt}</span>
                  <span className="text-xs font-bold text-slate-800 tabular-nums">
                    Total: {group.variants.reduce((s, v) => s + v.totalQty, 0).toLocaleString('fr-FR')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Active filter banner */}
      {filterBase && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="text-blue-700 font-medium">Showing: {filterBase}</span>
          <button onClick={() => setFilterBase(null)} className="ml-auto flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors">
            <X size={14} /> Clear filter
          </button>
        </div>
      )}

      {/* Orders table */}
      {loading ? (
        <div className="text-center text-slate-400 py-20 text-sm">Loading…</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag size={44} className="mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 text-sm">No orders yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              {filterBase ? ` · filtered by "${filterBase}"` : ''}
            </span>
            <button
              onClick={() => downloadSalesReport(orders, products)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors"
            >
              <FileDown size={13} /> Download Report
            </button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide bg-white">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3 text-right">Total pcs</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => {
                const date = order.date instanceof Date ? order.date : new Date(order.date);
                const totalQty = order.lines.reduce((s, l) => s + l.totalQty, 0);
                return (
                  <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 tabular-nums whitespace-nowrap">
                      {date.toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{order.ref}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{order.client}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {order.lines.map(l => l.sku).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">{totalQty}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setDetail(order)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="View">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => setEditing(order)}
                          className="p-1.5 text-amber-500 hover:text-amber-600 transition-colors" title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => downloadInvoice(order)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors" title="Download">
                          <Download size={15} />
                        </button>
                        <button onClick={() => handleDelete(order)} disabled={deleting === order.id}
                          className="p-1.5 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showNew && (
        <NewOrderModal products={products} recipes={recipes} onClose={() => setShowNew(false)} onSaved={load} />
      )}
      {detail && (
        <OrderDetailModal order={detail} onClose={() => setDetail(null)} />
      )}
      {editing && (
        <EditOrderModal
          order={editing}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
