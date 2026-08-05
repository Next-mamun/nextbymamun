const originalEnv = process.env;
(globalThis as any).import = { meta: { env: originalEnv } };
import { app } from './src/lib/firebase';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
const db = getFirestore(app);
async function test() {
  try {
    const q1 = query(collection(db, 'posts'), where('media_type', '==', 'video'), orderBy('created_at', 'desc'), limit(5));
    const snap1 = await getDocs(q1);
    console.log('posts videos:', snap1.docs.length);
  } catch (e: any) {
    console.error('posts error:', e.message);
  }
  process.exit(0);
}
test();
