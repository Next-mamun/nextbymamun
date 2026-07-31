import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { supabase } from './supabase';

export let activeDB: 'firebase' | 'supabase' = 'firebase';

export const switchDB = (from: 'firebase' | 'supabase') => {
  if (activeDB === from) {
    activeDB = activeDB === 'firebase' ? 'supabase' : 'firebase';
    console.warn(`Switched active database to: ${activeDB}`);
  }
};

export const dualWritePost = async (postData: any) => {
  // 1. Write to Firebase
  const postRef = await addDoc(collection(db, 'posts'), postData);
  
  // 2. Write to Supabase (Backup)
  try {
    const supabaseData = { ...postData };
    if (supabaseData.created_at && typeof supabaseData.created_at !== 'string' && supabaseData.created_at.toDate) {
       supabaseData.created_at = supabaseData.created_at.toDate().toISOString();
    } else if (!supabaseData.created_at || supabaseData.created_at?.isEqual) {
       supabaseData.created_at = new Date().toISOString();
    }

    // Ensure user_id or userId mapping
    if (!supabaseData.user_id && supabaseData.userId) {
      supabaseData.user_id = supabaseData.userId;
    }
    
    // Attempt insert with firebase id
    const payload: any = {
      firebase_id: postRef.id,
      ...supabaseData
    };

    // If id is present and valid string, include it
    if (postRef.id && postRef.id.length === 36) {
      payload.id = postRef.id;
    }

    const { error } = await supabase.from('posts').insert(payload);
    if (error) {
      console.error('Supabase dual-write error (posts):', error.message || error);
    } else {
      console.log('Successfully written to Supabase posts!');
    }
  } catch (error) {
    console.error('Supabase dual-write catch (posts):', error);
  }
  return postRef;
};

export const dualWriteMessage = async (messageData: any) => {
  // 1. Write to Firebase
  const msgRef = await addDoc(collection(db, 'messages'), messageData);
  
  // 2. Write to Supabase (Backup)
  try {
    const supabaseData = { ...messageData };
    if (supabaseData.created_at && typeof supabaseData.created_at !== 'string' && supabaseData.created_at.toDate) {
       supabaseData.created_at = supabaseData.created_at.toDate().toISOString();
    } else if (!supabaseData.created_at || supabaseData.created_at?.isEqual) {
       supabaseData.created_at = new Date().toISOString();
    }

    const payload: any = {
      firebase_id: msgRef.id,
      ...supabaseData
    };

    if (msgRef.id && msgRef.id.length === 36) {
      payload.id = msgRef.id;
    }

    const { error } = await supabase.from('messages').insert(payload);
    if (error) {
      console.error('Supabase dual-write error (messages):', error.message || error);
    } else {
      console.log('Successfully written to Supabase messages!');
    }
  } catch (error) {
    console.error('Supabase dual-write catch (messages):', error);
  }
  return msgRef;
};

