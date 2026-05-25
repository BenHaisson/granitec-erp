import { useEffect, useState } from 'react';
import {
  Database, AlertTriangle, ShoppingBag, Layers, Wrench, Package,
  BookOpen, BookMarked, Cpu, RefreshCw, UserPlus,
  Trash2, BadgeCheck, ChevronDown, ChevronUp, Download, Settings2,
} from 'lucide-react';
import {
  getProducts, getProductsFresh, upsertProduct,
  deleteAllMovements, resetAllStockToZero,
  updateProduct, deleteProduct,
} from '@/services/inventory.service';
import { getOrders, deleteAllOrders } from '@/services/orders.service';
import {
  getRecipes, upsertRecipe, deleteAllRecipes,
  getProductionOrders, deleteAllProductionOrders,
} from '@/services/production.service';
import {
  getMachines, upsertMachine, deleteAllMachines,
  getLibraryItems, upsertLibraryItem, deleteAllLibraryItems,
} from '@/services/library.service';
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
  const [opReset,     setOpReset]     = useState<OpState>($idle);
  const [resetText,   setResetText]   = useState('');

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
      setOpReset(s => ({ ...s, msg: 'Deleting inventory movements…' }));
      await deleteAllMovements();
      setOpReset(s => ({ ...s, msg: 'Deleting production orders…' }));
      await deleteAllProductionOrders();
      setOpReset(s => ({ ...s, msg: 'Resetting stock levels to 0…' }));
      await resetAllStockToZero();
      await loadStats();
      setResetText('');
      setOpReset({ running: false, status: 'done', msg: 'Reset complete — transaction data cleared, product catalog preserved.' });
    } catch (e) {
      setOpReset({ running: false, status: 'error', msg: e instanceof Error ? e.message : 'Reset failed.' });
    }
  };

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
              <div className="border-t border-blue-200 divide-y divide-blue-100">
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
          </div>
        )}
      </section>

      {/* ── 4. Danger Zone ────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">Danger Zone</h2>
        <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-5">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Reset All Transaction Data</p>
              <p className="text-xs text-red-500 mt-1 max-w-md">
                Permanently deletes all sales orders, inventory movements, and production orders.
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
      </section>

    </div>
  );
}
