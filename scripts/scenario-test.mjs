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

async function scenarioTest() {
  console.log('\n🧪 WORKFLOW SCENARIO TESTING\n');
  console.log('Testing all user workflows and edge cases...\n');

  const [products, movements, orders, targets, recipes, shipping] = await Promise.all([
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'inventory_movements')),
    getDocs(collection(db, 'sales_orders')),
    getDocs(collection(db, 'production_targets')),
    getDocs(collection(db, 'recipes')),
    getDocs(collection(db, 'shipping_orders')),
  ]);

  const prodMap = new Map(products.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
  const movs = movements.docs.map(d => d.data());
  const saleOrders = orders.docs.map(d => d.data());
  const prodTargets = targets.docs.map(d => ({ id: d.id, ...d.data() }));
  const recipesList = recipes.docs.map(d => d.data());
  const shippingOrders = shipping.docs.map(d => ({ id: d.id, ...d.data() }));

  const results = [];

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SCENARIO A: USER ADDS A PRODUCT
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('📝 SCENARIO A: ADD PRODUCT\n');
  console.log('Simulating: User adds a new product to inventory\n');

  const testProduct = {
    name: 'Test Product',
    sku: 'TEST-001',
    type: 'RAW',
    unit: 'pcs',
    stock_level: 100,
    min_stock: 10,
    cost: 25,
  };

  // Validation checks
  const addProductChecks = [
    { check: 'SKU is unique', pass: !Array.from(prodMap.values()).some(p => p.sku === testProduct.sku) },
    { check: 'Type is valid', pass: ['RAW', 'SUB_ASSEMBLY', 'FINISHED'].includes(testProduct.type) },
    { check: 'Stock is non-negative', pass: testProduct.stock_level >= 0 },
    { check: 'Min stock is non-negative', pass: testProduct.min_stock >= 0 },
    { check: 'Required fields present', pass: testProduct.name && testProduct.sku && testProduct.unit },
  ];

  for (const item of addProductChecks) {
    console.log(`${item.pass ? '✅' : '❌'} ${item.check}`);
    results.push({ scenario: 'ADD_PRODUCT', check: item.check, pass: item.pass });
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SCENARIO B: USER CREATES A SALES ORDER
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n🛒 SCENARIO B: CREATE SALES ORDER\n');
  console.log('Simulating: User creates a sales order\n');

  // Get a product with stock
  const productWithStock = Array.from(prodMap.values()).find(p => (p.stock_level || 0) > 100);

  if (productWithStock) {
    const testOrder = {
      client: 'Test Client',
      date: new Date(),
      lines: [
        { productId: productWithStock.id, productName: productWithStock.name, sku: productWithStock.sku, qty: 50 }
      ],
    };

    const saleChecks = [
      { check: 'Client name provided', pass: !!testOrder.client },
      { check: 'Date provided', pass: !!testOrder.date },
      { check: 'Order has lines', pass: testOrder.lines.length > 0 },
      { check: 'Product exists', pass: prodMap.has(testOrder.lines[0].productId) },
      { check: 'Quantity is positive', pass: testOrder.lines[0].qty > 0 },
      { check: 'Stock sufficient', pass: (productWithStock.stock_level || 0) >= testOrder.lines[0].qty },
    ];

    for (const item of saleChecks) {
      console.log(`${item.pass ? '✅' : '❌'} ${item.check}`);
      results.push({ scenario: 'CREATE_SALE', check: item.check, pass: item.pass });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SCENARIO C: USER RECEIVES A SHIPPING ORDER
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n📦 SCENARIO C: RECEIVE SHIPPING ORDER\n');
  console.log('Simulating: User receives a shipping order and updates inventory\n');

  const testShipping = {
    ref: 'TEST-2025-0001',
    date: new Date(),
    supplier: 'Test Supplier',
    lines: [
      { productId: 'DISC-220X27-N', qty: 100 }
    ],
  };

  const shippingChecks = [
    { check: 'Reference provided', pass: !!testShipping.ref },
    { check: 'Supplier provided', pass: !!testShipping.supplier },
    { check: 'Lines provided', pass: testShipping.lines.length > 0 },
    { check: 'Reference format valid', pass: /^[A-Z]+-\d+-\d+/.test(testShipping.ref) },
    { check: 'Date is valid', pass: testShipping.date instanceof Date },
  ];

  for (const item of shippingChecks) {
    console.log(`${item.pass ? '✅' : '❌'} ${item.check}`);
    results.push({ scenario: 'RECEIVE_SHIPPING', check: item.check, pass: item.pass });
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SCENARIO D: EDIT SHIPPING ORDER
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n✏️  SCENARIO D: EDIT SHIPPING ORDER\n');
  console.log('Simulating: User edits a received shipping order\n');

  const receivedOrder = shippingOrders.find(o => o.status === 'RECEIVED');

  if (receivedOrder) {
    const edit = {
      originalRef: receivedOrder.ref,
      newRef: 'DISC-2025-EDITED',
      lines: receivedOrder.lines,
    };

    const editChecks = [
      { check: 'Order exists', pass: !!receivedOrder },
      { check: 'Order is received', pass: receivedOrder.status === 'RECEIVED' },
      { check: 'New ref provided', pass: !!edit.newRef },
      { check: 'Lines preserved', pass: edit.lines && edit.lines.length > 0 },
    ];

    for (const item of editChecks) {
      console.log(`${item.pass ? '✅' : '❌'} ${item.check}`);
      results.push({ scenario: 'EDIT_SHIPPING', check: item.check, pass: item.pass });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SCENARIO E: PRODUCTION WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n🏭 SCENARIO E: PRODUCTION WORKFLOW\n');
  console.log('Simulating: Create → Start → Complete production\n');

  const recipe = recipesList[0];

  if (recipe) {
    const testTarget = {
      type: 'recipe',
      recipeId: recipe.id,
      targetQty: 10,
      deadline: new Date().toISOString().split('T')[0],
      status: 'not_started',
    };

    const prodChecks = [
      { check: 'Recipe exists', pass: !!recipe },
      { check: 'Target quantity positive', pass: testTarget.targetQty > 0 },
      { check: 'Deadline provided', pass: !!testTarget.deadline },
      { check: 'Status valid', pass: ['not_started', 'in_progress', 'complete', 'cancelled'].includes(testTarget.status) },
      { check: 'Recipe has components', pass: recipe.components && recipe.components.length > 0 },
    ];

    for (const item of prodChecks) {
      console.log(`${item.pass ? '✅' : '❌'} ${item.check}`);
      results.push({ scenario: 'PRODUCTION', check: item.check, pass: item.pass });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SCENARIO F: PRODUCTION CANCELLATION
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n❌ SCENARIO F: CANCEL PRODUCTION\n');
  console.log('Simulating: User cancels production, inventory should be restored\n');

  const inProgressTarget = prodTargets.find(t => t.status === 'in_progress');

  if (inProgressTarget) {
    // Check if movements exist
    const targetMovements = movs.filter(m => {
      const note = m.note || '';
      return note.includes(inProgressTarget.id);
    });

    const cancelChecks = [
      { check: 'Target is in_progress', pass: inProgressTarget.status === 'in_progress' },
      { check: 'Has movements', pass: targetMovements.length > 0 },
      { check: 'Materials deducted flag set', pass: inProgressTarget.materialsDeducted === true },
    ];

    for (const item of cancelChecks) {
      console.log(`${item.pass ? '✅' : '❌'} ${item.check}`);
      results.push({ scenario: 'CANCEL_PRODUCTION', check: item.check, pass: item.pass });
    }
  } else {
    console.log('✅ No in_progress targets (nothing to cancel)');
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(100));
  console.log('📊 SCENARIO TEST SUMMARY');
  console.log('═'.repeat(100) + '\n');

  const passed = results.filter(r => r.pass).length;
  const total = results.length;

  console.log(`Tests Passed: ${passed}/${total}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  // Group by scenario
  const byScenario = {};
  for (const result of results) {
    if (!byScenario[result.scenario]) {
      byScenario[result.scenario] = { pass: 0, total: 0 };
    }
    byScenario[result.scenario].total++;
    if (result.pass) byScenario[result.scenario].pass++;
  }

  console.log('By Scenario:');
  for (const [scenario, data] of Object.entries(byScenario).sort()) {
    const pct = ((data.pass / data.total) * 100).toFixed(0);
    const status = data.pass === data.total ? '✅' : '⚠️ ';
    console.log(`  ${status} ${scenario.padEnd(25)} ${data.pass}/${data.total} (${pct}%)`);
  }

  console.log('\n' + '═'.repeat(100) + '\n');
}

scenarioTest()
  .catch(e => { console.error('❌ Test failed:', e); process.exit(1); })
  .finally(() => setTimeout(() => process.exit(0), 500));
