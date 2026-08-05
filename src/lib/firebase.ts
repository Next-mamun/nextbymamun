import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAiczfp6lTr57-VrZyJXZKWbHKx32kBBtg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "next-489515.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "next-489515",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "next-489515.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "947258146571",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:947258146571:web:2dd66aa09474e5f7d22c0e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-G8TVHJCQ2Q",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-34e8c01f-4576-400a-9a3b-3b427ff6ba7a"
};

const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

export const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, databaseId);

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support all of the features required to enable persistence');
    }
  });
}

export const auth = getAuth(app);
export const storage = getStorage(app);

let messagingInstance: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      messagingInstance = getMessaging(app);
    }
  });
}

export const messaging = async () => {
  if (!messagingInstance && typeof window !== 'undefined') {
      const supported = await isSupported();
      if (supported) {
          messagingInstance = getMessaging(app);
      }
  }
  return messagingInstance;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
