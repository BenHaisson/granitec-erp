import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import type { Product } from '@/types';

const CATEGORY_ORDER = [
  'Sets & Packs', 'Marmite', 'Crepe & Specialty', 'Frypans', 'Saucepots', 'Cake & Molds',
  'Aluminium Disc', 'Accessories', 'Packaging',
];

function sortedCategories(cats: string[]) {
  return [...cats].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

interface Props {
  products: Product[];
  value: string;
  onChange: (p: Product) => void;
  placeholder?: string;
  className?: string;
}

export default function ProductPickerDropdown({
  products,
  value,
  onChange,
  placeholder = 'Select product…',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleCat = (cat: string) =>
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const selected = products.find(p => p.id === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Detect flip direction and focus search when opened
  useEffect(() => {
    if (!open) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 280);
    }
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const q = search.toLowerCase();
  const filtered = q
    ? products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
      )
    : products;

  const categories = sortedCategories(
    Array.from(new Set(filtered.map(p => p.category ?? 'Other')))
  );

  const handleSelect = (p: Product) => {
    onChange(p);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm text-left transition-colors ${
          open
            ? 'border-indigo-400 ring-2 ring-indigo-100 bg-white'
            : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        <span className={selected ? 'text-slate-800 truncate' : 'text-slate-400'}>
          {selected
            ? <>{selected.name} <span className="text-slate-400 font-mono text-xs ml-1">{selected.sku}</span></>
            : placeholder}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={`absolute z-50 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or SKU…"
                className="w-full pl-7 pr-7 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">No results for "{search}"</p>
            ) : (
              categories.map(cat => {
                const items = filtered
                  .filter(p => (p.category ?? 'Other') === cat)
                  .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
                const isExpanded = search.length > 0 || expandedCats.has(cat);
                return (
                  <div key={cat}>
                    <button
                      type="button"
                      onClick={() => toggleCat(cat)}
                      className="sticky top-0 w-full flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors"
                    >
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {cat}
                        <span className="ml-1.5 font-normal normal-case text-slate-400">({items.length})</span>
                      </span>
                      <ChevronDown
                        size={13}
                        className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isExpanded && items.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelect(p)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0 ${
                          p.id === value ? 'bg-indigo-50' : ''
                        }`}
                      >
                        <span className="text-sm text-slate-700 truncate">{p.name}</span>
                        <span className="text-xs font-mono text-slate-400 shrink-0">{p.sku}</span>
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
