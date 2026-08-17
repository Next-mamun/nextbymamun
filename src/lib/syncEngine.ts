import { db } from './firebase';
import { collection, query, where, getDocs, or } from 'firebase/firestore';
import { localDB, urlToBase64 } from './db';

let isSyncing = false;

export const backgroundSync = async (currentUserId: string) => {
  if (isSyncing) return;
  isSyncing = true;
  console.log('Background Sync: Started');
  
  try {
    // Fetch friendships
    const qRel = query(
      collection(db, 'friendships'),
      or(where('sender_id', '==', currentUserId), where('receiver_id', '==', currentUserId))
    );
    const relSnap = await getDocs(qRel);
    const friendships = relSnap.docs.map(d => ({id: d.id, ...d.data()}) as any);
    
    const friendIds = friendships.map(f => f.sender_id === currentUserId ? f.receiver_id : f.sender_id) || [];
    
    // Batch profile fetches (up to 30 at a time per Firebase limits, but we simulate array keys fetch)
    const uniqueIds = Array.from(new Set(friendIds));
    const batches = [];
    while (uniqueIds.length > 0) {
      batches.push(uniqueIds.splice(0, 30));
    }
    
    for (const batch of batches) {
      const qProf = query(collection(db, 'profiles'), where('__name__', 'in', batch));
      const profSnap = await getDocs(qProf);
      
      for (const d of profSnap.docs) {
        const data = d.data();
        const avatarBase64 = data.avatar_url ? await urlToBase64(data.avatar_url) : '';
        
        await localDB.profiles.put({
          id: d.id,
          name: data.display_name || data.username,
          avatarBase64
        });
        
        await localDB.friends.put({
          id: d.id,
          fullName: data.display_name || data.username,
          avatarBlob: avatarBase64,
          peerId: `nxt-peer-${d.id}`,
          lastSeen: Date.now()
        });
      }
    }
    
    // Also sync old messages from firebase? (Optional, P2P handles new ones)
    // For now, we only sync profiles and friends.
    
    console.log('Background Sync: Completed');
  } catch (err: any) {
    // "catch it silently in a try-catch block without clearing the UI state or wiping IndexedDB"
    console.warn('Background Sync: HTTP 429 Quota Limit / Network Error ignored.', err.message);
  } finally {
    isSyncing = false;
  }
};
