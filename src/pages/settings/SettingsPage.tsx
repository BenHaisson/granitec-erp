import { useEffect, useState } from 'react';
import { Database, AlertTriangle, ShoppingBag, Layers, Wrench } from 'lucide-react';
import { getProducts, upsertProduct, deleteAllProducts, seedDiscHistory, deleteDiscHistory, deleteAllAccessories } from '@/services/inventory.service';
import { getOrders, seedHistoricalOrders, deleteAllOrders } from '@/services/orders.service';
import { SEED_PRODUCTS } from '@/data/seedProducts';
import { SEED_ORDERS } from '@/data/seedOrders';
import { DISC_PRODUCTS, DISC_MOVEMENTS } from '@/data/seedDiscs';
import { ACCESSORIES } from '@/data/seedAccessories';

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

  const refreshCounts = () => {
    getProducts().then(p => {
      setProductCount(p.filter(x => x.type === 'FINISHED').length);
      setDiscCount(p.filter(x => x.type === 'RAW' && x.category !== 'Accessories').length);
      setAccCount(p.filter(x => x.type === 'RAW' && x.category === 'Accessories').length);
    });
    getOrders().then(o => setOrderCount(o.length));
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
    </div>
  );
}
