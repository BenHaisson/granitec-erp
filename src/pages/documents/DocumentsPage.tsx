import { useEffect, useRef, useState } from 'react';
import {
  FileText, Plus, Trash2, Pencil, X, AlertCircle, Search,
  Upload, ExternalLink, ChevronDown, CheckCircle2, Receipt,
  Cpu, Wrench, BookOpen, Tag, ChevronRight, Eye, Package,
  FileCheck, FileClock,
} from 'lucide-react';
import {
  getInvoices, createInvoice, updateInvoice, deleteInvoice, uploadInvoiceDocument,
  getMachineDocs, createMachineDoc, updateMachineDoc, deleteMachineDoc,
} from '@/services/documents.service';
import { getShippingOrders } from '@/services/shipping.service';
import { getMachines } from '@/services/library.service';
import type { Invoice, MachineDoc, ShippingOrder, Machine } from '@/types';

const toDate = (d: unknown): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (typeof d === 'object' && 'toDate' in (d as object)) return (d as { toDate: () => Date }).toDate();
  return new Date();
};

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Extract all BL numbers from a shipping order's receipts ───────
function getOrderBLs(order: ShippingOrder): string[] {
  const bls: string[] = [];
  if (order.blNumber) bls.push(order.blNumber);
  for (const r of order.receipts ?? []) {
    if (r.blNumber && !bls.includes(r.blNumber)) bls.push(r.blNumber);
  }
  return bls;
}

// ══════════════════════════════════════════════════════════════════
// INVOICES TAB
// ══════════════════════════════════════════════════════════════════

// ── Invoice Form Modal ────────────────────────────────────────────
interface InvoiceModalProps {
  invoice?: Invoice | null;
  orders: ShippingOrder[];
  prefillOrderId?: string;
  prefillBL?: string;
  onSave: (data: Omit<Invoice, 'id' | 'createdAt'>, file: File | null) => Promise<void>;
  onClose: () => void;
}
function InvoiceModal({ invoice, orders, prefillOrderId, prefillBL, onSave, onClose }: InvoiceModalProps) {
  const initOrderId = invoice?.shippingOrderId ?? prefillOrderId ?? '';
  const initOrder = orders.find(o => o.id === initOrderId);
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber ?? '');
  const [selectedOrderId, setSelectedOrderId]   = useState(initOrderId);
  const [selectedOrderRef, setSelectedOrderRef] = useState(invoice?.shippingOrderRef ?? initOrder?.ref ?? '');
  const [supplier, setSupplier] = useState(invoice?.supplier ?? initOrder?.supplier ?? '');
  const initBLs = invoice?.blNumbers ?? (prefillBL ? [prefillBL] : (initOrder ? getOrderBLs(initOrder) : []));
  const [blNumbers, setBlNumbers]   = useState<string[]>(initBLs);
  const [blInput, setBlInput]       = useState('');
  const [amount, setAmount]         = useState(invoice?.amount ? String(invoice.amount) : '');
  const [currency, setCurrency]     = useState(invoice?.currency ?? 'MAD');
  const [date, setDate]             = useState(invoice?.date ?? new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks]       = useState(invoice?.remarks ?? '');
  const [file, setFile]             = useState<File | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);
  const orderBLs = selectedOrder ? getOrderBLs(selectedOrder) : [];

  const handleOrderSelect = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    setSelectedOrderId(orderId);
    setSelectedOrderRef(order?.ref ?? '');
    setSupplier(order?.supplier ?? '');
    // Auto-populate BL numbers from order's receipts
    if (order) {
      const bls = getOrderBLs(order);
      setBlNumbers(bls);
    }
  };

  const addBL = () => {
    const v = blInput.trim();
    if (v && !blNumbers.includes(v)) setBlNumbers(b => [...b, v]);
    setBlInput('');
  };

  const removeBL = (bl: string) => setBlNumbers(b => b.filter(x => x !== bl));

  const toggleOrderBL = (bl: string) => {
    setBlNumbers(prev => prev.includes(bl) ? prev.filter(x => x !== bl) : [...prev, bl]);
  };

  const handleSave = async () => {
    if (!invoiceNumber.trim()) { setError('Invoice number is required.'); return; }
    if (!selectedOrderId)      { setError('Select a shipping order.'); return; }
    if (!date)                 { setError('Date is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        invoiceNumber: invoiceNumber.trim(),
        shippingOrderId: selectedOrderId,
        shippingOrderRef: selectedOrderRef,
        supplier: supplier.trim() || undefined,
        blNumbers,
        amount: amount ? Number(amount) : undefined,
        currency,
        date,
        remarks: remarks.trim() || undefined,
        documentUrl: invoice?.documentUrl,
        documentName: invoice?.documentName,
      }, file);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-indigo-500" />
            <h2 className="font-bold text-slate-800">{invoice ? 'Edit Invoice' : 'Add Invoice'}</h2>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Invoice # + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Invoice Number *</label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2024-001" autoFocus
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
            </div>
          </div>

          {/* Shipping Order */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Shipping Order *</label>
            <select value={selectedOrderId} onChange={e => handleOrderSelect(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white">
              <option value="">— Select a shipping order —</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.ref}{o.supplier ? ` · ${o.supplier}` : ''} · {o.date}
                </option>
              ))}
            </select>
          </div>

          {/* BL Numbers */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">BL Numbers</label>

            {/* BL suggestions from order receipts */}
            {orderBLs.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest self-center mr-1">From order:</span>
                {orderBLs.map(bl => (
                  <button key={bl} type="button" onClick={() => toggleOrderBL(bl)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all border ${
                      blNumbers.includes(bl)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                    }`}>
                    {bl}
                  </button>
                ))}
              </div>
            )}

            {/* Selected BL tags */}
            {blNumbers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {blNumbers.map(bl => (
                  <span key={bl} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {bl}
                    <button onClick={() => removeBL(bl)} className="text-indigo-400 hover:text-red-500 transition-colors"><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}

            {/* Add custom BL */}
            <div className="flex gap-2">
              <input type="text" value={blInput} onChange={e => setBlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBL())}
                placeholder="Add BL number and press Enter…"
                className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
              <button type="button" onClick={addBL}
                className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors">
                Add
              </button>
            </div>
          </div>

          {/* Supplier + Amount */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Supplier</label>
              <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)}
                placeholder="Supplier name"
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white">
                {['MAD', 'EUR', 'USD', 'GBP', 'CNY'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Amount</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" min="0" step="0.01"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Remarks</label>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
              placeholder="Notes about this invoice…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
          </div>

          {/* Document */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Attached Document {invoice?.documentUrl && <span className="text-emerald-600 font-normal normal-case">(existing attached)</span>}
            </label>
            <div onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0] ?? null); }}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-4 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors cursor-pointer">
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-indigo-700">
                  <FileText size={15} />
                  <span className="font-medium truncate max-w-[280px]">{file.name}</span>
                  <button type="button" onClick={ev => { ev.stopPropagation(); setFile(null); }} className="p-0.5 rounded text-slate-400 hover:text-red-500"><X size={13} /></button>
                </div>
              ) : invoice?.documentUrl ? (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <FileText size={14} className="text-emerald-600" />
                  <a href={invoice.documentUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-emerald-700 font-medium hover:underline">
                    {invoice.documentName ?? 'View Document'}
                  </a>
                  <span className="text-slate-400 text-xs">· click to replace</span>
                </div>
              ) : (
                <div className="text-slate-400">
                  <Upload size={20} className="mx-auto mb-1 text-slate-300" />
                  <p className="text-sm">Drop file or <span className="text-indigo-600 font-semibold">click to browse</span></p>
                  <p className="text-xs mt-0.5 text-slate-300">PDF, image, or any document</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200">
            {saving ? <><span className="animate-spin inline-block">↻</span> Saving…</> : <><CheckCircle2 size={14} /> {invoice ? 'Update' : 'Save Invoice'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invoice Detail Modal (show all invoices for an order) ─────────
interface InvoiceDetailModalProps {
  order: ShippingOrder;
  invoices: Invoice[];
  onEdit: (inv: Invoice) => void;
  onDelete: (inv: Invoice) => void;
  onAdd: () => void;
  onClose: () => void;
}
function InvoiceDetailModal({ order, invoices, onEdit, onDelete, onAdd, onClose }: InvoiceDetailModalProps) {
  const total = invoices.reduce((s, inv) => s + (inv.amount ?? 0), 0);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Package size={16} className="text-indigo-500" />
              <h2 className="font-bold text-slate-800">Invoices for {order.ref}</h2>
            </div>
            {order.supplier && <p className="text-xs text-slate-400 mt-0.5">{order.supplier}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>

        {/* Summary */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-slate-500">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</span>
            {total > 0 && <span className="text-slate-700 font-semibold">Total: {total.toLocaleString('fr-FR')} {invoices[0]?.currency ?? ''}</span>}
          </div>
        </div>

        {/* Invoice list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No invoices yet for this order.</p>
          ) : invoices.map(inv => (
            <div key={inv.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-indigo-200 transition-colors">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <Receipt size={14} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm font-mono">{inv.invoiceNumber}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmtDate(inv.date)}</p>
                    {inv.blNumbers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {inv.blNumbers.map(bl => (
                          <span key={bl} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            BL: {bl}
                          </span>
                        ))}
                      </div>
                    )}
                    {inv.remarks && <p className="text-xs text-slate-500 mt-1 italic">{inv.remarks}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {inv.amount && (
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">{inv.amount.toLocaleString('fr-FR')}</p>
                      <p className="text-[10px] text-slate-400">{inv.currency}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    {inv.documentUrl && (
                      <a href={inv.documentUrl} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" title="View document">
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <button onClick={() => onEdit(inv)} className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => onDelete(inv)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors">Close</button>
          <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
            <Plus size={14} /> Add Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invoices Tab ──────────────────────────────────────────────────
interface InvoicesTabProps {
  invoices: Invoice[];
  orders: ShippingOrder[];
  onReload: () => Promise<void>;
  prefillOrder?: ShippingOrder;
  prefillBL?: string;
  onPrefillConsumed?: () => void;
}
function InvoicesTab({ invoices, orders, onReload, prefillOrder, prefillBL, onPrefillConsumed }: InvoicesTabProps) {
  const [showModal, setShowModal]       = useState(false);
  const [editingInv, setEditingInv]     = useState<Invoice | null>(null);
  const [detailOrder, setDetailOrder]   = useState<ShippingOrder | null>(null);
  const [preselectedOrder, setPreselectedOrder] = useState<ShippingOrder | null>(null);
  const [preselectedBL, setPreselectedBL] = useState<string | null>(null);
  const [search, setSearch]             = useState('');
  const [filterOrder, setFilterOrder]   = useState('');

  // Auto-open modal when navigated from BL Receipts tab
  useEffect(() => {
    if (prefillOrder) {
      setEditingInv(null);
      setPreselectedOrder(prefillOrder);
      setPreselectedBL(prefillBL ?? null);
      setShowModal(true);
      onPrefillConsumed?.();
    }
  }, [prefillOrder]);

  const openCreate = (order?: ShippingOrder) => {
    setEditingInv(null);
    setPreselectedOrder(order ?? null);
    setPreselectedBL(null);
    setShowModal(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditingInv(inv);
    setPreselectedOrder(null);
    setDetailOrder(null);
    setShowModal(true);
  };

  const handleSave = async (data: Omit<Invoice, 'id' | 'createdAt'>, file: File | null) => {
    let documentUrl = data.documentUrl;
    let documentName = data.documentName;
    const id = editingInv?.id ?? 'temp-' + Date.now();
    if (file) {
      const realId = editingInv?.id ?? id;
      const uploaded = await uploadInvoiceDocument(realId, file);
      documentUrl = uploaded.url;
      documentName = uploaded.name;
    }
    if (editingInv) {
      await updateInvoice(editingInv.id, { ...data, documentUrl, documentName });
    } else {
      const newId = await createInvoice({ ...data, documentUrl, documentName });
      if (file && newId !== id) {
        // re-upload with correct id if needed (already uploaded above, URL is fine)
      }
    }
    await onReload();
  };

  const handleDelete = async (inv: Invoice) => {
    if (!confirm(`Delete invoice ${inv.invoiceNumber}?`)) return;
    await deleteInvoice(inv.id);
    await onReload();
  };

  // Group invoices by shipping order
  const byOrder = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    if (!byOrder.has(inv.shippingOrderId)) byOrder.set(inv.shippingOrderId, []);
    byOrder.get(inv.shippingOrderId)!.push(inv);
  }

  // Orders that have at least one invoice or all orders for selection
  const ordersWithInvoices = orders.filter(o => byOrder.has(o.id));

  const filteredInvoices = invoices.filter(inv => {
    if (filterOrder && inv.shippingOrderId !== filterOrder) return false;
    if (search) {
      const q = search.toLowerCase();
      return inv.invoiceNumber.toLowerCase().includes(q)
        || inv.shippingOrderRef.toLowerCase().includes(q)
        || (inv.supplier ?? '').toLowerCase().includes(q)
        || inv.blNumbers.some(bl => bl.toLowerCase().includes(q));
    }
    return true;
  });

  // Grouped flat display: orders → invoices
  const groupedDisplay: { order: ShippingOrder; invoices: Invoice[] }[] = ordersWithInvoices
    .filter(o => !filterOrder || o.id === filterOrder)
    .filter(o => {
      if (!search) return true;
      const orderInvs = byOrder.get(o.id) ?? [];
      return orderInvs.some(inv => filteredInvoices.find(fi => fi.id === inv.id));
    })
    .map(o => ({
      order: o,
      invoices: (byOrder.get(o.id) ?? []).filter(inv => filteredInvoices.find(fi => fi.id === inv.id)),
    }))
    .filter(g => g.invoices.length > 0);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search invoice, BL, order…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white w-56" />
        </div>
        <select value={filterOrder} onChange={e => setFilterOrder(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="">All orders</option>
          {ordersWithInvoices.map(o => <option key={o.id} value={o.id}>{o.ref}{o.supplier ? ` · ${o.supplier}` : ''}</option>)}
        </select>
        <button onClick={() => openCreate()}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
          <Plus size={15} /> Add Invoice
        </button>
      </div>

      {/* Empty state */}
      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-14 text-center">
          <Receipt size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No invoices yet</p>
          <p className="text-slate-400 text-sm mt-1">Add an invoice and link it to a shipping order</p>
          <button onClick={() => openCreate()} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors">
            <Plus size={14} /> Add Invoice
          </button>
        </div>
      ) : groupedDisplay.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 text-sm">No results for the selected filters.</div>
      ) : (
        <div className="space-y-4">
          {groupedDisplay.map(({ order, invoices: orderInvs }) => {
            const totalAmt = orderInvs.reduce((s, i) => s + (i.amount ?? 0), 0);
            const allBLs = Array.from(new Set(orderInvs.flatMap(i => i.blNumbers)));
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Order header row */}
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Package size={14} className="text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 font-mono text-sm">{order.ref}</span>
                        {order.supplier && <span className="text-slate-400 text-xs">· {order.supplier}</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${order.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-700' : order.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {orderInvs.length} invoice{orderInvs.length !== 1 ? 's' : ''}
                        {allBLs.length > 0 && ` · BL: ${allBLs.join(', ')}`}
                        {totalAmt > 0 && ` · ${totalAmt.toLocaleString('fr-FR')} ${orderInvs[0]?.currency ?? ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDetailOrder(order)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-200">
                      <Eye size={11} /> View All
                    </button>
                    <button onClick={() => openCreate(order)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-200">
                      <Plus size={11} /> Add
                    </button>
                  </div>
                </div>

                {/* Invoice rows */}
                <div className="divide-y divide-slate-50">
                  {orderInvs.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <Receipt size={14} className="text-slate-400 shrink-0" />
                        <div>
                          <span className="font-mono font-bold text-slate-800 text-sm">{inv.invoiceNumber}</span>
                          <span className="text-xs text-slate-400 ml-3">{fmtDate(inv.date)}</span>
                          {inv.blNumbers.length > 0 && (
                            <span className="ml-2 text-xs text-indigo-600 font-semibold font-mono">BL: {inv.blNumbers.join(', ')}</span>
                          )}
                          {inv.remarks && <p className="text-xs text-slate-400 mt-0.5 italic">{inv.remarks}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {inv.amount && (
                          <span className="text-sm font-bold text-slate-700 tabular-nums">
                            {inv.amount.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">{inv.currency}</span>
                          </span>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {inv.documentUrl && (
                            <a href={inv.documentUrl} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" title="View document">
                              <ExternalLink size={13} />
                            </a>
                          )}
                          <button onClick={() => openEdit(inv)} className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => handleDelete(inv)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice form modal */}
      {showModal && (
        <InvoiceModal
          invoice={editingInv}
          orders={preselectedOrder ? [preselectedOrder, ...orders.filter(o => o.id !== preselectedOrder.id)] : orders}
          prefillOrderId={preselectedOrder?.id}
          prefillBL={preselectedBL ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingInv(null); setPreselectedOrder(null); setPreselectedBL(null); }}
        />
      )}

      {/* Detail modal (all invoices for an order) */}
      {detailOrder && (
        <InvoiceDetailModal
          order={detailOrder}
          invoices={byOrder.get(detailOrder.id) ?? []}
          onEdit={inv => { openEdit(inv); }}
          onDelete={handleDelete}
          onAdd={() => { openCreate(detailOrder); setDetailOrder(null); }}
          onClose={() => setDetailOrder(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MACHINE DOCS TAB
// ══════════════════════════════════════════════════════════════════

interface MachineDocModalProps {
  doc?: MachineDoc | null;
  machines: Machine[];
  onSave: (data: Omit<MachineDoc, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onClose: () => void;
}
function MachineDocModal({ doc: mdoc, machines, onSave, onClose }: MachineDocModalProps) {
  const [machineName, setMachineName] = useState(mdoc?.machineName ?? '');
  const [title, setTitle]             = useState(mdoc?.title ?? '');
  const [body, setBody]               = useState(mdoc?.body ?? '');
  const [remarks, setRemarks]         = useState(mdoc?.remarks ?? '');
  const [category, setCategory]       = useState(mdoc?.category ?? '');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 60); }, []);

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!machineName.trim()) { setError('Machine name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ machineName: machineName.trim(), title: title.trim(), body: body.trim(), remarks: remarks.trim() || undefined, category: category.trim() || undefined });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
      setSaving(false);
    }
  };

  const allMachineNames = Array.from(new Set([
    ...machines.map(m => m.name),
    ...(machineName && !machines.find(m => m.name === machineName) ? [machineName] : []),
  ]));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Cpu size={17} className="text-orange-500" />
            <h2 className="font-bold text-slate-800">{mdoc ? 'Edit Machine Doc' : 'New Machine Doc'}</h2>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Machine name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Machine *</label>
            <input ref={titleRef} type="text" list="machine-list" value={machineName} onChange={e => setMachineName(e.target.value)}
              placeholder="Machine name or select from list…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400" />
            <datalist id="machine-list">
              {allMachineNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Document Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Maintenance procedure, Specifications…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400" />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Category</label>
            <input type="text" list="cat-list" value={category} onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Maintenance, Specs, Safety…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400" />
            <datalist id="cat-list">
              {['Maintenance', 'Specifications', 'Safety', 'Operation', 'Calibration', 'Repair'].map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Content</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={7}
              placeholder="Full text content, procedure, specifications…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm resize-y focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 font-mono leading-relaxed" />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Remarks</label>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
              placeholder="Additional notes or warnings…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400" />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 shadow-sm shadow-orange-200">
            {saving ? <><span className="animate-spin inline-block">↻</span> Saving…</> : <><CheckCircle2 size={14} /> {mdoc ? 'Update' : 'Save Doc'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function MachineDocCard({ mdoc, onEdit, onDelete }: { mdoc: MachineDoc; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
      {/* Top bar */}
      <div className="flex items-start justify-between px-5 pt-4 pb-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <Cpu size={16} className="text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest truncate">{mdoc.machineName}</p>
            <p className="text-sm font-bold text-slate-800 leading-snug mt-0.5 truncate">{mdoc.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Pencil size={13} /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>

      {mdoc.category && (
        <div className="px-5 pb-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            <Tag size={9} /> {mdoc.category}
          </span>
        </div>
      )}

      {/* Body preview */}
      {mdoc.body && (
        <div className="px-5 py-3">
          <p className={`text-xs text-slate-600 font-mono leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-4'}`}>
            {mdoc.body}
          </p>
          {mdoc.body.length > 200 && (
            <button onClick={() => setExpanded(e => !e)}
              className="mt-1.5 text-xs text-indigo-500 hover:text-indigo-700 font-semibold transition-colors">
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Remarks */}
      {mdoc.remarks && (
        <div className="mx-5 mb-4 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Remarks</p>
          <p className="text-xs text-amber-800">{mdoc.remarks}</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-slate-50 bg-slate-50/60">
        <p className="text-[10px] text-slate-400">
          Updated {toDate(mdoc.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

interface MachineDocsTabProps {
  docs: MachineDoc[];
  machines: Machine[];
  onReload: () => Promise<void>;
}
function MachineDocsTab({ docs, machines, onReload }: MachineDocsTabProps) {
  const [showModal, setShowModal]         = useState(false);
  const [editingDoc, setEditingDoc]       = useState<MachineDoc | null>(null);
  const [search, setSearch]               = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const handleSave = async (data: Omit<MachineDoc, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingDoc) {
      await updateMachineDoc(editingDoc.id, data);
    } else {
      await createMachineDoc(data);
    }
    await onReload();
  };

  const handleDelete = async (d: MachineDoc) => {
    if (!confirm(`Delete "${d.title}"?`)) return;
    await deleteMachineDoc(d.id);
    await onReload();
  };

  const allMachineNames = Array.from(new Set(docs.map(d => d.machineName))).sort();
  const allCategories   = Array.from(new Set(docs.map(d => d.category).filter(Boolean))).sort() as string[];

  const filtered = docs.filter(d => {
    if (filterMachine && d.machineName !== filterMachine) return false;
    if (filterCategory && d.category !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.machineName.toLowerCase().includes(q) || d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q);
    }
    return true;
  });

  // Group by machine
  const grouped = new Map<string, MachineDoc[]>();
  for (const d of filtered) {
    if (!grouped.has(d.machineName)) grouped.set(d.machineName, []);
    grouped.get(d.machineName)!.push(d);
  }
  const groupEntries = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search docs…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white w-48" />
        </div>
        {allMachineNames.length > 0 && (
          <select value={filterMachine} onChange={e => setFilterMachine(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
            <option value="">All machines</option>
            {allMachineNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        {allCategories.length > 0 && (
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
            <option value="">All categories</option>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button onClick={() => { setEditingDoc(null); setShowModal(true); }}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm shadow-orange-200">
          <Plus size={15} /> New Machine Doc
        </button>
      </div>

      {/* Content */}
      {docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-14 text-center">
          <Cpu size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No machine documentation yet</p>
          <p className="text-slate-400 text-sm mt-1">Add specs, maintenance guides, or procedures for your machines</p>
          <button onClick={() => setShowModal(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors">
            <Plus size={14} /> Add Machine Doc
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 text-sm">No results.</div>
      ) : (
        <div className="space-y-6">
          {groupEntries.map(([machineName, machineDocs]) => (
            <div key={machineName}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <Cpu size={14} className="text-orange-500" />
                <h3 className="text-xs font-bold text-orange-600 uppercase tracking-widest">{machineName}</h3>
                <span className="text-xs text-slate-400">· {machineDocs.length} doc{machineDocs.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {machineDocs.map(d => (
                  <MachineDocCard key={d.id} mdoc={d}
                    onEdit={() => { setEditingDoc(d); setShowModal(true); }}
                    onDelete={() => handleDelete(d)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <MachineDocModal
          doc={editingDoc}
          machines={machines}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingDoc(null); }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// BL RECEIPTS TAB
// ══════════════════════════════════════════════════════════════════

type BLRecord = {
  key: string;          // orderId + blNumber
  orderId: string;
  orderRef: string;
  supplier?: string;
  blNumber: string;
  date: string;
  documentUrl?: string;
  documentName?: string;
};

function extractBLRecords(orders: ShippingOrder[]): BLRecord[] {
  const records: BLRecord[] = [];
  for (const order of orders) {
    // From receipts array (new flow)
    for (const r of order.receipts ?? []) {
      if (r.blNumber) {
        records.push({
          key: `${order.id}__${r.blNumber}`,
          orderId: order.id,
          orderRef: order.ref,
          supplier: order.supplier,
          blNumber: r.blNumber,
          date: r.date,
          documentUrl: r.documentUrl,
          documentName: r.documentName,
        });
      }
    }
    // From legacy blNumber field (old flow - received orders without receipts)
    if (order.blNumber && (!order.receipts || order.receipts.length === 0)) {
      records.push({
        key: `${order.id}__${order.blNumber}`,
        orderId: order.id,
        orderRef: order.ref,
        supplier: order.supplier,
        blNumber: order.blNumber,
        date: order.receivedAt ? new Date(order.receivedAt as unknown as string).toISOString().split('T')[0] : order.date,
        documentUrl: order.documentUrl,
        documentName: order.documentName,
      });
    }
  }
  // Sort by date desc
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

interface BLReceiptsTabProps {
  orders: ShippingOrder[];
  invoices: Invoice[];
  onReload: () => Promise<void>;
  onAddInvoice: (order: ShippingOrder, prefillBL: string) => void;
}
function BLReceiptsTab({ orders, invoices, onReload, onAddInvoice }: BLReceiptsTabProps) {
  const [search, setSearch] = useState('');
  const [filterOrder, setFilterOrder] = useState('');

  const records = extractBLRecords(orders);

  // Map: blNumber → invoices that include it
  const blInvoiceMap = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    for (const bl of inv.blNumbers) {
      if (!blInvoiceMap.has(bl)) blInvoiceMap.set(bl, []);
      blInvoiceMap.get(bl)!.push(inv);
    }
  }

  const allOrderIds = Array.from(new Set(records.map(r => r.orderId)));
  const orderMap = new Map(orders.map(o => [o.id, o]));

  const filtered = records.filter(r => {
    if (filterOrder && r.orderId !== filterOrder) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.orderRef.toLowerCase().includes(q)
        || r.blNumber.toLowerCase().includes(q)
        || (r.supplier ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search BL, order, supplier…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-56" />
        </div>
        {allOrderIds.length > 0 && (
          <select value={filterOrder} onChange={e => setFilterOrder(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All orders</option>
            {allOrderIds.map(id => {
              const o = orderMap.get(id);
              return o ? <option key={id} value={id}>{o.ref}{o.supplier ? ` · ${o.supplier}` : ''}</option> : null;
            })}
          </select>
        )}
        <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Available</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block" /> Missing</span>
        </div>
      </div>

      {/* Empty state */}
      {records.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-14 text-center">
          <FileCheck size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No BL receipts yet</p>
          <p className="text-slate-400 text-sm mt-1">BL numbers recorded on shipment receipts will appear here</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 text-sm">No results for the selected filters.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>Shipping Order</span>
            <span>BL Number</span>
            <span>Date</span>
            <span className="text-center">BL Doc</span>
            <span className="text-center">Invoice</span>
            <span />
          </div>

          <div className="divide-y divide-slate-50">
            {filtered.map(r => {
              const invs = blInvoiceMap.get(r.blNumber) ?? [];
              const hasDoc = !!r.documentUrl;
              const hasInvoice = invs.length > 0;
              const order = orderMap.get(r.orderId);

              return (
                <div key={r.key} className="grid grid-cols-[2fr_1.5fr_1fr_auto_auto_auto] gap-4 items-center px-5 py-3 hover:bg-slate-50/60 transition-colors group">
                  {/* Order */}
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-slate-800 text-sm truncate">{r.orderRef}</p>
                    {r.supplier && <p className="text-xs text-slate-400 truncate">{r.supplier}</p>}
                  </div>

                  {/* BL Number */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                      {r.blNumber}
                    </span>
                  </div>

                  {/* Date */}
                  <span className="text-xs text-slate-500">{fmtDate(r.date)}</span>

                  {/* BL Doc status */}
                  <div className="flex flex-col items-center gap-1 w-14">
                    {hasDoc ? (
                      <a href={r.documentUrl} target="_blank" rel="noopener noreferrer"
                        className="flex flex-col items-center gap-0.5 group/bl" title="View BL document">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                        <span className="text-[9px] text-emerald-600 font-bold hidden group-hover/bl:block absolute mt-4 bg-white border border-emerald-200 rounded px-1 z-10">Open</span>
                      </a>
                    ) : (
                      <span className="w-3 h-3 rounded-full bg-slate-200" title="No BL document attached" />
                    )}
                    {hasDoc && (
                      <a href={r.documentUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[9px] text-emerald-600 font-semibold hover:underline">
                        View
                      </a>
                    )}
                  </div>

                  {/* Invoice status */}
                  <div className="flex flex-col items-center gap-1 w-14">
                    <span className={`w-3 h-3 rounded-full ${hasInvoice ? 'bg-emerald-500 shadow-sm shadow-emerald-200' : 'bg-slate-200'}`}
                      title={hasInvoice ? `${invs.length} invoice(s): ${invs.map(i => i.invoiceNumber).join(', ')}` : 'No invoice'} />
                    {hasInvoice && (
                      <span className="text-[9px] text-emerald-600 font-semibold">
                        {invs.length} inv.
                      </span>
                    )}
                  </div>

                  {/* Add invoice action */}
                  <div className="flex items-center gap-1.5">
                    {hasInvoice ? (
                      <div className="flex gap-1">
                        {invs.map(inv => inv.documentUrl ? (
                          <a key={inv.id} href={inv.documentUrl} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" title={`View invoice ${inv.invoiceNumber}`}>
                            <FileCheck size={13} />
                          </a>
                        ) : null)}
                        {order && (
                          <button onClick={() => onAddInvoice(order, r.blNumber)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100" title="Add another invoice">
                            <Plus size={13} />
                          </button>
                        )}
                      </div>
                    ) : order ? (
                      <button onClick={() => onAddInvoice(order, r.blNumber)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors">
                        <Plus size={11} /> Invoice
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN DOCUMENTS PAGE
// ══════════════════════════════════════════════════════════════════
type DocTab = 'invoices' | 'bl-receipts' | 'machines';

export default function DocumentsPage() {
  const [tab, setTab]           = useState<DocTab>('bl-receipts');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders]     = useState<ShippingOrder[]>([]);
  const [machineDocs, setMachineDocs] = useState<MachineDoc[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading]   = useState(true);
  // For "Add Invoice from BL" shortcut
  const [blInvoiceOrder, setBlInvoiceOrder] = useState<ShippingOrder | null>(null);
  const [blInvoicePrefill, setBlInvoicePrefill] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const [invs, ords, mDocs, machs] = await Promise.all([
        getInvoices(),
        getShippingOrders(),
        getMachineDocs(),
        getMachines(),
      ]);
      setInvoices(invs);
      setOrders(ords);
      setMachineDocs(mDocs);
      setMachines(machs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const blRecordCount = extractBLRecords(orders).length;
  const TABS: { id: DocTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'bl-receipts', label: 'BL Receipts',   icon: <FileCheck size={15} />, count: blRecordCount },
    { id: 'invoices',    label: 'Invoices',       icon: <Receipt size={15} />,   count: invoices.length },
    { id: 'machines',    label: 'Machine Docs',   icon: <Cpu size={15} />,       count: machineDocs.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Documents</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {loading ? 'Loading…' : `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''} · ${machineDocs.length} machine doc${machineDocs.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}>
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 text-sm animate-pulse">
          Loading documents…
        </div>
      ) : (
        <>
          {tab === 'bl-receipts' && (
            <BLReceiptsTab
              orders={orders}
              invoices={invoices}
              onReload={load}
              onAddInvoice={(order, bl) => {
                setBlInvoiceOrder(order);
                setBlInvoicePrefill(bl);
                setTab('invoices');
              }}
            />
          )}
          {tab === 'invoices' && (
            <InvoicesTab
              invoices={invoices}
              orders={orders}
              onReload={load}
              prefillOrder={blInvoiceOrder ?? undefined}
              prefillBL={blInvoicePrefill || undefined}
              onPrefillConsumed={() => { setBlInvoiceOrder(null); setBlInvoicePrefill(''); }}
            />
          )}
          {tab === 'machines' && (
            <MachineDocsTab docs={machineDocs} machines={machines} onReload={load} />
          )}
        </>
      )}
    </div>
  );
}
