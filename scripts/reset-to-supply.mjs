/**
 * reset-to-supply.mjs
 *
 * Resets the ERP data to match Supply Receipt History only:
 *  1. Recalculates stock_level per product = sum of all PURCHASE movements
 *  2. Clears unverified_stock on all products
 *  3. Deletes PRODUCTION, SALE, SHIPMENT inventory movements
 *  4. Deletes: production_targets, production_entries, production_orders
 *  5. Deletes: sales_orders, sales
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyA4IUwfzP_XIfbQtTVzBszcDD2cJS6odrU',
  projectId: 'granitec-erp',
  authDomain: 'granitec-erp.firebaseapp.com',
  storageBucket: 'granitec-erp.firebasestorage.app',
  messagingSenderId: '532605203373',
  appId: '1:532605203373:web:e62c55b1a8d1b537db6724',
});
const db = getFirestore(app);

async function batchDelete(docs) {
  const CHUNK = 400;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

async function main() {
  console.log('📦 Reading inventory_movements…');
  const movSnap = await getDocs(collection(db, 'inventory_movements'));
  const allMovements = movSnap.docs.map(d => ({ ref: d.ref, ...d.data() }));

  // ── 1. Calculate stock from PURCHASE movements only ──────────────────────
  const stockMap = new Map(); // productId → net qty from purchases
  for (const m of allMovements) {
    if (m.reason === 'PURCHASE') {
      stockMap.set(m.productId, (stockMap.get(m.productId) ?? 0) + (m.quantity ?? 0));
    }
  }
  console.log(`  Found PURCHASE movements for ${stockMap.size} products`);

  // ── 2. Update products ───────────────────────────────────────────────────
  console.log('🏭 Updating product stock levels…');
  const prodSnap = await getDocs(collection(db, 'products'));
  const CHUNK = 400;
  for (let i = 0; i < prodSnap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    prodSnap.docs.slice(i, i + CHUNK).forEach(d => {
      const newStock = stockMap.get(d.id) ?? 0;
      batch.update(d.ref, { stock_level: newStock, unverified_stock: 0 });
    });
    await batch.commit();
  }
  console.log(`  Updated ${prodSnap.docs.length} products`);

  // ── 3. Delete PRODUCTION / SALE / SHIPMENT movements ────────────────────
  const toDeleteMovements = allMovements.filter(m =>
    ['PRODUCTION', 'SALE', 'SHIPMENT'].includes(m.reason)
  );
  console.log(`🗑️  Deleting ${toDeleteMovements.length} PRODUCTION/SALE/SHIPMENT movements…`);
  await batchDelete(toDeleteMovements);

  // ── 4. Delete production collections ────────────────────────────────────
  for (const col of ['production_targets', 'production_entries', 'production_orders']) {
    const snap = await getDocs(collection(db, col));
    console.log(`🗑️  Deleting ${snap.docs.length} docs from ${col}…`);
    await batchDelete(snap.docs.map(d => ({ ref: d.ref })));
  }

  // ── 5. Delete sales collections ──────────────────────────────────────────
  for (const col of ['sales_orders', 'sales']) {
    const snap = await getDocs(collection(db, col));
    console.log(`🗑️  Deleting ${snap.docs.length} docs from ${col}…`);
    await batchDelete(snap.docs.map(d => ({ ref: d.ref })));
  }

  console.log('\n✅ Done! Inventory now matches Supply Receipt History.');
  console.log('   Stock summary (products with stock > 0):');
  for (const [id, qty] of stockMap.entries()) {
    if (qty > 0) console.log(`   ${id}: ${qty}`);
  }
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); }).finally(() => setTimeout(() => process.exit(0), 500));
