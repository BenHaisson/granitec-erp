import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X, ShoppingBag, Download, Eye, Pencil, FileDown } from 'lucide-react';
import { getOrders, createOrder, updateOrder, generateOrderRef } from '@/services/orders.service';
import { getProducts } from '@/services/inventory.service';
import Modal from '@/components/ui/Modal';
import type { SalesOrder, SalesOrderLine, Product, PaymentStatus, DeliveryStatus } from '@/types';

// ── Color helpers (mirrors WarehousePage) ────────────────────────
const COLOR_NAMES = ['Black', 'Gray', 'Cream', 'Blue', 'Red'] as const;
type ColorName = typeof COLOR_NAMES[number];

const COLOR_DOT: Record<ColorName, string> = {
  Black: 'bg-gray-900',
  Gray:  'bg-gray-400',
  Cream: 'bg-amber-100 border border-amber-300',
  Blue:  'bg-blue-500',
  Red:   'bg-red-500',
};

function extractColor(name: string): { base: string; color: ColorName } | null {
  for (const color of COLOR_NAMES) {
    if (name.endsWith(color)) {
      const base = name.slice(0, name.length - color.length).replace(/[\s—\-]+$/, '').trim();
      return { base, color };
    }
  }
  return null;
}

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

  const rows = order.lines.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${l.productName}</td>
      <td class="mono">${l.sku}</td>
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
        <th style="text-align:right">Quantité</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <div class="total-box">
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
    <div class="sub">Généré le ${now.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}</div>
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

// ── Status badge helpers ──────────────────────────────────────────
const PAYMENT_LABELS: Record<PaymentStatus, string> = { unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid' };
const DELIVERY_LABELS: Record<DeliveryStatus, string> = { pending: 'Pending', shipped: 'Shipped', delivered: 'Delivered' };

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  unpaid:  'bg-red-100 text-red-700 hover:bg-red-200',
  partial: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
  paid:    'bg-green-100 text-green-700 hover:bg-green-200',
};
const DELIVERY_STYLE: Record<DeliveryStatus, string> = {
  pending:   'bg-slate-100 text-slate-600 hover:bg-slate-200',
  shipped:   'bg-blue-100 text-blue-700 hover:bg-blue-200',
  delivered: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
};

const PAYMENT_CYCLE: PaymentStatus[] = ['unpaid', 'partial', 'paid'];
const DELIVERY_CYCLE: DeliveryStatus[] = ['pending', 'shipped', 'delivered'];

function nextPayment(s?: PaymentStatus): PaymentStatus { const i = PAYMENT_CYCLE.indexOf(s ?? 'unpaid'); return PAYMENT_CYCLE[(i + 1) % 3]; }
function nextDelivery(s?: DeliveryStatus): DeliveryStatus { const i = DELIVERY_CYCLE.indexOf(s ?? 'pending'); return DELIVERY_CYCLE[(i + 1) % 3]; }

// ── Product picker (categories accordion) ────────────────────────
const CATEGORY_ORDER = ['Sets & Packs', 'Marmite', 'Crepe & Specialty', 'Frypans', 'Saucepots', 'Cake & Molds'];

const COLOR_DOT_PICKER: Record<ColorName, string> = {
  Black: 'bg-gray-900', Gray: 'bg-gray-400', Cream: 'bg-amber-200',
  Blue: 'bg-blue-500', Red: 'bg-red-500',
};

function ProductPicker({ products, onSelect }: { products: Product[]; onSelect: (p: Product) => void }) {
  const [openCat, setOpenCat] = useState<string | null>(null);

  const byCategory: Record<string, Product[]> = {};
  for (const p of products) {
    const cat = p.category ?? 'Other';
    (byCategory[cat] ??= []).push(p);
  }
  const cats = [...CATEGORY_ORDER.filter(c => byCategory[c]), ...Object.keys(byCategory).filter(c => !CATEGORY_ORDER.includes(c))];

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
      {cats.map(cat => (
        <div key={cat}>
          <button type="button" onClick={() => setOpenCat(openCat === cat ? null : cat)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors border-b border-slate-200">
            <span>{cat}</span>
            <span className="text-slate-400">{openCat === cat ? '▲' : '▼'}</span>
          </button>
          {openCat === cat && (
            <div className="bg-white">
              {byCategory[cat].map(p => {
                const parsed = extractColor(p.name);
                const color = parsed?.color ?? null;
                return (
                  <button key={p.id} type="button" onClick={() => onSelect(p)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left transition-colors border-b border-slate-100 last:border-0">
                    {color && <span className={`w-3 h-3 rounded-full shrink-0 ${COLOR_DOT_PICKER[color]}`} />}
                    <span className="text-xs text-slate-700 flex-1">{p.name}</span>
                    <span className="text-xs font-mono text-slate-400">{p.sku}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Draft line type ───────────────────────────────────────────────
interface DraftLine {
  productId: string;
  productName: string;
  sku: string;
  boxes: number;
  qtyPerBox: number;
  totalQty: number;
}

// ── New Order Modal ───────────────────────────────────────────────
function NewOrderModal({ products, onClose, onSaved }: {
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ref, setRef] = useState('');
  const [client, setClient] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [openPicker, setOpenPicker] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    generateOrderRef().then(setRef);
  }, []);

  const addLine = () => {
    const idx = lines.length;
    setLines(prev => [...prev, { productId: '', productName: '', sku: '', boxes: 1, qtyPerBox: 1, totalQty: 1 }]);
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
      await createOrder({ ref, client, date: new Date(date), lines: lines as SalesOrderLine[] });
      onSaved();
      onClose();
    } catch {
      setError('Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Sales Order" onClose={onClose}>
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
            {saving ? 'Saving…' : 'Save Order'}
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
              <tr key={i} className="border-b border-slate-100">
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
    order.lines.map(l => ({ ...l }))
  );
  const [openPicker, setOpenPicker] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addLine = () => {
    const idx = lines.length;
    setLines(prev => [...prev, { productId: '', productName: '', sku: '', boxes: 1, qtyPerBox: 1, totalQty: 1 }]);
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
    } catch {
      setError('Failed to save changes');
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
const isLive = import.meta.env.VITE_APP_MODE === 'live';

export default function SalesPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<SalesOrder | null>(null);
  const [editing, setEditing] = useState<SalesOrder | null>(null);
  const [filterBase, setFilterBase] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getOrders(), getProducts()])
      .then(([o, p]) => { setOrders(o); setProducts(p.filter(x => x.type === 'FINISHED')); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide bg-white">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3 text-right">Total pcs</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Delivery</th>
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
                      <button
                        onClick={() => updateOrder({ ...order, paymentStatus: nextPayment(order.paymentStatus) }).then(load)}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${PAYMENT_STYLE[order.paymentStatus ?? 'unpaid']}`}
                        title="Click to cycle status"
                      >
                        {PAYMENT_LABELS[order.paymentStatus ?? 'unpaid']}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => updateOrder({ ...order, deliveryStatus: nextDelivery(order.deliveryStatus) }).then(load)}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${DELIVERY_STYLE[order.deliveryStatus ?? 'pending']}`}
                        title="Click to cycle status"
                      >
                        {DELIVERY_LABELS[order.deliveryStatus ?? 'pending']}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setDetail(order)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="View">
                          <Eye size={15} />
                        </button>
                        {!isLive && (
                          <button onClick={() => setEditing(order)}
                            className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors" title="Edit">
                            <Pencil size={15} />
                          </button>
                        )}
                        <button onClick={() => downloadInvoice(order)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors" title="Download">
                          <Download size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <NewOrderModal products={products} onClose={() => setShowNew(false)} onSaved={load} />
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
