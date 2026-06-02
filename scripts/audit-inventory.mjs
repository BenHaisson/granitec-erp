import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyA4IUwfzP_XIfbQtTVzBszcDD2cJS6odrU',
  projectId: 'granitec-erp',
  authDomain: 'granitec-erp.firebaseapp.com',
  storageBucket: 'granitec-erp.firebasestorage.app',
  messagingSenderId: '532605203373',
  appId: '1:532605203373:web:e62c55b1a8d1b537db6724',
});
const db = getFirestore(app);

async function auditInventory() {
  console.log('\n📊 DETAILED INVENTORY AUDIT\n');
  console.log('Loading products and movements...\n');

  // Get all products
  const prodSnap = await getDocs(collection(db, 'products'));
  const products = new Map(prodSnap.docs.map(d => [d.id, { ...d.data(), id: d.id }]));

  // Get all movements sorted by date
  const movSnap = await getDocs(
    query(collection(db, 'inventory_movements'), orderBy('createdAt', 'asc'))
  );
  const movements = movSnap.docs.map(d => d.data());

  console.log(`Found ${products.size} products and ${movements.length} movements\n`);

  // Calculate expected stock for each product
  const expectedStock = new Map();
  const movementsByProduct = new Map();

  for (const mov of movements) {
    const productId = mov.productId;
    const qty = mov.quantity || 0;

    // Track movements
    if (!movementsByProduct.has(productId)) {
      movementsByProduct.set(productId, []);
    }
    movementsByProduct.get(productId).push(mov);

    // Calculate running total
    if (!expectedStock.has(productId)) {
      expectedStock.set(productId, 0);
    }
    const current = expectedStock.get(productId);
    expectedStock.set(productId, current + qty);
  }

  // Report all products with detailed breakdown
  const discrepancies = [];

  console.log('=' .repeat(120));
  console.log('PRODUCT STOCK ANALYSIS');
  console.log('=' .repeat(120) + '\n');

  for (const [productId, product] of products) {
    const currentStock = product.stock_level || 0;
    const calculatedStock = expectedStock.get(productId) || 0;
    const movs = movementsByProduct.get(productId) || [];
    const diff = calculatedStock - currentStock;

    if (Math.abs(diff) > 0) {
      discrepancies.push({
        productId,
        sku: product.sku,
        name: product.name,
        current: currentStock,
        calculated: calculatedStock,
        diff,
        movementCount: movs.length,
      });

      console.log(`\n❌ MISMATCH: ${product.sku} (${product.name})`);
      console.log(`   Current Stock: ${currentStock}`);
      console.log(`   Calculated:   ${calculatedStock}`);
      console.log(`   Difference:   ${diff > 0 ? '+' + diff : diff}`);
      console.log(`   Movements:    ${movs.length}`);

      // Show movement breakdown
      if (movs.length > 0) {
        console.log(`   Movement Summary:`);
        const byReason = {};
        for (const mov of movs) {
          const reason = mov.reason || 'UNKNOWN';
          if (!byReason[reason]) byReason[reason] = 0;
          byReason[reason] += mov.quantity || 0;
        }
        for (const [reason, total] of Object.entries(byReason)) {
          console.log(`     - ${reason}: ${total > 0 ? '+' : ''}${total}`);
        }

        // Show last 5 movements
        console.log(`   Last 5 movements:`);
        movs.slice(-5).forEach(m => {
          const date = m.createdAt?.toDate?.() || m.createdAt || '?';
          const qty = m.quantity > 0 ? '+' + m.quantity : m.quantity;
          console.log(`     ${date} | ${m.reason.padEnd(12)} | ${qty.toString().padStart(6)} | ${m.note}`);
        });
      }
    }
  }

  console.log('\n' + '=' .repeat(120));
  console.log(`SUMMARY: ${discrepancies.length} products with discrepancies\n`);

  if (discrepancies.length > 0) {
    console.log('DISCREPANCY TABLE:');
    console.log('SKU'.padEnd(20) + ' | ' + 'Name'.padEnd(30) + ' | ' + 'Current'.padEnd(10) + ' | ' + 'Calculated'.padEnd(12) + ' | ' + 'Diff'.padEnd(8) + ' | Movements');
    console.log('-'.repeat(120));

    for (const d of discrepancies) {
      console.log(
        `${d.sku.padEnd(20)} | ${d.name.substring(0, 28).padEnd(30)} | ${String(d.current).padEnd(10)} | ${String(d.calculated).padEnd(12)} | ${String(d.diff).padEnd(8)} | ${d.movementCount}`
      );
    }
  }

  console.log('\n');
}

auditInventory()
  .catch(e => { console.error('❌ Audit failed:', e); process.exit(1); })
  .finally(() => setTimeout(() => process.exit(0), 500));
