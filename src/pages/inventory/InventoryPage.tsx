import { useEffect, useState, type FormEvent } from 'react';
import { Plus, FlaskConical, ArrowDownToLine } from 'lucide-react';
import { getProducts, addProduct, adjustStock, getMovements } from '@/services/inventory.service';
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
        className="w-full py-1.5 flex items-center justify-center gap-1.5 border border-indigo-200 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-50 transition-colors">
        <ArrowDownToLine size={13} /> Receive Supply
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function InventoryPage() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading]     = useState(true);
  const [rawCategory, setRawCategory] = useState('All');

  // Add material modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState('');
  const [form, setForm]                 = useState<{
    name: string; sku: string; category: RawCategory | ''; unit: string; stock_level: string; min_stock: string;
  }>({ name: '', sku: '', category: '', unit: 'pcs', stock_level: '0', min_stock: '10' });

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

  const filteredRaw = rawCategory === 'All'
    ? rawMaterials
    : rawMaterials.filter(p => (p.category ?? 'Other') === rawCategory);

  const rawGrouped = sortCategories(
    Array.from(new Set(filteredRaw.map(p => p.category ?? 'Other'))),
    RAW_CATEGORY_ORDER
  ).map(cat => ({ cat, items: filteredRaw.filter(p => (p.category ?? 'Other') === cat) }));

  const rawIds = new Set(rawMaterials.map(p => p.id));
  const purchaseHistory = movements
    .filter(m => m.reason === 'PURCHASE' && rawIds.has(m.productId))
    .sort((a, b) => tsToDate(b.createdAt).getTime() - tsToDate(a.createdAt).getTime())
    .slice(0, 30);

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
            rawGrouped.map(({ cat, items }) => (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{cat}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map(p => (
                    <RawMaterialCard key={p.id} product={p} onReceive={() => setReceiveProduct(p)} />
                  ))}
                </div>
              </div>
            ))
          )}

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
                    const prod = products.find(p => p.id === m.productId);
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
