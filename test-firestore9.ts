import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAiczfp6lTr57-VrZyJXZKWbHKx32kBBtg",
  authDomain: "ai-studio-34e8c01f-4576-400a-9a3b-3b427ff6ba7a.firebaseapp.com",
  projectId: "ai-studio-34e8c01f-4576-400a-9a3b-3b427ff6ba7a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const q1 = query(collection(db, 'messages'), where('sender_id', '==', 'test'), orderBy('created_at', 'desc'), limit(5));
    const snap1 = await getDocs(q1);
    console.log('ok');
  } catch (e: any) {
    console.error('err:', e.message);
  }
  process.exit(0);
}
test();
