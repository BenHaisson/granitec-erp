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

async function inventoryReport() {
  console.log('\n📦 COMPLETE INVENTORY REPORT\n');

  // Get all products
  const prodSnap = await getDocs(collection(db, 'products'));
  const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Get all movements
  const movSnap = await getDocs(
    query(collection(db, 'inventory_movements'), orderBy('createdAt', 'asc'))
  );
  const movements = movSnap.docs.map(d => d.data());

  // Group by reason
  const movByReason = {};
  for (const mov of movements) {
    const reason = mov.reason || 'UNKNOWN';
    if (!movByReason[reason]) movByReason[reason] = 0;
    movByReason[reason] += mov.quantity || 0;
  }

  console.log('MOVEMENT SUMMARY BY REASON:');
  for (const [reason, total] of Object.entries(movByReason).sort()) {
    console.log(`  ${reason.padEnd(15)} ${total > 0 ? '+' : ''}${total}`);
  }

  // Products with stock
  const withStock = products.filter(p => (p.stock_level || 0) > 0);
  console.log(`\n\nPRODUCTS WITH STOCK (${withStock.length}):\n`);
  console.log('SKU'.padEnd(20) + ' | Name'.padEnd(30) + ' | Stock'.padEnd(10) + ' | Unverified');
  console.log('-'.repeat(80));

  for (const p of withStock.sort((a, b) => (b.stock_level || 0) - (a.stock_level || 0))) {
    const stock = p.stock_level || 0;
    const unverified = p.unverified_stock || 0;
    console.log(
      `${(p.sku || p.id).padEnd(20)} | ${(p.name || '').substring(0, 28).padEnd(30)} | ${stock.toString().padEnd(10)} | ${unverified}`
    );
  }

  // Empty stock
  const empty = products.filter(p => (p.stock_level || 0) <= 0);
  console.log(`\n\nEMPTY PRODUCTS (${empty.length} of ${products.length}):\n`);

  // Latest movements
  console.log('\n\nLATEST 30 MOVEMENTS:\n');
  console.log('Date'.padEnd(20) + ' | Reason'.padEnd(12) + ' | Qty'.padEnd(10) + ' | SKU'.padEnd(20) + ' | Note');
  console.log('-'.repeat(100));

  const latestMovs = movements.reverse().slice(0, 30);
  for (const mov of latestMovs) {
    const prod = products.find(p => p.id === mov.productId);
    const sku = prod?.sku || mov.productId;
    const date = mov.createdAt?.toDate?.()?.toLocaleDateString() || '?';
    const qty = (mov.quantity || 0) > 0 ? '+' + mov.quantity : mov.quantity;
    const note = (mov.note || '').substring(0, 40);
    console.log(
      `${date.padEnd(20)} | ${(mov.reason || '?').padEnd(12)} | ${qty.toString().padEnd(10)} | ${sku.padEnd(20)} | ${note}`
    );
  }

  console.log('\n');
}

inventoryReport()
  .catch(e => { console.error('❌ Failed:', e); process.exit(1); })
  .finally(() => setTimeout(() => process.exit(0), 500));
