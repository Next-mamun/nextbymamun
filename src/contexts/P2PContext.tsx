import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { useAuth } from './AuthContext';
import { localDB, urlToBase64 } from '@/lib/db';
import { triggerNotification } from '@/services/notificationService';
import { toast } from 'sonner';

interface P2PContextType {
  peer: Peer | null;
  onlineFriends: Set<string>;
  sendMessage: (receiverId: string, text: string) => Promise<void>;
  sendTypingStatus: (receiverId: string, isTyping: boolean) => void;
  typingUsers: Set<string>;
}

const P2PContext = createContext<P2PContextType | null>(null);

export const P2PProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useAuth();
  const [peer, setPeer] = useState<Peer | null>(null);
  const [onlineFriends, setOnlineFriends] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  
  const connectionsRef = useRef<{ [username: string]: DataConnection }>({});
  const typingTimersRef = useRef<{ [username: string]: NodeJS.Timeout }>({});

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

    return () => {
      newPeer.destroy();
    };
  }, [currentUser]);

  // Heartbeat to keep connections alive and track presence
  useEffect(() => {
    if (!peer) return;
    const interval = setInterval(() => {
      Object.entries(connectionsRef.current).forEach(([username, conn]) => {
        if (conn.open) {
          conn.send({ type: 'PING' });
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [peer]);

  const setupDataConnection = (conn: DataConnection) => {
    const friendId = conn.peer.replace('nxt-peer-', '');
    
    const handleOpen = async () => {
      connectionsRef.current[friendId] = conn;
      setOnlineFriends(prev => new Set(prev).add(friendId));
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
      } else if (data.type === 'TEXT_MESSAGE') {
        await localDB.messages.put({
          id: data.id,
          conversationId: friendId, // simplified
          sender: friendId,
          receiver: currentUser!.id,
          text: data.text,
          status: 'DELIVERED',
          timestamp: data.timestamp
        });
        // trigger UI update via event or db subscription
        window.dispatchEvent(new Event('p2p-message-received'));
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
        toast('Fast messaging system disconnected', { description: `from ${name}` });
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

      // Timeout fallback
      setTimeout(() => {
        if (!conn.open) reject('Connection timeout');
      }, 3000);
    });
  };

  const sendMessage = async (receiverId: string, text: string) => {
    if (!currentUser) return;
    const msgId = Date.now().toString();
    const timestamp = Date.now();
    
    try {
      const conn = await ensureConnection(receiverId);
      conn.send({
        type: 'TEXT_MESSAGE',
        id: msgId,
        sender: currentUser.id,
        text,
        timestamp
      });
      
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
    } catch (err) {
      // Peer offline or connection failed -> save as PENDING_P2P
      await localDB.messages.put({
        id: msgId,
        conversationId: receiverId,
        sender: currentUser.id,
        receiver: receiverId,
        text,
        status: 'PENDING_P2P',
        timestamp
      });
      window.dispatchEvent(new Event('p2p-message-sent'));
    }
  };

  const sendTypingStatus = async (receiverId: string, isTyping: boolean) => {
    try {
      const conn = connectionsRef.current[receiverId];
      if (conn && conn.open) {
        conn.send({ type: isTyping ? 'TYPING_START' : 'TYPING_STOP' });
      }
    } catch (e) {}
  };

  return (
    <P2PContext.Provider value={{ peer, onlineFriends, sendMessage, sendTypingStatus, typingUsers }}>
      {children}
    </P2PContext.Provider>
  );
};

export const useP2P = () => {
  const context = useContext(P2PContext);
  if (!context) throw new Error('useP2P must be used within P2PProvider');
  return context;
};
