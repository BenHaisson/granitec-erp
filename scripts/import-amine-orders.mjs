import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyA4IUwfzP_XIfbQtTVzBszcDD2cJS6odrU',
  projectId: 'granitec-erp',
  authDomain: 'granitec-erp.firebaseapp.com',
  storageBucket: 'granitec-erp.firebasestorage.app',
  messagingSenderId: '532605203373',
  appId: '1:532605203373:web:e62c55b1a8d1b537db6724',
});
const db = getFirestore(app);

const RAW_ORDERS = [
  { date: '2024-08-07', ref: 'PKG-2024-0043', lines: [
    { sku: 'PKG-7P-PB', qty: 40 }, { sku: 'PKG-EGG14-ST', qty: 7000 },
    { sku: 'PKG-7P-INTER-G', qty: 8934 }, { sku: 'PKG-7P-INTER-S', qty: 9399 },
  ]},
  { date: '2024-08-08', ref: 'PKG-2024-0044', lines: [{ sku: 'PKG-7P-PB', qty: 260 }] },
  { date: '2024-08-09', ref: 'PKG-2024-0045', lines: [{ sku: 'PKG-7P-PB', qty: 500 }] },
  { date: '2024-08-12', ref: 'PKG-2024-0046', lines: [
    { sku: 'PKG-7P-PB', qty: 200 }, { sku: 'PKG-FP26-ST', qty: 3500 },
  ]},
  { date: '2024-09-06', ref: 'PKG-2024-0047', lines: [{ sku: 'PKG-7P-PB', qty: 209 }] },
  { date: '2024-09-07', ref: 'PKG-2024-0048', lines: [{ sku: 'PKG-7P-PB', qty: 200 }] },
  { date: '2024-09-08', ref: 'PKG-2024-0049', lines: [{ sku: 'PKG-7P-PB', qty: 200 }] },
  { date: '2024-09-10', ref: 'PKG-2024-0050', lines: [{ sku: 'PKG-7P-PB', qty: 200 }] },
  { date: '2024-09-11', ref: 'PKG-2024-0051', lines: [{ sku: 'PKG-7P-PB', qty: 200 }] },
  { date: '2024-09-13', ref: 'PKG-2024-0052', lines: [{ sku: 'PKG-7P-PB', qty: 270 }] },
];

async function main() {
  console.log('🔍 Loading products...');
  const prodSnap = await getDocs(collection(db, 'products'));
  const skuMap = new Map();
  prodSnap.docs.forEach(d => {
    const data = d.data();
    skuMap.set(data.sku?.toUpperCase(), { id: d.id, name: data.name, sku: data.sku });
  });
  console.log(`   Found ${skuMap.size} products.\n`);

  const unknownSkus = new Set();
  for (const order of RAW_ORDERS)
    for (const line of order.lines)
      if (!skuMap.has(line.sku.toUpperCase())) unknownSkus.add(line.sku);

  if (unknownSkus.size > 0) {
    console.warn('⚠️  Unknown SKUs (will be skipped):');
    unknownSkus.forEach(s => console.warn(`   • ${s}`));
    console.warn('');
  }

  console.log('📦 Creating shipping orders...');
  let created = 0;

  for (const order of RAW_ORDERS) {
    const resolvedLines = order.lines
      .map(line => {
        const p = skuMap.get(line.sku.toUpperCase());
        if (!p) { console.warn(`   ⚠️  Skipping unknown SKU: ${line.sku}`); return null; }
        return { productId: p.id, productName: p.name, sku: p.sku, qty: line.qty };
      })
      .filter(Boolean);

    if (resolvedLines.length === 0) { console.warn(`   ⚠️  ${order.ref} has no valid lines.`); continue; }

    await addDoc(collection(db, 'shipping_orders'), {
      ref: order.ref, date: order.date, supplier: 'Imprimerie Amine',
      lines: resolvedLines, status: 'PLANNED', createdAt: Timestamp.now(),
    });
    console.log(`   ✅ ${order.ref}  ${order.date}  (${resolvedLines.length} lines)`);
    created++;
  }

  console.log(`\n✅ Done — ${created} orders created.`);
}

main().catch(e => { console.error('❌', e); process.exit(1); }).finally(() => setTimeout(() => process.exit(0), 500));
