import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { supabase } from './supabase';

const DB_SWITCH_KEY = 'next_media_db_fallback';
const DB_SWITCH_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export const getActiveDB = (): 'firebase' | 'supabase' => {
  try {
    const data = localStorage.getItem(DB_SWITCH_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Date.now() - parsed.timestamp < DB_SWITCH_EXPIRY) {
        return parsed.db;
      } else {
        localStorage.removeItem(DB_SWITCH_KEY);
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
  return 'firebase';
};

export const switchDB = (from: 'firebase' | 'supabase') => {
  const currentDB = getActiveDB();
  if (currentDB === from) {
    const nextDB = currentDB === 'firebase' ? 'supabase' : 'firebase';
    try {
      localStorage.setItem(DB_SWITCH_KEY, JSON.stringify({
        db: nextDB,
        timestamp: Date.now()
      }));
      console.warn(`Switched active database to: ${nextDB}`);
    } catch (e) {
      console.error("Failed to save DB fallback state", e);
    }
  }
};

export const dualWritePost = async (postData: any) => {
  // 1. Write to Firebase
  let postRef;
  try {
    postRef = await addDoc(collection(db, 'posts'), postData);
  } catch (err) {
    console.error("Firebase write failed, switching DB:", err);
    switchDB('firebase');
  }
  
  // 2. Write to Supabase (Backup)
  try {
    const supabaseData = { ...postData };
    if (supabaseData.created_at && typeof supabaseData.created_at !== 'string' && supabaseData.created_at.toDate) {
       supabaseData.created_at = supabaseData.created_at.toDate().toISOString();
    } else if (!supabaseData.created_at || supabaseData.created_at?.isEqual) {
       supabaseData.created_at = new Date().toISOString();
    }

    if (!supabaseData.user_id && supabaseData.userId) {
      supabaseData.user_id = supabaseData.userId;
    }
    
    const payload: any = {
      ...supabaseData
    };

    if (postRef?.id) {
      payload.id = postRef.id;
    } else {
      payload.id = crypto.randomUUID();
    }

    delete payload.views;
    delete payload.source_type;
    delete payload.youtube_id;
    delete payload.firebase_id;

    const { error } = await supabase.from('posts').insert(payload);
    if (error) {
      console.warn('Supabase dual-write error (posts):', error.message || error);
      if (!postRef) throw error; // If Firebase also failed, throw the error
    } else {
      console.log('Successfully written to Supabase posts!');
    }
  } catch (error) {
    console.error('Supabase dual-write catch (posts):', error);
    if (!postRef) throw error;
  }
  return postRef || { id: 'supa-' + Date.now().toString() };
};

export const dualWriteMessage = async (messageData: any) => {
  let msgRef;
  try {
    msgRef = await addDoc(collection(db, 'messages'), messageData);
  } catch (err) {
    console.error("Firebase write failed, switching DB:", err);
    switchDB('firebase');
  }
  
  try {
    const supabaseData = { ...messageData };
    if (supabaseData.created_at && typeof supabaseData.created_at !== 'string' && supabaseData.created_at.toDate) {
       supabaseData.created_at = supabaseData.created_at.toDate().toISOString();
    } else if (!supabaseData.created_at || supabaseData.created_at?.isEqual) {
       supabaseData.created_at = new Date().toISOString();
    }

    const payload: any = {
      ...supabaseData
    };

    if (msgRef?.id) {
      payload.id = msgRef.id;
    } else {
      payload.id = crypto.randomUUID();
    }
    delete payload.firebase_id;

    const { error } = await supabase.from('messages').insert(payload);
    if (error) {
      console.warn('Supabase dual-write error (messages):', error.message || error);
    } else {
      console.log('Successfully written to Supabase messages!');
    }
  } catch (error) {
    console.error('Supabase dual-write catch (messages):', error);
  }
  return msgRef || { id: 'supa-' + Date.now().toString() };
};

