import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAiczfp6lTr57-VrZyJXZKWbHKx32kBBtg",
  authDomain: "ai-studio-34e8c01f-4576-400a-9a3b-3b427ff6ba7a.firebaseapp.com",
  projectId: "ai-studio-34e8c01f-4576-400a-9a3b-3b427ff6ba7a",
  storageBucket: "ai-studio-34e8c01f-4576-400a-9a3b-3b427ff6ba7a.firebasestorage.app",
  messagingSenderId: "365851086202",
  appId: "1:365851086202:web:dd0988ccaf5771d18af6b7",
  measurementId: "G-XXXXXXXXXX"
};

const app = initializeApp(firebaseConfig);
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
