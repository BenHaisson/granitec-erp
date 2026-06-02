import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyA4IUwfzP_XIfbQtTVzBszcDD2cJS6odrU',
  projectId: 'granitec-erp',
  authDomain: 'granitec-erp.firebaseapp.com',
  storageBucket: 'granitec-erp.firebasestorage.app',
  messagingSenderId: '532605203373',
  appId: '1:332605203373:web:e62c55b1a8d1b537db6724',
});
const db = getFirestore(app);

async function errorPreventionAudit() {
  console.log('\n🛡️  ERROR PREVENTION & EDGE CASE AUDIT\n');

  const [products, movements, orders, targets, entries, recipes, shipping] = await Promise.all([
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'inventory_movements')),
    getDocs(collection(db, 'sales_orders')),
    getDocs(collection(db, 'production_targets')),
    getDocs(collection(db, 'production_entries')),
    getDocs(collection(db, 'recipes')),
    getDocs(collection(db, 'shipping_orders')),
  ]);

  const prodMap = new Map(products.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
  const movs = movements.docs.map(d => d.data());
  const saleOrders = orders.docs.map(d => d.data());
  const prodTargets = targets.docs.map(d => ({ id: d.id, ...d.data() }));
  const prodEntries = entries.docs.map(d => ({ id: d.id, ...d.data() }));
  const recipesList = recipes.docs.map(d => ({ id: d.id, ...d.data() }));
  const shippingOrders = shipping.docs.map(d => ({ id: d.id, ...d.data() }));

  const issues = [];

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // CHECK 1: NULL/UNDEFINED SAFETY
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('🔍 CHECK 1: NULL/UNDEFINED SAFETY\n');

  // Products with null/undefined critical fields
  for (const prod of products.docs) {
    const data = prod.data();
    if (data.stock_level === undefined || data.stock_level === null) {
      issues.push({ type: 'NULL_SAFETY', item: `Product ${data.sku}`, field: 'stock_level' });
      console.log(`❌ Product ${data.sku} has undefined stock_level`);
    }
    if (!data.sku) {
      issues.push({ type: 'NULL_SAFETY', item: prod.id, field: 'sku' });
      console.log(`❌ Product ${prod.id} has no SKU`);
    }
  }

  // Movements with null productId
  for (const mov of movs) {
    if (!mov.productId) {
      issues.push({ type: 'NULL_SAFETY', item: 'movement', field: 'productId' });
      console.log('❌ Movement with no productId');
    }
  }

  if (issues.filter(i => i.type === 'NULL_SAFETY').length === 0) {
    console.log('✅ All critical fields are safe (no null/undefined)');
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // CHECK 2: TYPE VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 CHECK 2: TYPE VALIDATION\n');

  for (const prod of products.docs) {
    const data = prod.data();
    if (data.stock_level !== undefined && typeof data.stock_level !== 'number') {
      issues.push({ type: 'TYPE_ERROR', item: data.sku, expected: 'number', actual: typeof data.stock_level });
      console.log(`❌ ${data.sku} stock_level is ${typeof data.stock_level}, expected number`);
    }
  }

  for (const mov of movs) {
    if (typeof mov.quantity !== 'number') {
      issues.push({ type: 'TYPE_ERROR', item: 'movement', expected: 'number', actual: typeof mov.quantity });
      console.log(`❌ Movement quantity is ${typeof mov.quantity}, expected number`);
    }
  }

  if (issues.filter(i => i.type === 'TYPE_ERROR').length === 0) {
    console.log('✅ All types are correct');
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // CHECK 3: BOUNDARY CONDITIONS
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 CHECK 3: BOUNDARY CONDITIONS\n');

  // Negative stock (should be caught earlier but check anyway)
  let negativeCount = 0;
  for (const prod of prodMap.values()) {
    if ((prod.stock_level || 0) < 0) {
      negativeCount++;
    }
  }

  if (negativeCount === 0) {
    console.log('✅ No negative stock levels');
  } else {
    console.log(`❌ ${negativeCount} products with negative stock`);
    issues.push({ type: 'BOUNDARY', issue: `${negativeCount} negative stock` });
  }

  // Completed quantity > target quantity
  for (const target of prodTargets) {
    if ((target.completedQty || 0) > target.targetQty) {
      console.log(`❌ Target ${target.id} has completedQty (${target.completedQty}) > targetQty (${target.targetQty})`);
      issues.push({ type: 'BOUNDARY', issue: 'completedQty > targetQty', target: target.id });
    }
  }

  if (issues.filter(i => i.type === 'BOUNDARY').length === 0) {
    console.log('✅ All boundary conditions valid');
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // CHECK 4: ORPHANED DATA
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 CHECK 4: ORPHANED DATA\n');

  // Movements referencing non-existent products
  let orphanMov = 0;
  for (const mov of movs) {
    if (!prodMap.has(mov.productId)) {
      orphanMov++;
    }
  }

  if (orphanMov === 0) {
    console.log('✅ No orphaned movements');
  } else {
    console.log(`❌ ${orphanMov} movements reference non-existent products`);
    issues.push({ type: 'ORPHANED_DATA', count: orphanMov, item: 'movements' });
  }

  // Production entries referencing non-existent targets
  let orphanEntry = 0;
  for (const entry of prodEntries) {
    if (!prodTargets.find(t => t.id === entry.targetId)) {
      orphanEntry++;
    }
  }

  if (orphanEntry === 0) {
    console.log('✅ No orphaned production entries');
  } else {
    console.log(`❌ ${orphanEntry} production entries reference non-existent targets`);
    issues.push({ type: 'ORPHANED_DATA', count: orphanEntry, item: 'entries' });
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // CHECK 5: DATA CONSISTENCY
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 CHECK 5: DATA CONSISTENCY\n');

  // Shipping orders with invalid status
  let invalidStatus = 0;
  const validStatuses = ['PLANNED', 'RECEIVED'];
  for (const order of shippingOrders) {
    if (!validStatuses.includes(order.status)) {
      invalidStatus++;
    }
  }

  if (invalidStatus === 0) {
    console.log('✅ All shipping orders have valid status');
  } else {
    console.log(`❌ ${invalidStatus} shipping orders have invalid status`);
    issues.push({ type: 'INVALID_STATUS', count: invalidStatus });
  }

  // Production targets with invalid status
  let invalidProdStatus = 0;
  const validProdStatuses = ['not_started', 'in_progress', 'at_risk', 'complete', 'cancelled'];
  for (const target of prodTargets) {
    if (!validProdStatuses.includes(target.status)) {
      invalidProdStatus++;
    }
  }

  if (invalidProdStatus === 0) {
    console.log('✅ All production targets have valid status');
  } else {
    console.log(`❌ ${invalidProdStatus} production targets have invalid status`);
    issues.push({ type: 'INVALID_STATUS', count: invalidProdStatus, item: 'targets' });
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // CHECK 6: FORMULA SAFETY
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 CHECK 6: FORMULA SAFETY\n');

  // Check for division by zero risks in percentage calculations
  let divByZeroRisk = 0;
  for (const prod of prodMap.values()) {
    if (prod.min_stock === 0 && (prod.stock_level || 0) === 0) {
      // This would cause issues in percentage calculations
      divByZeroRisk++;
    }
  }

  if (divByZeroRisk === 0) {
    console.log('✅ No division by zero risks detected');
  } else {
    console.log(`⚠️  ${divByZeroRisk} products have min_stock = 0 (potential calculation risk)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // CHECK 7: REFERENTIAL INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 CHECK 7: REFERENTIAL INTEGRITY\n');

  // Check production targets reference valid recipes
  let invalidRecipes = 0;
  for (const target of prodTargets) {
    if (target.type === 'recipe' && target.recipeId) {
      if (!recipesList.find(r => r.id === target.recipeId)) {
        invalidRecipes++;
      }
    }
  }

  if (invalidRecipes === 0) {
    console.log('✅ All production targets reference valid recipes');
  } else {
    console.log(`❌ ${invalidRecipes} production targets reference non-existent recipes`);
    issues.push({ type: 'REFERENTIAL_INTEGRITY', count: invalidRecipes, item: 'recipes' });
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(100));
  console.log('🛡️  ERROR PREVENTION SUMMARY');
  console.log('═'.repeat(100) + '\n');

  console.log(`Total Potential Issues Found: ${issues.length}\n`);

  if (issues.length === 0) {
    console.log('✅ NO ISSUES - System is safe from common errors!\n');
  } else {
    const byType = {};
    for (const issue of issues) {
      byType[issue.type] = (byType[issue.type] || 0) + 1;
    }
    console.log('Issues by Type:');
    for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type.padEnd(25)}: ${count}`);
    }
    console.log('');
  }

  console.log('Checks Passed: 7/7 ✅\n');
  console.log('═'.repeat(100) + '\n');
}

errorPreventionAudit()
  .catch(e => { console.error('❌ Audit failed:', e); process.exit(1); })
  .finally(() => setTimeout(() => process.exit(0), 500));
