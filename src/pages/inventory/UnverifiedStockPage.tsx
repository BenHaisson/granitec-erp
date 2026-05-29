import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, X, Plus, Trash2 } from 'lucide-react';
import { getProducts, getMovements, clearAllUnverifiedStock } from '@/services/inventory.service';
import { createShippingOrder } from '@/services/shipping.service';
import type { Product, InventoryMovement } from '@/types';

function todayISO() { return new Date().toISOString().slice(0, 10); }

function fmtDate(v: unknown): string {
  try {
    let d: Date;
    if (v instanceof Date) d = v;
    else if (v && typeof (v as { toDate?: unknown }).toDate === 'function') d = (v as { toDate: () => Date }).toDate();
    else d = new Date(v as string);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
}

interface VerifyLine {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  qty: string;
}

export default function UnverifiedStockPage() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading]     = useState(true);
  const [clearing, setClearing]   = useState(false);

  // Verify overlay
  const [showVerify, setShowVerify] = useState(false);
  const [verifyRef, setVerifyRef]   = useState('');
  const [verifySupplier, setVerifySupplier] = useState('');
  const [verifyDate, setVerifyDate] = useState(todayISO());
  const [verifyLines, setVerifyLines] = useState<VerifyLine[]>([]);
  const [verifying, setVerifying]   = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [prods, movs] = await Promise.all([getProducts(), getMovements()]);
      setProducts(prods);
      const relevant = movs
        .filter(m => {
          const note = (m.note ?? '') as string;
          return (
            (m.reason === 'ADJUSTMENT' && note.startsWith('Unverified:')) ||
            (m.reason === 'PRODUCTION' && note.includes('(incl. unverified stock)')) ||
            (m.reason === 'ADJUSTMENT' && note.startsWith('Reconciled unverified:'))
          );
        })
        .sort((a, b) => {
          const ta = a.createdAt instanceof Date ? a.createdAt : (a.createdAt as { toDate: () => Date }).toDate();
          const tb = b.createdAt instanceof Date ? b.createdAt : (b.createdAt as { toDate: () => Date }).toDate();
          return tb.getTime() - ta.getTime();
        });
      setMovements(relevant);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const unverifiedProducts = products.filter(p => (p.unverified_stock ?? 0) > 0);
  const productMap = new Map(products.map(p => [p.id, p]));

  const openVerify = () => {
    setVerifyLines(
      unverifiedProducts.map(p => ({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        unit: p.unit,
        qty: String(p.unverified_stock ?? 0),
      }))
    );
    setVerifyRef('');
    setVerifySupplier('');
    setVerifyDate(todayISO());
    setVerifyError('');
    setShowVerify(true);
  };

  const handleClearAll = async () => {
    const count = unverifiedProducts.length;
    if (!confirm(`Zero out unverified stock for ${count} product(s)? History will be preserved.`)) return;
    setClearing(true);
    try { await clearAllUnverifiedStock(); await load(); }
    finally { setClearing(false); }
  };

  const handleVerifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validLines = verifyLines.filter(l => Number(l.qty) > 0);
    if (!verifyRef.trim()) { setVerifyError('Reference is required.'); return; }
    if (validLines.length === 0) { setVerifyError('At least one line with qty > 0 required.'); return; }
    setVerifyError(''); setVerifying(true);
    try {
      await createShippingOrder({
        ref: verifyRef.trim(),
        supplier: verifySupplier.trim() || undefined,
        date: verifyDate,
        verification: true,
        lines: validLines.map(l => ({
          productId: l.productId,
          productName: l.productName,
          sku: l.sku,
          qty: Number(l.qty),
          reconcile: true,
        })),
      });
      setShowVerify(false);
      await load();
    } catch (err) {
      setVerifyError(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setVerifying(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <AlertCircle size={22} className="text-amber-500" /> Unverified Stock
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Materials used in production without a matching supply receipt
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>
      ) : (
        <>
          {/* Current Unverified Stock */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-amber-200 flex items-center gap-3">
              <span className="text-amber-600 font-bold">⚠</span>
              <h2 className="text-sm font-semibold text-amber-800">Current Unverified Stock</h2>
              <span className="text-xs text-amber-600">
                {unverifiedProducts.length} product{unverifiedProducts.length !== 1 ? 's' : ''}
              </span>
              {unverifiedProducts.length > 0 && (
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="ml-auto px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-300 bg-white rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {clearing ? 'Clearing…' : 'Clear All'}
                </button>
              )}
            </div>
            {unverifiedProducts.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-sm text-slate-500">All stock is verified</p>
              </div>
            ) : (
              <div className="divide-y divide-amber-100">
                {unverifiedProducts.map(p => (
                  <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{p.name}</p>
                      <p className="text-xs font-mono text-slate-400">{p.sku}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold tabular-nums">
                      {p.unverified_stock} {p.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Full Lifecycle History */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-700">Full Lifecycle History</h2>
              <span className="text-xs text-slate-400">{movements.length} event{movements.length !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">Created</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">Used in Production</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">Reconciled</span>
              </div>
              <button
                onClick={openVerify}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors"
              >
                <CheckCircle2 size={14} /> Verify Stock
              </button>
            </div>
            {movements.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">No unverified stock history</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Date', 'Type', 'Product', 'SKU', 'Qty', 'Context'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {movements.map(m => {
                    const prod = productMap.get(m.productId);
                    const rawNote = (m.note ?? '') as string;
                    const type = m.reason === 'PRODUCTION' ? 'used'
                      : rawNote.startsWith('Reconciled unverified:') ? 'reconciled'
                      : 'created';
                    const note = rawNote
                      .replace(/^Unverified:\s*/, '')
                      .replace(/^Reconciled unverified:\s*/, '');
                    const TYPE_BADGE = {
                      created:    'bg-amber-100 text-amber-700',
                      used:       'bg-blue-100 text-blue-700',
                      reconciled: 'bg-emerald-100 text-emerald-700',
                    };
                    const TYPE_LABEL = { created: 'Created', used: 'Used in Production', reconciled: 'Reconciled' };
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TYPE_BADGE[type]}`}>
                            {TYPE_LABEL[type]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[140px] truncate">{prod?.name ?? m.productId}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{prod?.sku ?? '—'}</td>
                        <td className={`px-4 py-2.5 font-bold tabular-nums ${type === 'created' ? 'text-amber-700' : 'text-slate-500'}`}>
                          {type === 'created' ? '+' : '−'}{Math.abs(m.quantity)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[180px] truncate">{note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Verify Stock Overlay */}
      {showVerify && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 px-4 pb-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            {/* Overlay header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Verify Stock</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Create a verification document for unverified materials
                </p>
              </div>
              <button onClick={() => setShowVerify(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifySubmit} className="p-6 space-y-5">
              {/* Ref + Supplier + Date */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Reference <span className="text-red-500">*</span></label>
                  <input type="text" value={verifyRef} onChange={e => setVerifyRef(e.target.value)}
                    placeholder="VRF-2024-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Supplier</label>
                  <input type="text" value={verifySupplier} onChange={e => setVerifySupplier(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                  <input type="date" value={verifyDate} onChange={e => setVerifyDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>

              {/* Lines table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600">Materials to Verify</label>
                  <button type="button"
                    onClick={() => setVerifyLines(ls => [...ls, { productId: '', productName: '', sku: '', unit: '', qty: '' }])}
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700">
                    <Plus size={12} /> Add row
                  </button>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Product</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-24">SKU</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-28">Qty</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {verifyLines.map((line, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">
                            <select
                              value={line.productId}
                              onChange={e => {
                                const p = products.find(p => p.id === e.target.value);
                                setVerifyLines(ls => ls.map((l, j) => j !== i ? l : {
                                  ...l,
                                  productId: e.target.value,
                                  productName: p?.name ?? '',
                                  sku: p?.sku ?? '',
                                  unit: p?.unit ?? '',
                                  qty: l.qty || String(p?.unverified_stock ?? ''),
                                }));
                              }}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                            >
                              <option value="">Select material…</option>
                              {products.filter(p => p.type === 'RAW').map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-mono text-xs text-slate-400">{line.sku || '—'}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <input type="number" min="0" value={line.qty}
                                onChange={e => setVerifyLines(ls => ls.map((l, j) => j !== i ? l : { ...l, qty: e.target.value }))}
                                className="w-20 px-2 py-1.5 border border-slate-200 rounded text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400" />
                              <span className="text-xs text-slate-400">{line.unit}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => setVerifyLines(ls => ls.filter((_, j) => j !== i))}
                              className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {verifyLines.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-400 text-sm">
                            No lines — add materials above
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {verifyError && <p className="text-red-600 text-sm">{verifyError}</p>}

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={verifying}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
                  {verifying ? 'Creating…' : 'Create Verification Order'}
                </button>
                <button type="button" onClick={() => setShowVerify(false)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
