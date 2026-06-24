import { useEffect, useState } from 'react';
import {
  Database, AlertTriangle, ShoppingBag, Layers, Wrench, Package,
  BookOpen, BookMarked, Cpu, RefreshCw, UserPlus,
  Trash2, BadgeCheck, ChevronDown, ChevronUp, Download, Settings2,
} from 'lucide-react';
import {
  getProducts, getProductsFresh, upsertProduct,
  deleteAllMovements, deleteMovementsByReasons, resetAllStockToZero, clearAllUnverifiedStock,
  resetFinishedProductStock,
  updateProduct, deleteProduct, recalculateStockFromMovements,
  backfillPurchaseMovements, deletePhantomAdjustmentMovements, reconcileInventoryToMovements,
} from '@/services/inventory.service';
import { deleteAllProductionTargets, deleteAllProductionEntries } from '@/services/productionTargets.service';
import { getOrders, deleteAllOrders } from '@/services/orders.service';
import {
  getRecipes, upsertRecipe, deleteAllRecipes,
  getProductionOrders, deleteAllProductionOrders,
} from '@/services/production.service';
import {
  getMachines, upsertMachine, deleteAllMachines,
  getLibraryItems, upsertLibraryItem, deleteAllLibraryItems,
} from '@/services/library.service';
import {
  getShippingOrders, deleteShippingOrder, updateShippingOrderRef,
  findAndDeleteDuplicateReceipts, deleteReceivedShippingOrder,
  deleteAllShippingOrders,
} from '@/services/shipping.service';
import { SEED_PRODUCTS } from '@/data/seedProducts';
import { DISC_PRODUCTS } from '@/data/seedDiscs';
import { ACCESSORIES, PACKAGING } from '@/data/seedAccessories';
import { SEED_RECIPES } from '@/data/seedRecipes';
import { MACHINES } from '@/data/seedMachines';
import { LIBRARY_ITEMS } from '@/data/seedLibrary';
import type { Product } from '@/types';

type OpState = { running: boolean; status: 'idle' | 'done' | 'error'; msg: string };
const $idle: OpState = { running: false, status: 'idle', msg: '' };

const ALL_CATALOG_SKUS = new Set([
  ...SEED_PRODUCTS.map(p => p.sku),
  ...DISC_PRODUCTS.map(p => p.sku),
  ...ACCESSORIES.map(p => p.sku),
  ...PACKAGING.map(p => p.sku),
]);

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

interface Stats {
  finished: number; discs: number; accessories: number; packaging: number;
  recipes: number; machines: number; library: number;
  orders: number; prodCompleted: number;
}

export default function SettingsPage() {
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [extraItems,   setExtraItems]   = useState<Product[] | null>(null);
  const [extrasOpen,   setExtrasOpen]   = useState(true);
  const [setupOpen,    setSetupOpen]    = useState(false);

  const [opProducts,  setOpProducts]  = useState<OpState>($idle);
  const [opDiscs,     setOpDiscs]     = useState<OpState>($idle);
  const [opAcc,       setOpAcc]       = useState<OpState>($idle);
  const [opPkg,       setOpPkg]       = useState<OpState>($idle);
  const [opRecipes,   setOpRecipes]   = useState<OpState>($idle);
  const [opMachines,  setOpMachines]  = useState<OpState>($idle);
  const [opLib,       setOpLib]       = useState<OpState>($idle);
  const [opCleanup,   setOpCleanup]   = useState<OpState>($idle);
  const [opDupClean,  setOpDupClean]  = useState<OpState>($idle);
  const [opRecalc,    setOpRecalc]    = useState<OpState>($idle);
  const [opReset,     setOpReset]     = useState<OpState>($idle);
  const [resetText,   setResetText]   = useState('');
  const [opClearProd, setOpClearProd] = useState<OpState>($idle);
  const [opClearUnv,  setOpClearUnv]  = useState<OpState>($idle);
  const [opClearWh,   setOpClearWh]   = useState<OpState>($idle);
  const [opClearMovs, setOpClearMovs] = useState<OpState>($idle);
  const [opReconc,    setOpReconc]    = useState<OpState>($idle);

  const loadStats = async (fresh = false) => {
    const [products, orders, recipes, machines, libItems, prodOrders] = await Promise.all([
      fresh ? getProductsFresh() : getProducts(),
      getOrders(), getRecipes(), getMachines(), getLibraryItems(), getProductionOrders(),
    ]);
    setStats({
      finished:     products.filter(p => p.type === 'FINISHED').length,
      discs:        products.filter(p => p.type === 'RAW' && p.category !== 'Accessories' && p.category !== 'Packaging').length,
      accessories:  products.filter(p => p.category === 'Accessories').length,
      packaging:    products.filter(p => p.category === 'Packaging').length,
      recipes:      recipes.length,
      machines:     machines.length,
      library:      libItems.length,
      orders:       orders.length,
      prodCompleted: prodOrders.filter(x => x.status === 'COMPLETED').length,
    });
    setExtraItems(products.filter(p => !ALL_CATALOG_SKUS.has(p.sku) && p.source !== 'catalog'));
  };

  useEffect(() => { loadStats(); }, []);

  const run = async (
    setter: React.Dispatch<React.SetStateAction<OpState>>,
    fn: () => Promise<string>,
  ) => {
    setter({ running: true, status: 'idle', msg: '' });
    try {
      const msg = await fn();
      setter({ running: false, status: 'done', msg });
      setTimeout(() => setter($idle), 4000);
    } catch (e) {
      setter({ running: false, status: 'error', msg: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  };

  const handleImportProducts = () => run(setOpProducts, async () => {
    for (const p of SEED_PRODUCTS) await upsertProduct({ ...p, source: 'catalog' });
    return `${SEED_PRODUCTS.length} finished products imported.`;
  });

  const handleImportDiscs = () => run(setOpDiscs, async () => {
    for (const p of DISC_PRODUCTS) await upsertProduct({ ...p, source: 'catalog' });
    return `${DISC_PRODUCTS.length} disc products imported.`;
  });

  const handleImportAcc = () => run(setOpAcc, async () => {
    for (const p of ACCESSORIES) await upsertProduct({ ...p, source: 'catalog' });
    return `${ACCESSORIES.length} accessories imported.`;
  });

  const handleImportPkg = () => run(setOpPkg, async () => {
    for (const p of PACKAGING) await upsertProduct({ ...p, source: 'catalog' });
    return `${PACKAGING.length} packaging items imported.`;
  });

  const handleImportRecipes = () => run(setOpRecipes, async () => {
    await deleteAllRecipes();
    for (const r of SEED_RECIPES)
      await upsertRecipe({ finishedProductId: r.finishedProductSku, components: r.components.map(c => ({ productId: c.productSku, quantity: c.quantity })) });
    return `${SEED_RECIPES.length} BOM recipes imported.`;
  });

  const handleImportMachines = () => run(setOpMachines, async () => {
    await deleteAllMachines();
    for (const m of MACHINES) await upsertMachine(m);
    return `${MACHINES.length} machines & tools imported.`;
  });

  const handleImportLibrary = () => run(setOpLib, async () => {
    await deleteAllLibraryItems();
    for (const item of LIBRARY_ITEMS) await upsertLibraryItem(item);
    return `${LIBRARY_ITEMS.length} library items imported.`;
  });

  const handleDupClean = () => run(setOpDupClean, async () => {
    const count = await findAndDeleteDuplicateReceipts();
    if (count === 0) return 'No duplicate receipts found.';
    await recalculateStockFromMovements();
    return `Removed ${count} duplicate receipt(s) · Stock recalculated.`;
  });

  const handleRecalculate = () => run(setOpRecalc, async () => {
    const phantoms = await deletePhantomAdjustmentMovements();
    const filled = await backfillPurchaseMovements();
    const count = await recalculateStockFromMovements();
    const msgs: string[] = [];
    if (phantoms > 0) msgs.push(`Removed ${phantoms} phantom movement(s)`);
    if (filled > 0) msgs.push(`Restored ${filled} missing movement(s)`);
    return `Stock recalculated for ${count} product(s)${msgs.length ? ' · ' + msgs.join(' · ') : ''}.`;
  });

  const PACKAGING_SKUS = new Set(PACKAGING.map(p => p.sku));

  const handleCleanupShipping = () => run(setOpCleanup, async () => {
    const orders = await getShippingOrders();
    let deleted = 0, renamed = 0;
    for (const order of orders) {
      const isPackaging = order.lines.length > 0 && order.lines.every(l => PACKAGING_SKUS.has(l.productId));
      if (isPackaging) {
        if (order.status === 'RECEIVED') {
          await deleteReceivedShippingOrder(order);
        } else {
          await deleteShippingOrder(order.id);
        }
        deleted++;
      } else {
        const newRef = order.ref.replace(/^SH-\d{4}-/, 'Disc-2024-');
        if (newRef !== order.ref) {
          await updateShippingOrderRef(order.id, order.ref, newRef);
          renamed++;
        }
      }
    }
    return `Deleted ${deleted} packaging orders · Renamed ${renamed} disc orders.`;
  });

  const handleApproveExtra = async (item: Product) => {
    await updateProduct(item.id, { source: 'catalog' });
    await loadStats(true);
  };

  const handleDeleteExtra = async (item: Product) => {
    if (!confirm(`Delete "${item.name}" (${item.sku})? This cannot be undone.`)) return;
    await deleteProduct(item.id);
    await loadStats(true);
  };

  const handleResetAll = async () => {
    if (resetText !== 'RESET') return;
    setOpReset({ running: true, status: 'idle', msg: 'Deleting sales orders…' });
    try {
      await deleteAllOrders();
      setOpReset(s => ({ ...s, msg: 'Deleting shipping orders…' }));
      await deleteAllShippingOrders();
      setOpReset(s => ({ ...s, msg: 'Deleting inventory movements…' }));
      await deleteAllMovements();
      setOpReset(s => ({ ...s, msg: 'Deleting production orders…' }));
      await deleteAllProductionOrders();
      setOpReset(s => ({ ...s, msg: 'Resetting stock levels to 0…' }));
      await resetAllStockToZero();
      await loadStats();
      setResetText('');
      setOpReset({ running: false, status: 'done', msg: 'Reset complete — all transaction data cleared, product catalog preserved.' });
    } catch (e) {
      setOpReset({ running: false, status: 'error', msg: e instanceof Error ? e.message : 'Reset failed.' });
    }
  };

  const handleClearProduction = () => run(setOpClearProd, async () => {
    if (!confirm('Delete all production targets and batch entries? This cannot be undone.')) throw new Error('Cancelled.');
    await deleteAllProductionTargets();
    await deleteAllProductionEntries();
    return 'All production targets and entries deleted.';
  });

  const handleClearUnverified = () => run(setOpClearUnv, async () => {
    if (!confirm('Reset all unverified stock to 0? Movement history is preserved.')) throw new Error('Cancelled.');
    const result = await clearAllUnverifiedStock();
    return `Unverified stock cleared for ${result.products} product(s).`;
  });

  const handleClearWarehouse = () => run(setOpClearWh, async () => {
    if (!confirm('Reset stock to 0 for all finished products? This cannot be undone.')) throw new Error('Cancelled.');
    const count = await resetFinishedProductStock();
    return `Warehouse stock reset to 0 for ${count} finished product(s).`;
  });

  const handleClearMovementSection = (label: string, reasons: string[]) =>
    run(setOpClearMovs, async () => {
      if (!confirm(`Delete all ${label} movements? This cannot be undone.`)) throw new Error('Cancelled.');
      const count = await deleteMovementsByReasons(reasons);
      return `${count} ${label} movement(s) deleted.`;
    });

  const handleResetInventoryLevel = () => run(setOpReconc, async () => {
    if (!confirm('Recalculate and fix inventory levels based on shipping history? This will update stock to match all PURCHASE movements.')) throw new Error('Cancelled.');
    const result = await reconcileInventoryToMovements();
    if (result.discrepancies === 0) {
      return 'Inventory already consistent — no changes needed.';
    }
    return `Fixed ${result.fixed} product(s) with discrepancies.`;
  });

  const statRows = stats ? [
    { icon: <Database size={15} className="text-blue-500" />,    label: 'Finished Products',    value: stats.finished },
    { icon: <Layers size={15} className="text-indigo-500" />,    label: 'Disc Products',         value: stats.discs },
    { icon: <Wrench size={15} className="text-amber-500" />,     label: 'Accessories',           value: stats.accessories },
    { icon: <Package size={15} className="text-purple-500" />,   label: 'Packaging',             value: stats.packaging },
    { icon: <BookOpen size={15} className="text-violet-500" />,  label: 'BOM Recipes',           value: stats.recipes },
    { icon: <Cpu size={15} className="text-orange-500" />,       label: 'Machines & Tools',      value: stats.machines },
    { icon: <BookMarked size={15} className="text-teal-500" />,  label: 'Library Items',         value: stats.library },
    { icon: <ShoppingBag size={15} className="text-green-500" />,label: 'Sales Orders',          value: stats.orders },
    { icon: <Layers size={15} className="text-cyan-500" />,      label: 'Completed Production',  value: stats.prodCompleted },
  ] : [];

  const cleanupButtons = [
    {
      label: 'Clean Shipping History',
      description: 'Delete all packaging shipping orders · Rename disc orders from SH-YYYY- to Disc-2024-',
      op: opCleanup, handler: handleCleanupShipping,
      icon: <Trash2 size={14} />,
      actionLabel: 'Run Cleanup',
    },
  ];

  const importButtons = [
    { label: 'Finished Products', count: SEED_PRODUCTS.length,  op: opProducts, handler: handleImportProducts, icon: <Database size={14} /> },
    { label: 'Disc Products',     count: DISC_PRODUCTS.length,  op: opDiscs,    handler: handleImportDiscs,    icon: <Layers size={14} /> },
    { label: 'Accessories',       count: ACCESSORIES.length,    op: opAcc,      handler: handleImportAcc,      icon: <Wrench size={14} /> },
    { label: 'Packaging',         count: PACKAGING.length,      op: opPkg,      handler: handleImportPkg,      icon: <Package size={14} /> },
    { label: 'BOM Recipes',       count: SEED_RECIPES.length,   op: opRecipes,  handler: handleImportRecipes,  icon: <BookOpen size={14} /> },
    { label: 'Machines & Tools',  count: MACHINES.length,       op: opMachines, handler: handleImportMachines, icon: <Cpu size={14} /> },
    { label: 'Library Items',     count: LIBRARY_ITEMS.length,  op: opLib,      handler: handleImportLibrary,  icon: <BookMarked size={14} /> },
  ];

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">System administration and data management</p>
      </div>

      {/* ── 1. System Health ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">System Health</h2>
          <button onClick={() => loadStats(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {stats === null ? (
            <div className="px-5 py-4 text-sm text-slate-400 animate-pulse">Loading…</div>
          ) : statRows.map(row => (
            <div key={row.label} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2.5">
                {row.icon}
                <span className="text-sm font-medium text-slate-700">{row.label}</span>
              </div>
              <span className="text-sm font-bold tabular-nums text-slate-700">
                {row.value.toLocaleString('fr-FR')}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. User Additions Review ──────────────────────────────── */}
      {extraItems !== null && extraItems.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">User Additions</h2>
          <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
            <button onClick={() => setExtrasOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-4 text-left">
              <div className="flex items-center gap-3">
                <UserPlus size={18} className="text-blue-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">
                    {extraItems.length} item{extraItems.length > 1 ? 's' : ''} added by employees
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Not in the base catalog — review and keep or remove.
                  </p>
                </div>
              </div>
              {extrasOpen
                ? <ChevronUp size={16} className="text-blue-400 shrink-0" />
                : <ChevronDown size={16} className="text-blue-400 shrink-0" />}
            </button>

            {extrasOpen && (
              <div className="border-t border-blue-200 divide-y divide-blue-100 overflow-x-auto">
                <div className="min-w-[640px]">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-blue-400">
                  <span>Name</span><span>SKU</span><span>Added by</span><span>Date</span><span className="w-28" />
                </div>
                {extraItems.map(item => (
                  <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-center px-5 py-3 bg-white/60">
                    <div>
                      <p className="text-sm font-medium text-slate-800 leading-snug">{item.name}</p>
                      {item.category && <p className="text-xs text-slate-400">{item.category}</p>}
                    </div>
                    <span className="text-xs font-mono text-slate-600">{item.sku}</span>
                    <span className="text-xs text-slate-600 truncate">{item.createdBy ?? '—'}</span>
                    <span className="text-xs text-slate-500">{fmtDate(item.createdAt)}</span>
                    <div className="flex items-center gap-2 w-28 justify-end">
                      <button onClick={() => handleApproveExtra(item)} title="Keep — mark as official"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">
                        <BadgeCheck size={12} /> Keep
                      </button>
                      <button onClick={() => handleDeleteExtra(item)} title="Delete from database"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-600 hover:bg-red-200 transition-colors">
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
                </div>{/* end min-w wrapper */}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 3. Initial Setup ──────────────────────────────────────── */}
      <section>
        <button onClick={() => setSetupOpen(o => !o)}
          className="w-full flex items-center justify-between mb-3 group">
          <div className="flex items-center gap-2">
            <Settings2 size={14} className="text-slate-400" />
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">
              Initial Setup
            </h2>
          </div>
          {setupOpen
            ? <ChevronUp size={14} className="text-slate-400" />
            : <ChevronDown size={14} className="text-slate-400" />}
        </button>

        {setupOpen && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-start gap-3">
              <Download size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-700">One-time data import</p>
                <p className="text-xs text-slate-500 mt-0.5 max-w-lg">
                  Use these buttons to populate a fresh database. All operations add or update items by SKU —
                  they <strong>never delete</strong> existing data. Safe to run at any time.
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {importButtons.map(btn => (
                <div key={btn.label} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-400">{btn.icon}</span>
                    <span className="text-sm font-medium text-slate-700">{btn.label}</span>
                    <span className="text-xs text-slate-400">({btn.count} items)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {btn.op.status === 'done' && (
                      <span className="text-xs text-emerald-600 font-medium">{btn.op.msg}</span>
                    )}
                    {btn.op.status === 'error' && (
                      <span className="text-xs text-red-600">{btn.op.msg}</span>
                    )}
                    <button onClick={btn.handler} disabled={btn.op.running}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50">
                      {btn.op.running
                        ? <><RefreshCw size={11} className="animate-spin" /> Importing…</>
                        : <><Download size={11} /> Import</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Data cleanup operations */}
            <div className="border-t border-slate-100">
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest">Data Cleanup</p>
              </div>
              {cleanupButtons.map(btn => (
                <div key={btn.label} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-amber-500">{btn.icon}</span>
                      <span className="text-sm font-medium text-slate-700">{btn.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 ml-6">{btn.description}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    {btn.op.status === 'done' && (
                      <span className="text-xs text-emerald-600 font-medium">{btn.op.msg}</span>
                    )}
                    {btn.op.status === 'error' && (
                      <span className="text-xs text-red-600">{btn.op.msg}</span>
                    )}
                    <button onClick={btn.handler} disabled={btn.op.running}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-50">
                      {btn.op.running
                        ? <><RefreshCw size={11} className="animate-spin" /> Running…</>
                        : btn.actionLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── 4. Danger Zone ────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">Danger Zone</h2>

        <div className="bg-orange-50 rounded-xl border border-orange-200 p-5 mb-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Remove Duplicate Supply Receipts</p>
              <p className="text-xs text-orange-600 mt-1 max-w-md">
                Finds received orders with the same date and products as another order, deletes the
                system-generated duplicate, and recalculates stock. Safe to run multiple times.
              </p>
            </div>
          </div>
          <button onClick={handleDupClean} disabled={opDupClean.running}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-40">
            {opDupClean.running ? 'Cleaning…' : 'Remove Duplicates'}
          </button>
          {opDupClean.status === 'done' && <p className="text-xs text-emerald-600 mt-2 font-medium">{opDupClean.msg}</p>}
          {opDupClean.status === 'error' && <p className="text-xs text-red-600 mt-2">{opDupClean.msg}</p>}
        </div>

        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 mb-4">
          <div className="flex items-start gap-3 mb-3">
            <RefreshCw size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Recalculate Stock from Movements</p>
              <p className="text-xs text-amber-600 mt-1 max-w-md">
                Recomputes every product's stock level by summing all recorded movements.
                Use this to fix incorrect stock values after editing or deleting orders.
              </p>
            </div>
          </div>
          <button onClick={handleRecalculate} disabled={opRecalc.running}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-40">
            {opRecalc.running ? 'Recalculating…' : 'Recalculate Stock'}
          </button>
          {opRecalc.status === 'done' && <p className="text-xs text-emerald-600 mt-2 font-medium">{opRecalc.msg}</p>}
          {opRecalc.status === 'error' && <p className="text-xs text-red-600 mt-2">{opRecalc.msg}</p>}
        </div>

        <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-5">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Reset All Transaction Data</p>
              <p className="text-xs text-red-500 mt-1 max-w-md">
                Permanently deletes all sales orders, shipping orders, inventory movements, and production orders.
                Resets every product's stock to 0.{' '}
                <strong>Product catalog, names, and SKUs are preserved.</strong> This cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="text" value={resetText} onChange={e => setResetText(e.target.value)}
              placeholder='Type "RESET" to confirm'
              className="flex-1 max-w-xs px-4 py-2 border-2 border-red-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-slate-400" />
            <button onClick={handleResetAll} disabled={opReset.running || resetText !== 'RESET'}
              className="shrink-0 px-5 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {opReset.running
                ? <span className="flex items-center gap-2"><RefreshCw size={13} className="animate-spin" /> {opReset.msg.split('…')[0]}…</span>
                : 'Reset All Data'}
            </button>
          </div>
          {opReset.status === 'done' && <p className="text-xs text-emerald-600 mt-3 font-medium">{opReset.msg}</p>}
          {opReset.status === 'error' && <p className="text-xs text-red-600 mt-3">{opReset.msg}</p>}
        </div>

        {/* Scoped resets */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
            { label: 'Reset Inventory Level', sub: 'Recalculate and fix stock based on shipping history', handler: handleResetInventoryLevel, op: opReconc },
            { label: 'Clear Production Records', sub: 'Deletes all targets and batch entries', handler: handleClearProduction, op: opClearProd },
            { label: 'Clear Unverified Stock', sub: 'Resets unverified_stock to 0 (history kept)', handler: handleClearUnverified, op: opClearUnv },
            { label: 'Reset Warehouse Stock', sub: 'Sets stock to 0 on all finished products', handler: handleClearWarehouse, op: opClearWh },
          ].map(({ label, sub, handler, op }) => (
            <div key={label} className="bg-red-50 rounded-xl border border-red-200 p-4">
              <p className="text-sm font-semibold text-red-800">{label}</p>
              <p className="text-xs text-red-500 mt-0.5 mb-3">{sub}</p>
              <button onClick={handler} disabled={op.running}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40">
                {op.running ? 'Working…' : label}
              </button>
              {op.status === 'done' && <p className="text-xs text-emerald-600 mt-2 font-medium">{op.msg}</p>}
              {op.status === 'error' && op.msg !== 'Cancelled.' && <p className="text-xs text-red-600 mt-2">{op.msg}</p>}
            </div>
          ))}
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 sm:col-span-2">
            <p className="text-sm font-semibold text-red-800">Clear Movements by Section</p>
            <p className="text-xs text-red-500 mt-0.5 mb-3">Delete movement records for a specific section only</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Shipping',    reasons: ['PURCHASE'],            cls: 'bg-green-600 hover:bg-green-700'    },
                { label: 'Production',  reasons: ['PRODUCTION'],          cls: 'bg-blue-600 hover:bg-blue-700'      },
                { label: 'Sales',       reasons: ['SALE'],                cls: 'bg-emerald-600 hover:bg-emerald-700'},
                { label: 'Adjustments', reasons: ['ADJUSTMENT', 'WASTE'], cls: 'bg-yellow-600 hover:bg-yellow-700'  },
              ].map(s => (
                <button key={s.label}
                  onClick={() => handleClearMovementSection(s.label, s.reasons)}
                  disabled={opClearMovs.running}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-40 ${s.cls}`}>
                  Clear {s.label}
                </button>
              ))}
            </div>
            {opClearMovs.status === 'done' && <p className="text-xs text-emerald-600 mt-2 font-medium">{opClearMovs.msg}</p>}
            {opClearMovs.status === 'error' && opClearMovs.msg !== 'Cancelled.' && <p className="text-xs text-red-600 mt-2">{opClearMovs.msg}</p>}
          </div>
        </div>
      </section>

    </div>
  );
}
