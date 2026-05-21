import { useEffect, useState } from 'react';
import { Search, Wrench, BookOpen, BarChart3, Cpu, FileText, ClipboardList, Tag } from 'lucide-react';
import { getMachines, getLibraryItems } from '@/services/library.service';
import type { Machine, LibraryItem, LibraryCategory } from '@/types';

type Tab = 'machines' | 'guides' | 'standards';

const CATEGORY_LABEL: Record<LibraryCategory, string> = {
  guide:    'Guide',
  sop:      'SOP',
  standard: 'Standard',
  spec:     'Spec',
};

const CATEGORY_COLOR: Record<LibraryCategory, string> = {
  guide:    'bg-blue-100 text-blue-700',
  sop:      'bg-violet-100 text-violet-700',
  standard: 'bg-amber-100 text-amber-700',
  spec:     'bg-teal-100 text-teal-700',
};

const CATEGORY_DOT: Record<LibraryCategory, string> = {
  guide:    'bg-blue-500',
  sop:      'bg-violet-500',
  standard: 'bg-amber-500',
  spec:     'bg-teal-500',
};

function MachineCard({ m }: { m: Machine }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            m.type === 'machine' ? 'bg-orange-50' : 'bg-slate-50'
          }`}>
            {m.type === 'machine'
              ? <Cpu size={17} className="text-orange-500" />
              : <Wrench size={17} className="text-slate-500" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{m.name}</p>
            {m.category && <p className="text-xs text-slate-400">{m.category}</p>}
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
          m.type === 'machine' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
        }`}>
          {m.type === 'machine' ? 'Machine' : 'Tool'}
        </span>
      </div>

      {m.capacity && (
        <div className="flex gap-2 text-xs">
          <span className="text-slate-400 shrink-0">Capacity:</span>
          <span className="text-slate-700">{m.capacity}</span>
        </div>
      )}
      {m.settings && (
        <div className="flex gap-2 text-xs">
          <span className="text-slate-400 shrink-0">Settings:</span>
          <span className="text-slate-700 font-mono">{m.settings}</span>
        </div>
      )}
      {m.notes && (
        <div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {expanded ? 'Hide notes' : 'Show notes'}
          </button>
          {expanded && (
            <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-3 leading-relaxed">{m.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

function LibraryCard({ item }: { item: LibraryItem }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
            {item.category === 'sop'
              ? <ClipboardList size={17} className="text-violet-500" />
              : item.category === 'standard'
                ? <BarChart3 size={17} className="text-amber-500" />
                : item.category === 'spec'
                  ? <FileText size={17} className="text-teal-500" />
                  : <BookOpen size={17} className="text-blue-500" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{item.title}</p>
            {item.subcategory && <p className="text-xs text-slate-400">{item.subcategory}</p>}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${CATEGORY_COLOR[item.category]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[item.category]}`} />
          {CATEGORY_LABEL[item.category]}
        </span>
      </div>

      <div>
        <p className={`text-xs text-slate-600 leading-relaxed whitespace-pre-line ${expanded ? '' : 'line-clamp-3'}`}>
          {item.content}
        </p>
        {item.content.split('\n').length > 3 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {item.tags && item.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tag size={11} className="text-slate-300" />
          {item.tags.map(t => (
            <span key={t} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>('machines');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMachines(), getLibraryItems()])
      .then(([m, l]) => {
        setMachines(m.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));
        setItems(l.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));
      })
      .finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();

  const filteredMachines = machines.filter(m =>
    !q || m.name.toLowerCase().includes(q) || (m.category ?? '').toLowerCase().includes(q) ||
    (m.settings ?? '').toLowerCase().includes(q) || (m.notes ?? '').toLowerCase().includes(q)
  );

  const guides   = items.filter(i => (i.category === 'guide' || i.category === 'sop') &&
    (!q || i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q) || (i.tags ?? []).some(t => t.includes(q))));
  const standards = items.filter(i => (i.category === 'standard' || i.category === 'spec') &&
    (!q || i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q) || (i.tags ?? []).some(t => t.includes(q))));

  const TABS: { id: Tab; label: string; icon: typeof Wrench; count: number }[] = [
    { id: 'machines',  label: 'Machines & Tools',     icon: Cpu,      count: filteredMachines.length },
    { id: 'guides',    label: 'Guides & SOPs',         icon: BookOpen, count: guides.length },
    { id: 'standards', label: 'Standards & Specs',     icon: BarChart3,count: standards.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Library</h1>
          <p className="text-slate-500 text-sm mt-1">Machines, guides, SOPs, standards & specs</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search library…"
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={14} />
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              tab === t.id ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading…</div>
      ) : (
        <>
          {tab === 'machines' && (
            filteredMachines.length === 0
              ? <Empty search={search} label="machines" />
              : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredMachines.map(m => <MachineCard key={m.id} m={m} />)}
                </div>
          )}
          {tab === 'guides' && (
            guides.length === 0
              ? <Empty search={search} label="guides or SOPs" />
              : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {guides.map(i => <LibraryCard key={i.id} item={i} />)}
                </div>
          )}
          {tab === 'standards' && (
            standards.length === 0
              ? <Empty search={search} label="standards or specs" />
              : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {standards.map(i => <LibraryCard key={i.id} item={i} />)}
                </div>
          )}
        </>
      )}
    </div>
  );
}

function Empty({ search, label }: { search: string; label: string }) {
  return (
    <div className="bg-white rounded-xl p-12 text-center border border-slate-100 shadow-sm">
      <BookOpen size={36} className="mx-auto mb-3 text-slate-200" />
      <p className="text-slate-400 text-sm">
        {search ? `No ${label} found for "${search}"` : `No ${label} yet. Import from Settings.`}
      </p>
    </div>
  );
}
