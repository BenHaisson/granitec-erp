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

// Refs to change from PKG to DISC
const importRefs = ['PKG-2024-0001', 'PKG-2024-0006', 'PKG-2024-0013'];

const snap = await getDocs(query(collection(db, 'shipping_orders'), orderBy('date', 'asc')));
const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

console.log('\n🔄 Converting Import supplier refs from PKG to DISC\n');

// Step 1: Change Import refs to DISC
console.log('Step 1: Change Import orders to DISC refs');
const discMappings = [
  { old: 'PKG-2024-0001', new: 'DISC-2024-0001' },
  { old: 'PKG-2024-0006', new: 'DISC-2024-0002' },
  { old: 'PKG-2024-0013', new: 'DISC-2024-0003' },
];

for (const mapping of discMappings) {
  const order = orders.find(o => o.ref === mapping.old);
  if (order) {
    await updateDoc(doc(db, 'shipping_orders', order.id), { ref: mapping.new });
    console.log(`   ✅ ${mapping.old} → ${mapping.new}`);
  }
}

// Step 2: Re-number remaining PKG refs
console.log('\nStep 2: Re-number remaining PKG orders');
const pkgOrders = orders.filter(o => o.ref.startsWith('PKG-')).sort((a, b) => {
  const aDate = new Date(a.date);
  const bDate = new Date(b.date);
  return aDate - bDate;
});

let pkgNum = 1;
let currentYear = null;
const pkgUpdates = [];

for (const order of pkgOrders) {
  // Skip the three that are now DISC
  if (importRefs.includes(order.ref)) continue;

  const year = order.date.split('-')[0];
  if (year !== currentYear) {
    pkgNum = 1;
    currentYear = year;
  }

  const newRef = `PKG-${year}-${String(pkgNum).padStart(4, '0')}`;
  if (order.ref !== newRef) {
    pkgUpdates.push({ id: order.id, old: order.ref, new: newRef });
  }
  pkgNum++;
}

for (const upd of pkgUpdates) {
  await updateDoc(doc(db, 'shipping_orders', upd.id), { ref: upd.new });
  console.log(`   ✅ ${upd.old} → ${upd.new}`);
}

console.log(`\n✅ Done — 3 DISC refs created, ${pkgUpdates.length} PKG refs re-numbered.`);
