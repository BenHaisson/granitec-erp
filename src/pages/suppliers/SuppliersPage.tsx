import { useEffect, useState } from 'react';
import { Plus, X, Building2, Phone, MapPin, FileText, Pencil, Trash2, Search, Package, Mail, UserPlus } from 'lucide-react';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/services/supplier.service';
import type { Supplier, SupplyType, PhoneContact } from '@/types';

const SUPPLY_TYPE_LABELS: Record<SupplyType, string> = {
  raw_material: 'Raw Material',
  accessory: 'Accessory',
  packaging: 'Packaging',
};

const SUPPLY_TYPE_COLORS: Record<SupplyType, string> = {
  raw_material: 'bg-blue-100 text-blue-700 border-blue-200',
  accessory: 'bg-purple-100 text-purple-700 border-purple-200',
  packaging: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const EMPTY_FORM = (): Omit<Supplier, 'id'> => ({
  name: '',
  email: '',
  mainPhone: '',
  phones: [],
  address: '',
  supplyType: 'raw_material',
  description: '',
  ice: '',
  rc: '',
});

// ── Supplier Form Modal ───────────────────────────────────────────
interface SupplierModalProps {
  initial?: Supplier;
  onSave: (data: Omit<Supplier, 'id'>) => Promise<void>;
  onClose: () => void;
}

export function SupplierModal({ initial, onSave, onClose }: SupplierModalProps) {
  const [form, setForm] = useState<Omit<Supplier, 'id'>>(
    initial ? {
      name: initial.name,
      email: initial.email ?? '',
      mainPhone: initial.mainPhone ?? '',
      phones: initial.phones ?? [],
      address: initial.address ?? '',
      supplyType: initial.supplyType,
      description: initial.description ?? '',
      ice: initial.ice ?? '',
      rc: initial.rc ?? '',
    } : EMPTY_FORM()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const set = (patch: Partial<Omit<Supplier, 'id'>>) => setForm(f => ({ ...f, ...patch }));

  const addContact = () => {
    if (!newContactPhone.trim()) return;
    const contact: PhoneContact = { name: newContactName.trim(), phone: newContactPhone.trim() };
    set({ phones: [...(form.phones ?? []), contact] });
    setNewContactName(''); setNewContactPhone('');
  };

  const removeContact = (i: number) =>
    set({ phones: (form.phones ?? []).filter((_, idx) => idx !== i) });

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Supplier name is required.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        email: form.email?.trim() || undefined,
        mainPhone: form.mainPhone?.trim() || undefined,
        phones: (form.phones ?? []).length > 0 ? form.phones : undefined,
        address: form.address?.trim() || undefined,
        description: form.description?.trim() || undefined,
        ice: form.ice?.trim() || undefined,
        rc: form.rc?.trim() || undefined,
      });
      onClose();
    } catch {
      setError('Failed to save supplier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Building2 size={16} className="text-indigo-600" />
            </div>
            <h2 className="font-bold text-slate-800">{initial ? 'Edit Supplier' : 'Add Supplier'}</h2>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Supplier Name <span className="text-red-400">*</span>
            </label>
            <input type="text" value={form.name} onChange={e => set({ name: e.target.value })}
              placeholder="e.g. Atlas Steel Co." autoFocus
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
          </div>

          {/* Supply Type */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Type of Supply</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(SUPPLY_TYPE_LABELS) as SupplyType[]).map(type => (
                <button key={type} type="button" onClick={() => set({ supplyType: type })}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    form.supplyType === type ? `${SUPPLY_TYPE_COLORS[type]} border-current` : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>
                  {SUPPLY_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Email + Main Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
              <input type="email" value={form.email ?? ''} onChange={e => set({ email: e.target.value })}
                placeholder="contact@supplier.com"
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Main Phone</label>
              <input type="tel" value={form.mainPhone ?? ''} onChange={e => set({ mainPhone: e.target.value })}
                placeholder="+212 6xx xxx xxx"
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
            </div>
          </div>

          {/* Additional Contacts */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Additional Contacts</label>
            {(form.phones ?? []).length > 0 && (
              <div className="space-y-1.5 mb-2">
                {(form.phones ?? []).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <UserPlus size={13} className="text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-600 min-w-[80px]">{c.name || <em className="text-slate-400 font-normal">unnamed</em>}</span>
                    <span className="text-xs font-mono text-slate-700 flex-1">{c.phone}</span>
                    <button type="button" onClick={() => removeContact(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={newContactName} onChange={e => setNewContactName(e.target.value)}
                placeholder="Contact name (e.g. Omar Sales)"
                className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
              <input type="tel" value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)}
                placeholder="Phone number"
                onKeyDown={e => e.key === 'Enter' && addContact()}
                className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
              <button type="button" onClick={addContact}
                className="px-3 py-2 rounded-xl bg-indigo-100 text-indigo-700 text-sm font-bold hover:bg-indigo-200 transition-colors shrink-0">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* ICE + RC */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">ICE Number</label>
              <input type="text" value={form.ice ?? ''} onChange={e => set({ ice: e.target.value })}
                placeholder="001234567000123"
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">RC Number</label>
              <input type="text" value={form.rc ?? ''} onChange={e => set({ rc: e.target.value })}
                placeholder="123456"
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Address</label>
            <textarea value={form.address ?? ''} onChange={e => set({ address: e.target.value })} rows={2}
              placeholder="Street, City, Country…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
            <textarea value={form.description ?? ''} onChange={e => set({ description: e.target.value })} rows={3}
              placeholder="Products supplied, payment terms, notes…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <X size={14} className="shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200">
            {saving ? <><span className="animate-spin inline-block">↻</span> Saving…</> : <><Plus size={14} /> {initial ? 'Save Changes' : 'Add Supplier'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Supplier Card ─────────────────────────────────────────────────
function SupplierCard({ supplier, onEdit, onDelete }: {
  supplier: Supplier; onEdit: (s: Supplier) => void; onDelete: (s: Supplier) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-indigo-500" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800 truncate">{supplier.name}</h3>
            <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${SUPPLY_TYPE_COLORS[supplier.supplyType]}`}>
              <Package size={10} /> {SUPPLY_TYPE_LABELS[supplier.supplyType]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(supplier)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Pencil size={14} /></button>
          <button onClick={() => onDelete(supplier)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {supplier.email && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail size={13} className="text-slate-400 shrink-0" />
            <a href={`mailto:${supplier.email}`} className="hover:underline">{supplier.email}</a>
          </div>
        )}
        {supplier.mainPhone && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone size={13} className="text-slate-400 shrink-0" />
            <span className="font-semibold">{supplier.mainPhone}</span>
          </div>
        )}
        {(supplier.phones ?? []).map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-slate-500 pl-0.5">
            <Phone size={12} className="text-slate-300 shrink-0" />
            {c.name && <span className="text-xs text-slate-400 font-medium">{c.name}:</span>}
            <span>{c.phone}</span>
          </div>
        ))}
        {supplier.address && (
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{supplier.address}</span>
          </div>
        )}
        {supplier.description && (
          <div className="flex items-start gap-2 text-sm text-slate-500">
            <FileText size={13} className="text-slate-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{supplier.description}</span>
          </div>
        )}
      </div>

      {(supplier.ice || supplier.rc) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
          {supplier.ice && (
            <div className="text-xs bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
              <span className="text-slate-400 font-semibold">ICE: </span>
              <span className="font-mono text-slate-700">{supplier.ice}</span>
            </div>
          )}
          {supplier.rc && (
            <div className="text-xs bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
              <span className="text-slate-400 font-semibold">RC: </span>
              <span className="font-mono text-slate-700">{supplier.rc}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<SupplyType | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const load = async () => {
    setLoading(true);
    try { setSuppliers(await getSuppliers()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Omit<Supplier, 'id'>) => {
    if (editingSupplier) await updateSupplier(editingSupplier.id, data);
    else await createSupplier(data);
    await load();
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    await deleteSupplier(s.id);
    await load();
  };

  const handleCloseModal = () => { setShowModal(false); setEditingSupplier(null); };

  const q = search.toLowerCase();
  const filtered = suppliers.filter(s => {
    if (filterType !== 'all' && s.supplyType !== filterType) return false;
    if (q && !s.name.toLowerCase().includes(q) && !(s.description ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  const counts = {
    all: suppliers.length,
    raw_material: suppliers.filter(s => s.supplyType === 'raw_material').length,
    accessory: suppliers.filter(s => s.supplyType === 'accessory').length,
    packaging: suppliers.filter(s => s.supplyType === 'packaging').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Suppliers</h1>
          <p className="text-sm text-slate-400 mt-0.5">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button onClick={() => { setEditingSupplier(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={13} /></button>}
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
          {(['all', 'raw_material', 'accessory', 'packaging'] as const).map(type => (
            <button key={type} onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType === type ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {type === 'all' ? 'All' : SUPPLY_TYPE_LABELS[type]}
              <span className="ml-1.5 text-slate-400">{counts[type]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <span className="animate-spin mr-2">↻</span> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Building2 size={28} className="text-slate-300" />
          </div>
          {suppliers.length === 0 ? (
            <>
              <h3 className="text-slate-600 font-semibold">No suppliers yet</h3>
              <p className="text-slate-400 text-sm mt-1">Add your first supplier to get started.</p>
              <button onClick={() => { setEditingSupplier(null); setShowModal(true); }}
                className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
                <Plus size={15} /> Add Supplier
              </button>
            </>
          ) : (
            <><h3 className="text-slate-600 font-semibold">No results</h3><p className="text-slate-400 text-sm mt-1">Try adjusting your search or filter.</p></>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <SupplierCard key={s.id} supplier={s} onEdit={s => { setEditingSupplier(s); setShowModal(true); }} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showModal && (
        <SupplierModal initial={editingSupplier ?? undefined} onSave={handleSave} onClose={handleCloseModal} />
      )}
    </div>
  );
}
