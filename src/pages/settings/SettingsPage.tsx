import { useEffect, useState } from 'react';
import {
  Database, AlertTriangle, ShoppingBag, Layers, Wrench, Package,
  BookOpen, BookMarked, Cpu, CheckCircle2, RefreshCw, Bell, UserPlus,
  Trash2, BadgeCheck, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  getProducts, getProductsFresh, upsertProduct, deleteAllProducts,
  deleteAllAccessories, deleteAllPackaging, deleteAllMovements, resetAllStockToZero,
  updateProduct, deleteProduct,
} from '@/services/inventory.service';
import { getOrders, deleteAllOrders } from '@/services/orders.service';
import {
  getRecipes, upsertRecipe, deleteAllRecipes,
  getProductionOrders, deleteAllProductionOrders,
} from '@/services/production.service';
import { getMachines, upsertMachine, deleteAllMachines, getLibraryItems, upsertLibraryItem, deleteAllLibraryItems } from '@/services/library.service';
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
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

export default function SettingsPage() {
  const [productCount,   setProductCount]   = useState<number | null>(null);
  const [orderCount,     setOrderCount]     = useState<number | null>(null);
  const [discCount,      setDiscCount]      = useState<number | null>(null);
  const [accCount,       setAccCount]       = useState<number | null>(null);
  const [pkgCount,       setPkgCount]       = useState<number | null>(null);
  const [recipeCount,    setRecipeCount]    = useState<number | null>(null);
  const [machineCount,   setMachineCount]   = useState<number | null>(null);
  const [libCount,       setLibCount]       = useState<number | null>(null);
  const [prodOrderCount, setProdOrderCount] = useState<number | null>(null);
  const [extraItems,     setExtraItems]     = useState<Product[] | null>(null);
  const [extrasOpen,     setExtrasOpen]     = useState(true);

  const [opProducts,  setOpProducts]  = useState<OpState>($idle);
  const [opDiscs,     setOpDiscs]     = useState<OpState>($idle);
  const [opAcc,       setOpAcc]       = useState<OpState>($idle);
  const [opPkg,       setOpPkg]       = useState<OpState>($idle);
  const [opRecipes,   setOpRecipes]   = useState<OpState>($idle);
  const [opMachines,  setOpMachines]  = useState<OpState>($idle);
  const [opLib,       setOpLib]       = useState<OpState>($idle);

  const [opReset,     setOpReset]     = useState<OpState>($idle);
  const [resetText,   setResetText]   = useState('');

  const refreshCounts = async (fresh = false) => {
    const [products, orders, recipes, machines, libItems, prodOrders] = await Promise.all([
      fresh ? getProductsFresh() : getProducts(), getOrders(), getRecipes(), getMachines(), getLibraryItems(), getProductionOrders(),
    ]);

    const firestoreSkus = new Set(products.map(p => p.sku));
    setProductCount(SEED_PRODUCTS.filter(p => firestoreSkus.has(p.sku)).length);
    setDiscCount(   DISC_PRODUCTS.filter(p => firestoreSkus.has(p.sku)).length);
    setAccCount(    ACCESSORIES.filter(p => firestoreSkus.has(p.sku)).length);
    setPkgCount(    PACKAGING.filter(p => firestoreSkus.has(p.sku)).length);

    setExtraItems(products.filter(p => !ALL_CATALOG_SKUS.has(p.sku) && p.source !== 'catalog'));

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
    for (const p of SEED_PRODUCTS) await upsertProduct({ ...p, source: 'catalog' });
    return `${SEED_PRODUCTS.length} products synced.`;
  }, () => setProductCount(SEED_PRODUCTS.length));

  const handleSeedDiscs = () => run(setOpDiscs, async () => {
    for (const p of DISC_PRODUCTS) await upsertProduct({ ...p, source: 'catalog' });
    return `${DISC_PRODUCTS.length} disc products synced.`;
  }, () => setDiscCount(DISC_PRODUCTS.length));

  const handleSeedAcc = () => run(setOpAcc, async () => {
    for (const p of ACCESSORIES) await upsertProduct({ ...p, source: 'catalog' });
    return `${ACCESSORIES.length} accessories synced.`;
  }, () => setAccCount(ACCESSORIES.length));

  const handleSeedPkg = () => run(setOpPkg, async () => {
    for (const p of PACKAGING) await upsertProduct({ ...p, source: 'catalog' });
    return `${PACKAGING.length} packaging items synced.`;
  }, () => setPkgCount(PACKAGING.length));

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

  const handleApproveExtra = async (item: Product) => {
    await updateProduct(item.id, { source: 'catalog' });
    await refreshCounts(true);
  };

  const handleDeleteExtra = async (item: Product) => {
    if (!confirm(`Delete "${item.name}" (${item.sku})? This cannot be undone.`)) return;
    await deleteProduct(item.id);
    await refreshCounts(true);
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

  // ── Notification definitions ─────────────────────────────────────────────
  type Notif = {
    id: string; icon: React.ReactNode; color: string;
    title: string; detail: string; actionLabel: string;
    op: OpState; handler: () => void;
  };

  const notifs: Notif[] = [
    productCount !== null && productCount < SEED_PRODUCTS.length && {
      id: 'products', icon: <Database size={18} />, color: 'amber',
      title: 'Product Catalog out of sync',
      detail: `${productCount} of ${SEED_PRODUCTS.length} catalog items present`,
      actionLabel: productCount === 0 ? 'Import Products' : 'Re-sync Catalog',
      op: opProducts, handler: handleReseedProducts,
    },
    discCount !== null && discCount < DISC_PRODUCTS.length && {
      id: 'discs', icon: <Layers size={18} />, color: 'amber',
      title: 'Disc Inventory out of sync',
      detail: `${discCount} of ${DISC_PRODUCTS.length} catalog items present`,
      actionLabel: 'Sync Disc Catalog',
      op: opDiscs, handler: handleSeedDiscs,
    },
    accCount !== null && accCount < ACCESSORIES.length && {
      id: 'accessories', icon: <Wrench size={18} />, color: 'amber',
      title: 'Accessories Catalog out of sync',
      detail: `${accCount} of ${ACCESSORIES.length} catalog items present`,
      actionLabel: 'Sync Accessories',
      op: opAcc, handler: handleSeedAcc,
    },
    pkgCount !== null && pkgCount < PACKAGING.length && {
      id: 'packaging', icon: <Package size={18} />, color: 'amber',
      title: 'Packaging Catalog out of sync',
      detail: `${pkgCount} of ${PACKAGING.length} catalog items present`,
      actionLabel: 'Sync Packaging',
      op: opPkg, handler: handleSeedPkg,
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
  ].filter(Boolean) as Notif[];

  const allLoaded = [productCount, discCount, accCount, pkgCount, recipeCount, machineCount, libCount, orderCount].every(c => c !== null) && extraItems !== null;
  const hasAlerts = notifs.length > 0 || (extraItems?.length ?? 0) > 0;

  // ── Info rows for the data overview grid ─────────────────────────────────
  const dataRows = [
    { icon: <Database size={16} className="text-blue-500" />,    label: 'Products',            value: productCount,   seed: SEED_PRODUCTS.length,  onlyWarnLow: true  },
    { icon: <Layers size={16} className="text-indigo-500" />,    label: 'Disc Products',        value: discCount,      seed: DISC_PRODUCTS.length,  onlyWarnLow: true  },
    { icon: <Wrench size={16} className="text-amber-500" />,     label: 'Accessories',          value: accCount,       seed: ACCESSORIES.length,    onlyWarnLow: true  },
    { icon: <Package size={16} className="text-purple-500" />,   label: 'Packaging',            value: pkgCount,       seed: PACKAGING.length,      onlyWarnLow: true  },
    { icon: <BookOpen size={16} className="text-violet-500" />,  label: 'BOM Recipes',          value: recipeCount,    seed: SEED_RECIPES.length,   onlyWarnLow: false },
    { icon: <Cpu size={16} className="text-orange-500" />,       label: 'Machines & Tools',     value: machineCount,   seed: MACHINES.length,       onlyWarnLow: false },
    { icon: <BookMarked size={16} className="text-teal-500" />,  label: 'Library Items',        value: libCount,       seed: LIBRARY_ITEMS.length,  onlyWarnLow: false },
    { icon: <ShoppingBag size={16} className="text-green-500" />,label: 'Sales Orders',         value: orderCount,     seed: null,                  onlyWarnLow: false },
    { icon: <Layers size={16} className="text-cyan-500" />,      label: 'Completed Production', value: prodOrderCount, seed: null,                  onlyWarnLow: false },
  ];

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">System configuration and data management</p>
      </div>

      {/* ── Notification cards ────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Bell size={14} className="text-slate-400" />
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Updates</h2>
        </div>

        {!allLoaded ? (
          <div className="bg-white rounded-xl border border-slate-100 p-5 text-sm text-slate-400 animate-pulse">
            Checking data status…
          </div>
        ) : !hasAlerts ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <p className="text-sm font-medium text-emerald-700">All catalogs are up to date.</p>
          </div>
        ) : (
          <div className="space-y-3">

            {/* Standard sync notifications */}
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
                    {n.op.status === 'done' && <p className="text-xs text-emerald-600 mt-1 font-medium">{n.op.msg}</p>}
                    {n.op.status === 'error' && <p className="text-xs text-red-600 mt-1">{n.op.msg}</p>}
                  </div>
                </div>
                <button onClick={n.handler} disabled={n.op.running}
                  className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-amber-500 text-white hover:bg-amber-600">
                  {n.op.running ? <span className="flex items-center gap-2"><RefreshCw size={13} className="animate-spin" /> Working…</span> : n.actionLabel}
                </button>
              </div>
            ))}

            {/* User-Added Items card */}
            {extraItems && extraItems.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
                <button
                  onClick={() => setExtrasOpen(o => !o)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <div className="flex items-center gap-3">
                    <UserPlus size={18} className="text-blue-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-800">
                        User-Added Items ({extraItems.length})
                      </p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        Items added manually — not part of the code catalog. Review and keep or remove.
                      </p>
                    </div>
                  </div>
                  {extrasOpen ? <ChevronUp size={16} className="text-blue-400 shrink-0" /> : <ChevronDown size={16} className="text-blue-400 shrink-0" />}
                </button>

                {extrasOpen && (
                  <div className="border-t border-blue-200 divide-y divide-blue-100">
                    {/* Header row */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-blue-400">
                      <span>Name</span>
                      <span>SKU</span>
                      <span>Added by</span>
                      <span>Date</span>
                      <span className="w-28" />
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
                          <button
                            onClick={() => handleApproveExtra(item)}
                            title="Approve — add to official catalog"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">
                            <BadgeCheck size={12} /> Keep
                          </button>
                          <button
                            onClick={() => handleDeleteExtra(item)}
                            title="Delete from Firestore"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-600 hover:bg-red-200 transition-colors">
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </section>

      {/* ── Data Overview ─────────────────────────────────────────── */}
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

      {/* ── Danger Zone ───────────────────────────────────────────── */}
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
          {opReset.status === 'done' && <p className="text-xs text-emerald-600 mt-3 font-medium">{opReset.msg}</p>}
          {opReset.status === 'error' && <p className="text-xs text-red-600 mt-3">{opReset.msg}</p>}
        </div>
      </section>

    </div>
  );
}
