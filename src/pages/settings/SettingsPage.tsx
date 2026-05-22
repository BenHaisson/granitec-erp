import { useEffect, useState } from 'react';
import { Database, AlertTriangle, ShoppingBag, Layers, Wrench, BookOpen, BookMarked, Cpu } from 'lucide-react';
import { getProducts, upsertProduct, deleteAllProducts, seedDiscHistory, deleteDiscHistory, deleteAllAccessories, recalculateStockFromMovements, deleteAllMovements, resetAllStockToZero } from '@/services/inventory.service';
import { getOrders, seedHistoricalOrders, deleteAllOrders, backfillSalesMovements } from '@/services/orders.service';
import { getRecipes, upsertRecipe, deleteAllRecipes, backfillCrepeProductionHistory, getProductionOrders, deleteAllProductionOrders } from '@/services/production.service';
import { getMachines, upsertMachine, deleteAllMachines, getLibraryItems, upsertLibraryItem, deleteAllLibraryItems } from '@/services/library.service';
import { SEED_PRODUCTS } from '@/data/seedProducts';
import { SEED_ORDERS } from '@/data/seedOrders';
import { DISC_PRODUCTS, DISC_MOVEMENTS } from '@/data/seedDiscs';
import { ACCESSORIES } from '@/data/seedAccessories';
import { SEED_RECIPES } from '@/data/seedRecipes';
import { MACHINES } from '@/data/seedMachines';
import { LIBRARY_ITEMS } from '@/data/seedLibrary';

const isLive = import.meta.env.VITE_APP_MODE === 'live';

export default function SettingsPage() {
  const [productCount, setProductCount] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [discCount, setDiscCount] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [ordersRunning, setOrdersRunning] = useState(false);
  const [discRunning, setDiscRunning] = useState(false);
  const [accRunning, setAccRunning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [ordersStatus, setOrdersStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [discStatus, setDiscStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [accStatus, setAccStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [ordersMessage, setOrdersMessage] = useState('');
  const [discMessage, setDiscMessage] = useState('');
  const [accMessage, setAccMessage] = useState('');
  const [accCount, setAccCount] = useState<number | null>(null);
  const [recipeRunning, setRecipeRunning] = useState(false);
  const [recipeStatus, setRecipeStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [recipeMessage, setRecipeMessage] = useState('');
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [machineRunning, setMachineRunning] = useState(false);
  const [machineStatus, setMachineStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [machineMessage, setMachineMessage] = useState('');
  const [machineCount, setMachineCount] = useState<number | null>(null);
  const [libRunning, setLibRunning] = useState(false);
  const [libStatus, setLibStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [libMessage, setLibMessage] = useState('');
  const [libCount, setLibCount] = useState<number | null>(null);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [backfillMessage, setBackfillMessage] = useState('');
  const [prodOrderCount, setProdOrderCount] = useState<number | null>(null);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [resetRunning, setResetRunning] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [resetMessage, setResetMessage] = useState('');

  const refreshCounts = () => {
    getProducts().then(p => {
      setProductCount(p.filter(x => x.type === 'FINISHED').length);
      setDiscCount(p.filter(x => x.type === 'RAW' && x.category !== 'Accessories').length);
      setAccCount(p.filter(x => x.type === 'RAW' && x.category === 'Accessories').length);
    });
    getOrders().then(o => setOrderCount(o.length));
    getRecipes().then(r => setRecipeCount(r.length));
    getMachines().then(m => setMachineCount(m.length));
    getLibraryItems().then(l => setLibCount(l.length));
    getProductionOrders().then(o => setProdOrderCount(o.filter(x => x.recipeId?.startsWith && x.status === 'COMPLETED').length));
  };

  useEffect(() => { refreshCounts(); }, []);

  const handleReseed = async () => {
    const action = productCount === 0 ? 'Import' : `Delete all ${productCount} products and re-import`;
    if (!confirm(`${action} ${SEED_PRODUCTS.length} products? This cannot be undone.`)) return;
    setRunning(true);
    setStatus('idle');
    try {
      if (productCount !== 0) await deleteAllProducts();
      for (const p of SEED_PRODUCTS) await upsertProduct(p);
      refreshCounts();
      setStatus('done');
      setMessage(`${SEED_PRODUCTS.length} products imported successfully.`);
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Check Firestore rules and try again.');
    } finally {
      setRunning(false);
    }
  };

  const handleSeedDiscs = async () => {
    if (!confirm(`Import ${DISC_PRODUCTS.length} disc products and ${DISC_MOVEMENTS.length} shipping entries? This will overwrite existing disc data.`)) return;
    setDiscRunning(true);
    setDiscStatus('idle');
    try {
      await seedDiscHistory(DISC_PRODUCTS, DISC_MOVEMENTS);
      refreshCounts();
      setDiscStatus('done');
      setDiscMessage(`${DISC_PRODUCTS.length} disc products and ${DISC_MOVEMENTS.length} movements imported.`);
    } catch {
      setDiscStatus('error');
      setDiscMessage('Failed to import disc history. Check Firestore rules.');
    } finally {
      setDiscRunning(false);
    }
  };

  const handleDeleteDiscs = async () => {
    if (!confirm(`Delete all ${discCount} disc products and their movement history? This cannot be undone.`)) return;
    setDiscRunning(true);
    setDiscStatus('idle');
    try {
      await deleteDiscHistory();
      refreshCounts();
      setDiscStatus('done');
      setDiscMessage('All disc data deleted.');
    } catch {
      setDiscStatus('error');
      setDiscMessage('Failed to delete disc data.');
    } finally {
      setDiscRunning(false);
    }
  };

  const handleSeedOrders = async () => {
    if (!confirm(`Import ${SEED_ORDERS.length} historical orders? This will add them on top of existing orders.`)) return;
    setOrdersRunning(true);
    setOrdersStatus('idle');
    try {
      await seedHistoricalOrders(SEED_ORDERS);
      refreshCounts();
      setOrdersStatus('done');
      setOrdersMessage(`${SEED_ORDERS.length} historical orders imported.`);
    } catch {
      setOrdersStatus('error');
      setOrdersMessage('Failed to import orders. Check Firestore rules.');
    } finally {
      setOrdersRunning(false);
    }
  };

  const handleDeleteOrders = async () => {
    if (!confirm(`Delete all ${orderCount} orders? This cannot be undone.`)) return;
    setOrdersRunning(true);
    setOrdersStatus('idle');
    try {
      await deleteAllOrders();
      refreshCounts();
      setOrdersStatus('done');
      setOrdersMessage('All orders deleted.');
    } catch {
      setOrdersStatus('error');
      setOrdersMessage('Failed to delete orders.');
    } finally {
      setOrdersRunning(false);
    }
  };

  const handleSeedAccessories = async () => {
    if (!confirm(`Delete all existing accessories and import ${ACCESSORIES.length} fresh entries?`)) return;
    setAccRunning(true);
    setAccStatus('idle');
    try {
      await deleteAllAccessories();
      for (const p of ACCESSORIES) await upsertProduct(p);
      refreshCounts();
      setAccStatus('done');
      setAccMessage(`${ACCESSORIES.length} accessories imported successfully.`);
    } catch {
      setAccStatus('error');
      setAccMessage('Failed to import accessories. Check Firestore rules.');
    } finally {
      setAccRunning(false);
    }
  };

  const handleDeleteAccessories = async () => {
    if (!confirm(`Delete all ${accCount} accessories? This cannot be undone.`)) return;
    setAccRunning(true);
    setAccStatus('idle');
    try {
      await deleteAllAccessories();
      refreshCounts();
      setAccStatus('done');
      setAccMessage('All accessories deleted.');
    } catch {
      setAccStatus('error');
      setAccMessage('Failed to delete accessories.');
    } finally {
      setAccRunning(false);
    }
  };

  const handleSeedRecipes = async () => {
    if (!confirm(`Delete all existing recipes and import ${SEED_RECIPES.length} from seed file?`)) return;
    setRecipeRunning(true); setRecipeStatus('idle');
    try {
      await deleteAllRecipes();
      for (const r of SEED_RECIPES) {
        await upsertRecipe({ finishedProductId: r.finishedProductSku, components: r.components.map(c => ({ productId: c.productSku, quantity: c.quantity })) });
      }
      refreshCounts();
      setRecipeStatus('done');
      setRecipeMessage(`${SEED_RECIPES.length} recipes imported.`);
    } catch {
      setRecipeStatus('error');
      setRecipeMessage('Failed to import recipes. Check Firestore rules.');
    } finally { setRecipeRunning(false); }
  };

  const handleDeleteRecipes = async () => {
    if (!confirm(`Delete all ${recipeCount} recipes? This cannot be undone.`)) return;
    setRecipeRunning(true); setRecipeStatus('idle');
    try {
      await deleteAllRecipes(); refreshCounts();
      setRecipeStatus('done'); setRecipeMessage('All recipes deleted.');
    } catch { setRecipeStatus('error'); setRecipeMessage('Failed to delete recipes.'); }
    finally { setRecipeRunning(false); }
  };

  const handleSeedMachines = async () => {
    if (!confirm(`Delete all existing machines/tools and import ${MACHINES.length} entries?`)) return;
    setMachineRunning(true); setMachineStatus('idle');
    try {
      await deleteAllMachines();
      for (const m of MACHINES) await upsertMachine(m);
      refreshCounts();
      setMachineStatus('done');
      setMachineMessage(`${MACHINES.length} machines & tools imported.`);
    } catch {
      setMachineStatus('error');
      setMachineMessage('Failed to import machines. Check Firestore rules.');
    } finally { setMachineRunning(false); }
  };

  const handleDeleteMachines = async () => {
    if (!confirm(`Delete all ${machineCount} machines & tools?`)) return;
    setMachineRunning(true); setMachineStatus('idle');
    try {
      await deleteAllMachines(); refreshCounts();
      setMachineStatus('done'); setMachineMessage('All machines deleted.');
    } catch { setMachineStatus('error'); setMachineMessage('Failed to delete machines.'); }
    finally { setMachineRunning(false); }
  };

  const handleSeedLibrary = async () => {
    if (!confirm(`Delete all existing library items and import ${LIBRARY_ITEMS.length} entries?`)) return;
    setLibRunning(true); setLibStatus('idle');
    try {
      await deleteAllLibraryItems();
      for (const item of LIBRARY_ITEMS) await upsertLibraryItem(item);
      refreshCounts();
      setLibStatus('done');
      setLibMessage(`${LIBRARY_ITEMS.length} library items imported.`);
    } catch {
      setLibStatus('error');
      setLibMessage('Failed to import library. Check Firestore rules.');
    } finally { setLibRunning(false); }
  };

  const handleDeleteLibrary = async () => {
    if (!confirm(`Delete all ${libCount} library items?`)) return;
    setLibRunning(true); setLibStatus('idle');
    try {
      await deleteAllLibraryItems(); refreshCounts();
      setLibStatus('done'); setLibMessage('All library items deleted.');
    } catch { setLibStatus('error'); setLibMessage('Failed to delete library.'); }
    finally { setLibRunning(false); }
  };

  const handleBackfillCrepe = async () => {
    if (!confirm('Generate production orders for all historical Crepe & Egg Pan sales (3 days before each sale date)? This also writes inventory movements. Idempotent — safe to re-run.')) return;
    setBackfillRunning(true); setBackfillStatus('idle');
    try {
      const count = await backfillCrepeProductionHistory();
      refreshCounts();
      setBackfillStatus('done');
      setBackfillMessage(`${count} production order lines backfilled successfully.`);
    } catch (e) {
      setBackfillStatus('error');
      setBackfillMessage(`Backfill failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally { setBackfillRunning(false); }
  };

  const handleSyncInventory = async () => {
    if (!confirm(
      'Sync full inventory from history? This will:\n' +
      '1. Backfill crepe/egg pan production orders (3 days before each sale)\n' +
      '2. Write SALE movements for all historical orders\n' +
      '3. Recalculate every product\'s stock_level from all movements\n\n' +
      'Safe to re-run — idempotent. Negative stock will be shown in the UI.'
    )) return;
    setSyncRunning(true); setSyncStatus('idle'); setSyncMessage('Step 1/3: backfilling production orders…');
    try {
      const prodCount = await backfillCrepeProductionHistory();
      setSyncMessage(`Step 2/3: writing sales movements… (${prodCount} production lines done)`);
      const saleCount = await backfillSalesMovements();
      setSyncMessage(`Step 3/3: recalculating stock levels… (${saleCount} sale movements written)`);
      const productCount = await recalculateStockFromMovements();
      refreshCounts();
      setSyncStatus('done');
      setSyncMessage(`Sync complete — ${prodCount} production lines, ${saleCount} sale movements, ${productCount} products recalculated.`);
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage(`Sync failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally { setSyncRunning(false); }
  };

  const handleResetTransactionData = async () => {
    if (!confirm(
      'RESET ALL TRANSACTION DATA?\n\n' +
      'This will permanently delete:\n' +
      '  • All sales orders (sales history)\n' +
      '  • All inventory movements (supply receipt history)\n' +
      '  • All production orders (backfilled + manual)\n' +
      '  • Reset all product stock levels to 0\n\n' +
      'Products, names, SKUs, packaging catalog → KEPT.\n\n' +
      'This cannot be undone. Continue?'
    )) return;
    setResetRunning(true); setResetStatus('idle'); setResetMessage('Deleting sales orders…');
    try {
      await deleteAllOrders();
      setResetMessage('Deleting inventory movements…');
      await deleteAllMovements();
      setResetMessage('Deleting production orders…');
      await deleteAllProductionOrders();
      setResetMessage('Resetting stock levels to 0…');
      await resetAllStockToZero();
      refreshCounts();
      setResetStatus('done');
      setResetMessage('Reset complete — all transaction data cleared, product catalog preserved.');
    } catch (e) {
      setResetStatus('error');
      setResetMessage(`Reset failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally { setResetRunning(false); }
  };

  const hasProducts  = productCount !== null && productCount > 0;
  const isDuplicated = productCount !== null && productCount > SEED_PRODUCTS.length;
  const hasOrders    = orderCount !== null && orderCount > 0;
  const hasDiscs     = discCount !== null && discCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">System configuration</p>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <Database size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Product Catalog</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {productCount === null
                  ? 'Loading...'
                  : `${productCount} products in Firestore · Catalog has ${SEED_PRODUCTS.length} references`}
              </p>
            </div>
          </div>
          {!isLive && (
            <button
              onClick={handleReseed}
              disabled={running || productCount === null}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                hasProducts
                  ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {running ? 'Working...' : hasProducts ? 'Delete all & Re-seed' : 'Import Products'}
            </button>
          )}
        </div>

        {!isLive && isDuplicated && (
          <div className="mt-4 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            <span>Duplicates detected ({productCount} instead of {SEED_PRODUCTS.length}). Click "Delete all & Re-seed" to fix.</span>
          </div>
        )}

        {!isLive && status === 'done' && (
          <p className="mt-4 text-green-600 text-sm">{message}</p>
        )}
        {!isLive && status === 'error' && (
          <p className="mt-4 text-red-600 text-sm">{message}</p>
        )}
      </div>

      {/* Disc inventory */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
              <Layers size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Disc Inventory</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {discCount === null
                  ? 'Loading...'
                  : `${discCount} disc products in Firestore · Catalog has ${DISC_PRODUCTS.length} references · ${DISC_MOVEMENTS.length} shipping entries`}
              </p>
            </div>
          </div>
          {!isLive && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleSeedDiscs}
                disabled={discRunning || discCount === null}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700">
                {discRunning ? 'Importing…' : 'Import Disc History'}
              </button>
              {hasDiscs && (
                <button
                  onClick={handleDeleteDiscs}
                  disabled={discRunning}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                  Delete disc data
                </button>
              )}
            </div>
          )}
        </div>
        {!isLive && discStatus === 'done' && (
          <p className="mt-4 text-green-600 text-sm">{discMessage}</p>
        )}
        {!isLive && discStatus === 'error' && (
          <p className="mt-4 text-red-600 text-sm">{discMessage}</p>
        )}
      </div>

      {/* Accessories */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
              <Wrench size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Accessories Catalog</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {accCount === null
                  ? 'Loading...'
                  : `${accCount} accessories in Firestore · Catalog has ${ACCESSORIES.length} references`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleSeedAccessories}
              disabled={accRunning || accCount === null}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-amber-600 text-white hover:bg-amber-700"
            >
              {accRunning ? 'Working…' : 'Delete & Re-import'}
            </button>
            {(accCount ?? 0) > 0 && (
              <button
                onClick={handleDeleteAccessories}
                disabled={accRunning}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
              >
                Delete all
              </button>
            )}
          </div>
        </div>
        {accStatus === 'done' && <p className="mt-4 text-green-600 text-sm">{accMessage}</p>}
        {accStatus === 'error' && <p className="mt-4 text-red-600 text-sm">{accMessage}</p>}
      </div>

      {/* Historical orders */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
              <ShoppingBag size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Sales History</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {orderCount === null
                  ? 'Loading...'
                  : `${orderCount} orders in Firestore`}
              </p>
            </div>
          </div>
          {!isLive && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleSeedOrders}
                disabled={ordersRunning || orderCount === null}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-green-600 text-white hover:bg-green-700">
                {ordersRunning ? 'Importing…' : 'Import Historical Data'}
              </button>
              {hasOrders && (
                <button
                  onClick={handleDeleteOrders}
                  disabled={ordersRunning}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                  Delete all orders
                </button>
              )}
            </div>
          )}
        </div>
        {!isLive && ordersStatus === 'done' && (
          <p className="mt-4 text-green-600 text-sm">{ordersMessage}</p>
        )}
        {!isLive && ordersStatus === 'error' && (
          <p className="mt-4 text-red-600 text-sm">{ordersMessage}</p>
        )}
      </div>

      {/* BOM Recipes */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center shrink-0">
              <BookOpen size={20} className="text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">BOM Recipes</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {recipeCount === null ? 'Loading...' : `${recipeCount} recipes in Firestore · Seed file has ${SEED_RECIPES.length} recipes`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleSeedRecipes} disabled={recipeRunning || recipeCount === null}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-violet-600 text-white hover:bg-violet-700">
              {recipeRunning ? 'Working…' : 'Delete & Re-import'}
            </button>
            {(recipeCount ?? 0) > 0 && (
              <button onClick={handleDeleteRecipes} disabled={recipeRunning}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                Delete all
              </button>
            )}
          </div>
        </div>
        {recipeStatus === 'done' && <p className="mt-4 text-green-600 text-sm">{recipeMessage}</p>}
        {recipeStatus === 'error' && <p className="mt-4 text-red-600 text-sm">{recipeMessage}</p>}
      </div>

      {/* Crepe & Egg Pan Production History */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center shrink-0">
              <Layers size={20} className="text-cyan-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Crepe & Egg Pan Production History</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Generates a completed production order 3 days before each crepe/egg pan sale. Idempotent.
                {prodOrderCount !== null && ` · ${prodOrderCount} completed orders already in Firestore`}
              </p>
            </div>
          </div>
          <button onClick={handleBackfillCrepe} disabled={backfillRunning}
            className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-cyan-600 text-white hover:bg-cyan-700">
            {backfillRunning ? 'Running…' : 'Backfill Production Orders'}
          </button>
        </div>
        {backfillStatus === 'done' && <p className="mt-4 text-green-600 text-sm">{backfillMessage}</p>}
        {backfillStatus === 'error' && <p className="mt-4 text-red-600 text-sm">{backfillMessage}</p>}
      </div>

      {/* Reset Transaction Data */}
      <div className="bg-red-50 rounded-xl p-6 shadow-sm border border-red-200 border-l-4 border-l-red-500">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800">Reset Transaction Data</p>
              <p className="text-xs text-red-500 mt-0.5 max-w-lg">
                Deletes all sales orders, inventory movements (supply receipts), and production orders.
                Resets every product's stock to 0. <strong>Product catalog, names, SKUs, packaging → kept.</strong> Cannot be undone.
              </p>
            </div>
          </div>
          <button onClick={handleResetTransactionData} disabled={resetRunning}
            className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 whitespace-nowrap">
            {resetRunning ? 'Resetting…' : 'Reset All Data'}
          </button>
        </div>
        {resetRunning && <p className="mt-3 text-red-500 text-sm animate-pulse">{resetMessage}</p>}
        {resetStatus === 'done' && <p className="mt-4 text-green-600 text-sm">{resetMessage}</p>}
        {resetStatus === 'error' && <p className="mt-4 text-red-600 text-sm">{resetMessage}</p>}
      </div>

      {/* Sync Inventory from History */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 border-l-4 border-l-emerald-500">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
              <Database size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Sync Inventory from History</p>
              <p className="text-xs text-slate-400 mt-0.5 max-w-lg">
                Full 3-step sync: backfill crepe/egg pan production orders → write SALE movements for all historical sales → recalculate every product's stock_level from movements. Negative stock is allowed and shown in red.
              </p>
            </div>
          </div>
          <button onClick={handleSyncInventory} disabled={syncRunning}
            className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-emerald-600 text-white hover:bg-emerald-700 whitespace-nowrap">
            {syncRunning ? syncMessage.split(':')[0] + '…' : 'Sync Inventory'}
          </button>
        </div>
        {syncRunning && <p className="mt-3 text-slate-500 text-sm animate-pulse">{syncMessage}</p>}
        {syncStatus === 'done' && <p className="mt-4 text-green-600 text-sm">{syncMessage}</p>}
        {syncStatus === 'error' && <p className="mt-4 text-red-600 text-sm">{syncMessage}</p>}
      </div>

      {/* Machines & Tools */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
              <Cpu size={20} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Machines & Tools</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {machineCount === null ? 'Loading...' : `${machineCount} entries in Firestore · Catalog has ${MACHINES.length} entries`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleSeedMachines} disabled={machineRunning || machineCount === null}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-orange-600 text-white hover:bg-orange-700">
              {machineRunning ? 'Working…' : 'Delete & Re-import'}
            </button>
            {(machineCount ?? 0) > 0 && (
              <button onClick={handleDeleteMachines} disabled={machineRunning}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                Delete all
              </button>
            )}
          </div>
        </div>
        {machineStatus === 'done' && <p className="mt-4 text-green-600 text-sm">{machineMessage}</p>}
        {machineStatus === 'error' && <p className="mt-4 text-red-600 text-sm">{machineMessage}</p>}
      </div>

      {/* Library — Guides, SOPs, Standards */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
              <BookMarked size={20} className="text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Library — Guides, SOPs & Standards</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {libCount === null ? 'Loading...' : `${libCount} items in Firestore · Catalog has ${LIBRARY_ITEMS.length} items`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleSeedLibrary} disabled={libRunning || libCount === null}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-teal-600 text-white hover:bg-teal-700">
              {libRunning ? 'Working…' : 'Delete & Re-import'}
            </button>
            {(libCount ?? 0) > 0 && (
              <button onClick={handleDeleteLibrary} disabled={libRunning}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                Delete all
              </button>
            )}
          </div>
        </div>
        {libStatus === 'done' && <p className="mt-4 text-green-600 text-sm">{libMessage}</p>}
        {libStatus === 'error' && <p className="mt-4 text-red-600 text-sm">{libMessage}</p>}
      </div>
    </div>
  );
}
