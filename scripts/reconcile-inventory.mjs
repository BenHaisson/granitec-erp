import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyA4IUwfzP_XIfbQtTVzBszcDD2cJS6odrU',
  projectId: 'granitec-erp',
  authDomain: 'granitec-erp.firebaseapp.com',
  storageBucket: 'granitec-erp.firebasestorage.app',
  messagingSenderId: '532605203373',
  appId: '1:532605203373:web:e62c55b1a8d1b537db6724',
});
const db = getFirestore(app);

async function reconcileInventory() {
  console.log('\n📊 INVENTORY RECONCILIATION REPORT\n');
  console.log('Loading products and movements...\n');

  // Get all products
  const prodSnap = await getDocs(collection(db, 'products'));
  const products = new Map(prodSnap.docs.map(d => [d.id, { ...d.data(), id: d.id }]));

  // Get all movements
  const movSnap = await getDocs(collection(db, 'inventory_movements'));
  const movements = movSnap.docs.map(d => d.data());

  // Calculate expected stock for each product based on movements
  const expectedStock = new Map();

  for (const [productId, product] of products) {
    let total = 0;
    const productMovements = movements.filter(m => m.productId === productId);

    for (const m of productMovements) {
      const qty = m.quantity || 0;
      total += qty;

      // Debug: show first few movements
      if (!expectedStock.has(productId)) {
        console.log(`📦 ${product.name || productId}:`);
      }
    }

    expectedStock.set(productId, {
      calculated: total,
      current: product.stock_level || 0,
      unverified: product.unverified_stock || 0,
      movementCount: productMovements.length,
    });
  }

  // Report discrepancies
  console.log('\n' + '='.repeat(100));
  console.log('SKU'.padEnd(20) | 'Product Name'.padEnd(30) | 'Current'.padEnd(12) | 'Calculated'.padEnd(12) | 'Difference'.padEnd(12) | 'Status');
  console.log('='.repeat(100));

  let discrepancies = 0;
  const fixes = [];

  for (const [productId, stock] of expectedStock) {
    const product = products.get(productId);
    const sku = product?.sku || productId;
    const name = (product?.name || 'Unknown').substring(0, 28);
    const current = stock.current;
    const calculated = stock.calculated;
    const diff = calculated - current;
    const status = Math.abs(diff) > 0 ? '❌ MISMATCH' : '✅ OK';

    if (Math.abs(diff) > 0) {
      discrepancies++;
      fixes.push({ productId, sku, name, current, calculated, expected: calculated });
      console.log(
        `${sku.padEnd(20)} | ${name.padEnd(30)} | ${String(current).padEnd(12)} | ${String(calculated).padEnd(12)} | ${String(diff > 0 ? '+' + diff : diff).padEnd(12)} | ${status}`
      );
    }
  }

  console.log('='.repeat(100));
  console.log(`\nTotal products: ${products.size}`);
  console.log(`Discrepancies found: ${discrepancies}`);
  console.log(`Total movements: ${movements.length}\n`);

  if (discrepancies > 0) {
    console.log('🔄 Applying fixes...\n');
    let fixed = 0;

    for (const fix of fixes) {
      try {
        await updateDoc(doc(db, 'products', fix.productId), {
          stock_level: fix.expected,
        });
        console.log(`   ✅ ${fix.sku} → ${fix.expected} units (was ${fix.current})`);
        fixed++;
      } catch (err) {
        console.error(`   ❌ Failed to update ${fix.sku}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    console.log(`\n✅ Fixed ${fixed}/${discrepancies} discrepancies.`);
  } else {
    console.log('✅ Inventory is consistent! No discrepancies found.\n');
  }
}

reconcileInventory()
  .catch(e => { console.error('❌ Reconciliation failed:', e); process.exit(1); })
  .finally(() => setTimeout(() => process.exit(0), 500));
