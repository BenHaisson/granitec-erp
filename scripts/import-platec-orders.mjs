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

// ── Raw order data ────────────────────────────────────────────────
// Duplicate SKUs on same date are merged (summed)
const RAW_ORDERS = [
  {
    date: '2024-01-20',
    ref: 'PKG-2024-0001',
    lines: [
      { sku: 'PKG-5SP-MB',   name: '5-Piece Saucepot Set — Master Box', qty: 262 },
      { sku: 'PKG-3FP-MB',   name: '3-Piece Frypan Set – Master Box',   qty: 256 },
      { sku: 'PKG-FP-SV',    name: 'Interlayer Frypan SV',              qty: 512 },
    ],
  },
  {
    date: '2024-03-01',
    ref: 'PKG-2024-0002',
    lines: [
      { sku: 'PKG-5SP-MB',   name: '5-Piece Saucepot Set — Master Box', qty: 115 },
      { sku: 'PKG-3FP-MB',   name: '3-Piece Frypan Set – Master Box',   qty: 100 },
      { sku: 'PKG-CR18-ST',  name: 'Crepe Pan 18cm – Sticker',          qty: 1000 }, // 500+500
      { sku: 'PKG-CR22-ST',  name: 'Crepe Pan 22cm – Sticker',          qty: 500  },
    ],
  },
  {
    date: '2024-03-05',
    ref: 'PKG-2024-0003',
    lines: [
      { sku: 'PKG-EGG14-PB', name: 'Egg Pan 14cm – Package Box',        qty: 280  },
      { sku: 'PKG-CR18-ST',  name: 'Crepe Pan 18cm – Sticker',          qty: 4773 }, // 2439+2334
      { sku: 'PKG-CR22-ST',  name: 'Crepe Pan 22cm – Sticker',          qty: 1600 }, // 1400+200
      { sku: 'PKG-CR24-ST',  name: 'Crepe Pan 24cm – Sticker',          qty: 1700 }, // 300+1400
    ],
  },
  {
    date: '2024-03-08',
    ref: 'PKG-2024-0004',
    lines: [
      { sku: 'PKG-5SP-MB',   name: '5-Piece Saucepot Set — Master Box', qty: 394  },
      { sku: 'PKG-3FP-MB',   name: '3-Piece Frypan Set – Master Box',   qty: 374  },
      { sku: 'PKG-EGG14-PB', name: 'Egg Pan 14cm – Package Box',        qty: 3440 },
      { sku: 'PKG-CR18-ST',  name: 'Crepe Pan 18cm – Sticker',          qty: 659  }, // 366+293
      { sku: 'PKG-CR22-ST',  name: 'Crepe Pan 22cm – Sticker',          qty: 1000 },
      { sku: 'PKG-CR24-ST',  name: 'Crepe Pan 24cm – Sticker',          qty: 1994 }, // 1616+378
    ],
  },
  {
    date: '2024-03-16',
    ref: 'PKG-2024-0005',
    lines: [
      { sku: 'PKG-EGG14-PB', name: 'Egg Pan 14cm – Package Box',        qty: 4070 },
      { sku: 'PKG-CR22-ST',  name: 'Crepe Pan 22cm – Sticker',          qty: 1624 },
    ],
  },
  {
    date: '2024-04-03',
    ref: 'PKG-2024-0006',
    lines: [
      { sku: 'PKG-M28-MB',   name: 'Marmite 28cm – Master Box',         qty: 627  },
      { sku: 'PKG-M26-MB',   name: 'Marmite 26cm – Master Box',         qty: 266  },
      { sku: 'PKG-M30-MB',   name: 'Marmite 30cm – Master Box',         qty: 516  },
      { sku: 'PKG-CR18-ST',  name: 'Crepe Pan 18cm – Sticker',          qty: 2497 }, // 1200+1297
      { sku: 'PKG-CR22-ST',  name: 'Crepe Pan 22cm – Sticker',          qty: 2496 }, // 1242+1254
    ],
  },
];

async function main() {
  // ── 1. Load product catalogue and build SKU → id map ──────────
  console.log('🔍 Loading products from Firestore...');
  const prodSnap = await getDocs(collection(db, 'products'));
  const skuMap = new Map();
  prodSnap.docs.forEach(d => {
    const data = d.data();
    skuMap.set(data.sku?.toUpperCase(), { id: d.id, name: data.name, sku: data.sku });
  });
  console.log(`   Found ${skuMap.size} products in catalogue.`);

  // ── 2. Validate all SKUs before writing anything ───────────────
  const unknownSkus = new Set();
  for (const order of RAW_ORDERS) {
    for (const line of order.lines) {
      if (!skuMap.has(line.sku.toUpperCase())) unknownSkus.add(line.sku);
    }
  }
  if (unknownSkus.size > 0) {
    console.warn('\n⚠️  Unknown SKUs (not found in product catalogue):');
    unknownSkus.forEach(s => console.warn(`   • ${s}`));
    console.warn('\nThese lines will be skipped. Continue? Edit the script to fix them first.');
    // Still continue but skip unknowns
  }

  // ── 3. Create each shipping order ─────────────────────────────
  console.log('\n📦 Creating shipping orders...');
  let created = 0;

  for (const order of RAW_ORDERS) {
    const resolvedLines = order.lines
      .map(line => {
        const product = skuMap.get(line.sku.toUpperCase());
        if (!product) {
          console.warn(`   ⚠️  SKU not found, skipping: ${line.sku}`);
          return null;
        }
        return {
          productId:   product.id,
          productName: product.name,
          sku:         product.sku,
          qty:         line.qty,
        };
      })
      .filter(Boolean);

    if (resolvedLines.length === 0) {
      console.warn(`   ⚠️  Order ${order.ref} has no valid lines, skipping.`);
      continue;
    }

    const doc = {
      ref:       order.ref,
      date:      order.date,
      supplier:  'PLATEC',
      lines:     resolvedLines,
      status:    'PLANNED',
      createdAt: Timestamp.now(),
    };

    await addDoc(collection(db, 'shipping_orders'), doc);
    console.log(`   ✅ ${order.ref}  ${order.date}  (${resolvedLines.length} lines)`);
    created++;
  }

  console.log(`\n✅ Done — ${created} shipping orders created.`);
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => setTimeout(() => process.exit(0), 500));
