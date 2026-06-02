import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyA4IUwfzP_XIfbQtTVzBszcDD2cJS6odrU',
  projectId: 'granitec-erp',
  authDomain: 'granitec-erp.firebaseapp.com',
  storageBucket: 'granitec-erp.firebasestorage.app',
  messagingSenderId: '532605203373',
  appId: '1:532605203373:web:e62c55b1a8d1b537db6724',
});
const db = getFirestore(app);

async function fullAudit() {
  console.log('\n🔍 COMPLETE INVENTORY AUDIT\n');
  console.log('Loading all products and movements...\n');

  // Get all products
  const prodSnap = await getDocs(collection(db, 'products'));
  const products = new Map(prodSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));

  // Get all movements
  const movSnap = await getDocs(
    query(collection(db, 'inventory_movements'), orderBy('createdAt', 'asc'))
  );
  const movements = movSnap.docs.map(d => d.data());

  console.log(`Found ${products.size} products and ${movements.length} movements\n`);

  // Build movement analysis
  const analysis = new Map();
  let totalMovementQty = 0;

  for (const mov of movements) {
    const productId = mov.productId;
    const qty = mov.quantity || 0;

    if (!analysis.has(productId)) {
      const prod = products.get(productId);
      analysis.set(productId, {
        sku: prod?.sku || productId,
        name: prod?.name || 'Unknown',
        type: prod?.type || 'UNKNOWN',
        category: prod?.category || 'Unknown',
        currentStock: prod?.stock_level || 0,
        unverified: prod?.unverified_stock || 0,
        movements: [],
        calculatedStock: 0,
        phantom: false,
      });
    }

    const item = analysis.get(productId);
    item.movements.push({
      qty,
      reason: mov.reason,
      note: mov.note,
      date: mov.createdAt?.toDate?.()?.toLocaleDateString() || '?',
    });
    item.calculatedStock += qty;
    totalMovementQty += qty;
  }

  // Check for issues
  const issues = [];
  const byIssueType = {
    mismatch: [],
    phantom: [],
    suspicious: [],
  };

  console.log('=' .repeat(140));
  console.log('DETAILED PRODUCT ANALYSIS');
  console.log('=' .repeat(140) + '\n');

  for (const [productId, item] of analysis) {
    const diff = item.calculatedStock - item.currentStock;
    const hasIssue = Math.abs(diff) > 0;

    // Check for phantom movements (e.g., PKG-* note on non-PKG product)
    let isPhantom = false;
    let phantomReason = '';
    for (const mov of item.movements) {
      const notePrefix = mov.note?.split('-')[0]?.toUpperCase() || '';
      const skuPrefix = item.sku?.split('-')[0]?.toUpperCase() || '';

      // If note has a prefix and SKU has different prefix, it might be phantom
      if (notePrefix && notePrefix !== skuPrefix && notePrefix.match(/^[A-Z]{3,}$/)) {
        isPhantom = true;
        phantomReason = `Note prefix "${notePrefix}" doesn't match SKU prefix "${skuPrefix}"`;
        byIssueType.phantom.push({ sku: item.sku, issue: phantomReason, qty: mov.qty });
      }
    }

    if (hasIssue) {
      const issue = {
        sku: item.sku,
        name: item.name,
        currentStock: item.currentStock,
        calculatedStock: item.calculatedStock,
        diff,
        movementCount: item.movements.length,
        phantom: isPhantom,
      };
      issues.push(issue);

      if (isPhantom) {
        byIssueType.phantom.push(issue);
      } else {
        byIssueType.mismatch.push(issue);
      }

      // Print issue details
      console.log(`❌ ${item.sku} (${item.name})`);
      console.log(`   Type: ${item.type} | Category: ${item.category}`);
      console.log(`   Current Stock: ${item.currentStock}`);
      console.log(`   Calculated: ${item.calculatedStock}`);
      console.log(`   Difference: ${diff > 0 ? '+' : ''}${diff}`);
      console.log(`   Movements: ${item.movements.length}`);

      if (isPhantom) {
        console.log(`   ⚠️  PHANTOM: ${phantomReason}`);
      }

      // Show movement breakdown
      const byReason = {};
      for (const mov of item.movements) {
        if (!byReason[mov.reason]) byReason[mov.reason] = 0;
        byReason[mov.reason] += mov.qty;
      }
      console.log(`   Breakdown:`);
      for (const [reason, total] of Object.entries(byReason).sort()) {
        console.log(`     ${reason.padEnd(12)}: ${total > 0 ? '+' : ''}${total}`);
      }
      console.log('');
    }
  }

  // Summary
  console.log('=' .repeat(140));
  console.log('AUDIT SUMMARY\n');
  console.log(`Total Products: ${products.size}`);
  console.log(`Products with Issues: ${issues.length}`);
  console.log(`  - Mismatches: ${byIssueType.mismatch.length}`);
  console.log(`  - Phantom Movements: ${byIssueType.phantom.length}`);
  console.log(`\nTotal Movements: ${movements.length}`);
  console.log(`Total Movement Quantity: ${totalMovementQty.toLocaleString()}`);
  console.log(`Verified Stock Level: ${Array.from(analysis.values()).reduce((s, a) => s + a.currentStock, 0).toLocaleString()}`);

  if (issues.length === 0) {
    console.log('\n✅ NO ISSUES FOUND - Inventory is consistent!\n');
  } else {
    console.log('\n📋 ISSUES REQUIRING ATTENTION:\n');

    if (byIssueType.phantom.length > 0) {
      console.log('🚨 PHANTOM MOVEMENTS (wrong order type applied to product):\n');
      for (const p of byIssueType.phantom) {
        console.log(
          `  ${p.sku.padEnd(20)} ${typeof p.issue === 'string' ? '→ ' + p.issue : '→ Mismatch: ' + p.diff + ' units'}`
        );
      }
    }

    if (byIssueType.mismatch.length > 0) {
      console.log('\n⚠️  STOCK MISMATCHES (calculated ≠ current):\n');
      for (const m of byIssueType.mismatch.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))) {
        console.log(
          `  ${m.sku.padEnd(20)} Expected: ${m.calculatedStock.toString().padStart(8)} | Current: ${m.currentStock.toString().padStart(8)} | Diff: ${(m.diff > 0 ? '+' : '')}${m.diff}`
        );
      }
    }
  }

  console.log('\n');
}

fullAudit()
  .catch(e => { console.error('❌ Audit failed:', e); process.exit(1); })
  .finally(() => setTimeout(() => process.exit(0), 500));
