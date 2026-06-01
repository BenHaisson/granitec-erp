import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, deleteDoc, doc } from 'firebase/firestore';

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
  console.log('🔍 Fetching all shipping_orders...');
  const snap = await getDocs(collection(db, 'shipping_orders'));
  console.log(`📦 Found ${snap.docs.length} shipping orders to delete`);

  if (snap.docs.length === 0) {
    console.log('✅ No shipping orders found — already clean!');
    return;
  }

  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`   ✅ Deleted batch ${Math.floor(i / CHUNK) + 1}`);
  }

  console.log('\n✅ All shipping orders deleted. Clean slate ready!');
}

main().catch(e => { console.error('❌', e); process.exit(1); }).finally(() => setTimeout(() => process.exit(0), 500));
