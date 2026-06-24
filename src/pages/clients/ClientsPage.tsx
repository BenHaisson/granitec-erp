import { useEffect, useState } from 'react';
import { Plus, X, Users, Phone, MapPin, FileText, Pencil, Trash2, Search, Mail, UserPlus } from 'lucide-react';
import { getClients, createClient, updateClient, deleteClient } from '@/services/client.service';
import type { Client, PhoneContact } from '@/types';

const EMPTY_FORM = (): Omit<Client, 'id'> => ({
  name: '',
  email: '',
  mainPhone: '',
  phones: [],
  address: '',
  description: '',
});

// ── Client Form Modal ─────────────────────────────────────────────
interface ClientModalProps {
  initial?: Client;
  onSave: (data: Omit<Client, 'id'>) => Promise<void>;
  onClose: () => void;
}

export function ClientModal({ initial, onSave, onClose }: ClientModalProps) {
  const [form, setForm] = useState<Omit<Client, 'id'>>(
    initial ? {
      name: initial.name,
      email: initial.email ?? '',
      mainPhone: initial.mainPhone ?? '',
      phones: initial.phones ?? [],
      address: initial.address ?? '',
      description: initial.description ?? '',
    } : EMPTY_FORM()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const set = (patch: Partial<Omit<Client, 'id'>>) => setForm(f => ({ ...f, ...patch }));

  const addContact = () => {
    if (!newContactPhone.trim()) return;
    const contact: PhoneContact = { name: newContactName.trim(), phone: newContactPhone.trim() };
    set({ phones: [...(form.phones ?? []), contact] });
    setNewContactName(''); setNewContactPhone('');
  };

  const removeContact = (i: number) =>
    set({ phones: (form.phones ?? []).filter((_, idx) => idx !== i) });

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Client name is required.'); return; }
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
      });
      onClose();
    } catch (err) {
      setError(`Failed to save client: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
              <Users size={16} className="text-sky-600" />
            </div>
            <h2 className="font-bold text-slate-800">{initial ? 'Edit Client' : 'Add Client'}</h2>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Client Name <span className="text-red-400">*</span>
            </label>
            <input type="text" value={form.name} onChange={e => set({ name: e.target.value })}
              placeholder="e.g. Marché Central" autoFocus
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400" />
          </div>

          {/* Email + Main Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
              <input type="email" value={form.email ?? ''} onChange={e => set({ email: e.target.value })}
                placeholder="contact@client.com"
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Main Phone</label>
              <input type="tel" value={form.mainPhone ?? ''} onChange={e => set({ mainPhone: e.target.value })}
                placeholder="+212 6xx xxx xxx"
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400" />
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
                className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400" />
              <input type="tel" value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)}
                placeholder="Phone number"
                onKeyDown={e => e.key === 'Enter' && addContact()}
                className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400" />
              <button type="button" onClick={addContact}
                className="px-3 py-2 rounded-xl bg-sky-100 text-sky-700 text-sm font-bold hover:bg-sky-200 transition-colors shrink-0">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Address</label>
            <textarea value={form.address ?? ''} onChange={e => set({ address: e.target.value })} rows={2}
              placeholder="Street, City, Country…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Description / Notes</label>
            <textarea value={form.description ?? ''} onChange={e => set({ description: e.target.value })} rows={3}
              placeholder="Payment terms, preferences, notes…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400" />
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
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 transition-colors disabled:opacity-50 shadow-sm shadow-sky-200">
            {saving ? <><span className="animate-spin inline-block">↻</span> Saving…</> : <><Plus size={14} /> {initial ? 'Save Changes' : 'Add Client'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Client Card ───────────────────────────────────────────────────
function ClientCard({ client, onEdit, onDelete }: {
  client: Client; onEdit: (c: Client) => void; onDelete: (c: Client) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
            <Users size={18} className="text-sky-500" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800 truncate">{client.name}</h3>
            {client.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{client.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(client)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"><Pencil size={14} /></button>
          <button onClick={() => onDelete(client)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {client.email && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail size={13} className="text-slate-400 shrink-0" />
            <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
          </div>
        )}
        {client.mainPhone && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone size={13} className="text-slate-400 shrink-0" />
            <span className="font-semibold">{client.mainPhone}</span>
          </div>
        )}
        {(client.phones ?? []).map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-slate-500 pl-0.5">
            <Phone size={12} className="text-slate-300 shrink-0" />
            {c.name && <span className="text-xs text-slate-400 font-medium">{c.name}:</span>}
            <span>{c.phone}</span>
          </div>
        ))}
        {client.address && (
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{client.address}</span>
          </div>
        )}
        {!client.email && !client.mainPhone && !client.address && (
          <p className="text-xs text-slate-300 italic">No contact info</p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const load = async () => {
    setLoading(true);
    try { setClients(await getClients()); }
    catch (e) { console.error('Failed to load clients:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Omit<Client, 'id'>) => {
    if (editingClient) await updateClient(editingClient.id, data);
    else await createClient(data);
    await load();
  };

  const handleDelete = async (c: Client) => {
    if (!confirm(`Delete client "${c.name}"?`)) return;
    await deleteClient(c.id);
    await load();
  };

  const handleCloseModal = () => { setShowModal(false); setEditingClient(null); };

  const q = search.toLowerCase();
  const filtered = clients.filter(c =>
    !q || c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Clients</h1>
          <p className="text-sm text-slate-400 mt-0.5">{clients.length} client{clients.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button onClick={() => { setEditingClient(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-bold hover:bg-sky-700 transition-colors shadow-sm shadow-sky-200">
          <Plus size={16} /> Add Client
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={13} /></button>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <span className="animate-spin mr-2">↻</span> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Users size={28} className="text-slate-300" />
          </div>
          {clients.length === 0 ? (
            <>
              <h3 className="text-slate-600 font-semibold">No clients yet</h3>
              <p className="text-slate-400 text-sm mt-1">Add your first client to get started.</p>
              <button onClick={() => { setEditingClient(null); setShowModal(true); }}
                className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-bold hover:bg-sky-700 transition-colors">
                <Plus size={15} /> Add Client
              </button>
            </>
          ) : (
            <><h3 className="text-slate-600 font-semibold">No results</h3><p className="text-slate-400 text-sm mt-1">Try adjusting your search.</p></>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ClientCard key={c.id} client={c} onEdit={c => { setEditingClient(c); setShowModal(true); }} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showModal && (
        <ClientModal initial={editingClient ?? undefined} onSave={handleSave} onClose={handleCloseModal} />
      )}
    </div>
  );
}
