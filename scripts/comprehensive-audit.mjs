import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyA4IUwfzP_XIfbQtTVzBszcDD2cJS6odrU',
  projectId: 'granitec-erp',
  authDomain: 'granitec-erp.firebaseapp.com',
  storageBucket: 'granitec-erp.firebasestorage.app',
  messagingSenderId: '532605203373',
  appId: '1:532605203373:web:e62c55b1a8d1b537db6724',
});
const db = getFirestore(app);

async function comprehensiveAudit() {
  console.log('\n📋 COMPREHENSIVE SYSTEM AUDIT & SCENARIO TESTING\n');

  // Load all data
  const [products, movements, orders, targets, entries, recipes, shipping] = await Promise.all([
    getDocs(collection(db, 'products')),
    getDocs(query(collection(db, 'inventory_movements'), orderBy('createdAt', 'asc'))),
    getDocs(collection(db, 'sales_orders')),
    getDocs(collection(db, 'production_targets')),
    getDocs(collection(db, 'production_entries')),
    getDocs(collection(db, 'recipes')),
    getDocs(collection(db, 'shipping_orders')),
  ]);

  const prodMap = new Map(products.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
  const movs = movements.docs.map(d => d.data());
  const saleOrders = orders.docs.map(d => ({ id: d.id, ...d.data() }));
  const prodTargets = targets.docs.map(d => ({ id: d.id, ...d.data() }));
  const prodEntries = entries.docs.map(d => ({ id: d.id, ...d.data() }));
  const recipesList = recipes.docs.map(d => ({ id: d.id, ...d.data() }));
  const shippingOrders = shipping.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log('📊 DATA SUMMARY');
  console.log('═'.repeat(100));
  console.log(`Products: ${prodMap.size}`);
  console.log(`Movements: ${movs.length}`);
  console.log(`Sales Orders: ${saleOrders.length}`);
  console.log(`Production Targets: ${prodTargets.length}`);
  console.log(`Production Entries: ${prodEntries.length}`);
  console.log(`Recipes: ${recipesList.length}`);
  console.log(`Shipping Orders: ${shippingOrders.length}\n`);

  const issues = [];

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: INVENTORY CONSISTENCY
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('🔍 SCENARIO 1: INVENTORY CONSISTENCY\n');

  const stockAnalysis = new Map();
  for (const prod of prodMap.values()) {
    stockAnalysis.set(prod.id, {
      sku: prod.sku,
      current: prod.stock_level || 0,
      unverified: prod.unverified_stock || 0,
      calculated: 0,
    });
  }

  for (const mov of movs) {
    if (stockAnalysis.has(mov.productId)) {
      stockAnalysis.get(mov.productId).calculated += mov.quantity || 0;
    }
  }

  let inventory_ok = true;
  for (const [prodId, stock] of stockAnalysis) {
    if (stock.calculated !== stock.current) {
      issues.push({
        type: 'INVENTORY_MISMATCH',
        product: stock.sku,
        expected: stock.calculated,
        actual: stock.current,
        diff: stock.current - stock.calculated,
      });
      inventory_ok = false;
    }
  }

  console.log(inventory_ok ? '✅ All stock levels match movement history' : `❌ Found ${issues.filter(i => i.type === 'INVENTORY_MISMATCH').length} inventory mismatches\n`);

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: PRODUCTION TARGET INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n🏭 SCENARIO 2: PRODUCTION TARGET INTEGRITY\n');

  let prodTargetIssues = 0;

  // Check for targets with inconsistent fields
  for (const target of prodTargets) {
    const recipe = recipesList.find(r => r.id === target.recipeId);

    // Issue 1: in_progress but no materialsDeducted
    if (target.status === 'in_progress' && !target.materialsDeducted) {
      issues.push({
        type: 'PROD_TARGET_STATE',
        target: target.id,
        issue: 'Status is in_progress but materialsDeducted is false',
      });
      prodTargetIssues++;
    }

    // Issue 2: completedQty > targetQty
    if (target.completedQty > target.targetQty) {
      issues.push({
        type: 'PROD_TARGET_LOGIC',
        target: target.id,
        issue: `completedQty (${target.completedQty}) > targetQty (${target.targetQty})`,
      });
      prodTargetIssues++;
    }

    // Issue 3: Missing recipe when type is recipe
    if (target.type === 'recipe' && !recipe) {
      issues.push({
        type: 'PROD_TARGET_MISSING_DATA',
        target: target.id,
        issue: `Recipe ${target.recipeId} not found`,
      });
      prodTargetIssues++;
    }

    // Issue 4: autoAddedUnverified not cleared on cancelled
    if (target.status === 'cancelled' && target.autoAddedUnverified && Object.keys(target.autoAddedUnverified).length > 0) {
      issues.push({
        type: 'PROD_TARGET_CLEANUP',
        target: target.id,
        issue: 'Cancelled target still has autoAddedUnverified data',
      });
      prodTargetIssues++;
    }
  }

  console.log(prodTargetIssues === 0 ? '✅ All production targets have valid state' : `❌ Found ${prodTargetIssues} production target issues\n`);

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: SALES ORDER VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n🛒 SCENARIO 3: SALES ORDER VALIDATION\n');

  let salesIssues = 0;

  for (const order of saleOrders) {
    // Issue 1: Missing lines
    if (!order.lines || order.lines.length === 0) {
      issues.push({
        type: 'SALES_ORDER_ERROR',
        order: order.id,
        issue: 'Sales order has no lines',
      });
      salesIssues++;
    }

    // Issue 2: Invalid product reference
    if (order.lines) {
      for (const line of order.lines) {
        if (!prodMap.has(line.productId)) {
          issues.push({
            type: 'SALES_ORDER_ERROR',
            order: order.id,
            issue: `Product ${line.productId} in order not found`,
          });
          salesIssues++;
        }
      }
    }

    // Issue 3: Missing required fields
    if (!order.client || !order.date || !order.ref) {
      issues.push({
        type: 'SALES_ORDER_INCOMPLETE',
        order: order.id,
        missing: [
          !order.client && 'client',
          !order.date && 'date',
          !order.ref && 'ref',
        ].filter(Boolean).join(', '),
      });
      salesIssues++;
    }
  }

  console.log(salesIssues === 0 ? '✅ All sales orders are valid' : `❌ Found ${salesIssues} sales order issues\n`);

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: SHIPPING ORDER RECONCILIATION
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n📦 SCENARIO 4: SHIPPING ORDER RECONCILIATION\n');

  let shippingIssues = 0;

  // Group movements by shipping ref
  const movByRef = {};
  for (const mov of movs.filter(m => m.reason === 'PURCHASE')) {
    const ref = mov.note || 'NO-REF';
    if (!movByRef[ref]) movByRef[ref] = [];
    movByRef[ref].push(mov);
  }

  // Check each shipping order
  for (const order of shippingOrders) {
    if (order.status === 'RECEIVED') {
      const movements = movByRef[order.ref] || [];

      // Issue 1: No movements recorded
      if (movements.length === 0) {
        issues.push({
          type: 'SHIPPING_NO_MOVEMENTS',
          order: order.ref,
          issue: 'Shipping order marked RECEIVED but no movements found',
        });
        shippingIssues++;
      }

      // Issue 2: Missing product reference
      if (order.lines) {
        for (const line of order.lines) {
          if (!prodMap.has(line.productId)) {
            issues.push({
              type: 'SHIPPING_MISSING_PRODUCT',
              order: order.ref,
              issue: `Product ${line.productId} not found`,
            });
            shippingIssues++;
          }
        }
      }
    }
  }

  console.log(shippingIssues === 0 ? '✅ All shipping orders are consistent' : `❌ Found ${shippingIssues} shipping issues\n`);

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: MOVEMENT INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n🔄 SCENARIO 5: MOVEMENT INTEGRITY\n');

  let movementIssues = 0;

  for (const mov of movs) {
    // Issue 1: Missing productId
    if (!mov.productId) {
      issues.push({
        type: 'MOVEMENT_INVALID',
        issue: 'Movement missing productId',
      });
      movementIssues++;
    }

    // Issue 2: Invalid reason
    const validReasons = ['PURCHASE', 'PRODUCTION', 'SHIPMENT', 'ADJUSTMENT', 'WASTE', 'SALE'];
    if (!validReasons.includes(mov.reason)) {
      issues.push({
        type: 'MOVEMENT_INVALID_REASON',
        reason: mov.reason,
        issue: `Invalid movement reason: ${mov.reason}`,
      });
      movementIssues++;
    }

    // Issue 3: Missing createdAt
    if (!mov.createdAt) {
      issues.push({
        type: 'MOVEMENT_MISSING_DATE',
        issue: 'Movement missing createdAt',
      });
      movementIssues++;
    }
  }

  console.log(movementIssues === 0 ? '✅ All movements are valid' : `❌ Found ${movementIssues} movement issues\n`);

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SCENARIO 6: NEGATIVE STOCK DETECTION
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n⚠️  SCENARIO 6: NEGATIVE STOCK DETECTION\n');

  let negativeStock = 0;

  for (const [prodId, prod] of prodMap) {
    if ((prod.stock_level || 0) < 0) {
      issues.push({
        type: 'NEGATIVE_STOCK',
        product: prod.sku,
        stock: prod.stock_level,
      });
      negativeStock++;
    }
  }

  console.log(negativeStock === 0 ? '✅ No negative stock found' : `❌ Found ${negativeStock} products with negative stock\n`);

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(100));
  console.log('📊 FINAL AUDIT REPORT');
  console.log('═'.repeat(100) + '\n');

  const issuesByType = {};
  for (const issue of issues) {
    if (!issuesByType[issue.type]) issuesByType[issue.type] = 0;
    issuesByType[issue.type]++;
  }

  console.log(`Total Issues Found: ${issues.length}\n`);

  if (issues.length > 0) {
    console.log('Issues by Type:');
    for (const [type, count] of Object.entries(issuesByType).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type.padEnd(30)}: ${count}`);
    }
    console.log('');

    console.log('Issues Requiring Action:');
    const criticalIssues = issues.filter(i =>
      ['INVENTORY_MISMATCH', 'NEGATIVE_STOCK', 'PROD_TARGET_LOGIC', 'MOVEMENT_INVALID'].includes(i.type)
    );
    if (criticalIssues.length > 0) {
      for (const issue of criticalIssues.slice(0, 10)) {
        console.log(`  ⚠️  ${issue.type}: ${issue.issue || issue.issue}`);
      }
    } else {
      console.log('  No critical issues - all warnings/infos only');
    }
  } else {
    console.log('✅ NO ISSUES FOUND - System is clean!\n');
  }

  console.log('═'.repeat(100) + '\n');
}

comprehensiveAudit()
  .catch(e => { console.error('❌ Audit failed:', e); process.exit(1); })
  .finally(() => setTimeout(() => process.exit(0), 500));
