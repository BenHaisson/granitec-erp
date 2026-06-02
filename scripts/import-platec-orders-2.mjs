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
    date: '2024-06-04', ref: 'PKG-2024-0012',
    lines: [
      { sku: 'PKG-3FP-PB',  name: '3-Piece Frypan Set – Package Box', qty: 635  },
    ],
  },
  {
    date: '2024-06-05', ref: 'PKG-2024-0013',
    lines: [
      { sku: 'PKG-FP-SV',   name: 'Interlayer Frypan SV',             qty: 2400 },
    ],
  },
  {
    date: '2024-06-11', ref: 'PKG-2024-0014',
    lines: [
      { sku: 'PKG-CR18-ST', name: 'Crepe Pan 18cm – Sticker',         qty: 1800 },
      { sku: 'PKG-CR22-ST', name: 'Crepe Pan 22cm – Sticker',         qty: 1600 },
      { sku: 'PKG-CR24-ST', name: 'Crepe Pan 24cm – Sticker',         qty: 1200 },
      { sku: 'PKG-FP-SV',   name: 'Interlayer Frypan SV',             qty: 1200 },
    ],
  },
  {
    date: '2024-06-13', ref: 'PKG-2024-0015',
    lines: [
      { sku: 'PKG-3FP-PB',  name: '3-Piece Frypan Set – Package Box', qty: 1466 },
      { sku: 'PKG-CR22-ST', name: 'Crepe Pan 22cm – Sticker',         qty: 500  },
      { sku: 'PKG-CR24-ST', name: 'Crepe Pan 24cm – Sticker',         qty: 1900 },
    ],
  },
  {
    date: '2024-07-11', ref: 'PKG-2024-0016',
    lines: [
      { sku: 'PKG-FP-SV',   name: 'Interlayer Frypan SV',             qty: 2700 },
    ],
  },
  {
    date: '2024-07-12', ref: 'PKG-2024-0017',
    lines: [
      { sku: 'PKG-5SP-PB',  name: '5-Piece Saucepot Set – Package Box', qty: 431 },
      { sku: 'PKG-M30-PB',  name: 'Marmite 30cm – Package Box',         qty: 994 },
    ],
  },
  {
    date: '2024-07-26', ref: 'PKG-2024-0018',
    lines: [
      { sku: 'PKG-5SP-MB',  name: '5-Piece Saucepot Set – Master Box',  qty: 506 },
      { sku: 'PKG-3FP-MB',  name: '3-Piece Frypan Set – Master Box',    qty: 530 },
    ],
  },
];

async function main() {
  console.log('🔍 Loading products from Firestore...');
  const prodSnap = await getDocs(collection(db, 'products'));
  const skuMap = new Map();
  prodSnap.docs.forEach(d => {
    const data = d.data();
    skuMap.set(data.sku?.toUpperCase(), { id: d.id, name: data.name, sku: data.sku });
  });
  console.log(`   Found ${skuMap.size} products in catalogue.\n`);

  const unknownSkus = new Set();
  for (const order of RAW_ORDERS)
    for (const line of order.lines)
      if (!skuMap.has(line.sku.toUpperCase())) unknownSkus.add(line.sku);

  if (unknownSkus.size > 0) {
    console.warn('⚠️  SKUs not found (will be skipped):');
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

    if (resolvedLines.length === 0) { console.warn(`   ⚠️  ${order.ref} has no valid lines, skipping.`); continue; }

    await addDoc(collection(db, 'shipping_orders'), {
      ref: order.ref, date: order.date, supplier: 'PLATEC',
      lines: resolvedLines, status: 'PLANNED', createdAt: Timestamp.now(),
    });
    console.log(`   ✅ ${order.ref}  ${order.date}  (${resolvedLines.length} lines)`);
    created++;
  }

  console.log(`\n✅ Done — ${created} shipping orders created.`);
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => setTimeout(() => process.exit(0), 500));
