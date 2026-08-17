import { db } from './firebase';
import { collection, query, where, getDocs, or, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { localDB, urlToBase64 } from './db';

let isSyncing = false;
let isBatchSyncing = false;

// Periodic batched sync from localDB to Firestore to prevent quota exhaustion
export const batchSyncUnsyncedMessagesToFirestore = async (currentUserId: string) => {
  if (isBatchSyncing || !currentUserId) return;
  isBatchSyncing = true;

  try {
    const unsyncedKey = 'synced_msg_ids_' + currentUserId;
    const syncedIds = new Set<string>(JSON.parse(localStorage.getItem(unsyncedKey) || '[]'));
    
    // Get all local messages
    const allMsgs = await localDB.messages.toArray();
    const toSync = allMsgs.filter(m => !syncedIds.has(m.id) && m.sender === currentUserId);

    if (toSync.length === 0) {
      isBatchSyncing = false;
      return;
    }

    console.log(`[SyncEngine] Batch syncing ${toSync.length} P2P messages to Firestore in one single batch...`);
    
    const batch = writeBatch(db);
    const newlySynced: string[] = [];

    // Limit to 40 per batch for Firestore batch safety
    const slice = toSync.slice(0, 40);
    for (const msg of slice) {
      const msgRef = doc(db, 'messages', msg.id);
      batch.set(msgRef, {
        sender_id: msg.sender,
        receiver_id: msg.receiver,
        content: msg.text || '',
        media_url: msg.media || '',
        media_type: msg.mediaType || null,
        is_view_once: !!msg.isViewOnce,
        is_read: msg.status === 'READ',
        timestamp: msg.timestamp,
        created_at: new Date(msg.timestamp)
      }, { merge: true });

      newlySynced.push(msg.id);
    }

    await batch.commit();

    // Update local cache of synced message IDs
    newlySynced.forEach(id => syncedIds.add(id));
    // Keep max 2000 synced IDs in localStorage
    const savedArray = Array.from(syncedIds).slice(-2000);
    localStorage.setItem(unsyncedKey, JSON.stringify(savedArray));
    console.log(`[SyncEngine] Successfully batch synced ${newlySynced.length} messages.`);
  } catch (err: any) {
    console.warn('[SyncEngine] Batch sync skipped or deferred:', err.message);
  } finally {
    isBatchSyncing = false;
  }
};

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
    
    // Also sync old messages from Firestore if available
    try {
      const qMsgs = query(
        collection(db, 'messages'),
        or(where('sender_id', '==', currentUserId), where('receiver_id', '==', currentUserId))
      );
      const msgsSnap = await getDocs(qMsgs);
      for (const d of msgsSnap.docs) {
        const m = d.data();
        let content = m.content || '';
        let mediaUrl = m.media_url || '';
        let mediaType = m.media_type || undefined;
        let isViewOnce = false;

        if (typeof content === 'string' && content.includes('"JSON_PAYLOAD"')) {
          try {
            const parsed = JSON.parse(content);
            content = parsed.text || '';
            isViewOnce = !!parsed.is_view_once;
          } catch(e) {}
        }
        const partnerId = m.sender_id === currentUserId ? m.receiver_id : m.sender_id;
        const msgTime = m.created_at?.toDate ? m.created_at.toDate().getTime() : (m.timestamp || Date.now());
        
        await localDB.messages.put({
          id: d.id,
          conversationId: partnerId,
          sender: m.sender_id,
          receiver: m.receiver_id,
          text: content,
          media: mediaUrl,
          mediaType: mediaType,
          isViewOnce: isViewOnce,
          status: m.is_read ? 'READ' : 'DELIVERED',
          timestamp: msgTime
        });
      }
    } catch (e) {
      // Ignore if quota limit or network offline
    }
    
    console.log('Background Sync: Completed');
  } catch (err: any) {
    // "catch it silently in a try-catch block without clearing the UI state or wiping IndexedDB"
    console.warn('Background Sync: HTTP 429 Quota Limit / Network Error ignored.', err.message);
  } finally {
    isSyncing = false;
  }
};
