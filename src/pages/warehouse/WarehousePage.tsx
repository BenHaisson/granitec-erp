import { useEffect, useState, useRef, type FormEvent } from 'react';
import { Plus, Search, Package, ImageOff, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { getProducts, addProduct, updateProduct, deleteProduct } from '@/services/inventory.service';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import type { Product, ProductType } from '@/types';

import { PRODUCT_IMAGES } from '@/constants/productImages';

// ── Category order ───────────────────────────────────────────────
const FINISHED_CATEGORY_ORDER = [
  'Sets & Packs', 'Marmite', 'Crepe & Specialty', 'Frypans', 'Saucepots', 'Cake & Molds',
];

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

// ── Product card ─────────────────────────────────────────────────
function ProductGroupCard({ group, onEdit, onDelete }: {
  group: ProductGroup;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
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
            <div className="flex items-center gap-1.5">
              <span className={`font-semibold tabular-nums ${
                p.stock_level <= 0 ? 'text-red-500' : p.stock_level <= p.min_stock ? 'text-yellow-600' : 'text-slate-700'
              }`}>
                {p.stock_level} <span className="font-normal text-slate-400">{p.unit}</span>
              </span>
              <button onClick={() => onEdit(p)} title="Edit"
                className="p-0.5 rounded text-slate-300 hover:text-blue-500 transition-colors">
                <Pencil size={10} />
              </button>
              <button onClick={() => onDelete(p)} title="Delete"
                className="p-0.5 rounded text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function WarehousePage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [category, setCategory]       = useState('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'hide-zero' | 'zero-only' | 'alarm'>('all');

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm]           = useState({ name: '', sku: '', category: '', unit: 'pcs', stock_level: '0', min_stock: '10' });

  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm]       = useState({ name: '', sku: '', category: '', unit: 'pcs', min_stock: '10' });
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState('');

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({ name: p.name, sku: p.sku, category: p.category ?? '', unit: p.unit, min_stock: String(p.min_stock) });
    setEditError('');
  };

  const handleEditProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setEditError(''); setEditSaving(true);
    try {
      await updateProduct(editProduct.id, {
        name: editForm.name, sku: editForm.sku,
        category: editForm.category || undefined,
        unit: editForm.unit, min_stock: Number(editForm.min_stock),
      });
      setEditProduct(null);
      load();
    } catch { setEditError('Failed to save.'); }
    finally { setEditSaving(false); }
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await deleteProduct(p.id);
    load();
  };

  const load = () => {
    setLoading(true);
    getProducts().then(setAllProducts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const finishedProducts = allProducts.filter(p => p.type === 'FINISHED');

  const finCats = ['All', ...sortCategories(Array.from(new Set(finishedProducts.map(p => p.category ?? 'Other'))), FINISHED_CATEGORY_ORDER)];
  const filteredFinished = finishedProducts.filter(p => {
    const matchCat = category === 'All' || (p.category ?? 'Other') === category;
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    const matchStock =
      stockFilter === 'hide-zero' ? p.stock_level > 0 :
      stockFilter === 'zero-only' ? p.stock_level <= 0 :
      stockFilter === 'alarm'     ? p.stock_level <= p.min_stock :
      true;
    return matchCat && matchSearch && matchStock;
  });
  const groups = groupProducts(filteredFinished).sort((a, b) => {
    const ao = Math.min(...a.variants.map(v => v.product.sort_order ?? 999));
    const bo = Math.min(...b.variants.map(v => v.product.sort_order ?? 999));
    return ao - bo;
  });

  const empty     = finishedProducts.filter(p => p.stock_level <= 0).length;
  const low       = finishedProducts.filter(p => p.stock_level > 0 && p.stock_level <= p.min_stock).length;
  const alarmCount = finishedProducts.filter(p => p.stock_level <= p.min_stock).length;

  const handleAddProduct = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await addProduct({
        name: form.name, sku: form.sku,
        type: 'FINISHED' as ProductType,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Warehouse</h1>
          <p className="text-slate-500 text-sm mt-1">
            {finishedProducts.length} references · {groups.length} products · {empty} empty · {low} low stock
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> New Product
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search by name or reference…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" />
      </div>

      {/* Stock filter */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'hide-zero', 'zero-only', 'alarm'] as const).map(key => {
          const labels = { all: 'All Stock', 'hide-zero': 'Hide Zero', 'zero-only': 'Zero Only', alarm: `Alarm${alarmCount > 0 ? ` (${alarmCount})` : ''}` };
          const isActive = stockFilter === key;
          const isAlarm = key === 'alarm';
          return (
            <button key={key} onClick={() => setStockFilter(key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive && isAlarm ? 'bg-red-600 text-white shadow-sm' :
                isActive ? 'bg-blue-600 text-white shadow-sm' :
                isAlarm && alarmCount > 0 ? 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100' :
                'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {isAlarm && <AlertTriangle size={10} />}
              {labels[key]}
            </button>
          );
        })}
      </div>

      {/* Category filter */}
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

      {/* Product grid */}
      {loading ? (
        <div className="text-center text-slate-400 py-20 text-sm">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20">
          <Package size={44} className="mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 text-sm">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {groups.map(g => <ProductGroupCard key={g.base + g.category} group={g} onEdit={openEdit} onDelete={handleDeleteProduct} />)}
        </div>
      )}

      {/* Add Product Modal */}
      {showModal && (
        <Modal title="New Finished Product" onClose={() => { setShowModal(false); setFormError(''); }}>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
              <input type="text" value={form.name} required
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Frypan 28cm — Granite Black"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SKU / Ref</label>
                <input type="text" value={form.sku} required
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
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
              <input type="text" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Frypans, Sets & Packs…"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                {saving ? 'Saving…' : 'Add Product'}
              </button>
              <button type="button" onClick={() => { setShowModal(false); setFormError(''); }}
                className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Product Modal */}
      {editProduct && (
        <Modal title="Edit Product" onClose={() => setEditProduct(null)}>
          <form onSubmit={handleEditProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
              <input type="text" value={editForm.name} required
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
                <input type="text" value={editForm.sku} required
                  onChange={e => setEditForm(f => ({ ...f, sku: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                <input type="text" value={editForm.unit} required
                  onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input type="text" value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock</label>
                <input type="number" min="0" value={editForm.min_stock} required
                  onChange={e => setEditForm(f => ({ ...f, min_stock: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {editError && <p className="text-red-600 text-sm">{editError}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={editSaving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
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
    </div>
  );
}
