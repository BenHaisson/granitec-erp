import { useEffect, useState, useRef, type FormEvent } from 'react';
import { Plus, Search, Package, ImageOff, FlaskConical, ArrowDownToLine } from 'lucide-react';
import { getProducts, addProduct, adjustStock, getMovements } from '@/services/inventory.service';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import type { Product, ProductType, InventoryMovement } from '@/types';

// ── Product image map ────────────────────────────────────────────
const PRODUCT_IMAGES: Record<string, string> = {
  'JSM-2102N': '/products/JSM-2102N.png',
  'JSM-2102G': '/products/JSM-2102G.png',
  'JSM-1406N': '/products/JSM-1406N.png',
  'JSM-2104N': '/products/JSM-2104N.png',
  'JSM-1408N': '/products/JSM-1408N.png',
  'JSM-1408G': '/products/JSM-1408G.png',
  'JSM-1407N': '/products/JSM-1407N.JPEG',
  'JSM-1407G': '/products/JSM-1407G.jfif',
};

// ── Category orders ──────────────────────────────────────────────
const FINISHED_CATEGORY_ORDER = [
  'Sets & Packs', 'Marmite', 'Crepe & Specialty', 'Frypans', 'Saucepots', 'Cake & Molds',
];

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

// ── Color helpers ────────────────────────────────────────────────
const COLOR_NAMES = ['Black', 'Gray', 'Cream', 'Blue', 'Red'] as const;
type ColorName = typeof COLOR_NAMES[number];
const COLOR_DOT: Record<ColorName, string> = {
  Black: 'bg-gray-900', Gray: 'bg-gray-400',
  Cream: 'bg-amber-100 border border-amber-300', Blue: 'bg-blue-500', Red: 'bg-red-500',
};

function extractColor(name: string): { base: string; color: ColorName } | null {
  for (const color of COLOR_NAMES) {
    if (name.endsWith(color)) {
      return { base: name.slice(0, name.length - color.length).replace(/[\s—\-]+$/, '').trim(), color };
    }
  }
  return null;
}

interface ProductGroup {
  base: string; category: string;
  variants: { product: Product; color: ColorName | null }[];
}

function groupProducts(products: Product[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  for (const p of products) {
    const parsed = extractColor(p.name);
    const base = parsed ? parsed.base : p.name;
    const color = parsed ? parsed.color : null;
    const key = `${base}__${p.category ?? ''}`;
    if (!map.has(key)) map.set(key, { base, category: p.category ?? '', variants: [] });
    map.get(key)!.variants.push({ product: p, color });
  }
  return Array.from(map.values());
}

function groupBadge(group: ProductGroup) {
  const ps = group.variants.map(v => v.product);
  if (ps.every(p => p.stock_level <= 0)) return <Badge label="Empty" variant="red" />;
  if (ps.some(p => p.stock_level > 0 && p.stock_level <= p.min_stock)) return <Badge label="Low" variant="yellow" />;
  return <Badge label="In Stock" variant="green" />;
}

function stockBadge(p: Product) {
  if (p.stock_level <= 0) return <Badge label="Empty" variant="red" />;
  if (p.stock_level <= p.min_stock) return <Badge label="Low" variant="yellow" />;
  return <Badge label="In Stock" variant="green" />;
}

// ── Timestamp → Date helper ──────────────────────────────────────
function tsToDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: unknown }).toDate === 'function')
    return (v as { toDate: () => Date }).toDate();
  return new Date();
}

// ── Finished goods card ──────────────────────────────────────────
function ProductGroupCard({ group }: { group: ProductGroup }) {
  const images = group.variants.map(v => PRODUCT_IMAGES[v.product.sku]).filter(Boolean) as string[];
  const unique = [...new Set(images)];
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (unique.length < 2) return;
    timerRef.current = setInterval(() => setIdx(i => (i + 1) % unique.length), 2500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [unique.length]);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-50 relative">
        {unique.length > 0 ? (
          <>
            <div className="flex h-full transition-transform duration-500 ease-in-out"
              style={{ width: `${unique.length * 100}%`, transform: `translateX(-${idx * (100 / unique.length)}%)` }}>
              {unique.map((src, i) => (
                <div key={i} className="h-full flex items-center justify-center p-2" style={{ width: `${100 / unique.length}%` }}>
                  <img src={src} alt={group.base} className="w-full h-full object-contain" />
                </div>
              ))}
            </div>
            {unique.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {unique.map((_, i) => (
                  <button key={i} onClick={() => { setIdx(i); if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-slate-600' : 'bg-slate-300'}`} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={32} className="text-slate-200" />
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 leading-snug">{group.base}</p>
        {groupBadge(group)}
      </div>
      {group.category && (
        <span className="self-start text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
          {group.category}
        </span>
      )}
      <div className="space-y-2 mt-1">
        {group.variants.map(({ product: p, color }) => (
          <div key={p.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {color && <span className={`w-3 h-3 rounded-full shrink-0 ${COLOR_DOT[color]}`} />}
              <span className="text-slate-500 font-mono truncate">{p.sku}</span>
              {color && <span className="text-slate-400">{color}</span>}
            </div>
            <span className={`font-semibold tabular-nums ${
              p.stock_level <= 0 ? 'text-red-500' : p.stock_level <= p.min_stock ? 'text-yellow-600' : 'text-slate-700'
            }`}>
              {p.stock_level} <span className="font-normal text-slate-400">{p.unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Raw material card ─────────────────────────────────────────────
function RawMaterialCard({ product, onReceive }: { product: Product; onReceive: () => void }) {
  const empty = product.stock_level <= 0;
  const low   = product.stock_level > 0 && product.stock_level <= product.min_stock;
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {product.category && (
        <span className="self-start text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
          {product.category}
        </span>
      )}
      <div>
        <p className="text-sm font-semibold text-slate-800">{product.name}</p>
        <p className="text-xs font-mono text-slate-400 mt-0.5">{product.sku}</p>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className={`text-3xl font-bold tabular-nums ${empty ? 'text-red-500' : low ? 'text-yellow-600' : 'text-slate-800'}`}>
            {product.stock_level}
          </span>
          <span className="text-sm text-slate-400 ml-1.5">{product.unit}</span>
        </div>
        {stockBadge(product)}
      </div>
      <p className="text-xs text-slate-400 -mt-1">Min: {product.min_stock} {product.unit}</p>
      <button onClick={onReceive}
        className="w-full py-1.5 flex items-center justify-center gap-1.5 border border-blue-200 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors">
        <ArrowDownToLine size={13} /> Receive Supply
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function WarehousePage() {
  const [allProducts, setAllProducts]   = useState<Product[]>([]);
  const [movements, setMovements]       = useState<InventoryMovement[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<'finished' | 'raw'>('finished');
  const [search, setSearch]             = useState('');
  const [category, setCategory]         = useState('All');
  const [rawCategory, setRawCategory]   = useState('All');

  // Add product modal
  const [showModal, setShowModal]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState('');
  const [form, setForm]                 = useState({ name: '', sku: '', category: '', unit: 'pcs', stock_level: '0', min_stock: '10' });

  // Receive supply modal
  const [receiveProduct, setReceiveProduct] = useState<Product | null>(null);
  const [receiveForm, setReceiveForm]       = useState({ qty: '1', note: '' });
  const [receiveSaving, setReceiveSaving]   = useState(false);
  const [receiveError, setReceiveError]     = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([getProducts(), getMovements()])
      .then(([prods, movs]) => { setAllProducts(prods); setMovements(movs); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const finishedProducts = allProducts.filter(p => p.type === 'FINISHED');
  const rawMaterials     = allProducts.filter(p => p.type === 'RAW');

  // ── Finished goods ───────────────────────────────────────────────
  const finCats = ['All', ...sortCategories(Array.from(new Set(finishedProducts.map(p => p.category ?? 'Other'))), FINISHED_CATEGORY_ORDER)];
  const filteredFinished = finishedProducts.filter(p => {
    const matchCat = category === 'All' || (p.category ?? 'Other') === category;
    const q = search.toLowerCase();
    return matchCat && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  });
  const groups = groupProducts(filteredFinished).sort((a, b) => {
    const ao = Math.min(...a.variants.map(v => v.product.sort_order ?? 999));
    const bo = Math.min(...b.variants.map(v => v.product.sort_order ?? 999));
    return ao - bo;
  });

  // ── Raw materials ────────────────────────────────────────────────
  const rawCats = ['All', ...sortCategories(Array.from(new Set(rawMaterials.map(p => p.category ?? 'Other'))), RAW_CATEGORY_ORDER)];
  const filteredRaw = rawMaterials.filter(p => {
    const matchCat = rawCategory === 'All' || (p.category ?? 'Other') === rawCategory;
    const q = search.toLowerCase();
    return matchCat && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  });

  // Group raw materials by category for sectioned display
  const rawGrouped = sortCategories(
    Array.from(new Set(filteredRaw.map(p => p.category ?? 'Other'))),
    RAW_CATEGORY_ORDER
  ).map(cat => ({ cat, items: filteredRaw.filter(p => (p.category ?? 'Other') === cat) }));

  // Supply receipt history (PURCHASE movements for raw materials)
  const rawIds = new Set(rawMaterials.map(p => p.id));
  const purchaseHistory = movements
    .filter(m => m.reason === 'PURCHASE' && rawIds.has(m.productId))
    .sort((a, b) => tsToDate(b.createdAt).getTime() - tsToDate(a.createdAt).getTime())
    .slice(0, 30);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleAddProduct = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await addProduct({
        name: form.name, sku: form.sku,
        type: (tab === 'raw' ? 'RAW' : 'FINISHED') as ProductType,
        category: form.category || undefined,
        unit: form.unit,
        stock_level: Number(form.stock_level),
        min_stock: Number(form.min_stock),
        cost: 0,
      });
      setShowModal(false);
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

  const empty = finishedProducts.filter(p => p.stock_level <= 0).length;
  const low   = finishedProducts.filter(p => p.stock_level > 0 && p.stock_level <= p.min_stock).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Warehouse</h1>
          <p className="text-slate-500 text-sm mt-1">
            {tab === 'finished'
              ? `${finishedProducts.length} references · ${groups.length} products · ${empty} empty · ${low} low stock`
              : `${rawMaterials.length} material${rawMaterials.length !== 1 ? 's' : ''} · ${rawCats.length - 1} categories`}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> {tab === 'raw' ? 'Add Raw Material' : 'New Product'}
        </button>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {([['finished', Package, 'Finished Goods'], ['raw', FlaskConical, 'Raw Materials']] as const).map(([t, Icon, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search by name or reference…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" />
      </div>

      {/* ── Finished Goods ──────────────────────────────────────────── */}
      {tab === 'finished' && (
        <>
          <div className="flex flex-wrap gap-2">
            {finCats.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  category === cat ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                {cat}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="text-center text-slate-400 py-20 text-sm">Loading…</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-20">
              <Package size={44} className="mx-auto mb-3 text-slate-200" />
              <p className="text-slate-400 text-sm">No products found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {groups.map(g => <ProductGroupCard key={g.base + g.category} group={g} />)}
            </div>
          )}
        </>
      )}

      {/* ── Raw Materials ────────────────────────────────────────────── */}
      {tab === 'raw' && (
        loading ? (
          <div className="text-center text-slate-400 py-20 text-sm">Loading…</div>
        ) : (
          <>
            {/* Category filter */}
            {rawMaterials.length > 0 && (
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
            )}

            {filteredRaw.length === 0 ? (
              <div className="text-center py-20">
                <FlaskConical size={44} className="mx-auto mb-3 text-slate-200" />
                <p className="text-slate-400 text-sm font-medium">No raw materials yet.</p>
                <p className="text-slate-400 text-xs mt-1">Add materials here, then build BOM recipes.</p>
              </div>
            ) : (
              <>
                {/* Cards grouped by category */}
                {rawGrouped.map(({ cat, items }) => (
                  <div key={cat}>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{cat}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {items.map(p => (
                        <RawMaterialCard key={p.id} product={p} onReceive={() => setReceiveProduct(p)} />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Supply receipt history */}
                {purchaseHistory.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                      <ArrowDownToLine size={15} className="text-slate-400" />
                      <h2 className="text-sm font-semibold text-slate-700">Supply Receipt History</h2>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Material</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty Received</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {purchaseHistory.map(m => {
                          const prod = allProducts.find(p => p.id === m.productId);
                          const d = tsToDate(m.createdAt);
                          return (
                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-sm text-slate-500 tabular-nums whitespace-nowrap">
                                {d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-slate-800">{prod?.name ?? m.productId}</td>
                              <td className="px-4 py-3 text-sm font-semibold tabular-nums text-right text-green-600">
                                +{m.quantity} {prod?.unit ?? ''}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-400">{m.note ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )
      )}

      {/* ── Add Product / Material Modal ─────────────────────────────── */}
      {showModal && (
        <Modal title={tab === 'raw' ? 'Add Raw Material' : 'New Finished Product'} onClose={() => { setShowModal(false); setFormError(''); }}>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {tab === 'raw' ? 'Material Name' : 'Product Name'}
              </label>
              <input type="text" value={form.name} required
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={tab === 'raw' ? 'e.g. Aluminium Disc 20cm' : 'e.g. Frypan 28cm — Granite Black'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SKU / Ref</label>
                <input type="text" value={form.sku} required
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder={tab === 'raw' ? 'e.g. RM-AL-20' : ''}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                <input type="text" value={form.unit} required
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              {tab === 'raw' ? (
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select category…</option>
                  {RAW_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input type="text" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Frypans, Sets & Packs…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Initial Stock</label>
                <input type="number" min="0" value={form.stock_level} required
                  onChange={e => setForm(f => ({ ...f, stock_level: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock</label>
                <input type="number" min="0" value={form.min_stock} required
                  onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {formError && <p className="text-red-600 text-sm">{formError}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : tab === 'raw' ? 'Add Material' : 'Add Product'}
              </button>
              <button type="button" onClick={() => { setShowModal(false); setFormError(''); }}
                className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Receive Supply Modal ─────────────────────────────────────── */}
      {receiveProduct && (
        <Modal title="Receive Supply" onClose={() => { setReceiveProduct(null); setReceiveError(''); }}>
          <form onSubmit={handleReceive} className="space-y-4">
            <div className="bg-slate-50 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Material</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{receiveProduct.name}</p>
              <p className="text-xs font-mono text-slate-400">{receiveProduct.sku}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity Received</label>
              <div className="flex items-center gap-2">
                <input type="number" min="1" step="any" value={receiveForm.qty} required
                  onChange={e => setReceiveForm(f => ({ ...f, qty: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-sm text-slate-400 shrink-0">{receiveProduct.unit}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Note / Supplier <span className="text-slate-400 font-normal">(optional)</span></label>
              <input type="text" value={receiveForm.note}
                onChange={e => setReceiveForm(f => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Supplier name, invoice #…"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
