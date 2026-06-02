import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyA4IUwfzP_XIfbQtTVzBszcDD2cJS6odrU',
  projectId: 'granitec-erp',
  authDomain: 'granitec-erp.firebaseapp.com',
  storageBucket: 'granitec-erp.firebasestorage.app',
  messagingSenderId: '532605203373',
  appId: '1:532605203373:web:e62c55b1a8d1b537db6724',
});
const db = getFirestore(app);

const snap = await getDocs(query(collection(db, 'shipping_orders'), orderBy('date', 'asc')));
const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

console.log('\n📋 SHIPPING ORDERS BY DATE (oldest first)\n');
console.log('Date       | Current Ref      | Year | New Ref          | Status');
console.log('-----------|------------------|------|------------------|--------');

const updates = [];
orders.forEach((o, i) => {
  const date = o.date;
  const year = date.split('-')[0];
  const orderNum = String(i + 1).padStart(4, '0');
  const newRef = `PKG-${year}-${orderNum}`;
  const status = o.ref !== newRef ? '⚠️ NEEDS UPDATE' : '✓ OK';

  console.log(`${date} | ${o.ref.padEnd(16)} | ${year} | ${newRef.padEnd(16)} | ${status}`);

  if (o.ref !== newRef) {
    updates.push({ id: o.id, oldRef: o.ref, newRef });
  }
});

console.log(`\nTotal: ${orders.length} orders | Updates needed: ${updates.length}`);

if (updates.length > 0) {
  console.log('\n🔄 Applying updates...\n');
  for (const upd of updates) {
    await updateDoc(doc(db, 'shipping_orders', upd.id), { ref: upd.newRef });
    console.log(`   ✅ ${upd.oldRef} → ${upd.newRef}`);
  }
  console.log(`\n✅ Done — ${updates.length} refs updated.`);
} else {
  console.log('\n✓ All refs are correct!');
}
