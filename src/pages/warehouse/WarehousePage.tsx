import { useEffect, useState, useRef, type FormEvent } from 'react';
import { Plus, Search, Package, ImageOff, FlaskConical } from 'lucide-react';
import { getProducts, addProduct } from '@/services/inventory.service';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import type { Product, ProductType } from '@/types';

// ── Product image map (SKU → public/products/<sku>.<ext>) ────────
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

// ── Category order ───────────────────────────────────────────────
const CATEGORY_ORDER = [
  'Sets & Packs',
  'Marmite',
  'Crepe & Specialty',
  'Frypans',
  'Saucepots',
  'Cake & Molds',
];

function sortCategories(cats: string[]): string[] {
  return [...cats].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// ── Color helpers ────────────────────────────────────────────────
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

// ── Group products by base name ───────────────────────────────────
interface ProductGroup {
  base: string;
  category: string;
  variants: { product: Product; color: ColorName | null }[];
}

function groupProducts(products: Product[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  for (const p of products) {
    const parsed = extractColor(p.name);
    const base = parsed ? parsed.base : p.name;
    const color = parsed ? parsed.color : null;
    const key = `${base}__${p.category ?? ''}`;
    if (!map.has(key)) {
      map.set(key, { base, category: p.category ?? '', variants: [] });
    }
    map.get(key)!.variants.push({ product: p, color });
  }
  return Array.from(map.values());
}

// ── Stock badge for a group ───────────────────────────────────────
function groupBadge(group: ProductGroup) {
  const products = group.variants.map(v => v.product);
  const allEmpty = products.every(p => p.stock_level <= 0);
  const anyLow = products.some(p => p.stock_level > 0 && p.stock_level <= p.min_stock);
  if (allEmpty) return <Badge label="Empty" variant="red" />;
  if (anyLow)   return <Badge label="Low"   variant="yellow" />;
  return             <Badge label="In Stock" variant="green" />;
}

function stockBadge(p: Product) {
  if (p.stock_level <= 0) return <Badge label="Empty" variant="red" />;
  if (p.stock_level <= p.min_stock) return <Badge label="Low" variant="yellow" />;
  return <Badge label="In Stock" variant="green" />;
}

// ── Product group card with image carousel ────────────────────────
function ProductGroupCard({ group }: { group: ProductGroup }) {
  const images = group.variants
    .map(v => PRODUCT_IMAGES[v.product.sku])
    .filter((url): url is string => Boolean(url));
  const unique = [...new Set(images)];

  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (unique.length < 2) return;
    timerRef.current = setInterval(() => {
      setIdx(i => (i + 1) % unique.length);
    }, 2500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [unique.length]);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">

      {/* Image carousel */}
      <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-50 relative">
        {unique.length > 0 ? (
          <>
            <div
              className="flex h-full transition-transform duration-500 ease-in-out"
              style={{ width: `${unique.length * 100}%`, transform: `translateX(-${idx * (100 / unique.length)}%)` }}
            >
              {unique.map((src, i) => (
                <div key={i} className="h-full flex items-center justify-center p-2"
                  style={{ width: `${100 / unique.length}%` }}>
                  <img src={src} alt={group.base} className="w-full h-full object-contain" />
                </div>
              ))}
            </div>
            {unique.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {unique.map((_, i) => (
                  <button key={i} onClick={() => {
                    setIdx(i);
                    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
                  }}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-slate-600' : 'bg-slate-300'}`}
                  />
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

      {/* Title + badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 leading-snug">{group.base}</p>
        {groupBadge(group)}
      </div>

      {/* Category tag */}
      {group.category && (
        <span className="self-start text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
          {group.category}
        </span>
      )}

      {/* Color variants */}
      <div className="space-y-2 mt-1">
        {group.variants.map(({ product: p, color }) => (
          <div key={p.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {color && (
                <span className={`w-3 h-3 rounded-full shrink-0 ${COLOR_DOT[color]}`} />
              )}
              <span className="text-slate-500 font-mono truncate">{p.sku}</span>
              {color && <span className="text-slate-400">{color}</span>}
            </div>
            <span className={`font-semibold tabular-nums ${
              p.stock_level <= 0 ? 'text-red-500' :
              p.stock_level <= p.min_stock ? 'text-yellow-600' : 'text-slate-700'
            }`}>
              {p.stock_level} <span className="font-normal text-slate-400">{p.unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WarehousePage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'finished' | 'raw'>('finished');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', sku: '', category: '', unit: 'pcs',
    stock_level: '0', min_stock: '10',
  });

  const load = () => {
    setLoading(true);
    getProducts()
      .then(setAllProducts)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const finishedProducts = allProducts.filter(p => p.type === 'FINISHED');
  const rawMaterials     = allProducts.filter(p => p.type === 'RAW');

  // ── Finished goods logic ─────────────────────────────────────────
  const categories = ['All', ...sortCategories(Array.from(new Set(finishedProducts.map(p => p.category ?? 'Other'))))];

  const filteredFinished = finishedProducts.filter(p => {
    const matchCat = category === 'All' || (p.category ?? 'Other') === category;
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const groups = groupProducts(filteredFinished).sort((a, b) => {
    const ao = Math.min(...a.variants.map(v => v.product.sort_order ?? 999));
    const bo = Math.min(...b.variants.map(v => v.product.sort_order ?? 999));
    return ao - bo;
  });

  // ── Raw materials logic ──────────────────────────────────────────
  const filteredRaw = rawMaterials.filter(p => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
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
    } catch {
      setError('Failed to add product');
    } finally {
      setSaving(false);
    }
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
              : `${rawMaterials.length} raw material${rawMaterials.length !== 1 ? 's' : ''} defined`
            }
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> {tab === 'raw' ? 'Add Raw Material' : 'New Product'}
        </button>
      </div>

      {/* Top-level tab strip */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button onClick={() => setTab('finished')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'finished' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Package size={15} /> Finished Goods
        </button>
        <button onClick={() => setTab('raw')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'raw' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <FlaskConical size={15} /> Raw Materials
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search by name or reference..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" />
      </div>

      {/* ── Finished Goods view ─────────────────────────────────────── */}
      {tab === 'finished' && (
        <>
          {/* Category tabs */}
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  category === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Cards */}
          {loading ? (
            <div className="text-center text-slate-400 py-20 text-sm">Loading...</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-20">
              <Package size={44} className="mx-auto mb-3 text-slate-200" />
              <p className="text-slate-400 text-sm">No products found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {groups.map(group => (
                <div key={group.base + group.category}>
                  <ProductGroupCard group={group} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Raw Materials view ──────────────────────────────────────── */}
      {tab === 'raw' && (
        loading ? (
          <div className="text-center text-slate-400 py-20 text-sm">Loading...</div>
        ) : filteredRaw.length === 0 ? (
          <div className="text-center py-20">
            <FlaskConical size={44} className="mx-auto mb-3 text-slate-200" />
            <p className="text-slate-400 text-sm font-medium">No raw materials yet.</p>
            <p className="text-slate-400 text-xs mt-1">Add raw materials to use them in BOM recipes.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Min</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredRaw.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-500">{p.sku}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{p.unit}</td>
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums text-right text-slate-700">{p.stock_level}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-right text-slate-400">{p.min_stock}</td>
                    <td className="px-4 py-3 text-right">{stockBadge(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Add Product / Raw Material Modal */}
      {showModal && (
        <Modal
          title={tab === 'raw' ? 'Add Raw Material' : 'New Finished Product'}
          onClose={() => { setShowModal(false); setError(''); }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {tab === 'raw' ? 'Material Name' : 'Product Name'}
              </label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={tab === 'raw' ? 'e.g. Aluminum Disc 20cm' : 'e.g. Frypan 28cm — Granite Black'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference (SKU)</label>
                <input type="text" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder={tab === 'raw' ? 'e.g. RM-AL-20' : ''}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
            </div>
            {tab === 'finished' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input type="text" placeholder="e.g. Frypans, Sets & Packs..." value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Initial Stock</label>
                <input type="number" min="0" value={form.stock_level} onChange={e => setForm(f => ({ ...f, stock_level: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock</label>
                <input type="number" min="0" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : tab === 'raw' ? 'Add Material' : 'Add Product'}
              </button>
              <button type="button" onClick={() => { setShowModal(false); setError(''); }}
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
