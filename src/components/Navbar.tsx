
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, MessageCircle, Bell, User, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VerifiedBadge } from './VerifiedBadge';

import { useQuery, useQueryClient } from '@tanstack/react-query';

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications_firestore', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
      // Fetch regular notifications
      const qNotifs = query(
        collection(db, 'notifications'), 
        where('user_id', '==', currentUser.id),
        orderBy('created_at', 'desc'),
        limit(10)
      );
      const notifsSnap = await getDocs(qNotifs);
      const validNotifs = notifsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        
      // Fetch unread messages
      const qMsgs = query(
        collection(db, 'messages'),
        where('receiver_id', '==', currentUser.id),
        where('is_read', '==', false),
        orderBy('created_at', 'desc'),
        limit(15)
      );
      const msgsSnap = await getDocs(qMsgs);
      const validMsgs = msgsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const msgSenders = new Set();
      const msgNotifs: any[] = [];
      
      validMsgs.forEach(msg => {
        const clearedAt = parseInt(localStorage.getItem('inbox_cleared_at') || '0', 10);
        const msgTime = typeof msg.created_at === 'string' ? new Date(msg.created_at).getTime() : msg.created_at?.toMillis ? msg.created_at.toMillis() : Date.now();
        if (msgTime <= clearedAt) return;

        if (!msgSenders.has(msg.sender_id)) {
          msgSenders.add(msg.sender_id);
          msgNotifs.push({
            id: `msg-${msg.id}`,
            type: 'message',
            sender_id: msg.sender_id,
            created_at: msg.created_at,
            is_read: false,
            real_msg_id: msg.id
          });
        }
      });
 
      const combined = [...validNotifs, ...msgNotifs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 15);
 
      const senderIds = [...new Set(combined.map(n => n.sender_id).filter(Boolean))];
      let profileMap: any = {};
      
      if (senderIds.length > 0) {
        const profiles = await Promise.all(senderIds.map(async id => {
           const d = await getDoc(doc(db, 'profiles', id));
           return d.exists() ? { id: d.id, ...d.data() } : null;
        })).then(res => res.filter(Boolean));
          
        profileMap = profiles.reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }
      
      const seenIds = JSON.parse(localStorage.getItem('seen_notifications') || '[]');
      return combined.map(n => {
        const sender = profileMap[n.sender_id] || null;
        let text = `${sender?.display_name || 'Someone'} interacted with you.`;
        let link = `/profile/${currentUser.username}`;
        
        if (n.type === 'friend_request') {
          text = `${sender?.display_name || 'Someone'} sent you a friend request.`;
          link = '/friends';
        } else if (n.type === 'friend_accept') {
          text = `${sender?.display_name || 'Someone'} accepted your friend request.`;
          link = '/friends';
        } else if (n.type === 'message') {
          text = `${sender?.display_name || 'Someone'} sent you a message.`;
          link = '/messages';
        } else if (n.type === 'like') {
          text = `${sender?.display_name || 'Someone'} liked your post.`;
        } else if (n.type === 'comment') {
          text = `${sender?.display_name || 'Someone'} commented on your post.`;
        }
 
        return {
          id: n.id,
          type: n.type,
          text,
          avatar: sender?.avatar_url,
          link,
          state: n.type === 'message' ? { userId: n.sender_id } : undefined,
          created_at: n.created_at,
          is_seen: seenIds.includes(n.id) || !!n.is_read
        };
      });
    },
    enabled: !!currentUser?.id,
    staleTime: 1000 * 60, // 1 minute
  });
 
  useEffect(() => {
    if (!currentUser) return;
 
    const qNotifs = query(collection(db, 'notifications'), where('user_id', '==', currentUser.id));
    const unsubNotifs = onSnapshot(qNotifs, () => {
      queryClient.invalidateQueries({ queryKey: ['notifications_firestore', currentUser.id] });
    });
 
    const qMsgs = query(collection(db, 'messages'), where('receiver_id', '==', currentUser.id), where('is_read', '==', false));
    const unsubMsgs = onSnapshot(qMsgs, () => {
      queryClient.invalidateQueries({ queryKey: ['notifications_firestore', currentUser.id] });
    });
 
    return () => { 
      unsubNotifs();
      unsubMsgs();
    };
  }, [currentUser, queryClient]);
 
  const handleNotificationsClick = async () => {
    const opening = !showNotifications;
    setShowNotifications(opening);
    setShowDropdown(false);
    
    if (opening && notifications.length > 0) {
      const seenIds = JSON.parse(localStorage.getItem('seen_notifications') || '[]');
      const newSeenIds = Array.from(new Set([...seenIds, ...notifications.map((n: any) => n.id)]));
      localStorage.setItem('seen_notifications', JSON.stringify(newSeenIds));
      localStorage.setItem('inbox_cleared_at', Date.now().toString());
 
      if (currentUser?.id) {
         queryClient.setQueryData(['notifications_firestore', currentUser.id], (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.map((n: any) => ({ ...n, is_seen: true }));
         });
         queryClient.setQueryData(['totalUnread'], 0);
      }
      
      try {
        const qUnread = query(collection(db, 'notifications'), where('user_id', '==', currentUser?.id), where('is_read', '==', false));
        const snap = await getDocs(qUnread);
        snap.docs.forEach(d => updateDoc(doc(db, 'notifications', d.id), { is_read: true }).catch(() => {}));
      } catch (e) {
        console.error(e);
      }
    }
  };
 
  const handleNotificationClick = async (notif: any) => {
    setShowNotifications(false);
    if (!notif.id.toString().startsWith('msg-')) {
      try { await deleteDoc(doc(db, 'notifications', notif.id)); } catch(e) {}
    }
    queryClient.invalidateQueries({ queryKey: ['notifications_firestore', currentUser?.id] });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-gradient-to-r from-black to-white backdrop-blur-md border-b border-gray-100 dark:border-gray-800 z-[100] px-4 flex items-center justify-between shadow-sm transition-colors">
      <div className="flex items-center gap-2">
        <Link to="/" className="flex items-center">
          <img src="https://i.postimg.cc/wxwt5tsk/retouch-2026030721254774.png" alt="Next" className="h-8 w-auto" />
        </Link>
      </div>

      <div className="flex items-center justify-end gap-1 relative">
        <button 
          onClick={handleNotificationsClick}
          className={`p-2 rounded-full hover:bg-black/5 transition-colors relative ${showNotifications ? 'text-[#1877F2] bg-blue-50' : 'text-black'}`}
        >
          <Bell size={24} fill={showNotifications ? "currentColor" : "none"} />
          {notifications.filter(n => !n.is_seen).length > 0 && (
            <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold border-2 border-white dark:border-black">
              {notifications.filter(n => !n.is_seen).length}
            </span>
          )}
        </button>

        <button 
          onClick={() => { setShowDropdown(!showDropdown); setShowNotifications(false); }}
          className={`p-2 rounded-full hover:bg-black/5 transition-colors ${showDropdown ? 'text-[#1877F2] bg-blue-50' : 'text-black'}`}
        >
          <Menu size={24} />
        </button>

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div className="absolute top-14 right-0 w-80 bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-800 p-2 animate-in fade-in zoom-in-95 duration-150 z-[60]">
            <h3 className="font-black text-xl px-4 py-3 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 mb-2">Notifications</h3>
            <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-3">
                  <Bell size={40} className="opacity-20" />
                  <p className="font-bold">No new notifications</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <Link 
                    key={notif.id} 
                    to={notif.link}
                    state={notif.state}
                    onClick={() => handleNotificationClick(notif)}
                    className="flex items-start gap-3 p-3 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-xl transition-colors"
                  >
                    <img src={notif.avatar || undefined} className="w-12 h-12 rounded-full object-cover border dark:border-gray-700 shadow-sm" alt="avatar" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 dark:text-white font-medium leading-tight">{notif.text}</p>
                      <p className="text-xs text-[#1A2933] dark:text-blue-400 font-bold mt-1">
                        {new Date(notif.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}

        {/* Menu Dropdown */}
        {showDropdown && (
          <div className="absolute top-14 right-0 w-64 bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-800 p-2 animate-in fade-in zoom-in-95 duration-150 z-[60]">
            <Link to={`/profile/${currentUser?.username}`} className="flex items-center gap-3 p-3 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-xl transition-colors" onClick={() => setShowDropdown(false)}>
              <img src={currentUser?.avatar_url || undefined} className="w-10 h-10 rounded-full object-cover border dark:border-gray-700 shadow-sm" alt="profile" />
              <div>
                <p className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1">
                  See Profile
                  {currentUser?.is_verified && <VerifiedBadge />}
                </p>
                <p className="text-xs text-gray-500">@{currentUser?.display_name}</p>
              </div>
            </Link>
            <div className="h-px bg-gray-100 dark:bg-gray-800 my-2" />
            <Link to="/settings" className="flex items-center gap-3 p-3 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-xl transition-colors" onClick={() => setShowDropdown(false)}>
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-full"><User size={20} className="text-gray-600 dark:text-gray-300" /></div>
              <span className="font-bold text-sm text-gray-700 dark:text-gray-200">Settings</span>
            </Link>
            <button 
              onClick={() => { logout(); setShowDropdown(false); navigate('/login'); }}
              className="flex items-center gap-3 w-full p-3 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-left text-red-600 transition-colors mt-1"
            >
              <div className="bg-red-50 dark:bg-red-900/30 p-2 rounded-full"><LogOut size={20} /></div>
              <span className="font-bold text-sm">Log Out</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
