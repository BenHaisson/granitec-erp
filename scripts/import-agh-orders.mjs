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
    date: '2024-01-04',
    ref: 'PKG-2024-0007',
    lines: [
      { sku: 'PKG-3FP-PB',     name: '3-Piece Frypan Set – Package Box', qty: 4065 },
      { sku: 'PKG-FP-SV',      name: 'Interlayer Frypan SV',             qty: 8130 }, // 4000+4130
    ],
  },
  {
    date: '2024-01-08',
    ref: 'PKG-2024-0008',
    lines: [
      { sku: 'PKG-3FP-PB',     name: '3-Piece Frypan Set – Package Box', qty: 4960 },
    ],
  },
  {
    date: '2024-02-01',
    ref: 'PKG-2024-0009',
    lines: [
      { sku: 'PKG-M26-PB',     name: 'Marmite 26cm – Package Box',       qty: 800 },
      { sku: 'PKG-M28-PB',     name: 'Marmite 28cm – Package Box',       qty: 800 },
    ],
  },
  {
    date: '2024-02-06',
    ref: 'PKG-2024-0010',
    lines: [
      { sku: 'PKG-M26-PB',     name: 'Marmite 26cm – Package Box',       qty: 2115 },
      { sku: 'PKG-M28-PB',     name: 'Marmite 28cm – Package Box',       qty: 2128 },
    ],
  },
  {
    date: '2024-02-09',
    ref: 'PKG-2024-0011',
    lines: [
      { sku: 'PKG-M26-PB',     name: 'Marmite 26cm – Package Box',       qty: 944  },
      { sku: 'PKG-M28-PB',     name: 'Marmite 28cm – Package Box',       qty: 948  },
      { sku: 'PKG-M30-PB',     name: 'Marmite 30cm – Package Box',       qty: 3990 },
      { sku: 'PKG-M26-INTER',  name: 'Interlayer Marmite 26cm',          qty: 3750 },
      { sku: 'PKG-M28-INTER',  name: 'Interlayer Marmite 28cm',          qty: 2500 },
      { sku: 'PKG-M30-INTER',  name: 'Interlayer Marmite 30cm',          qty: 2250 },
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

  // Validate all SKUs upfront
  const unknownSkus = new Set();
  for (const order of RAW_ORDERS) {
    for (const line of order.lines) {
      if (!skuMap.has(line.sku.toUpperCase())) unknownSkus.add(line.sku);
    }
  }
  if (unknownSkus.size > 0) {
    console.warn('⚠️  SKUs not found in product catalogue (lines will be skipped):');
    unknownSkus.forEach(s => console.warn(`   • ${s}`));
    console.warn('');
  }

  console.log('📦 Creating shipping orders...');
  let created = 0;

  for (const order of RAW_ORDERS) {
    const resolvedLines = order.lines
      .map(line => {
        const product = skuMap.get(line.sku.toUpperCase());
        if (!product) {
          console.warn(`   ⚠️  SKU not found, skipping: ${line.sku}`);
          return null;
        }
        return { productId: product.id, productName: product.name, sku: product.sku, qty: line.qty };
      })
      .filter(Boolean);

    if (resolvedLines.length === 0) {
      console.warn(`   ⚠️  Order ${order.ref} has no valid lines, skipping.`);
      continue;
    }

    await addDoc(collection(db, 'shipping_orders'), {
      ref:       order.ref,
      date:      order.date,
      supplier:  'AGH GROUP',
      lines:     resolvedLines,
      status:    'PLANNED',
      createdAt: Timestamp.now(),
    });
    console.log(`   ✅ ${order.ref}  ${order.date}  (${resolvedLines.length} lines)`);
    created++;
  }

  console.log(`\n✅ Done — ${created} shipping orders created.`);
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => setTimeout(() => process.exit(0), 500));
