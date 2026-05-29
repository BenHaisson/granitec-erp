import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Trash2, Clock, X } from 'lucide-react';
import { getTargets, getAllTargets, getEntries, getAllEntries, createEntry, deleteEntry, updateTarget } from '@/services/productionTargets.service';
import { getRecipes, startProductionTarget, completeProductionTarget } from '@/services/production.service';
import type { ProductionTarget, ProductionEntry, Recipe } from '@/types';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function pct(done: number, total: number) { return total === 0 ? 0 : Math.round((done / total) * 100); }

const QUALITY_OPTIONS = [
  { value: 'passed', label: '✓ Passed', cls: 'bg-emerald-50 border-emerald-300 text-emerald-700' },
  { value: 'review', label: '⚠ Review', cls: 'bg-yellow-50 border-yellow-300 text-yellow-700' },
  { value: 'hold',   label: '✕ Hold',   cls: 'bg-red-50 border-red-300 text-red-700' },
];

export default function DataEntry() {
  const [date, setDate]           = useState('');
  const [targets, setTargets]     = useState<ProductionTarget[]>([]);
  const [entries, setEntries]     = useState<ProductionEntry[]>([]);
  const [recipes, setRecipes]     = useState<Recipe[]>([]);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  const [qty, setQty]             = useState('');
  const [goodQty, setGoodQty]     = useState('');
  const [defects, setDefects]     = useState('');
  const [qualityCheck, setQC]     = useState<'passed' | 'review' | 'hold'>('passed');
  const [logDate, setLogDate]     = useState(todayISO());
  const [logTime, setLogTime]     = useState('');
  const [useNow, setUseNow]       = useState(false);
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState('');
  const [error, setError]         = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      date ? getTargets(date) : getAllTargets(),
      date ? getEntries(date) : getAllEntries(),
      getRecipes(),
    ]).then(([t, e, r]) => {
      setTargets(t.sort((a, b) => b.date.localeCompare(a.date)));
      setEntries(e.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)));
      setRecipes(r);
      if (!selectedId && t.length > 0) setSelected(t[0].id);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [date]);
  useEffect(() => { setLogDate(date || todayISO()); }, [date]);

  const selected = targets.find(t => t.id === selectedId) ?? null;
  const targetEntries = entries.filter(e => e.targetId === selectedId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const n = Number(qty);
    if (!n || n <= 0) { setError('Enter a valid quantity.'); return; }
    const time = useNow ? nowHHMM() : logTime;
    if (!time) { setError('Enter a time.'); return; }
    setError(''); setSaving(true);
    try {
      await createEntry({
        date: logDate,
        targetId: selected.id,
        stage: selected.stage!,
        discType: selected.discType ?? selected.recipeName ?? '',
        qty: n,
        goodQty: goodQty ? Number(goodQty) : undefined,
        defects: defects ? Number(defects) : undefined,
        qualityCheck,
        loggedAt: time,
        notes: notes || undefined,
      });

      const newCompleted = selected.completedQty + n;
      const newStatus = newCompleted >= selected.targetQty ? 'complete'
        : newCompleted > 0 ? 'in_progress' : 'not_started';
      await updateTarget(selected.id, { completedQty: newCompleted, status: newStatus });

      const recipe = selected.type === 'recipe'
        ? recipes.find(r => r.id === selected.recipeId) : undefined;

      // Auto-start: deduct raw materials on first batch logged
      if (recipe && !selected.materialsDeducted && selected.completedQty === 0) {
        try { await startProductionTarget(selected, recipe); }
        catch { /* non-fatal — manual Start button still available in Daily Planning */ }
      }

      // Auto-complete: add finished goods to warehouse when target is met
      if (recipe && !selected.finishedGoodsAdded && newCompleted >= selected.targetQty) {
        try {
          await completeProductionTarget({ ...selected, completedQty: newCompleted }, recipe);
          setSuccess(`✓ Logged ${n} units — production complete. Added to warehouse stock.`);
        } catch (err) {
          setSuccess(`✓ Logged ${n} units. Warehouse update failed: ${err instanceof Error ? err.message : 'check recipe setup'}`);
        }
      } else {
        const label = selected.type === 'stage'
          ? `${selected.stage} now at ${newCompleted}/${selected.targetQty}`
          : `${newCompleted}/${selected.targetQty} sets`;
        setSuccess(`✓ Logged ${n} units — ${label}`);
      }

      setQty(''); setGoodQty(''); setDefects(''); setNotes('');
      setTimeout(() => setSuccess(''), 5000);
      load();
    } catch { setError('Failed to save entry.'); }
    finally { setSaving(false); }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    // Note: does not reverse the completedQty — entries are append-only logs
    await deleteEntry(id);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Data Entry</h2>
          <p className="text-sm text-slate-500 mt-0.5">Log production batches</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {date && (
            <button onClick={() => setDate('')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <X size={13} /> All dates
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>
      ) : targets.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <p className="text-slate-500 font-medium">{date ? 'No targets for this date' : 'No production targets yet'}</p>
          <p className="text-slate-400 text-sm mt-1">{date ? 'Try clearing the date filter' : 'Create targets in Daily Planning first'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left — target selector */}
          <div className="lg:col-span-2 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Select Target</p>
            {targets.map(t => {
              const p = pct(t.completedQty, t.targetQty);
              const isSelected = t.id === selectedId;
              return (
                <button key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${isSelected ? 'border-indigo-400 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {t.type === 'stage' ? `${t.stage} — ${t.discType}` : `${t.recipeName} × ${t.targetQty}`}
                    </p>
                    {!date && <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{t.date}</p>}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${t.status === 'complete' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {p}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${t.status === 'complete' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${p}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{t.completedQty} / {t.targetQty} units</p>
                </button>
              );
            })}
          </div>

          {/* Right — form + log */}
          <div className="lg:col-span-3 space-y-4">
            {selected && (
              <>
                {/* Current status card */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Current Status</p>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-2xl font-black text-slate-800 tabular-nums">{selected.completedQty.toLocaleString()}</p>
                      <p className="text-sm text-slate-400">of {selected.targetQty.toLocaleString()} units</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${pct(selected.completedQty, selected.targetQty)}%` }} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1 text-right">{pct(selected.completedQty, selected.targetQty)}% complete</p>
                    </div>
                  </div>
                  {selected.defects ? (
                    <p className="text-xs text-amber-600 mt-2">⚠ {selected.defects} defects recorded</p>
                  ) : null}
                </div>

                {/* Entry form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Log New Batch</p>
                  {selected.type === 'recipe' && !selected.materialsDeducted && selected.completedQty === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                      ⚠ Logging the first batch will automatically deduct raw materials from inventory.
                    </div>
                  )}
                  {selected.type === 'recipe' && selected.finishedGoodsAdded && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">
                      ✓ Production complete — finished goods already added to warehouse.
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Units Completed <span className="text-red-500">*</span></label>
                    <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} required
                      placeholder="e.g. 150"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    {qty && Number(qty) > 0 && (
                      <p className="text-xs text-indigo-600 mt-1">
                        Will update: {selected.completedQty} → {selected.completedQty + Number(qty)} units ({pct(selected.completedQty + Number(qty), selected.targetQty)}%)
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Good Units</label>
                      <input type="number" min="0" value={goodQty} onChange={e => setGoodQty(e.target.value)}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Defects</label>
                      <input type="number" min="0" value={defects} onChange={e => setDefects(e.target.value)}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>

                  {/* Quality check */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Quality Check</label>
                    <div className="flex gap-2">
                      {QUALITY_OPTIONS.map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => setQC(opt.value as typeof qualityCheck)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${qualityCheck === opt.value ? opt.cls : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                      <input type="date" value={logDate}
                        onChange={e => setLogDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Time <span className="text-red-500">*</span></label>
                      <div className="flex gap-2">
                        <button type="button"
                          onClick={() => { setUseNow(true); setLogTime(nowHHMM()); }}
                          className={`px-3 py-2 rounded-lg text-sm border transition-colors ${useNow ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                          <Clock size={13} className="inline mr-1" />Now
                        </button>
                        <input type="time" value={logTime}
                          onChange={e => { setLogTime(e.target.value); setUseNow(false); }}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Operator, machine notes, etc."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>

                  {error && <p className="text-red-600 text-sm">{error}</p>}
                  {success && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-sm text-emerald-700">
                      <CheckCircle2 size={14} /> {success}
                    </div>
                  )}

                  <button type="submit" disabled={saving}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {saving ? 'Saving…' : 'Submit Entry'}
                  </button>
                </form>

                {/* Recent entries for this target */}
                {targetEntries.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-50">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Entries for this Target</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {['Time', 'Units', 'Defects', 'Quality', 'Notes', ''].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {targetEntries.map(e => (
                          <tr key={e.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono text-xs text-slate-600">{e.loggedAt}</td>
                            <td className="px-3 py-2 font-bold text-slate-800">+{e.qty}</td>
                            <td className="px-3 py-2 text-slate-500">{e.defects ?? 0}</td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                e.qualityCheck === 'passed' ? 'bg-emerald-100 text-emerald-700' :
                                e.qualityCheck === 'review' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'}`}>
                                {e.qualityCheck ?? 'passed'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-400 text-xs max-w-[120px] truncate">{e.notes ?? '—'}</td>
                            <td className="px-3 py-2">
                              <button onClick={() => handleDeleteEntry(e.id)}
                                className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
