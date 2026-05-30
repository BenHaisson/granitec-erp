import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Trash2, Clock, X, Ban, CalendarCheck } from 'lucide-react';
import { getTargets, getAllTargets, getEntries, getAllEntries, createEntry, deleteEntry, updateTarget } from '@/services/productionTargets.service';
import { getRecipes, startProductionTarget, completeProductionTarget, cancelProductionTarget } from '@/services/production.service';
import type { ProductionTarget, ProductionEntry, Recipe } from '@/types';
import { useDraft, getLastEntryDate, saveLastEntryDate } from '@/hooks/useDraft';
import DraftBanner from '@/components/ui/DraftBanner';
import { todayISO, nowHHMM } from '@/utils/dates';
import { pct } from '@/utils/math';

const QUALITY_OPTIONS = [
  { value: 'passed', label: '✓ Passed', cls: 'bg-emerald-50 border-emerald-300 text-emerald-700' },
  { value: 'review', label: '⚠ Review', cls: 'bg-yellow-50 border-yellow-300 text-yellow-700' },
  { value: 'hold',   label: '✕ Hold',   cls: 'bg-red-50 border-red-300 text-red-700' },
];

type FormDraft = {
  selectedId: string | null;
  qty: string;
  goodQty: string;
  defects: string;
  qualityCheck: 'passed' | 'review' | 'hold';
  logDate: string;
  logTime: string;
  useNow: boolean;
  notes: string;
};

// Factory so getLastEntryDate() is called at mount time, not module-load time
const makeEmptyDraft = (): FormDraft => ({
  selectedId: null,
  qty: '', goodQty: '', defects: '',
  qualityCheck: 'passed',
  logDate: getLastEntryDate(),
  logTime: '', useNow: false,
  notes: '',
});

export default function DataEntry() {
  const [filterDate, setFilterDate] = useState('');
  const [targets, setTargets]       = useState<ProductionTarget[]>([]);
  const [entries, setEntries]       = useState<ProductionEntry[]>([]);
  const [recipes, setRecipes]       = useState<Recipe[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [success, setSuccess]       = useState('');
  const [error, setError]           = useState('');

  const { draft, update, clearDraft, hasDraft, isReady, savedAt, continueDraft, discardDraft } =
    useDraft<FormDraft>('dataentry', makeEmptyDraft());

  // Derived selections
  const selectedId = draft.selectedId;
  const setSelected = (id: string | null) => update({ selectedId: id });

  const load = () => {
    setLoading(true);
    Promise.all([
      filterDate ? getTargets(filterDate) : getAllTargets(),
      filterDate ? getEntries(filterDate) : getAllEntries(),
      getRecipes(),
    ]).then(([t, e, r]) => {
      setTargets(t.sort((a, b) => b.date.localeCompare(a.date)));
      setEntries(e.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)));
      setRecipes(r);
      if (!draft.selectedId && t.length > 0) setSelected(t[0].id);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterDate]);
  // Sync logDate with filter date when filter changes
  useEffect(() => {
    if (filterDate) update({ logDate: filterDate });
  }, [filterDate]);

  const selected = targets.find(t => t.id === selectedId) ?? null;
  const targetEntries = entries.filter(e => e.targetId === selectedId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const n = Number(draft.qty);
    if (!n || n <= 0) { setError('Enter a valid quantity.'); return; }
    const time = draft.useNow ? nowHHMM() : draft.logTime;
    if (!time) { setError('Enter a time.'); return; }
    setError(''); setSaving(true);
    try {
      await createEntry({
        date: draft.logDate,
        targetId: selected.id,
        stage: selected.stage!,
        discType: selected.discType ?? selected.recipeName ?? '',
        qty: n,
        goodQty: draft.goodQty ? Number(draft.goodQty) : undefined,
        defects: draft.defects ? Number(draft.defects) : undefined,
        qualityCheck: draft.qualityCheck,
        loggedAt: time,
        notes: draft.notes || undefined,
      });

      // Remember this date for next time
      saveLastEntryDate(draft.logDate);

      const newCompleted = selected.completedQty + n;
      const newStatus = newCompleted >= selected.targetQty ? 'complete'
        : newCompleted > 0 ? 'in_progress' : 'not_started';
      await updateTarget(selected.id, { completedQty: newCompleted, status: newStatus });

      const recipe = selected.type === 'recipe'
        ? recipes.find(r => r.id === selected.recipeId) : undefined;

      if (recipe && !selected.materialsDeducted && selected.completedQty === 0) {
        try { await startProductionTarget(selected, recipe); }
        catch (startErr) {
          // Entry was logged but material deduction failed — warn the user so they can fix inventory manually
          setSuccess(`⚠ Batch logged but raw material deduction failed: ${startErr instanceof Error ? startErr.message : 'unknown error'}. Check inventory and deduct manually from Daily Planning.`);
          clearDraft();
          update({ qty: '', goodQty: '', defects: '', notes: '', logTime: '', useNow: false, qualityCheck: 'passed' });
          load();
          return;
        }
      }

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

      // Clear draft and reset only the batch fields (keep date/target selected)
      clearDraft();
      update({ qty: '', goodQty: '', defects: '', notes: '', logTime: '', useNow: false, qualityCheck: 'passed' });
      setTimeout(() => setSuccess(''), 5000);
      load();
    } catch { setError('Failed to save entry.'); }
    finally { setSaving(false); }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await deleteEntry(id);
    load();
  };

  const handleCancelProduction = async () => {
    if (!selected) return;
    const recipe = selected.type === 'recipe'
      ? recipes.find(r => r.id === selected.recipeId) : undefined;
    const msg = selected.materialsDeducted
      ? 'Cancel this production? Raw materials will be returned to inventory and all logged entries deleted.'
      : 'Cancel this production target? All logged entries will be deleted.';
    if (!confirm(msg)) return;
    setSaving(true); setError('');
    try {
      if (recipe && selected.materialsDeducted) {
        await cancelProductionTarget(selected, recipe);
      } else {
        await updateTarget(selected.id, { status: 'cancelled', completedQty: 0 });
        const allE = await getAllEntries();
        await Promise.all(allE.filter(e => e.targetId === selected.id).map(e => deleteEntry(e.id)));
      }
      setSuccess('Production cancelled — inventory restored.');
      setTimeout(() => setSuccess(''), 5000);
      load();
    } catch (err) {
      setError(`Cancel failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {/* Draft banner — shown while waiting for user's choice */}
      {hasDraft && (
        <DraftBanner
          savedAt={savedAt}
          onContinue={continueDraft}
          onDiscard={discardDraft}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Data Entry</h2>
          <p className="text-sm text-slate-500 mt-0.5">Log production batches</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {filterDate && (
            <button onClick={() => setFilterDate('')}
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
          <p className="text-slate-500 font-medium">{filterDate ? 'No targets for this date' : 'No production targets yet'}</p>
          <p className="text-slate-400 text-sm mt-1">{filterDate ? 'Try clearing the date filter' : 'Create targets in Daily Planning first'}</p>
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
                    {!filterDate && <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{t.date}</p>}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${t.status === 'complete' ? 'bg-emerald-100 text-emerald-700' : t.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                      {t.status === 'cancelled' ? 'Cancelled' : `${p}%`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${t.status === 'complete' ? 'bg-emerald-500' : t.status === 'cancelled' ? 'bg-red-300' : 'bg-indigo-500'}`}
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
                  {selected.status !== 'cancelled' && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleCancelProduction}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
                        <Ban size={12} /> Cancel Production
                      </button>
                    </div>
                  )}
                  {selected.status === 'cancelled' && (
                    <p className="text-xs text-red-500 mt-2 font-semibold">✕ Production cancelled</p>
                  )}
                </div>

                {/* Entry form */}
                {selected.status !== 'cancelled' && (
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
                      <input type="number" min="1" value={draft.qty}
                        onChange={e => update({ qty: e.target.value })} required
                        placeholder="e.g. 150"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      {draft.qty && Number(draft.qty) > 0 && (
                        <p className="text-xs text-indigo-600 mt-1">
                          Will update: {selected.completedQty} → {selected.completedQty + Number(draft.qty)} units ({pct(selected.completedQty + Number(draft.qty), selected.targetQty)}%)
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Good Units</label>
                        <input type="number" min="0" value={draft.goodQty}
                          onChange={e => update({ goodQty: e.target.value })}
                          placeholder="Optional"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Defects</label>
                        <input type="number" min="0" value={draft.defects}
                          onChange={e => update({ defects: e.target.value })}
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
                            onClick={() => update({ qualityCheck: opt.value as FormDraft['qualityCheck'] })}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${draft.qualityCheck === opt.value ? opt.cls : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                        <div className="flex gap-2">
                          <input type="date" value={draft.logDate}
                            onChange={e => { update({ logDate: e.target.value }); saveLastEntryDate(e.target.value); }}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          {draft.logDate !== todayISO() && (
                            <button type="button"
                              onClick={() => { const t = todayISO(); update({ logDate: t }); saveLastEntryDate(t); }}
                              className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap">
                              <CalendarCheck size={12} /> Today
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Time <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">
                          <button type="button"
                            onClick={() => update({ useNow: true, logTime: nowHHMM() })}
                            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${draft.useNow ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            <Clock size={13} className="inline mr-1" />Now
                          </button>
                          <input type="time" value={draft.logTime}
                            onChange={e => update({ logTime: e.target.value, useNow: false })}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                      <input type="text" value={draft.notes}
                        onChange={e => update({ notes: e.target.value })}
                        placeholder="Operator, machine notes, etc."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>

                    <button type="submit" disabled={saving}
                      className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                      {saving ? 'Saving…' : 'Submit Entry'}
                    </button>
                  </form>
                )}

                {error && <p className="text-red-600 text-sm">{error}</p>}
                {success && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-sm text-emerald-700">
                    <CheckCircle2 size={14} /> {success}
                  </div>
                )}

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
