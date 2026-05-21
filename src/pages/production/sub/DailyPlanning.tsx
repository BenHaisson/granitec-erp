import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { getTargets, createTarget, updateTarget, deleteTarget } from '@/services/productionTargets.service';
import { getRecipes } from '@/services/production.service';
import { getProducts } from '@/services/inventory.service';
import Modal from '@/components/ui/Modal';
import type { ProductionTarget, ProductionStage, Recipe, Product } from '@/types';

const STAGES: ProductionStage[] = ['Press', 'Tourna', 'Laser', 'Pounta', 'Screw', 'Gather', 'Box'];
const LINES = ['Line 1', 'Line 2', 'Both', 'Auto'];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function pct(done: number, total: number) { return total === 0 ? 0 : Math.round((done / total) * 100); }

const STATUS_CLS: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  at_risk:     'bg-yellow-100 text-yellow-700',
  complete:    'bg-emerald-100 text-emerald-700',
};
const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started', in_progress: 'In Progress',
  at_risk: 'At Risk', complete: 'Complete',
};

interface TargetFormState {
  type: 'stage' | 'recipe';
  stage: ProductionStage;
  discType: string;
  recipeId: string;
  recipeName: string;
  targetQty: string;
  deadline: string;
  deadlineTime: string;
  line: string;
  status: ProductionTarget['status'];
  notes: string;
}

const EMPTY_FORM: TargetFormState = {
  type: 'stage', stage: 'Press', discType: '', recipeId: '', recipeName: '',
  targetQty: '', deadline: todayISO(), deadlineTime: '17:00',
  line: 'Both', status: 'not_started', notes: '',
};

export default function DailyPlanning() {
  const [date, setDate]         = useState(todayISO());
  const [targets, setTargets]   = useState<ProductionTarget[]>([]);
  const [recipes, setRecipes]   = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [showModal, setShowModal]   = useState(false);
  const [editTarget, setEditTarget] = useState<ProductionTarget | null>(null);
  const [form, setForm]             = useState<TargetFormState>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([getTargets(date), getRecipes(), getProducts()])
      .then(([t, r, p]) => { setTargets(t); setRecipes(r); setProducts(p); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [date]);

  const discTypes = Array.from(new Set(
    products.filter(p => p.category === 'Aluminium Disc').map(p => p.name)
  )).sort();

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, deadline: date });
    setError('');
    setShowModal(true);
  };

  const openEdit = (t: ProductionTarget) => {
    setEditTarget(t);
    setForm({
      type: t.type, stage: t.stage ?? 'Press', discType: t.discType ?? '',
      recipeId: t.recipeId ?? '', recipeName: t.recipeName ?? '',
      targetQty: String(t.targetQty), deadline: t.deadline,
      deadlineTime: t.deadlineTime ?? '17:00', line: t.line ?? 'Both',
      status: t.status, notes: t.notes ?? '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.targetQty || Number(form.targetQty) <= 0) { setError('Target quantity required.'); return; }
    if (form.type === 'stage' && !form.discType) { setError('Disc type required.'); return; }
    if (form.type === 'recipe' && !form.recipeId) { setError('Select a recipe.'); return; }
    setError(''); setSaving(true);
    try {
      const payload: Omit<ProductionTarget, 'id' | 'createdAt'> = {
        date,
        type: form.type,
        stage:       form.type === 'stage' ? form.stage : undefined,
        discType:    form.type === 'stage' ? form.discType : undefined,
        recipeId:    form.type === 'recipe' ? form.recipeId : undefined,
        recipeName:  form.type === 'recipe' ? form.recipeName : undefined,
        targetQty:   Number(form.targetQty),
        completedQty: editTarget?.completedQty ?? 0,
        deadline:    form.deadline,
        deadlineTime: form.deadlineTime || undefined,
        line:        form.line || undefined,
        status:      form.status,
        notes:       form.notes || undefined,
      };
      if (editTarget) {
        await updateTarget(editTarget.id, payload);
      } else {
        await createTarget(payload);
      }
      setShowModal(false);
      load();
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t: ProductionTarget) => {
    if (!confirm(`Delete target "${t.type === 'stage' ? `${t.stage} — ${t.discType}` : t.recipeName}"?`)) return;
    await deleteTarget(t.id);
    load();
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const stageTargets  = targets.filter(t => t.type === 'stage');
  const recipeTargets = targets.filter(t => t.type === 'recipe');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Daily Planning</h2>
          <p className="text-sm text-slate-500 mt-0.5">{targets.length} target{targets.length !== 1 ? 's' : ''} for {date}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus size={15} /> Add Target
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>
      ) : targets.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-16 text-center">
          <p className="text-slate-500 font-medium">No targets yet</p>
          <p className="text-slate-400 text-sm mt-1">Create stage or recipe targets for this date</p>
        </div>
      ) : (
        <>
          {/* Stage Targets */}
          {stageTargets.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Stage Targets</p>
              <div className="space-y-2">
                {stageTargets.map(t => {
                  const p = pct(t.completedQty, t.targetQty);
                  const isOpen = expanded.has(t.id);
                  return (
                    <div key={t.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                      <button className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                        onClick={() => toggleExpand(t.id)}>
                        {isOpen ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{t.stage} — {t.discType}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${p}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 tabular-nums shrink-0">{t.completedQty}/{t.targetQty} ({p}%)</span>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLS[t.status]}`}>
                          {STATUS_LABEL[t.status]}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 border-t border-slate-50">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-500 mb-3">
                            <div><span className="text-slate-400">Deadline</span><br /><strong className="text-slate-700">{t.deadline}{t.deadlineTime ? ` ${t.deadlineTime}` : ''}</strong></div>
                            <div><span className="text-slate-400">Line</span><br /><strong className="text-slate-700">{t.line ?? '—'}</strong></div>
                            <div><span className="text-slate-400">Defects</span><br /><strong className="text-slate-700">{t.defects ?? 0}</strong></div>
                            <div><span className="text-slate-400">Notes</span><br /><strong className="text-slate-700">{t.notes ?? '—'}</strong></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(t)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                              <Pencil size={11} /> Edit
                            </button>
                            <button onClick={() => handleDelete(t)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                              <Trash2 size={11} /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recipe Targets */}
          {recipeTargets.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Recipe Targets</p>
              <div className="space-y-2">
                {recipeTargets.map(t => {
                  const p = pct(t.completedQty, t.targetQty);
                  const isOpen = expanded.has(t.id);
                  return (
                    <div key={t.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                      <button className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                        onClick={() => toggleExpand(t.id)}>
                        {isOpen ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{t.recipeName} × {t.targetQty} sets</p>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${p}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 tabular-nums shrink-0">{t.completedQty}/{t.targetQty} sets ({p}%)</span>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLS[t.status]}`}>
                          {STATUS_LABEL[t.status]}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 border-t border-slate-50">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-500 mb-3">
                            <div><span className="text-slate-400">Deadline</span><br /><strong className="text-slate-700">{t.deadline}{t.deadlineTime ? ` ${t.deadlineTime}` : ''}</strong></div>
                            <div><span className="text-slate-400">Sets Done</span><br /><strong className="text-slate-700">{t.completedQty}</strong></div>
                            <div><span className="text-slate-400">Notes</span><br /><strong className="text-slate-700">{t.notes ?? '—'}</strong></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(t)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                              <Pencil size={11} /> Edit
                            </button>
                            <button onClick={() => handleDelete(t)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                              <Trash2 size={11} /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <Modal title={editTarget ? 'Edit Target' : 'New Target'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type toggle */}
            {!editTarget && (
              <div className="flex gap-2">
                {(['stage', 'recipe'] as const).map(tp => (
                  <button key={tp} type="button"
                    onClick={() => setForm(f => ({ ...f, type: tp }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === tp ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {tp === 'stage' ? 'Stage Target' : 'Recipe Target'}
                  </button>
                ))}
              </div>
            )}

            {form.type === 'stage' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Stage</label>
                    <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as ProductionStage }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {STAGES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Disc Type</label>
                    {discTypes.length > 0 ? (
                      <select value={form.discType} onChange={e => setForm(f => ({ ...f, discType: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select disc…</option>
                        {discTypes.map(d => <option key={d}>{d}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={form.discType} onChange={e => setForm(f => ({ ...f, discType: e.target.value }))}
                        placeholder="e.g. 240×2.7mm"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Line</label>
                  <select value={form.line} onChange={e => setForm(f => ({ ...f, line: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {LINES.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recipe</label>
                <select value={form.recipeId}
                  onChange={e => {
                    const r = recipes.find(r => r.id === e.target.value);
                    setForm(f => ({ ...f, recipeId: e.target.value, recipeName: r?.finishedProductId ?? e.target.value }));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select recipe…</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.finishedProductId}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {form.type === 'recipe' ? 'Sets' : 'Units'} Target <span className="text-red-500">*</span>
                </label>
                <input type="number" min="1" value={form.targetQty}
                  onChange={e => setForm(f => ({ ...f, targetQty: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
                <input type="date" value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            {editTarget && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProductionTarget['status'] }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Optional…"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Target'}
              </button>
              <button type="button" onClick={() => setShowModal(false)}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
