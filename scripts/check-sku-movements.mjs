import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyA4IUwfzP_XIfbQtTVzBszcDD2cJS6odrU',
  projectId: 'granitec-erp',
  authDomain: 'granitec-erp.firebaseapp.com',
  storageBucket: 'granitec-erp.firebasestorage.app',
  messagingSenderId: '532605203373',
  appId: '1:532605203373:web:e62c55b1a8d1b537db6724',
});
const db = getFirestore(app);

async function checkSKU(sku, expectedStock) {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`SKU: ${sku} (Expected by documents: ~3,545 | System shows: ${expectedStock})`);
  console.log('='.repeat(100));

  // Get product
  const prodSnap = await getDocs(query(collection(db, 'products'), where('sku', '==', sku)));
  if (prodSnap.empty) {
    console.log('Product not found');
    return;
  }
  const product = prodSnap.docs[0].data();
  const productId = prodSnap.docs[0].id;

  console.log(`Product ID: ${productId}`);
  console.log(`Current Stock Level: ${product.stock_level}\n`);

  // Get all movements for this product
  const movSnap = await getDocs(query(collection(db, 'inventory_movements'), where('productId', '==', productId)));
  const movements = movSnap.docs.map(d => d.data());

  console.log(`Total movements: ${movements.length}\n`);

  // Group by note/shipping ref
  const byRef = {};
  for (const mov of movements) {
    const ref = mov.note || 'NO-REF';
    if (!byRef[ref]) {
      byRef[ref] = { count: 0, total: 0, movements: [] };
    }
    byRef[ref].count++;
    byRef[ref].total += mov.quantity;
    byRef[ref].movements.push(mov);
  }

  console.log('MOVEMENTS BY SHIPPING REFERENCE:\n');
  console.log('Reference'.padEnd(20) + ' | Count | Total Qty | Date');
  console.log('-'.repeat(100));

  let grandTotal = 0;
  for (const [ref, data] of Object.entries(byRef).sort()) {
    const date = data.movements[0]?.createdAt?.toDate?.()?.toLocaleDateString() || '?';
    console.log(
      `${ref.padEnd(20)} | ${String(data.count).padEnd(5)} | ${String(data.total).padEnd(9)} | ${date}`
    );
    grandTotal += data.total;
  }

  console.log('-'.repeat(100));
  console.log(`GRAND TOTAL: ${grandTotal} units`);
  console.log(`System shows: ${product.stock_level}`);
  console.log(`Discrepancy: ${product.stock_level - grandTotal} units\n`);

  // Check for duplicates
  const refCounts = Object.entries(byRef).filter(([ref, data]) => data.count > 1);
  if (refCounts.length > 0) {
    console.log('⚠️  POTENTIAL DUPLICATES (same ref, multiple movements):');
    for (const [ref, data] of refCounts) {
      console.log(`   ${ref}: ${data.count} movements (${data.total} units total)`);
    }
  }

  // Show all movements in detail
  console.log('\nDETAILED MOVEMENTS:\n');
  for (const mov of movements) {
    const date = mov.createdAt?.toDate?.()?.toLocaleDateString() || '?';
    console.log(`${date} | ${mov.note || 'NO-REF'} | ${mov.quantity > 0 ? '+' : ''}${mov.quantity} units`);
  }
}

async function main() {
  await checkSKU('DISC-220X27-N', 5501);
  await checkSKU('DISC-220X27-G', 5500);
}

main()
  .catch(e => { console.error('❌ Failed:', e); process.exit(1); })
  .finally(() => setTimeout(() => process.exit(0), 500));
