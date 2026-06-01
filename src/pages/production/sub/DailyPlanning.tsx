import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, AlertCircle } from 'lucide-react';
import { todayISO } from '@/utils/dates';
import { pct } from '@/utils/math';
import { getTargets, getAllTargets, createTarget, updateTarget, deleteTarget } from '@/services/productionTargets.service';
import { getRecipes, checkFeasibilitySync, startProductionTarget, completeProductionTarget, cancelProductionTarget } from '@/services/production.service';
import { getProducts, addUnverifiedStock } from '@/services/inventory.service';
import { createShippingOrder } from '@/services/shipping.service';
import Modal from '@/components/ui/Modal';
import type { ProductionTarget, ProductionStage, Recipe, Product } from '@/types';

const STAGES: ProductionStage[] = ['Press', 'Tourna', 'Laser', 'Pounta', 'Screw', 'Gather', 'Box'];
const LINES = ['Line 1', 'Line 2', 'Both', 'Auto'];


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
  startDate: string;
  deadline: string;
  deadlineTime: string;
  line: string;
  status: ProductionTarget['status'];
  notes: string;
}

const EMPTY_FORM: TargetFormState = {
  type: 'stage', stage: 'Press', discType: '', recipeId: '', recipeName: '',
  targetQty: '', startDate: todayISO(), deadline: todayISO(), deadlineTime: '17:00',
  line: 'Both', status: 'not_started', notes: '',
};

interface DailyPlanningProps {
  initialShortfalls?: Array<{ recipeId: string; recipeName: string; targetQty: number }>;
  onShortfallsCleared?: () => void;
}

export default function DailyPlanning({ initialShortfalls, onShortfallsCleared }: DailyPlanningProps) {
  const [date, setDate]         = useState('');
  const [targets, setTargets]   = useState<ProductionTarget[]>([]);
  const [recipes, setRecipes]   = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [showModal, setShowModal]   = useState(!!initialShortfalls?.length);
  const [editTarget, setEditTarget] = useState<ProductionTarget | null>(null);
  const [form, setForm]             = useState<TargetFormState>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  // Feasibility gate state
  type Shortfall = { productId: string; need: number; have: number };
  const [feasibilityDialog, setFeasibilityDialog] = useState<{
    shortfalls: Shortfall[];
    maxProducible: number;
    pendingPayload: Omit<ProductionTarget, 'id' | 'createdAt'>;
  } | null>(null);
  const [feasSaving, setFeasSaving] = useState(false);
  const [actingId, setActingId]     = useState<string | null>(null); // target currently being started/completed

  // Order form state (shown inside feasibility dialog)
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderRef,      setOrderRef]      = useState('');
  const [orderSupplier, setOrderSupplier] = useState('');
  const [orderDate,     setOrderDate]     = useState('');
  const [orderQtys,     setOrderQtys]     = useState<Record<string, string>>({});
  const [orderSaving,   setOrderSaving]   = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([date ? getTargets(date) : getAllTargets(), getRecipes(), getProducts()])
      .then(([t, r, p]) => { setTargets(t); setRecipes(r); setProducts(p); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [date]);

  // When shortfalls from sales page arrive, pre-fill the form with first shortfall
  useEffect(() => {
    if (initialShortfalls?.length && recipes.length > 0) {
      const sf = initialShortfalls[0];
      setForm(prev => ({
        ...prev,
        type: 'recipe',
        recipeId: sf.recipeId,
        recipeName: sf.recipeName,
        targetQty: String(sf.targetQty),
        startDate: date || todayISO(),
        deadline: date || todayISO(),
      }));
    }
  }, [initialShortfalls, recipes]);

  const discTypes = Array.from(new Set(
    products.filter(p => p.category === 'Aluminium Disc').map(p => p.name)
  )).sort();

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, startDate: date || todayISO(), deadline: date || todayISO() });
    setError('');
    setShowModal(true);
  };

  const openEdit = (t: ProductionTarget) => {
    setEditTarget(t);
    setForm({
      type: t.type, stage: t.stage ?? 'Press', discType: t.discType ?? '',
      recipeId: t.recipeId ?? '', recipeName: t.recipeName ?? '',
      targetQty: String(t.targetQty), startDate: t.startDate ?? t.date,
      deadline: t.deadline, deadlineTime: t.deadlineTime ?? '17:00',
      line: t.line ?? 'Both', status: t.status, notes: t.notes ?? '',
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
      const qty = Number(form.targetQty);
      const payload: Omit<ProductionTarget, 'id' | 'createdAt'> = {
        date: form.startDate || date,
        type: form.type,
        stage:       form.type === 'stage' ? form.stage : undefined,
        discType:    form.type === 'stage' ? form.discType : undefined,
        recipeId:    form.type === 'recipe' ? form.recipeId : undefined,
        recipeName:  form.type === 'recipe' ? form.recipeName : undefined,
        targetQty:   qty,
        completedQty: editTarget?.completedQty ?? 0,
        startDate:   form.startDate || undefined,
        deadline:    form.deadline,
        deadlineTime: form.deadlineTime || undefined,
        line:        form.line || undefined,
        status:      form.status,
        notes:       form.notes || undefined,
      };
      // Feasibility gate for new recipe targets only
      // Uses sync check — products + recipes already in component state, no extra Firestore reads
      if (form.type === 'recipe' && !editTarget) {
        const recipe = recipes.find(r => r.id === form.recipeId);
        const { feasible, shortfalls } = recipe
          ? checkFeasibilitySync(recipe, qty, products)
          : { feasible: true, shortfalls: [] };
        if (!feasible) {
          const components = recipe?.components ?? [];
          const stockMap = new Map(products.map(p => [p.id, p.stock_level + (p.unverified_stock ?? 0)]));
          const maxProducible = shortfalls.length > 0
            ? Math.min(...components.map(c => Math.floor((stockMap.get(c.productId) ?? 0) / c.quantity)))
            : qty;
          setFeasibilityDialog({ shortfalls, maxProducible: Math.max(0, maxProducible), pendingPayload: payload });
          setSaving(false);
          return;
        }
      }
      if (editTarget) {
        await updateTarget(editTarget.id, payload);
      } else {
        await createTarget(payload);
        // Clear sales-page shortfall state after first target created
        if (initialShortfalls?.length && onShortfallsCleared) {
          onShortfallsCleared();
        }
      }
      setShowModal(false);
      load();
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleFeasibilityAutoAdjust = async () => {
    if (!feasibilityDialog) return;
    setFeasSaving(true);
    try {
      const adjusted = { ...feasibilityDialog.pendingPayload, targetQty: feasibilityDialog.maxProducible };
      await createTarget(adjusted);
      if (initialShortfalls?.length && onShortfallsCleared) {
        onShortfallsCleared();
      }
      setFeasibilityDialog(null); setShowModal(false); load();
    } catch { setError('Failed to create target.'); }
    finally { setFeasSaving(false); }
  };

  const handleFeasibilityUnverified = async () => {
    if (!feasibilityDialog) return;
    setFeasSaving(true);
    try {
      const targetId = await createTarget(feasibilityDialog.pendingPayload);
      for (const sf of feasibilityDialog.shortfalls) {
        const shortAmount = sf.need - sf.have;
        await addUnverifiedStock(sf.productId, shortAmount, `Production target ${targetId}: ${feasibilityDialog.pendingPayload.recipeName ?? ''}`);
      }
      if (initialShortfalls?.length && onShortfallsCleared) {
        onShortfallsCleared();
      }
      setFeasibilityDialog(null); setShowModal(false); load();
    } catch { setError('Failed to create target.'); }
    finally { setFeasSaving(false); }
  };

  const openOrderForm = () => {
    if (!feasibilityDialog) return;
    const year = new Date().getFullYear();
    const uid  = String(Date.now()).slice(-4);
    setOrderRef(`SH-${year}-${uid}`);
    setOrderSupplier('');
    setOrderDate(todayISO());
    const qtys: Record<string, string> = {};
    feasibilityDialog.shortfalls.forEach(sf => { qtys[sf.productId] = String(sf.need - sf.have); });
    setOrderQtys(qtys);
    setShowOrderForm(true);
  };

  const handleCreateOrder = async () => {
    if (!feasibilityDialog || !orderRef.trim()) return;
    setOrderSaving(true);
    try {
      const lines = feasibilityDialog.shortfalls
        .filter(sf => Number(orderQtys[sf.productId] ?? 0) > 0)
        .map(sf => {
          const p = products.find(prod => prod.id === sf.productId);
          return { productId: sf.productId, productName: p?.name ?? sf.productId, sku: p?.sku ?? '', qty: Number(orderQtys[sf.productId]), reconcile: false };
        });
      await createShippingOrder({ ref: orderRef.trim(), supplier: orderSupplier.trim() || undefined, date: orderDate, lines });
      setFeasibilityDialog(null); setShowOrderForm(false);
    } catch (e) { alert(`Failed to create order: ${e instanceof Error ? e.message : 'Unknown error'}`); }
    finally { setOrderSaving(false); }
  };

  const handleDelete = async (t: ProductionTarget) => {
    const label = t.type === 'stage' ? `${t.stage} — ${t.discType}` : t.recipeName;
    const hasInventoryImpact = t.materialsDeducted || t.finishedGoodsAdded;
    const msg = hasInventoryImpact
      ? `Delete "${label}"?\n\nMaterials will be returned to inventory and all related movements deleted.`
      : `Delete "${label}"? This cannot be undone.`;
    if (!confirm(msg)) return;

    try {
      const recipe = t.type === 'recipe' ? recipes.find(r => r.id === t.recipeId) : undefined;

      if (recipe && t.materialsDeducted) {
        // Reverse inventory: return materials, remove movements, delete entries
        await cancelProductionTarget(t, recipe);
      } else {
        // No inventory impact — just delete entries
        const { getAllEntries, deleteEntry } = await import('@/services/productionTargets.service');
        const allE = await getAllEntries();
        await Promise.all(allE.filter(e => e.targetId === t.id).map(e => deleteEntry(e.id)));
      }

      // Delete the target document itself
      await deleteTarget(t.id);
      load();
    } catch (e) {
      alert(`Delete failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleStart = async (t: ProductionTarget) => {
    if (actingId) return;
    const recipe = recipes.find(r => r.id === t.recipeId);
    if (!recipe) { setError('Recipe not found for this target.'); return; }
    if (!confirm(`Start production of "${t.recipeName}" × ${t.targetQty} sets?\n\nThis will deduct raw materials from inventory immediately and cannot be undone.`)) return;
    setActingId(t.id); setError('');
    try {
      await startProductionTarget(t, recipe);
      load();
    } catch (e) { setError(`Failed to start: ${e instanceof Error ? e.message : 'Unknown error'}`); }
    finally { setActingId(null); }
  };

  const handleComplete = async (t: ProductionTarget) => {
    if (actingId) return;
    const recipe = recipes.find(r => r.id === t.recipeId);
    if (!recipe) { setError('Recipe not found for this target.'); return; }
    if (t.completedQty <= 0) { setError('No completed quantity logged yet. Log entries in Data Entry first.'); return; }
    if (!confirm(`Complete production of "${t.recipeName}"?\n\n${t.completedQty} sets will be added to warehouse stock.`)) return;
    setActingId(t.id); setError('');
    try {
      await completeProductionTarget(t, recipe);
      load();
    } catch (e) { setError(`Failed to complete: ${e instanceof Error ? e.message : 'Unknown error'}`); }
    finally { setActingId(null); }
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
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X size={13} /></button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Daily Planning</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {targets.length} target{targets.length !== 1 ? 's' : ''} — {date ? date : 'all time'}
          </p>
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
          <p className="text-slate-500 font-medium">{date ? 'No targets for this date' : 'No production targets yet'}</p>
          <p className="text-slate-400 text-sm mt-1">{date ? 'Try clearing the date filter' : 'Add a target to get started'}</p>
        </div>
      ) : (() => {
        const renderStageCard = (t: ProductionTarget) => {
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
                    <div><span className="text-slate-400">Start Date</span><br /><strong className="text-slate-700">{t.startDate ?? t.date}</strong></div>
                    <div><span className="text-slate-400">Deadline</span><br /><strong className="text-slate-700">{t.deadline}{t.deadlineTime ? ` ${t.deadlineTime}` : ''}</strong></div>
                    <div><span className="text-slate-400">Line</span><br /><strong className="text-slate-700">{t.line ?? '—'}</strong></div>
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
        };

        const renderRecipeCard = (t: ProductionTarget) => {
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-500 mb-3">
                    <div><span className="text-slate-400">Start Date</span><br /><strong className="text-slate-700">{t.startDate ?? t.date}</strong></div>
                    <div><span className="text-slate-400">Deadline</span><br /><strong className="text-slate-700">{t.deadline}{t.deadlineTime ? ` ${t.deadlineTime}` : ''}</strong></div>
                    <div><span className="text-slate-400">Sets Done</span><br /><strong className="text-slate-700">{t.completedQty}</strong></div>
                    <div><span className="text-slate-400">Notes</span><br /><strong className="text-slate-700">{t.notes ?? '—'}</strong></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!t.materialsDeducted && (
                      <button onClick={() => handleStart(t)}
                        disabled={actingId === t.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                        {actingId === t.id ? 'Starting…' : '▶ Start Production'}
                      </button>
                    )}
                    {!t.finishedGoodsAdded && t.completedQty > 0 && (
                      <button onClick={() => handleComplete(t)}
                        disabled={actingId === t.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
                        {actingId === t.id ? 'Completing…' : '✓ Complete'}
                      </button>
                    )}
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
        };

        if (date) {
          return (
            <>
              {stageTargets.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Stage Targets</p>
                  <div className="space-y-2">{stageTargets.map(renderStageCard)}</div>
                </div>
              )}
              {recipeTargets.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Recipe Targets</p>
                  <div className="space-y-2">{recipeTargets.map(renderRecipeCard)}</div>
                </div>
              )}
            </>
          );
        }

        // All-records mode: group by date
        const dateMap = new Map<string, ProductionTarget[]>();
        for (const t of targets) {
          const existing = dateMap.get(t.date) ?? [];
          existing.push(t);
          dateMap.set(t.date, existing);
        }
        const dateGroups = Array.from(dateMap.entries());

        return (
          <div className="space-y-6">
            {dateGroups.map(([groupDate, items]) => (
              <div key={groupDate}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold text-slate-500">{groupDate}</span>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-[10px] text-slate-400">{items.length} target{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2">
                  {items.filter(t => t.type === 'stage').map(renderStageCard)}
                  {items.filter(t => t.type === 'recipe').map(renderRecipeCard)}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

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
                {(() => {
                  const productMap = new Map(products.map(p => [p.id, p]));
                  const catPriority = (c: string) => {
                    const l = c.toLowerCase();
                    if (l.includes('set') || l.includes('pack'))          return '0' + l;
                    if (l.includes('marmite') || l.includes('casserole')) return '1' + l;
                    if (l.includes('crêpe') || l.includes('crepe'))       return '2' + l;
                    return '9' + l;
                  };
                  const cats = Array.from(new Set(
                    recipes.map(r => productMap.get(r.finishedProductId)?.category ?? 'Other')
                  )).sort((a, b) => catPriority(a).localeCompare(catPriority(b)));
                  return (
                    <select value={form.recipeId}
                      onChange={e => {
                        const r = recipes.find(r => r.id === e.target.value);
                        const prod = r ? productMap.get(r.finishedProductId) : undefined;
                        setForm(f => ({ ...f, recipeId: e.target.value, recipeName: prod?.name ?? r?.finishedProductId ?? '' }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Select recipe…</option>
                      {cats.map(cat => {
                        const catRecipes = recipes.filter(r => (productMap.get(r.finishedProductId)?.category ?? 'Other') === cat);
                        return (
                          <optgroup key={cat} label={cat}>
                            {catRecipes.map(r => {
                              const prod = productMap.get(r.finishedProductId);
                              return (
                                <option key={r.id} value={r.id}>
                                  {prod?.name ?? r.finishedProductId}
                                </option>
                              );
                            })}
                          </optgroup>
                        );
                      })}
                    </select>
                  );
                })()}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {form.type === 'recipe' ? 'Sets' : 'Units'} Target <span className="text-red-500">*</span>
              </label>
              <input type="number" min="1" value={form.targetQty}
                onChange={e => setForm(f => ({ ...f, targetQty: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <input type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
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

      {/* Feasibility Gate Dialog */}
      {feasibilityDialog && (
        <Modal title="Insufficient Stock" onClose={() => { setFeasibilityDialog(null); setShowOrderForm(false); }}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Not enough raw materials to produce <span className="font-semibold">{feasibilityDialog.pendingPayload.targetQty}</span> units.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-red-100 text-red-700">
                    <th className="text-left px-3 py-2">Component</th>
                    <th className="text-right px-3 py-2">Need</th>
                    <th className="text-right px-3 py-2">Have</th>
                    <th className="text-right px-3 py-2">Short</th>
                  </tr>
                </thead>
                <tbody>
                  {feasibilityDialog.shortfalls.map(sf => {
                    const p = products.find(p => p.id === sf.productId);
                    return (
                      <tr key={sf.productId} className="border-t border-red-100">
                        <td className="px-3 py-2 text-slate-700">{p?.name ?? sf.productId}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{sf.need}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{sf.have}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-600 font-semibold">−{sf.need - sf.have}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
            {!showOrderForm ? (
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={handleFeasibilityAutoAdjust}
                  disabled={feasSaving || feasibilityDialog.maxProducible <= 0}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {feasibilityDialog.maxProducible > 0
                    ? `Auto-adjust to ${feasibilityDialog.maxProducible} units`
                    : 'Cannot produce any (stock at zero)'}
                </button>
                <button
                  onClick={handleFeasibilityUnverified}
                  disabled={feasSaving}
                  className="w-full py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  Use unverified stock &amp; keep {feasibilityDialog.pendingPayload.targetQty} units
                </button>
                <button
                  onClick={openOrderForm}
                  disabled={feasSaving}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  📦 Order Missing Materials
                </button>
                <button
                  onClick={() => { setFeasibilityDialog(null); setShowOrderForm(false); }}
                  className="w-full py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Reference</label>
                    <input type="text" value={orderRef} onChange={e => setOrderRef(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Supplier</label>
                    <input type="text" value={orderSupplier} onChange={e => setOrderSupplier(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                    <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
                  {(() => {
                    const groups = new Map<string, typeof feasibilityDialog.shortfalls>();
                    feasibilityDialog.shortfalls.forEach(sf => {
                      const cat = products.find(p => p.id === sf.productId)?.category ?? 'Other';
                      if (!groups.has(cat)) groups.set(cat, []);
                      groups.get(cat)!.push(sf);
                    });
                    return Array.from(groups.entries()).map(([cat, items]) => (
                      <div key={cat}>
                        <div className="bg-slate-50 px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">{cat}</div>
                        {items.map(sf => {
                          const p = products.find(prod => prod.id === sf.productId);
                          return (
                            <div key={sf.productId} className="flex items-center gap-3 px-3 py-2 border-t border-slate-100">
                              <span className="flex-1 text-slate-700 text-xs truncate">{p?.name ?? sf.productId}</span>
                              <input type="number" min="0" value={orderQtys[sf.productId] ?? ''}
                                onChange={e => setOrderQtys(q => ({ ...q, [sf.productId]: e.target.value }))}
                                className="w-20 px-2 py-1 border border-slate-300 rounded text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                              <span className="text-[10px] text-slate-400 w-8 shrink-0">{p?.unit}</span>
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateOrder} disabled={orderSaving || !orderRef.trim()}
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {orderSaving ? 'Creating…' : 'Create Shipping Order'}
                  </button>
                  <button onClick={() => setShowOrderForm(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
