import { useEffect, useState } from 'react';
import {
  Database, AlertTriangle, ShoppingBag, Layers, Wrench,
  BookOpen, BookMarked, Cpu, CheckCircle2, RefreshCw, Bell,
} from 'lucide-react';
import {
  getProducts, getProductsFresh, upsertProduct, deleteAllProducts,
  seedDiscHistory, deleteDiscHistory, deleteAllAccessories,
  recalculateStockFromMovements, deleteAllMovements, resetAllStockToZero,
} from '@/services/inventory.service';
import { getOrders, seedHistoricalOrders, deleteAllOrders, backfillSalesMovements } from '@/services/orders.service';
import {
  getRecipes, upsertRecipe, deleteAllRecipes,
  backfillCrepeProductionHistory, getProductionOrders, deleteAllProductionOrders,
} from '@/services/production.service';
import { getMachines, upsertMachine, deleteAllMachines, getLibraryItems, upsertLibraryItem, deleteAllLibraryItems } from '@/services/library.service';
import { SEED_PRODUCTS } from '@/data/seedProducts';
import { SEED_ORDERS } from '@/data/seedOrders';
import { DISC_PRODUCTS, DISC_MOVEMENTS } from '@/data/seedDiscs';
import { ACCESSORIES } from '@/data/seedAccessories';
import { SEED_RECIPES } from '@/data/seedRecipes';
import { MACHINES } from '@/data/seedMachines';
import { LIBRARY_ITEMS } from '@/data/seedLibrary';

type OpState = { running: boolean; status: 'idle' | 'done' | 'error'; msg: string };
const $idle: OpState = { running: false, status: 'idle', msg: '' };

export default function SettingsPage() {
  const [productCount,   setProductCount]   = useState<number | null>(null);
  const [orderCount,     setOrderCount]     = useState<number | null>(null);
  const [discCount,      setDiscCount]      = useState<number | null>(null);
  const [accCount,       setAccCount]       = useState<number | null>(null);
  const [recipeCount,    setRecipeCount]    = useState<number | null>(null);
  const [machineCount,   setMachineCount]   = useState<number | null>(null);
  const [libCount,       setLibCount]       = useState<number | null>(null);
  const [prodOrderCount, setProdOrderCount] = useState<number | null>(null);

  const [opProducts,  setOpProducts]  = useState<OpState>($idle);
  const [opDiscs,     setOpDiscs]     = useState<OpState>($idle);
  const [opAcc,       setOpAcc]       = useState<OpState>($idle);
  const [opRecipes,   setOpRecipes]   = useState<OpState>($idle);
  const [opMachines,  setOpMachines]  = useState<OpState>($idle);
  const [opLib,       setOpLib]       = useState<OpState>($idle);

  const [opOrders,    setOpOrders]    = useState<OpState>($idle);
  const [opBackfill,  setOpBackfill]  = useState<OpState>($idle);
  const [opSync,      setOpSync]      = useState<OpState>($idle);
  const [opReset,     setOpReset]     = useState<OpState>($idle);
  const [resetText,   setResetText]   = useState('');

  const refreshCounts = async (fresh = false) => {
    const [products, orders, recipes, machines, libItems, prodOrders] = await Promise.all([
      fresh ? getProductsFresh() : getProducts(), getOrders(), getRecipes(), getMachines(), getLibraryItems(), getProductionOrders(),
    ]);
    setProductCount(products.filter(x => x.type === 'FINISHED').length);
    setDiscCount(products.filter(x => x.type === 'RAW' && x.category !== 'Accessories').length);
    setAccCount(products.filter(x => x.type === 'RAW' && x.category === 'Accessories').length);
    setOrderCount(orders.length);
    setRecipeCount(recipes.length);
    setMachineCount(machines.length);
    setLibCount(libItems.length);
    setProdOrderCount(prodOrders.filter(x => x.status === 'COMPLETED').length);
  };

  useEffect(() => { refreshCounts(); }, []);

  const run = async (
    setter: React.Dispatch<React.SetStateAction<OpState>>,
    fn: () => Promise<string>,
    onDone?: () => void,
  ) => {
    setter({ running: true, status: 'idle', msg: '' });
    try {
      const msg = await fn();
      onDone?.();
      setter({ running: false, status: 'done', msg });
      setTimeout(() => setter($idle), 3000);
    } catch (e) {
      setter({ running: false, status: 'error', msg: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  };

  const handleReseedProducts = () => run(setOpProducts, async () => {
    if (productCount !== 0) await deleteAllProducts();
    for (const p of SEED_PRODUCTS) await upsertProduct(p);
    return `${SEED_PRODUCTS.length} products synced.`;
  }, () => setProductCount(SEED_PRODUCTS.length));

  const handleSeedDiscs = () => run(setOpDiscs, async () => {
    await seedDiscHistory(DISC_PRODUCTS, DISC_MOVEMENTS);
    return `${DISC_PRODUCTS.length} disc products and ${DISC_MOVEMENTS.length} movements imported.`;
  }, () => setDiscCount(DISC_PRODUCTS.length));

  const handleSeedAcc = () => run(setOpAcc, async () => {
    await deleteAllAccessories();
    for (const p of ACCESSORIES) await upsertProduct(p);
    return `${ACCESSORIES.length} accessories synced.`;
  }, () => setAccCount(ACCESSORIES.length));

  const handleSeedRecipes = () => run(setOpRecipes, async () => {
    await deleteAllRecipes();
    for (const r of SEED_RECIPES)
      await upsertRecipe({ finishedProductId: r.finishedProductSku, components: r.components.map(c => ({ productId: c.productSku, quantity: c.quantity })) });
    return `${SEED_RECIPES.length} recipes synced.`;
  }, () => setRecipeCount(SEED_RECIPES.length));

  const handleSeedMachines = () => run(setOpMachines, async () => {
    await deleteAllMachines();
    for (const m of MACHINES) await upsertMachine(m);
    return `${MACHINES.length} machines & tools synced.`;
  }, () => setMachineCount(MACHINES.length));

  const handleSeedLibrary = () => run(setOpLib, async () => {
    await deleteAllLibraryItems();
    for (const item of LIBRARY_ITEMS) await upsertLibraryItem(item);
    return `${LIBRARY_ITEMS.length} library items synced.`;
  }, () => setLibCount(LIBRARY_ITEMS.length));

  const handleClearOrders = () => run(setOpOrders, async () => {
    await deleteAllOrders();
    return 'All sales orders deleted.';
  }, () => setOrderCount(0));

  const handleImportOrders = () => run(setOpOrders, async () => {
    await seedHistoricalOrders(SEED_ORDERS);
    return `${SEED_ORDERS.length} historical orders imported.`;
  }, () => setOrderCount(prev => (prev ?? 0) + SEED_ORDERS.length));

  const handleBackfillCrepe = () => run(setOpBackfill, async () => {
    const count = await backfillCrepeProductionHistory();
    return `${count} production order lines backfilled.`;
  });

  const handleSyncInventory = async () => {
    setOpSync({ running: true, status: 'idle', msg: 'Step 1/3: backfilling production orders…' });
    try {
      const prodCount = await backfillCrepeProductionHistory();
      setOpSync(s => ({ ...s, msg: `Step 2/3: writing sales movements… (${prodCount} production lines done)` }));
      const saleCount = await backfillSalesMovements();
      setOpSync(s => ({ ...s, msg: `Step 3/3: recalculating stock levels…` }));
      const pCount = await recalculateStockFromMovements();
      await refreshCounts();
      setOpSync({ running: false, status: 'done', msg: `Sync complete — ${prodCount} production lines, ${saleCount} sale movements, ${pCount} products updated.` });
      setTimeout(() => setOpSync($idle), 5000);
    } catch (e) {
      setOpSync({ running: false, status: 'error', msg: e instanceof Error ? e.message : 'Sync failed.' });
    }
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
      await refreshCounts();
      setResetText('');
      setOpReset({ running: false, status: 'done', msg: 'Reset complete — transaction data cleared, product catalog preserved.' });
    } catch (e) {
      setOpReset({ running: false, status: 'error', msg: e instanceof Error ? e.message : 'Reset failed.' });
    }
  };

  // ── Notification definitions (only rendered when drift is detected) ──────
  type Notif = {
    id: string;
    icon: React.ReactNode;
    color: string;
    title: string;
    detail: string;
    actionLabel: string;
    op: OpState;
    handler: () => void;
  };

  const notifs: Notif[] = [
    productCount !== null && productCount !== SEED_PRODUCTS.length && {
      id: 'products', icon: <Database size={18} />, color: 'amber',
      title: 'Product Catalog out of sync',
      detail: `${productCount} in Firestore · ${SEED_PRODUCTS.length} in catalog`,
      actionLabel: productCount === 0 ? 'Import Products' : 'Re-sync Catalog',
      op: opProducts, handler: handleReseedProducts,
    },
    discCount !== null && discCount < DISC_PRODUCTS.length && {
      id: 'discs', icon: <Layers size={18} />, color: 'amber',
      title: 'Disc Inventory out of sync',
      detail: `${discCount} in Firestore · ${DISC_PRODUCTS.length} in catalog`,
      actionLabel: 'Import Disc History',
      op: opDiscs, handler: handleSeedDiscs,
    },
    accCount !== null && accCount !== ACCESSORIES.length && {
      id: 'accessories', icon: <Wrench size={18} />, color: 'amber',
      title: 'Accessories Catalog out of sync',
      detail: `${accCount} in Firestore · ${ACCESSORIES.length} in catalog`,
      actionLabel: 'Sync Accessories',
      op: opAcc, handler: handleSeedAcc,
    },
    recipeCount !== null && recipeCount !== SEED_RECIPES.length && {
      id: 'recipes', icon: <BookOpen size={18} />, color: 'amber',
      title: 'BOM Recipes out of sync',
      detail: `${recipeCount} in Firestore · ${SEED_RECIPES.length} in catalog`,
      actionLabel: 'Sync Recipes',
      op: opRecipes, handler: handleSeedRecipes,
    },
    machineCount !== null && machineCount !== MACHINES.length && {
      id: 'machines', icon: <Cpu size={18} />, color: 'amber',
      title: 'Machines & Tools out of sync',
      detail: `${machineCount} in Firestore · ${MACHINES.length} in catalog`,
      actionLabel: 'Sync Machines',
      op: opMachines, handler: handleSeedMachines,
    },
    libCount !== null && libCount !== LIBRARY_ITEMS.length && {
      id: 'library', icon: <BookMarked size={18} />, color: 'amber',
      title: 'Library out of sync',
      detail: `${libCount} in Firestore · ${LIBRARY_ITEMS.length} in catalog`,
      actionLabel: 'Sync Library',
      op: opLib, handler: handleSeedLibrary,
    },
    orderCount !== null && orderCount > 0 && {
      id: 'orders-clear', icon: <ShoppingBag size={18} />, color: 'red',
      title: `Sales history has ${orderCount} orders`,
      detail: 'Clear all historical orders to start fresh',
      actionLabel: 'Delete All Orders',
      op: opOrders, handler: handleClearOrders,
    },
  ].filter(Boolean) as Notif[];

  const allLoaded = [productCount, discCount, accCount, recipeCount, machineCount, libCount, orderCount].every(c => c !== null);

  // ── Info rows for the data overview grid ────────────────────────────────
  const dataRows = [
    { icon: <Database size={16} className="text-blue-500" />,   label: 'Products',         value: productCount,   seed: SEED_PRODUCTS.length,  onlyWarnLow: false },
    { icon: <Layers size={16} className="text-indigo-500" />,   label: 'Disc Products',    value: discCount,      seed: DISC_PRODUCTS.length,  onlyWarnLow: true  },
    { icon: <Wrench size={16} className="text-amber-500" />,    label: 'Accessories',      value: accCount,       seed: ACCESSORIES.length,    onlyWarnLow: false },
    { icon: <BookOpen size={16} className="text-violet-500" />, label: 'BOM Recipes',      value: recipeCount,    seed: SEED_RECIPES.length,   onlyWarnLow: false },
    { icon: <Cpu size={16} className="text-orange-500" />,      label: 'Machines & Tools', value: machineCount,   seed: MACHINES.length,       onlyWarnLow: false },
    { icon: <BookMarked size={16} className="text-teal-500" />, label: 'Library Items',    value: libCount,       seed: LIBRARY_ITEMS.length,  onlyWarnLow: false },
    { icon: <ShoppingBag size={16} className="text-green-500" />, label: 'Sales Orders',   value: orderCount,     seed: null,                  onlyWarnLow: false },
    { icon: <Layers size={16} className="text-cyan-500" />,     label: 'Completed Production', value: prodOrderCount, seed: null,              onlyWarnLow: false },
  ];

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">System configuration and data management</p>
      </div>

      {/* ── Notification cards ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Bell size={14} className="text-slate-400" />
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Updates</h2>
        </div>

        {!allLoaded ? (
          <div className="bg-white rounded-xl border border-slate-100 p-5 text-sm text-slate-400 animate-pulse">
            Checking data status…
          </div>
        ) : notifs.length === 0 ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <p className="text-sm font-medium text-emerald-700">All catalogs are up to date.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifs.map(n => (
              <div key={n.id}
                className={`flex items-start justify-between gap-4 rounded-xl border px-5 py-4 ${
                  n.color === 'red' ? 'bg-red-50 border-red-200'
                  : n.color === 'blue' ? 'bg-blue-50 border-blue-200'
                  : 'bg-amber-50 border-amber-200'
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 shrink-0 ${n.color === 'red' ? 'text-red-500' : n.color === 'blue' ? 'text-blue-500' : 'text-amber-500'}`}>
                    {n.icon}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${n.color === 'red' ? 'text-red-800' : n.color === 'blue' ? 'text-blue-800' : 'text-amber-800'}`}>{n.title}</p>
                    <p className={`text-xs mt-0.5 ${n.color === 'red' ? 'text-red-600' : n.color === 'blue' ? 'text-blue-600' : 'text-amber-600'}`}>{n.detail}</p>
                    {n.op.status === 'done' && (
                      <p className="text-xs text-emerald-600 mt-1 font-medium">{n.op.msg}</p>
                    )}
                    {n.op.status === 'error' && (
                      <p className="text-xs text-red-600 mt-1">{n.op.msg}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={n.handler}
                  disabled={n.op.running}
                  className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                    n.color === 'red' ? 'bg-red-600 text-white hover:bg-red-700'
                    : n.color === 'blue' ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}>
                  {n.op.running ? (
                    <span className="flex items-center gap-2"><RefreshCw size={13} className="animate-spin" /> Working…</span>
                  ) : n.actionLabel}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Data Overview ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Data Overview</h2>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {dataRows.map(row => {
            const synced  = row.seed !== null && row.value !== null && row.value >= row.seed;
            const drifted = row.seed !== null && row.value !== null && (row.onlyWarnLow ? row.value < row.seed : row.value !== row.seed);
            return (
              <div key={row.label} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2.5">
                  {row.icon}
                  <span className="text-sm font-medium text-slate-700">{row.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold tabular-nums ${drifted ? 'text-amber-600' : 'text-slate-700'}`}>
                    {row.value === null ? '—' : row.value.toLocaleString('fr-FR')}
                  </span>
                  {row.seed !== null && (
                    <span className="text-xs text-slate-400">/ {row.seed}</span>
                  )}
                  {synced && <CheckCircle2 size={13} className="text-emerald-400" />}
                  {drifted && <AlertTriangle size={13} className="text-amber-400" />}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Maintenance ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Maintenance</h2>
        <div className="space-y-3">

          {/* Sync Inventory */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Sync Inventory from History</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Backfills production orders (3 days before each crepe/egg pan sale), writes SALE movements for all historical orders, then recalculates every product's stock level. Safe to re-run — idempotent.
                </p>
                {opSync.running && (
                  <p className="text-xs text-slate-500 mt-2 animate-pulse">{opSync.msg}</p>
                )}
                {opSync.status === 'done' && (
                  <p className="text-xs text-emerald-600 mt-2 font-medium">{opSync.msg}</p>
                )}
                {opSync.status === 'error' && (
                  <p className="text-xs text-red-600 mt-2">{opSync.msg}</p>
                )}
              </div>
              <button onClick={handleSyncInventory} disabled={opSync.running}
                className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap">
                {opSync.running
                  ? <span className="flex items-center gap-2"><RefreshCw size={13} className="animate-spin" /> Running…</span>
                  : 'Sync Inventory'}
              </button>
            </div>
          </div>

          {/* Backfill Crepe */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Backfill Production History</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Generates completed production orders for all historical crepe & egg pan sales, dated 3 days before each sale. Idempotent.
                  {prodOrderCount !== null && ` ${prodOrderCount} completed orders already in Firestore.`}
                </p>
                {opBackfill.status === 'done' && (
                  <p className="text-xs text-emerald-600 mt-2 font-medium">{opBackfill.msg}</p>
                )}
                {opBackfill.status === 'error' && (
                  <p className="text-xs text-red-600 mt-2">{opBackfill.msg}</p>
                )}
              </div>
              <button onClick={handleBackfillCrepe} disabled={opBackfill.running}
                className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 text-white hover:bg-cyan-700 transition-colors disabled:opacity-50 whitespace-nowrap">
                {opBackfill.running
                  ? <span className="flex items-center gap-2"><RefreshCw size={13} className="animate-spin" /> Running…</span>
                  : 'Run Backfill'}
              </button>
            </div>
          </div>

          {/* Import Historical Orders */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Import Historical Orders</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Adds {SEED_ORDERS.length} pre-loaded historical sales orders to Firestore.
                  Currently {orderCount ?? '…'} orders in database.
                </p>
                {opOrders.status === 'done' && (
                  <p className="text-xs text-emerald-600 mt-2 font-medium">{opOrders.msg}</p>
                )}
                {opOrders.status === 'error' && (
                  <p className="text-xs text-red-600 mt-2">{opOrders.msg}</p>
                )}
              </div>
              <button onClick={handleImportOrders} disabled={opOrders.running}
                className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 whitespace-nowrap">
                {opOrders.running
                  ? <span className="flex items-center gap-2"><RefreshCw size={13} className="animate-spin" /> Working…</span>
                  : 'Import Historical Orders'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Danger Zone ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">Danger Zone</h2>
        <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-5">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Reset All Transaction Data</p>
              <p className="text-xs text-red-500 mt-1 max-w-md">
                Permanently deletes all sales orders, inventory movements, and production orders. Resets every product's stock to 0.{' '}
                <strong>Product catalog, names, SKUs, and packaging definitions are preserved.</strong> This cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={resetText}
              onChange={e => setResetText(e.target.value)}
              placeholder='Type "RESET" to confirm'
              className="flex-1 max-w-xs px-4 py-2 border-2 border-red-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-slate-400"
            />
            <button
              onClick={handleResetAll}
              disabled={opReset.running || resetText !== 'RESET'}
              className="shrink-0 px-5 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {opReset.running
                ? <span className="flex items-center gap-2"><RefreshCw size={13} className="animate-spin" /> {opReset.msg.split('…')[0]}…</span>
                : 'Reset All Data'}
            </button>
          </div>
          {opReset.status === 'done' && (
            <p className="text-xs text-emerald-600 mt-3 font-medium">{opReset.msg}</p>
          )}
          {opReset.status === 'error' && (
            <p className="text-xs text-red-600 mt-3">{opReset.msg}</p>
          )}
        </div>
      </section>

    </div>
  );
}
