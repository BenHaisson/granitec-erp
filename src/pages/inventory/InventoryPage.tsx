import { useEffect, useState, type FormEvent } from 'react';
import { Plus, FlaskConical, ArrowDownToLine, ChevronDown, Search, FileText, X, Pencil, Trash2 } from 'lucide-react';
import { getProducts, addProduct, adjustStock, getMovements, deleteProduct, updateProduct } from '@/services/inventory.service';
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
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bon de réception ${group.ref}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px 60px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
  .doc-title { font-size: 22px; font-weight: 900; letter-spacing: 1px; color: #1a1a2e; }
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
    <div class="doc-title">Bon de réception matière</div>
    <div class="doc-info">
      <div class="ref">${group.ref}</div>
      <div class="date">${fmt}</div>
    </div>
  </div>
  <div class="meta">
    <div class="meta-block">
      <label>Matière</label>
      <span>Disque aluminium</span>
    </div>
    <div class="meta-block">
      <label>Nombre de références</label>
      <span>${group.items.length}</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Désignation</th>
        <th>Référence</th>
        <th style="text-align:right">Quantité</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <div class="total-box">
      <div class="label">Total pièces</div>
      <div class="value">${group.totalQty.toLocaleString('fr-FR')}</div>
    </div>
  </div>
  <div class="stamp">Document généré par Granitec ERP · ${new Date().toLocaleDateString('fr-FR')}</div>
</body>
</html>`;

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
        <td className="px-4 py-3 text-sm text-slate-400">{group.items.length} disc types</td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={e => { e.stopPropagation(); openShippingDoc(group); }}
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

// ── Color grouping helpers ────────────────────────────────────────
const COLOR_NAMES = ['Black-Tf', 'Black', 'Gray', 'Cream', 'Blue', 'Red'] as const;
type ColorName = typeof COLOR_NAMES[number];
const COLOR_DOT: Record<ColorName, string> = {
  'Black-Tf': 'bg-gray-900 ring-2 ring-offset-1 ring-indigo-400',
  Black:  'bg-gray-900',
  Gray:   'bg-gray-400',
  Cream:  'bg-amber-100 border border-amber-300',
  Blue:   'bg-blue-500',
  Red:    'bg-red-500',
};

function extractColor(name: string): { base: string; color: ColorName } | null {
  for (const color of COLOR_NAMES) {
    if (name.endsWith(color)) {
      return { base: name.slice(0, name.length - color.length).replace(/[\s—\-]+$/, '').trim(), color };
    }
  }
  return null;
}

interface RawMaterialGroup {
  base: string;
  category: string;
  variants: { product: Product; color: ColorName | null }[];
}

function groupRawMaterials(products: Product[]): RawMaterialGroup[] {
  const map = new Map<string, RawMaterialGroup>();
  for (const p of products) {
    const parsed = extractColor(p.name);
    const base   = parsed ? parsed.base : p.name;
    const color  = parsed ? parsed.color : null;
    const key    = `${base}__${p.category ?? ''}`;
    if (!map.has(key)) map.set(key, { base, category: p.category ?? '', variants: [] });
    map.get(key)!.variants.push({ product: p, color });
  }
  return Array.from(map.values());
}

function groupBadge(group: RawMaterialGroup) {
  const ps = group.variants.map(v => v.product);
  if (ps.every(p => p.stock_level <= 0))                                return <Badge label="Empty" variant="red" />;
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
          const low   = p.stock_level > 0 && p.stock_level <= p.min_stock;
          return (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              {color
                ? <span className={`w-3 h-3 rounded-full shrink-0 ${COLOR_DOT[color]}`} />
                : <span className="w-3 h-3 shrink-0" />}
              <span className="text-slate-500 w-16 shrink-0">{color ?? '—'}</span>
              <span className={`font-bold tabular-nums text-sm ${empty ? 'text-red-500' : low ? 'text-yellow-600' : 'text-slate-800'}`}>
                {p.stock_level.toLocaleString()}
              </span>
              <span className="text-slate-400">{p.unit}</span>
              <div className="ml-auto flex items-center gap-1">
                {stockBadge(p)}
                <button onClick={() => onReceive(p)} title="Receive Supply"
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

// ── Main page ─────────────────────────────────────────────────────
export default function InventoryPage() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading]     = useState(true);
  const [rawCategory, setRawCategory] = useState('All');
  const [search, setSearch]           = useState('');

  // Add material modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState('');
  const [form, setForm]                 = useState<{
    name: string; sku: string; category: RawCategory | ''; unit: string; stock_level: string; min_stock: string;
  }>({ name: '', sku: '', category: '', unit: 'pcs', stock_level: '0', min_stock: '10' });

  // Edit material modal
  const [editProduct, setEditProduct]   = useState<Product | null>(null);
  const [editForm, setEditForm]         = useState({ name: '', sku: '', category: '' as RawCategory | '', unit: '', min_stock: '' });
  const [editSaving, setEditSaving]     = useState(false);
  const [editError, setEditError]       = useState('');

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({ name: p.name, sku: p.sku, category: (p.category as RawCategory | undefined) ?? '', unit: p.unit, min_stock: String(p.min_stock) });
    setEditError('');
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setEditError('');
    setEditSaving(true);
    try {
      await updateProduct(editProduct.id, {
        name: editForm.name,
        sku: editForm.sku,
        category: editForm.category || undefined,
        unit: editForm.unit,
        min_stock: Number(editForm.min_stock),
      });
      setEditProduct(null);
      load();
    } catch { setEditError('Failed to save.'); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await deleteProduct(p.id);
    load();
  };

  // Receive supply modal
  const [receiveProduct, setReceiveProduct] = useState<Product | null>(null);
  const [receiveForm, setReceiveForm]       = useState({ qty: '1', note: '' });
  const [receiveSaving, setReceiveSaving]   = useState(false);
  const [receiveError, setReceiveError]     = useState('');

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
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const rawGrouped = sortCategories(
    Array.from(new Set(filteredRaw.map(p => p.category ?? 'Other'))),
    RAW_CATEGORY_ORDER
  ).map(cat => ({
    cat,
    groups: groupRawMaterials(filteredRaw.filter(p => (p.category ?? 'Other') === cat)),
  }));

  const rawIds = new Set(rawMaterials.map(p => p.id));

  const shippingHistory: ShippingGroup[] = (() => {
    const map = new Map<string, ShippingGroup>();
    for (const m of movements.filter(m => m.reason === 'PURCHASE' && rawIds.has(m.productId))) {
      const ref = m.note ?? '—';
      if (!map.has(ref)) map.set(ref, { ref, date: tsToDate(m.createdAt), totalQty: 0, items: [] });
      const g = map.get(ref)!;
      const prod = products.find(p => p.id === m.productId);
      g.items.push({ sku: m.productId, name: prod?.name ?? m.productId, qty: m.quantity });
      g.totalQty += m.quantity;
    }
    return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  })();

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await addProduct({
        name: form.name, sku: form.sku,
        type: 'RAW' as ProductType,
        category: form.category || undefined,
        unit: form.unit,
        stock_level: Number(form.stock_level),
        min_stock: Number(form.min_stock),
        cost: 0,
      });
      setShowAddModal(false);
      setForm({ name: '', sku: '', category: '', unit: 'pcs', stock_level: '0', min_stock: '10' });
      load();
    } catch { setFormError('Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleReceive = async (e: FormEvent) => {
    e.preventDefault();
    if (!receiveProduct) return;
    setReceiveError('');
    setReceiveSaving(true);
    try {
      await adjustStock(receiveProduct.id, Number(receiveForm.qty), 'PURCHASE', receiveForm.note || undefined);
      setReceiveProduct(null);
      setReceiveForm({ qty: '1', note: '' });
      load();
    } catch { setReceiveError('Failed to record receipt.'); }
    finally { setReceiveSaving(false); }
  };

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
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={16} /> Add Raw Material
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search by name or SKU…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category filter chips */}
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
          <p className="text-slate-400 text-xs mt-1">Add materials here, then build BOM recipes.</p>
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
                    <RawMaterialGroupCard key={g.base + g.category} group={g} onReceive={setReceiveProduct} onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Supply receipt history */}
          {shippingHistory.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <ArrowDownToLine size={15} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-700">Supply Receipt History</h2>
                <span className="ml-auto text-xs text-slate-400">{shippingHistory.length} shipments · click to expand</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Shipping Ref</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Received</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contents</th>
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

      {/* Add Raw Material Modal */}
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
                  placeholder="e.g. RM-AL-20"
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
            <div className="grid grid-cols-2 gap-3">
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

      {/* Edit Material Modal */}
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
            <div className="grid grid-cols-2 gap-3">
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

      {/* Receive Supply Modal */}
      {receiveProduct && (
        <Modal title="Receive Supply" onClose={() => { setReceiveProduct(null); setReceiveError(''); }}>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Note / Supplier <span className="text-slate-400 font-normal">(optional)</span></label>
              <input type="text" value={receiveForm.note}
                onChange={e => setReceiveForm(f => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Supplier name, invoice #…"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {receiveError && <p className="text-red-600 text-sm">{receiveError}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={receiveSaving}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {receiveSaving ? 'Saving…' : 'Confirm Receipt'}
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
