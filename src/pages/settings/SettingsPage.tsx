import { useEffect, useState } from 'react';
import { Database, AlertTriangle, ShoppingBag } from 'lucide-react';
import { getProducts, upsertProduct, deleteAllProducts } from '@/services/inventory.service';
import { getOrders, seedHistoricalOrders, deleteAllOrders } from '@/services/orders.service';
import { SEED_PRODUCTS } from '@/data/seedProducts';
import { SEED_ORDERS } from '@/data/seedOrders';

const isLive = import.meta.env.VITE_APP_MODE === 'live';

export default function SettingsPage() {
  const [productCount, setProductCount] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [ordersRunning, setOrdersRunning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [ordersStatus, setOrdersStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [ordersMessage, setOrdersMessage] = useState('');

  useEffect(() => {
    getProducts().then(p => setProductCount(p.length));
    getOrders().then(o => setOrderCount(o.length));
  }, []);

  const handleReseed = async () => {
    const action = productCount === 0 ? 'Import' : `Delete all ${productCount} products and re-import`;
    if (!confirm(`${action} ${SEED_PRODUCTS.length} products? This cannot be undone.`)) return;
    setRunning(true);
    setStatus('idle');
    try {
      if (productCount !== 0) await deleteAllProducts();
      for (const p of SEED_PRODUCTS) await upsertProduct(p);
      setProductCount(SEED_PRODUCTS.length);
      setStatus('done');
      setMessage(`${SEED_PRODUCTS.length} products imported successfully.`);
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Check Firestore rules and try again.');
    } finally {
      setRunning(false);
    }
  };

  const handleSeedOrders = async () => {
    if (!confirm(`Import ${SEED_ORDERS.length} historical orders? This will add them on top of existing orders.`)) return;
    setOrdersRunning(true);
    setOrdersStatus('idle');
    try {
      await seedHistoricalOrders(SEED_ORDERS);
      const updated = await getOrders();
      setOrderCount(updated.length);
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
      setOrderCount(0);
      setOrdersStatus('done');
      setOrdersMessage('All orders deleted.');
    } catch {
      setOrdersStatus('error');
      setOrdersMessage('Failed to delete orders.');
    } finally {
      setOrdersRunning(false);
    }
  };

  const hasProducts = productCount !== null && productCount > 0;
  const isDuplicated = productCount !== null && productCount > SEED_PRODUCTS.length;
  const hasOrders = orderCount !== null && orderCount > 0;

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
