import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { getSales, addSale } from '@/services/sales.service';
import { getProducts } from '@/services/inventory.service';
import Modal from '@/components/ui/Modal';
import type { Sale, Product } from '@/types';

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ productId: '', quantity: '', client: '', totalAmount: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([getSales(), getProducts()])
      .then(([s, p]) => { setSales(s); setProducts(p.filter(p => p.type === 'FINISHED')); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await addSale({
        productId: form.productId,
        quantity: Number(form.quantity),
        client: form.client,
        date: new Date(),
        totalAmount: Number(form.totalAmount),
      });
      setShowModal(false);
      setForm({ productId: '', quantity: '', client: '', totalAmount: '' });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to record sale');
    } finally {
      setSaving(false);
    }
  };

  const totalRevenue = sales.reduce((s, sale) => s + (sale.totalAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales</h1>
          <p className="text-slate-500 text-sm mt-1">
            {sales.length} sales · Total: ${totalRevenue.toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          New Sale
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product ID</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sales.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{s.client}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 font-mono">{s.productId}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-right">{s.quantity}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">${s.totalAmount?.toLocaleString()}</td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">No sales recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal title="Record Sale" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
              <select
                value={form.productId}
                onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select product...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock_level})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount ($)</label>
                <input type="number" min="0" value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
              <input type="text" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Record Sale'}
              </button>
              <button type="button" onClick={() => setShowModal(false)}
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
