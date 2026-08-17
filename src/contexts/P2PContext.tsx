import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { useAuth } from './AuthContext';
import { localDB, urlToBase64 } from '@/lib/db';
import { triggerNotification, showNotification } from '@/services/notificationService';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { batchSyncUnsyncedMessagesToFirestore } from '@/lib/syncEngine';

interface P2PContextType {
  peer: Peer | null;
  onlineFriends: Set<string>;
  sendMessage: (receiverId: string, text: string) => Promise<void>;
  sendMediaMessage: (receiverId: string, media: string, mediaType: 'image' | 'video' | 'audio', text?: string, isViewOnce?: boolean) => Promise<void>;
  sendTypingStatus: (receiverId: string, isTyping: boolean) => void;
  sendReadReceipt: (receiverId: string, messageIds: string[]) => void;
  typingUsers: Set<string>;
}

const P2PContext = createContext<P2PContextType | null>(null);

const CHUNK_SIZE = 32 * 1024; // 32KB safe chunk size for WebRTC SCTP

export const P2PProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useAuth();
  const [peer, setPeer] = useState<Peer | null>(null);
  const [onlineFriends, setOnlineFriends] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  
  const connectionsRef = useRef<{ [username: string]: DataConnection }>({});
  const typingTimersRef = useRef<{ [username: string]: NodeJS.Timeout }>({});
  const incomingChunksRef = useRef<{
    [transferId: string]: {
      msgId: string;
      sender: string;
      senderName?: string;
      senderAvatar?: string;
      mediaType: 'image' | 'video' | 'audio';
      text?: string;
      isViewOnce?: boolean;
      timestamp: number;
      totalChunks: number;
      receivedChunks: { [index: number]: string };
    }
  }>({});

  useEffect(() => {
    if (!currentUser?.id) return;

    const peerId = `nxt-peer-${currentUser.id}`;
    const newPeer = new Peer(peerId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    newPeer.on('open', (id) => {
      console.log('P2P Engine running with ID:', id);
      setPeer(newPeer);
    });

    newPeer.on('connection', (conn) => {
      setupDataConnection(conn);
    });

    newPeer.on('error', (err) => {
      console.warn('P2P Peer error:', err);
    });

    return () => {
      newPeer.destroy();
    };
  }, [currentUser]);

  // Periodic batched sync to Firestore every 45 seconds to preserve database quota
  useEffect(() => {
    if (!currentUser?.id) return;
    const syncInterval = setInterval(() => {
      batchSyncUnsyncedMessagesToFirestore(currentUser.id);
    }, 45000);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        batchSyncUnsyncedMessagesToFirestore(currentUser.id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser?.id]);

  // Heartbeat to keep connections alive and track presence
  useEffect(() => {
    if (!peer) return;
    const interval = setInterval(() => {
      Object.entries(connectionsRef.current).forEach(([_, conn]) => {
        if (conn.open) {
          conn.send({ type: 'PING' });
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [peer]);

  const saveUserProfileToCache = async (userId: string, name: string, avatar: string) => {
    if (!userId) return;
    try {
      if (name) {
        await localDB.profiles.put({
          id: userId,
          name: name,
          avatarBase64: avatar || ''
        });
        
        const existing = await localDB.friends.get(userId);
        if (!existing) {
          await localDB.friends.put({
            id: userId,
            fullName: name,
            avatarBlob: avatar || '',
            peerId: `nxt-peer-${userId}`,
            lastSeen: Date.now()
          });
        } else if (name !== existing.fullName || (avatar && avatar !== existing.avatarBlob)) {
          await localDB.friends.update(userId, {
            fullName: name,
            avatarBlob: avatar || existing.avatarBlob,
            lastSeen: Date.now()
          });
        }
      }
    } catch (e) {
      console.warn('Error saving user profile to localDB:', e);
    }
  };

  const flushPendingMessages = async (friendId: string, conn: DataConnection) => {
    try {
      const allMsgs = await localDB.messages.toArray();
      const pending = allMsgs.filter(m => m.receiver === friendId && m.status === 'PENDING_P2P');
      for (const pMsg of pending) {
        if (conn.open) {
          if (pMsg.media && pMsg.media.length > CHUNK_SIZE) {
            await sendChunkedMediaOverConn(conn, friendId, pMsg.id, pMsg.media, pMsg.mediaType || 'image', pMsg.text, pMsg.isViewOnce, pMsg.timestamp);
          } else {
            conn.send({
              type: pMsg.media ? 'MEDIA_MESSAGE' : 'TEXT_MESSAGE',
              id: pMsg.id,
              sender: currentUser!.id,
              senderName: currentUser!.display_name || currentUser!.username || 'User',
              senderAvatar: currentUser!.avatar_url || '',
              text: pMsg.text || '',
              media: pMsg.media,
              mediaType: pMsg.mediaType,
              isViewOnce: pMsg.isViewOnce,
              timestamp: pMsg.timestamp
            });
          }
          await localDB.messages.update(pMsg.id, { status: 'SENT' });
        }
      }
    } catch (e) {
      console.warn('Error flushing pending messages:', e);
    }
  };

  const sendChunkedMediaOverConn = async (
    conn: DataConnection,
    friendId: string,
    msgId: string,
    media: string,
    mediaType: 'image' | 'video' | 'audio',
    text: string = '',
    isViewOnce: boolean = false,
    timestamp: number
  ) => {
    const transferId = `tr_${msgId}`;
    const totalChunks = Math.ceil(media.length / CHUNK_SIZE);

    conn.send({
      type: 'MEDIA_CHUNK_START',
      transferId,
      msgId,
      sender: currentUser!.id,
      senderName: currentUser!.display_name || currentUser!.username || 'User',
      senderAvatar: currentUser!.avatar_url || '',
      mediaType,
      text,
      isViewOnce,
      totalChunks,
      timestamp
    });

    for (let i = 0; i < totalChunks; i++) {
      const chunk = media.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      conn.send({
        type: 'MEDIA_CHUNK',
        transferId,
        index: i,
        chunk
      });
      // Micro-tick yield to avoid blocking thread
      if (i % 10 === 0) {
        await new Promise(r => setTimeout(r, 5));
      }
    }

    conn.send({
      type: 'MEDIA_CHUNK_END',
      transferId
    });
  };

  const setupDataConnection = (conn: DataConnection) => {
    const friendId = conn.peer.replace('nxt-peer-', '');
    
    const handleOpen = async () => {
      connectionsRef.current[friendId] = conn;
      setOnlineFriends(prev => new Set(prev).add(friendId));

      // Exchange Profile Handshake
      if (currentUser) {
        conn.send({
          type: 'PROFILE_HANDSHAKE',
          userId: currentUser.id,
          name: currentUser.display_name || currentUser.username || 'User',
          avatar: currentUser.avatar_url || ''
        });
      }

      // Flush any pending messages for this friend
      flushPendingMessages(friendId, conn);

      try {
        const friend = await localDB.friends.get(friendId);
        const name = friend?.fullName || 'User';
        toast.success(`Fast messaging system activated with ${name}`, { icon: '⚡' });
      } catch (e) {}
    };

    if (conn.open) {
      handleOpen();
    } else {
      conn.on('open', handleOpen);
    }

    conn.on('data', async (data: any) => {
      if (data.type === 'PING') {
        conn.send({ type: 'PONG' });
      } else if (data.type === 'PONG') {
        setOnlineFriends(prev => new Set(prev).add(friendId));
      } else if (data.type === 'PROFILE_HANDSHAKE') {
        const name = data.name || 'User';
        const avatar = data.avatar || '';
        await saveUserProfileToCache(friendId, name, avatar);
      } else if (data.type === 'TYPING_START') {
        setTypingUsers(prev => new Set(prev).add(friendId));
        clearTimeout(typingTimersRef.current[friendId]);
        typingTimersRef.current[friendId] = setTimeout(() => {
          setTypingUsers(prev => {
            const next = new Set(prev);
            next.delete(friendId);
            return next;
          });
        }, 3000);
      } else if (data.type === 'TYPING_STOP') {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(friendId);
          return next;
        });
      } else if (data.type === 'MESSAGE_ACK') {
        if (data.id) {
          try {
            await localDB.messages.update(data.id, { status: 'DELIVERED' });
            window.dispatchEvent(new Event('p2p-message-received'));
          } catch(e) {}
        }
      } else if (data.type === 'MESSAGE_READ') {
        if (data.ids && Array.isArray(data.ids)) {
          for (const mid of data.ids) {
            try {
              await localDB.messages.update(mid, { status: 'READ' });
            } catch(e) {}
          }
          window.dispatchEvent(new Event('p2p-message-read'));
        } else if (data.id) {
          try {
            await localDB.messages.update(data.id, { status: 'READ' });
          } catch(e) {}
          window.dispatchEvent(new Event('p2p-message-read'));
        }
      } else if (data.type === 'TEXT_MESSAGE') {
        if (data.senderName) {
          await saveUserProfileToCache(friendId, data.senderName, data.senderAvatar || '');
        }

        await localDB.messages.put({
          id: data.id,
          conversationId: friendId,
          sender: friendId,
          receiver: currentUser!.id,
          text: data.text,
          status: 'DELIVERED',
          timestamp: data.timestamp
        });

        try {
          conn.send({ type: 'MESSAGE_ACK', id: data.id });
        } catch(e) {}

        try {
          const isAtMessages = window.location.pathname.startsWith('/messages');
          if (!isAtMessages || document.hidden) {
            const senderName = data.senderName || (await localDB.friends.get(friendId))?.fullName || 'Someone';
            showNotification(`New message from ${senderName}`, { body: data.text || 'Sent you a message' });
          }
        } catch(e) {}

        window.dispatchEvent(new Event('p2p-message-received'));
      } else if (data.type === 'MEDIA_MESSAGE') {
        if (data.senderName) {
          await saveUserProfileToCache(friendId, data.senderName, data.senderAvatar || '');
        }

        await localDB.messages.put({
          id: data.id,
          conversationId: friendId,
          sender: friendId,
          receiver: currentUser!.id,
          text: data.text || '',
          media: data.media || '',
          mediaType: data.mediaType || 'image',
          isViewOnce: !!data.isViewOnce,
          status: 'DELIVERED',
          timestamp: data.timestamp
        });

        try {
          conn.send({ type: 'MESSAGE_ACK', id: data.id });
        } catch(e) {}

        try {
          const isAtMessages = window.location.pathname.startsWith('/messages');
          if (!isAtMessages || document.hidden) {
            const senderName = data.senderName || (await localDB.friends.get(friendId))?.fullName || 'Someone';
            const typeLabel = data.mediaType === 'audio' ? 'Voice Message' : (data.mediaType === 'video' ? 'Video' : 'Photo');
            showNotification(`New ${typeLabel} from ${senderName}`, { body: data.text || `Sent you a ${typeLabel}` });
          }
        } catch(e) {}

        window.dispatchEvent(new Event('p2p-message-received'));
      } else if (data.type === 'MEDIA_CHUNK_START') {
        incomingChunksRef.current[data.transferId] = {
          msgId: data.msgId,
          sender: friendId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar,
          mediaType: data.mediaType,
          text: data.text,
          isViewOnce: data.isViewOnce,
          timestamp: data.timestamp,
          totalChunks: data.totalChunks,
          receivedChunks: {}
        };
      } else if (data.type === 'MEDIA_CHUNK') {
        const transfer = incomingChunksRef.current[data.transferId];
        if (transfer) {
          transfer.receivedChunks[data.index] = data.chunk;
        }
      } else if (data.type === 'MEDIA_CHUNK_END') {
        const transfer = incomingChunksRef.current[data.transferId];
        if (transfer) {
          const assembledChunks: string[] = [];
          for (let i = 0; i < transfer.totalChunks; i++) {
            assembledChunks.push(transfer.receivedChunks[i] || '');
          }
          const fullMedia = assembledChunks.join('');

          if (transfer.senderName) {
            await saveUserProfileToCache(friendId, transfer.senderName, transfer.senderAvatar || '');
          }

          await localDB.messages.put({
            id: transfer.msgId,
            conversationId: friendId,
            sender: friendId,
            receiver: currentUser!.id,
            text: transfer.text || '',
            media: fullMedia,
            mediaType: transfer.mediaType,
            isViewOnce: !!transfer.isViewOnce,
            status: 'DELIVERED',
            timestamp: transfer.timestamp
          });

          delete incomingChunksRef.current[data.transferId];

          try {
            conn.send({ type: 'MESSAGE_ACK', id: transfer.msgId });
          } catch(e) {}

          try {
            const isAtMessages = window.location.pathname.startsWith('/messages');
            if (!isAtMessages || document.hidden) {
              const senderName = transfer.senderName || (await localDB.friends.get(friendId))?.fullName || 'Someone';
              const typeLabel = transfer.mediaType === 'audio' ? 'Voice Message' : (transfer.mediaType === 'video' ? 'Video' : 'Photo');
              showNotification(`New ${typeLabel} from ${senderName}`, { body: transfer.text || `Sent you a ${typeLabel}` });
            }
          } catch(e) {}

          window.dispatchEvent(new Event('p2p-message-received'));
        }
      }
    });

    conn.on('close', async () => {
      delete connectionsRef.current[friendId];
      setOnlineFriends(prev => {
        const next = new Set(prev);
        next.delete(friendId);
        return next;
      });
      try {
        const friend = await localDB.friends.get(friendId);
        const name = friend?.fullName || 'User';
        toast.info(`Direct P2P disconnected with ${name}. Cloud messaging & notifications active.`, { icon: '☁️' });
      } catch (e) {}
    });
  };

  const ensureConnection = (friendId: string): Promise<DataConnection> => {
    return new Promise((resolve, reject) => {
      if (!peer) return reject('No peer');
      let conn = connectionsRef.current[friendId];
      if (conn && conn.open) return resolve(conn);
      
      const targetPeerId = `nxt-peer-${friendId}`;
      conn = peer.connect(targetPeerId, { reliable: true });
      
      conn.on('open', () => {
        setupDataConnection(conn);
        resolve(conn);
      });
      
      conn.on('error', (err) => {
        reject(err);
      });

      // Fast timeout fallback (1200ms) for instant cloud messaging if offline
      setTimeout(() => {
        if (conn && conn.open) {
          resolve(conn);
        } else {
          reject('Connection timeout');
        }
      }, 1200);
    });
  };

  const sendMessage = async (receiverId: string, text: string) => {
    if (!currentUser || !text.trim()) return;
    const msgId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const timestamp = Date.now();
    const senderName = currentUser.display_name || currentUser.username || 'User';
    const senderAvatar = currentUser.avatar_url || '';
    
    // 1. Instant local persistence & UI update (0ms lag)
    await localDB.messages.put({
      id: msgId,
      conversationId: receiverId,
      sender: currentUser.id,
      receiver: receiverId,
      text,
      status: 'SENT',
      timestamp
    });
    window.dispatchEvent(new Event('p2p-message-sent'));

    // 2. Background async delivery (P2P first, fast fallback to Firestore & push notification if offline)
    (async () => {
      let sentViaP2P = false;
      const conn = connectionsRef.current[receiverId];
      if (conn && conn.open) {
        try {
          conn.send({
            type: 'TEXT_MESSAGE',
            id: msgId,
            sender: currentUser.id,
            senderName,
            senderAvatar,
            text,
            timestamp
          });
          sentViaP2P = true;
        } catch(e) {
          sentViaP2P = false;
        }
      }

      if (!sentViaP2P) {
        try {
          const activeConn = await ensureConnection(receiverId);
          if (activeConn && activeConn.open) {
            activeConn.send({
              type: 'TEXT_MESSAGE',
              id: msgId,
              sender: currentUser.id,
              senderName,
              senderAvatar,
              text,
              timestamp
            });
            sentViaP2P = true;
          }
        } catch (err) {
          sentViaP2P = false;
        }
      }

      if (!sentViaP2P) {
        // Peer is offline or P2P timed out -> Fallback to Firestore & Send Push Notification
        try {
          await addDoc(collection(db, 'messages'), {
            sender_id: currentUser.id,
            receiver_id: receiverId,
            content: text,
            is_read: false,
            created_at: serverTimestamp(),
            timestamp
          });

          await addDoc(collection(db, 'notifications'), {
            user_id: receiverId,
            sender_id: currentUser.id,
            type: 'message',
            is_read: false,
            created_at: serverTimestamp()
          });

          // Mark status as DELIVERED locally since message is in Cloud & notification dispatched
          await localDB.messages.update(msgId, { status: 'DELIVERED' });
          window.dispatchEvent(new Event('p2p-message-received'));

          // Trigger high-priority FCM Push Notification
          triggerNotification(receiverId, senderName, text, { sender_id: currentUser.id, type: 'message' });
        } catch (fbErr) {
          console.warn('Firestore fallback send deferred:', fbErr);
        }
      }
    })();
  };

  const sendMediaMessage = async (receiverId: string, media: string, mediaType: 'image' | 'video' | 'audio', text: string = '', isViewOnce: boolean = false) => {
    if (!currentUser || !media) return;
    const msgId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const timestamp = Date.now();
    const senderName = currentUser.display_name || currentUser.username || 'User';
    const senderAvatar = currentUser.avatar_url || '';

    // 1. Instant local persistence & UI update (0ms lag)
    await localDB.messages.put({
      id: msgId,
      conversationId: receiverId,
      sender: currentUser.id,
      receiver: receiverId,
      text,
      media,
      mediaType,
      isViewOnce,
      status: 'SENT',
      timestamp
    });
    window.dispatchEvent(new Event('p2p-message-sent'));

    // 2. Background delivery
    (async () => {
      let sentViaP2P = false;
      const conn = connectionsRef.current[receiverId];
      if (conn && conn.open) {
        try {
          if (media.length > CHUNK_SIZE) {
            await sendChunkedMediaOverConn(conn, receiverId, msgId, media, mediaType, text, isViewOnce, timestamp);
          } else {
            conn.send({
              type: 'MEDIA_MESSAGE',
              id: msgId,
              sender: currentUser.id,
              senderName,
              senderAvatar,
              media,
              mediaType,
              text,
              isViewOnce,
              timestamp
            });
          }
          sentViaP2P = true;
        } catch(e) {
          sentViaP2P = false;
        }
      }

      if (!sentViaP2P) {
        try {
          const activeConn = await ensureConnection(receiverId);
          if (activeConn && activeConn.open) {
            if (media.length > CHUNK_SIZE) {
              await sendChunkedMediaOverConn(activeConn, receiverId, msgId, media, mediaType, text, isViewOnce, timestamp);
            } else {
              activeConn.send({
                type: 'MEDIA_MESSAGE',
                id: msgId,
                sender: currentUser.id,
                senderName,
                senderAvatar,
                media,
                mediaType,
                text,
                isViewOnce,
                timestamp
              });
            }
            sentViaP2P = true;
          }
        } catch(err) {
          sentViaP2P = false;
        }
      }

      if (!sentViaP2P) {
        try {
          await addDoc(collection(db, 'messages'), {
            sender_id: currentUser.id,
            receiver_id: receiverId,
            content: text || '',
            media_url: media,
            media_type: mediaType,
            is_view_once: isViewOnce,
            is_read: false,
            created_at: serverTimestamp(),
            timestamp
          });

          await addDoc(collection(db, 'notifications'), {
            user_id: receiverId,
            sender_id: currentUser.id,
            type: 'message',
            is_read: false,
            created_at: serverTimestamp()
          });

          await localDB.messages.update(msgId, { status: 'DELIVERED' });
          window.dispatchEvent(new Event('p2p-message-received'));

          const typeLabel = mediaType === 'audio' ? 'Voice Message' : (mediaType === 'video' ? 'Video' : 'Photo');
          triggerNotification(receiverId, senderName, `Sent a ${typeLabel}`, { sender_id: currentUser.id, type: 'message' });
        } catch (fbErr) {
          console.warn('Firestore fallback media send deferred:', fbErr);
        }
      }
    })();
  };

  const sendTypingStatus = async (receiverId: string, isTyping: boolean) => {
    try {
      const conn = connectionsRef.current[receiverId];
      if (conn && conn.open) {
        conn.send({ type: isTyping ? 'TYPING_START' : 'TYPING_STOP' });
      }
    } catch (e) {}
  };

  const sendReadReceipt = async (receiverId: string, messageIds: string[]) => {
    if (!messageIds || messageIds.length === 0) return;
    try {
      const conn = connectionsRef.current[receiverId];
      if (conn && conn.open) {
        conn.send({ type: 'MESSAGE_READ', ids: messageIds });
      }
    } catch (e) {}
  };

  return (
    <P2PContext.Provider value={{ peer, onlineFriends, sendMessage, sendMediaMessage, sendTypingStatus, sendReadReceipt, typingUsers }}>
      {children}
    </P2PContext.Provider>
  );
};

export const useP2P = () => {
  const context = useContext(P2PContext);
  if (!context) throw new Error('useP2P must be used within P2PProvider');
  return context;
};
