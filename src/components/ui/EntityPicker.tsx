import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';

export interface PickerEntity { id: string; name: string; subtitle?: string; }

interface EntityPickerProps {
  value: string;
  onChange: (name: string) => void;
  entities: PickerEntity[];
  onAddNew: () => void;
  placeholder?: string;
  addLabel?: string;
  className?: string;
  inputClassName?: string;
}

export default function EntityPicker({
  value, onChange, entities, onAddNew,
  placeholder = 'Select or type…',
  addLabel = 'Add new',
  className = '',
  inputClassName = '',
}: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep search in sync when value changes externally
  useEffect(() => { setSearch(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // If search doesn't match any entity, commit typed value
        onChange(search);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [search, onChange]);

  const filtered = entities.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`w-full pr-7 ${inputClassName}`}
          autoComplete="off"
        />
        <ChevronDown
          size={14}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-[500] max-h-52 overflow-y-auto">
          {filtered.length === 0 && search.trim() === '' ? (
            <p className="px-3 py-2 text-xs text-slate-400 italic">No entries yet</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400 italic">No match — you can type a new name or:</p>
          ) : (
            filtered.map(entity => (
              <button
                key={entity.id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  onChange(entity.name);
                  setSearch(entity.name);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
              >
                <span className="text-sm font-medium text-slate-800">{entity.name}</span>
                {entity.subtitle && (
                  <span className="ml-2 text-xs text-slate-400">{entity.subtitle}</span>
                )}
              </button>
            ))
          )}
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => { setOpen(false); onAddNew(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors border-t border-slate-100 sticky bottom-0 bg-white"
          >
            <Plus size={12} /> {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}
