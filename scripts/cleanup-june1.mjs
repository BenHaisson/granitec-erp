import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, writeBatch, deleteDoc, doc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyA4IUwfzP_XIfbQtTVzBszcDD2cJS6odrU',
  projectId: 'granitec-erp',
  authDomain: 'granitec-erp.firebaseapp.com',
  storageBucket: 'granitec-erp.firebasestorage.app',
  messagingSenderId: '532605203373',
  appId: '1:532605203373:web:e62c55b1a8d1b537db6724',
});
const db = getFirestore(app);

async function main() {
  // ── 1. Open rules temporarily via already-deployed open rules ──
  // (rules were previously set to allow all — re-deploy if needed)

  // ── 2. Delete all inventory_movements from 01/06/2026 ──────────
  console.log('🔍 Fetching inventory_movements...');
  const movSnap = await getDocs(collection(db, 'inventory_movements'));
  const toDelete = movSnap.docs.filter(d => {
    const data = d.data();
    let date;
    try {
      if (data.createdAt?.toDate) date = data.createdAt.toDate();
      else date = new Date(data.createdAt);
    } catch { return false; }
    const iso = date.toISOString().slice(0, 10);
    return iso === '2026-06-01';
  });

  console.log(`🗑️  Deleting ${toDelete.length} movements from 2026-06-01...`);
  const CHUNK = 400;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const batch = writeBatch(db);
    toDelete.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  console.log(`   ✅ Done.`);

  // ── 3. Delete production target: 3-Piece Frypan Set × 6 sets ───
  console.log('🔍 Fetching production_targets...');
  const targSnap = await getDocs(collection(db, 'production_targets'));
  const targetDocs = targSnap.docs.filter(d => {
    const data = d.data();
    return (
      (data.recipeName ?? '').toLowerCase().includes('frypan') &&
      (data.recipeName ?? '').toLowerCase().includes('3-piece') &&
      data.targetQty === 6
    );
  });

  if (targetDocs.length === 0) {
    // Broader search
    const broader = targSnap.docs.filter(d => {
      const data = d.data();
      return (data.recipeName ?? '').toLowerCase().includes('frypan') && data.targetQty === 6;
    });
    console.log('Broader match:', broader.map(d => ({ id: d.id, ...d.data() })));
  }

  console.log(`🗑️  Deleting ${targetDocs.length} production target(s)...`);
  for (const d of targetDocs) {
    console.log(`   → ${d.data().recipeName} × ${d.data().targetQty}`);
    await deleteDoc(d.ref);

    // Also delete related entries
    const entriesSnap = await getDocs(
      query(collection(db, 'production_entries'), where('targetId', '==', d.id))
    );
    if (entriesSnap.docs.length > 0) {
      const batch = writeBatch(db);
      entriesSnap.docs.forEach(e => batch.delete(e.ref));
      await batch.commit();
      console.log(`   → Deleted ${entriesSnap.docs.length} related entries`);
    }
  }

  console.log('\n✅ Cleanup complete.');
}

main().catch(e => { console.error('❌', e); process.exit(1); }).finally(() => setTimeout(() => process.exit(0), 500));
