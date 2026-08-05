const originalEnv = process.env;
(globalThis as any).import = { meta: { env: originalEnv } };
import { db } from './src/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
async function test() {
  try {
    const q1 = query(collection(db, 'posts'), where('media_type', '==', 'video'), orderBy('created_at', 'desc'), limit(5));
    const snap1 = await getDocs(q1);
    console.log('posts videos:', snap1.docs.length);
  } catch (e: any) {
    console.error('posts error:', e.message);
  }
  
  try {
    const q2 = query(collection(db, 'reels'), orderBy('created_at', 'desc'), limit(5));
    const snap2 = await getDocs(q2);
    console.log('legacy reels:', snap2.docs.length);
  } catch (e: any) {
    console.error('reels error:', e.message);
  }
  process.exit(0);
}
test();
