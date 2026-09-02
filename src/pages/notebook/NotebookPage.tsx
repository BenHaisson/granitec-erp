import { useEffect, useRef, useState } from 'react';
import {
  BookOpen, Plus, Trash2, Pencil, X, CheckCircle2, Clock,
  AlertCircle, Flag, Search, ChevronDown, Pin, PinOff,
} from 'lucide-react';
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, Timestamp, orderBy, query,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { fmtDayMonth } from '@/utils/dates';

// ── Types ─────────────────────────────────────────────────────────
type Priority = 'high' | 'medium' | 'low' | 'none';
type NoteStatus = 'open' | 'done';

interface Note {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  status: NoteStatus;
  pinned: boolean;
  category: string;
  createdAt: Date | { toDate: () => Date };
  updatedAt: Date | { toDate: () => Date };
}

// ── Priority config ───────────────────────────────────────────────
const PRIORITY: Record<Priority, { label: string; color: string; border: string; bg: string; dot: string; badge: string }> = {
  high:   { label: 'High',   color: 'text-red-600',    border: 'border-red-400',    bg: 'bg-red-50',     dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700'    },
  medium: { label: 'Medium', color: 'text-amber-600',  border: 'border-amber-400',  bg: 'bg-amber-50',   dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700' },
  low:    { label: 'Low',    color: 'text-blue-500',   border: 'border-blue-300',   bg: 'bg-blue-50',    dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700'   },
  none:   { label: 'None',   color: 'text-slate-400',  border: 'border-slate-200',  bg: 'bg-white',      dot: 'bg-slate-300',  badge: 'bg-slate-100 text-slate-500' },
};

const CATEGORIES = ['General', 'Operations', 'Shipping', 'Production', 'Finance', 'HR', 'Urgent'];

// ── Firestore helpers ─────────────────────────────────────────────
const toDate = (d: Date | { toDate: () => Date } | undefined): Date =>
  !d ? new Date() : d instanceof Date ? d : d.toDate();

const getNotes = async (): Promise<Note[]> => {
  const snap = await getDocs(query(collection(db, 'notebook_notes'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Note));
};

const createNote = async (data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, 'notebook_notes'), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
};

const updateNote = async (id: string, data: Partial<Omit<Note, 'id' | 'createdAt'>>): Promise<void> => {
  await updateDoc(doc(db, 'notebook_notes', id), { ...data, updatedAt: Timestamp.now() });
};

const deleteNote = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'notebook_notes', id));
};

// ── Note Card ─────────────────────────────────────────────────────
interface NoteCardProps {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onTogglePin: () => void;
}
function NoteCard({ note, onEdit, onDelete, onToggleStatus, onTogglePin }: NoteCardProps) {
  const p = PRIORITY[note.priority];
  const isDone = note.status === 'done';

  return (
    <div className={`relative rounded-2xl border-2 ${p.border} ${p.bg} shadow-sm hover:shadow-md transition-all group flex flex-col overflow-hidden`}>
      {/* Priority stripe */}
      {note.priority === 'high' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-red-400" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {note.pinned && <Pin size={12} className="text-slate-400 shrink-0" />}
          <h3 className={`font-bold text-slate-800 text-sm leading-snug truncate ${isDone ? 'line-through text-slate-400' : ''}`}>
            {note.title || <span className="italic text-slate-400">Untitled</span>}
          </h3>
        </div>
        {/* Priority badge */}
        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${p.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
          {p.label}
        </span>
      </div>

      {/* Body */}
      {note.body && (
        <div className="px-4 pb-3 flex-1">
          <p className={`text-xs text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-4 ${isDone ? 'text-slate-400' : ''}`}>
            {note.body}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100/80 bg-white/50 mt-auto">
        <div className="flex items-center gap-2">
          {note.category && note.category !== 'General' && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {note.category}
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            {fmtDayMonth(note.updatedAt)}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onTogglePin} title={note.pinned ? 'Unpin' : 'Pin'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors">
            {note.pinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
          <button onClick={onToggleStatus} title={isDone ? 'Reopen' : 'Mark done'}
            className={`p-1.5 rounded-lg transition-colors ${isDone ? 'text-slate-400 hover:text-slate-600 hover:bg-white' : 'text-emerald-500 hover:text-emerald-700 hover:bg-white'}`}>
            <CheckCircle2 size={13} />
          </button>
          <button onClick={onEdit} title="Edit"
            className="p-1.5 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-white transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} title="Delete"
            className="p-1.5 rounded-lg text-red-300 hover:text-red-600 hover:bg-white transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Note Modal ────────────────────────────────────────────────────
interface NoteModalProps {
  note?: Note | null;
  onSave: (data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onClose: () => void;
}
function NoteModal({ note, onSave, onClose }: NoteModalProps) {
  const [title, setTitle]       = useState(note?.title ?? '');
  const [body, setBody]         = useState(note?.body ?? '');
  const [priority, setPriority] = useState<Priority>(note?.priority ?? 'none');
  const [category, setCategory] = useState(note?.category ?? 'General');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 60); }, []);

  const handleSave = async () => {
    if (!title.trim() && !body.trim()) { setError('Add a title or some content.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ title: title.trim(), body: body.trim(), priority, category, status: note?.status ?? 'open', pinned: note?.pinned ?? false });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">{note ? 'Edit Note' : 'New Note'}</h2>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Priority selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Priority</label>
            <div className="flex items-center gap-2">
              {(['high', 'medium', 'low', 'none'] as Priority[]).map(p => {
                const cfg = PRIORITY[p];
                const active = priority === p;
                return (
                  <button key={p} onClick={() => setPriority(p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                      active ? `${cfg.badge} ${cfg.border}` : 'border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${active ? cfg.dot : 'bg-slate-300'}`} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Title</label>
            <input ref={titleRef} type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Note title…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Content</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
              placeholder="Write your note here…"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200">
            {saving ? <><span className="animate-spin inline-block">↻</span> Saving…</> : <><CheckCircle2 size={14} /> {note ? 'Update' : 'Add Note'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function NotebookPage() {
  const [notes, setNotes]           = useState<Note[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [search, setSearch]         = useState('');
  const [filterPriority, setFilterPriority] = useState<Priority | ''>('');
  const [filterStatus, setFilterStatus]     = useState<NoteStatus | ''>('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showDone, setShowDone]     = useState(false);

  const load = async () => {
    setLoading(true);
    try { setNotes(await getNotes()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingNote) {
      await updateNote(editingNote.id, data);
    } else {
      await createNote(data);
    }
    setEditingNote(null);
    await load();
  };

  const handleDelete = async (note: Note) => {
    if (!confirm(`Delete "${note.title || 'this note'}"?`)) return;
    await deleteNote(note.id);
    setNotes(n => n.filter(x => x.id !== note.id));
  };

  const handleToggleStatus = async (note: Note) => {
    const newStatus: NoteStatus = note.status === 'done' ? 'open' : 'done';
    await updateNote(note.id, { status: newStatus });
    setNotes(n => n.map(x => x.id === note.id ? { ...x, status: newStatus } : x));
  };

  const handleTogglePin = async (note: Note) => {
    const pinned = !note.pinned;
    await updateNote(note.id, { pinned });
    setNotes(n => n.map(x => x.id === note.id ? { ...x, pinned } : x));
  };

  const openEdit = (note: Note) => { setEditingNote(note); setShowModal(true); };
  const openCreate = () => { setEditingNote(null); setShowModal(true); };

  // Filter & sort
  const filtered = notes
    .filter(n => {
      if (!showDone && n.status === 'done') return false;
      if (filterPriority && n.priority !== filterPriority) return false;
      if (filterStatus && n.status !== filterStatus) return false;
      if (filterCategory && n.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Pinned first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Then done last
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      // Then priority order
      const order: Priority[] = ['high', 'medium', 'low', 'none'];
      const ai = order.indexOf(a.priority), bi = order.indexOf(b.priority);
      if (ai !== bi) return ai - bi;
      return toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime();
    });

  const high   = filtered.filter(n => n.priority === 'high'   && n.status === 'open');
  const medium = filtered.filter(n => n.priority === 'medium' && n.status === 'open');
  const low    = filtered.filter(n => n.priority === 'low'    && n.status === 'open');
  const none   = filtered.filter(n => n.priority === 'none'   && n.status === 'open');
  const done   = filtered.filter(n => n.status === 'done');
  const pinned = filtered.filter(n => n.pinned && n.status === 'open');

  const totalOpen = notes.filter(n => n.status === 'open').length;
  const totalHigh = notes.filter(n => n.priority === 'high' && n.status === 'open').length;

  const allCategories = Array.from(new Set(notes.map(n => n.category).filter(Boolean))).sort();

  const renderSection = (title: string, items: Note[], accentClass = '', icon?: React.ReactNode) => {
    if (items.length === 0) return null;
    return (
      <div>
        <div className={`flex items-center gap-2 mb-3 px-1`}>
          {icon}
          <h2 className={`text-xs font-bold uppercase tracking-widest ${accentClass || 'text-slate-400'}`}>
            {title} · {items.length}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map(note => (
            <NoteCard key={note.id} note={note}
              onEdit={() => openEdit(note)}
              onDelete={() => handleDelete(note)}
              onToggleStatus={() => handleToggleStatus(note)}
              onTogglePin={() => handleTogglePin(note)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notebook</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Loading…' : (
              <>
                {totalOpen} open note{totalOpen !== 1 ? 's' : ''}
                {totalHigh > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                    <Flag size={10} /> {totalHigh} high priority
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
          <Plus size={16} /> New Note
        </button>
      </div>

      {/* Filter bar */}
      {!loading && notes.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search notes…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white w-48" />
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-1">
            <button onClick={() => setFilterPriority('')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${!filterPriority ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              All
            </button>
            {(['high', 'medium', 'low', 'none'] as Priority[]).map(p => {
              const cfg = PRIORITY[p];
              const active = filterPriority === p;
              return (
                <button key={p} onClick={() => setFilterPriority(active ? '' : p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${active ? `${cfg.badge}` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${active ? cfg.dot : 'bg-slate-300'}`} />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Category filter */}
          {allCategories.length > 1 && (
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">All categories</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {/* Done toggle */}
          <button onClick={() => setShowDone(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ml-auto ${showDone ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            <CheckCircle2 size={12} /> {showDone ? 'Hide Done' : 'Show Done'}
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400 text-sm animate-pulse">
          Loading notes…
        </div>
      ) : notes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-14 text-center">
          <BookOpen size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No notes yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first note to get started</p>
          <button onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors">
            <Plus size={14} /> Add Note
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 text-sm">
          No notes match the current filters.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pinned */}
          {pinned.length > 0 && renderSection('Pinned', pinned, 'text-slate-500',
            <Pin size={13} className="text-slate-400" />
          )}

          {/* High priority */}
          {renderSection('🔴 High Priority', high, 'text-red-600',
            <Flag size={13} className="text-red-500" />
          )}

          {/* Medium */}
          {renderSection('🟡 Medium Priority', medium, 'text-amber-600')}

          {/* Low */}
          {renderSection('🔵 Low Priority', low, 'text-blue-500')}

          {/* No priority */}
          {renderSection('Notes', none, 'text-slate-400')}

          {/* Done */}
          {showDone && done.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 px-1">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Done · {done.length}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-60">
                {done.map(note => (
                  <NoteCard key={note.id} note={note}
                    onEdit={() => openEdit(note)}
                    onDelete={() => handleDelete(note)}
                    onToggleStatus={() => handleToggleStatus(note)}
                    onTogglePin={() => handleTogglePin(note)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <NoteModal
          note={editingNote}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingNote(null); }}
        />
      )}
    </div>
  );
}
