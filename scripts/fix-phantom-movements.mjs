import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyA4IUwfzP_XIfbQtTVzBszcDD2cJS6odrU',
  projectId: 'granitec-erp',
  authDomain: 'granitec-erp.firebaseapp.com',
  storageBucket: 'granitec-erp.firebasestorage.app',
  messagingSenderId: '532605203373',
  appId: '1:532605203373:web:e62c55b1a8d1b537db6724',
});
const db = getFirestore(app);

async function fixPhantomMovements() {
  console.log('\n🔧 FIXING PHANTOM MOVEMENTS\n');

  // Find all movements with note starting with "PKG-" that are applied to DISC products
  const movSnap = await getDocs(query(
    collection(db, 'inventory_movements'),
    where('note', '>=', 'PKG-'),
    where('note', '<', 'PKG-~')
  ));

  const movements = movSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Get all products to check which are DISC
  const prodSnap = await getDocs(collection(db, 'products'));
  const discProducts = new Map();
  const pkgProducts = new Map();

  for (const pd of prodSnap.docs) {
    const data = pd.data();
    const sku = data.sku || '';
    if (sku.startsWith('DISC-')) {
      discProducts.set(pd.id, sku);
    }
    if (sku.startsWith('PKG-')) {
      pkgProducts.set(pd.id, sku);
    }
  }

  // Find phantom movements: PKG-* note applied to DISC products
  const phantoms = [];
  for (const mov of movements) {
    const isOnDiscProduct = discProducts.has(mov.productId);
    if (isOnDiscProduct) {
      phantoms.push({
        id: mov.id,
        productId: mov.productId,
        sku: discProducts.get(mov.productId),
        qty: mov.quantity,
        note: mov.note,
      });
    }
  }

  console.log(`Found ${phantoms.length} phantom movements:\n`);

  if (phantoms.length === 0) {
    console.log('No phantom movements found!');
    return;
  }

  // Group by product
  const byProduct = {};
  for (const p of phantoms) {
    if (!byProduct[p.sku]) {
      byProduct[p.sku] = [];
    }
    byProduct[p.sku].push(p);
  }

  for (const [sku, movs] of Object.entries(byProduct)) {
    const totalQty = movs.reduce((sum, m) => sum + m.qty, 0);
    console.log(`  ${sku}: ${movs.length} movement(s), -${totalQty} units`);
  }

  console.log('\n🗑️  DELETING PHANTOM MOVEMENTS...\n');

  // Delete all phantom movements
  const batch = writeBatch(db);
  for (const p of phantoms) {
    batch.delete(doc(db, 'inventory_movements', p.id));
  }
  await batch.commit();

  console.log(`✅ Deleted ${phantoms.length} phantom movements\n`);

  // Now recalculate stock for affected products
  console.log('📊 RECALCULATING STOCK...\n');

  const affected = new Map();
  for (const p of phantoms) {
    if (!affected.has(p.productId)) {
      affected.set(p.productId, { sku: p.sku, adjustment: 0 });
    }
    affected.get(p.productId).adjustment -= p.qty;
  }

  const updateBatch = writeBatch(db);
  for (const [productId, data] of affected) {
    const prodRef = doc(db, 'products', productId);
    const prodSnap = await getDocs(query(collection(db, 'products'), where('__name__', '==', productId)));

    if (!prodSnap.empty) {
      const prod = prodSnap.docs[0];
      const currentStock = (prod.data().stock_level || 0);
      const newStock = currentStock + data.adjustment;
      updateBatch.update(prodRef, { stock_level: newStock });
      console.log(`  ${data.sku}: ${currentStock} → ${newStock} (${data.adjustment > 0 ? '+' : ''}${data.adjustment})`);
    }
  }
  await updateBatch.commit();

  console.log('\n✅ DONE! Phantom movements deleted and stock recalculated.\n');
}

fixPhantomMovements()
  .catch(e => { console.error('❌ Failed:', e); process.exit(1); })
  .finally(() => setTimeout(() => process.exit(0), 500));
