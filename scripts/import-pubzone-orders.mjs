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
  {
    date: '2024-04-15',
    ref: 'PKG-2024-0042',
    supplier: 'PUB ZONE',
    lines: [
      { sku: 'PKG-5SP-MB',    qty: 2347 },
      { sku: 'PKG-3FP-MB',    qty: 3129 },
      { sku: 'PKG-M26-MB',    qty: 2480 },
      { sku: 'PKG-M28-MB',    qty: 2560 },
      { sku: 'PKG-M30-MB',    qty: 2418 },
      { sku: 'PKG-CR18-MB',   qty: 5540 },
      { sku: 'PKG-CR24-MB',   qty: 5511 },
      { sku: 'PKG-CR22-MB',   qty: 5180 },
      { sku: 'PKG-5SP-PB',    qty: 4940 },
      { sku: 'PKG-EGG14-MB',  qty: 3500 },
    ],
  },
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
    console.warn('⚠️  Unknown SKUs:');
    unknownSkus.forEach(s => console.warn(`   • ${s}`));
    console.warn('');
  }

  console.log('📦 Creating shipping orders...');
  let created = 0;

  for (const order of RAW_ORDERS) {
    const resolvedLines = order.lines
      .map(line => {
        const p = skuMap.get(line.sku.toUpperCase());
        if (!p) { console.warn(`   ⚠️  Skipping: ${line.sku}`); return null; }
        return { productId: p.id, productName: p.name, sku: p.sku, qty: line.qty };
      })
      .filter(Boolean);

    if (resolvedLines.length === 0) { console.warn(`   ⚠️  ${order.ref} has no valid lines.`); continue; }

    await addDoc(collection(db, 'shipping_orders'), {
      ref: order.ref, date: order.date, supplier: order.supplier,
      lines: resolvedLines, status: 'PLANNED', createdAt: Timestamp.now(),
    });
    console.log(`   ✅ ${order.ref}  ${order.date}  (${resolvedLines.length} lines)`);
    created++;
  }

  console.log(`\n✅ Done — ${created} order created.`);
}

main().catch(e => { console.error('❌', e); process.exit(1); }).finally(() => setTimeout(() => process.exit(0), 500));
