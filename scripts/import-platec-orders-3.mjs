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
  { date: '2024-11-01', ref: 'PKG-2024-0019', lines: [
    { sku: 'PKG-3FP-PB', qty: 4125 }, { sku: 'PKG-M30-PB', qty: 495 },
  ]},
  { date: '2024-11-09', ref: 'PKG-2024-0020', lines: [{ sku: 'PKG-FP-SV', qty: 1500 }] },
  { date: '2024-11-12', ref: 'PKG-2024-0021', lines: [{ sku: 'PKG-FP-SV', qty: 2000 }] },
  { date: '2024-11-15', ref: 'PKG-2024-0022', lines: [
    { sku: 'PKG-SP-GF', qty: 5100 }, { sku: 'PKG-SP-PF', qty: 5100 },
  ]},
  { date: '2024-11-21', ref: 'PKG-2024-0023', lines: [{ sku: 'PKG-3FP-PB', qty: 2136 }] },
  { date: '2024-11-26', ref: 'PKG-2024-0024', lines: [{ sku: 'PKG-M26-PB', qty: 2475 }] },
  { date: '2024-11-28', ref: 'PKG-2024-0025', lines: [
    { sku: 'PKG-CR18-ST', qty: 950 }, { sku: 'PKG-CR22-ST', qty: 445 },
    { sku: 'PKG-CR24-ST', qty: 2100 }, { sku: 'PKG-3SP-PB', qty: 1600 },
  ]},
  { date: '2024-12-03', ref: 'PKG-2024-0026', lines: [
    { sku: 'PKG-CR18-ST', qty: 286 }, { sku: 'PKG-CR22-ST', qty: 2400 }, { sku: 'PKG-M26-PB', qty: 239 },
  ]},
  { date: '2024-12-04', ref: 'PKG-2024-0027', lines: [{ sku: 'PKG-3SP-PB', qty: 4395 }] },
  { date: '2024-12-11', ref: 'PKG-2024-0028', lines: [{ sku: 'PKG-M26-PB', qty: 6882 }] },
  { date: '2024-12-27', ref: 'PKG-2024-0029', lines: [{ sku: 'PKG-3SP-MB', qty: 180 }] },
  { date: '2024-12-28', ref: 'PKG-2024-0030', lines: [{ sku: 'PKG-3SP-MB', qty: 300 }] },
  { date: '2024-12-31', ref: 'PKG-2024-0031', lines: [{ sku: 'PKG-3SP-MB', qty: 559 }] },
  { date: '2025-01-09', ref: 'PKG-2024-0032', lines: [
    { sku: 'PKG-M30-PB', qty: 16 }, { sku: 'PKG-M28-PB', qty: 3900 }, { sku: 'PKG-M26-PB', qty: 566 },
    { sku: 'PKG-CR18-ST', qty: 11760 }, { sku: 'PKG-CR22-ST', qty: 14618 }, { sku: 'PKG-CR24-ST', qty: 197 },
  ]},
  { date: '2025-01-16', ref: 'PKG-2024-0033', lines: [
    { sku: 'PKG-M28-PB', qty: 1151 }, { sku: 'PKG-M30-PB', qty: 1846 },
    { sku: 'PKG-CR18-ST', qty: 8531 },
  ]},
  { date: '2025-01-20', ref: 'PKG-2024-0034', lines: [
    { sku: 'PKG-M30-PB', qty: 900 }, { sku: 'PKG-CR18-ST', qty: 5427 }, { sku: 'PKG-CR22-ST', qty: 3444 },
  ]},
  { date: '2025-02-07', ref: 'PKG-2024-0035', lines: [{ sku: 'PKG-CR24-ST', qty: 2000 }] },
  { date: '2025-02-18', ref: 'PKG-2024-0036', lines: [
    { sku: 'PKG-3SP-MB', qty: 55 }, { sku: 'PKG-CR24-ST', qty: 2854 },
  ]},
  { date: '2025-02-19', ref: 'PKG-2024-0037', lines: [{ sku: 'PKG-3FP-PB', qty: 200 }] },
  { date: '2025-02-20', ref: 'PKG-2024-0038', lines: [
    { sku: 'PKG-CR24-ST', qty: 2854 }, { sku: 'PKG-3SP-MB', qty: 55 },
  ]},
  { date: '2025-02-21', ref: 'PKG-2024-0039', lines: [{ sku: 'PKG-3FP-PB', qty: 200 }] },
  { date: '2025-02-22', ref: 'PKG-2024-0040', lines: [
    { sku: 'PKG-3FP-PB', qty: 3281 }, { sku: 'PKG-3SP-MB', qty: 343 },
  ]},
  { date: '2025-02-27', ref: 'PKG-2024-0041', lines: [{ sku: 'PKG-FP-SV', qty: 7180 }] },
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
        if (!p) return null;
        return { productId: p.id, productName: p.name, sku: p.sku, qty: line.qty };
      })
      .filter(Boolean);

    if (resolvedLines.length === 0) continue;

    await addDoc(collection(db, 'shipping_orders'), {
      ref: order.ref, date: order.date, supplier: 'PLATEC',
      lines: resolvedLines, status: 'PLANNED', createdAt: Timestamp.now(),
    });
    console.log(`   ✅ ${order.ref}  ${order.date}  (${resolvedLines.length} lines)`);
    created++;
  }

  console.log(`\n✅ Done — ${created} orders created.`);
}

main().catch(e => { console.error('❌', e); process.exit(1); }).finally(() => setTimeout(() => process.exit(0), 500));
