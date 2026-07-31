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
    // Supabase handles timestamp differently or we can pass string
    if (supabaseData.created_at && typeof supabaseData.created_at !== 'string' && supabaseData.created_at.toDate) {
       supabaseData.created_at = supabaseData.created_at.toDate().toISOString();
    } else if (!supabaseData.created_at || supabaseData.created_at?.isEqual) {
       supabaseData.created_at = new Date().toISOString();
    }
    
    // Convert array/objects to JSON or let Supabase handle if column is JSONB
    const { error } = await supabase.from('posts').insert({
      id: postRef.id,
      ...supabaseData
    });
    if (error) {
      console.error('Supabase dual-write error (posts):', error);
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

    const { error } = await supabase.from('messages').insert({
      id: msgRef.id,
      ...supabaseData
    });
    if (error) {
      console.error('Supabase dual-write error (messages):', error);
    }
  } catch (error) {
    console.error('Supabase dual-write catch (messages):', error);
  }
  return msgRef;
};
