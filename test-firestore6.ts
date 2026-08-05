(globalThis as any).import = { meta: { env: process.env } };
async function test() {
  const { db } = await import('./src/lib/firebase');
  const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
  try {
    const q1 = query(collection(db, 'posts'), orderBy('created_at', 'desc'), limit(5));
    const snap1 = await getDocs(q1);
    console.log('posts orderby created_at count:', snap1.docs.length);
  } catch (e: any) {
    console.error('posts error:', e.message);
  }
  process.exit(0);
}
test();
