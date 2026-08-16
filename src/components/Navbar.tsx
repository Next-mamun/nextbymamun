
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, MessageCircle, Bell, User, LogOut, Menu, BookOpen, Tv } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VerifiedBadge } from './VerifiedBadge';
import { useGlobalStore } from '@/store/useGlobalStore';

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const storeNotifications = useGlobalStore((state) => state.notifications);
  const storeMessages = useGlobalStore((state) => state.messages);
  const [profilesCache, setProfilesCache] = useState<Record<string, any>>({});

  const notifications = useMemo(() => {
    if (!currentUser?.id) return [];
    
    const clearedAt = parseInt(localStorage.getItem('inbox_cleared_at') || '0', 10);
    const validMsgs = storeMessages.filter(msg => {
      if (msg.is_read !== false) return false;
      if (msg.deleted_for_everyone || (msg.deleted_for || []).includes(currentUser.id)) return false;
      const msgTime = typeof msg.created_at === 'string' ? new Date(msg.created_at).getTime() : msg.created_at?.toMillis ? msg.created_at.toMillis() : Date.now();
      return msgTime > clearedAt;
    });

    const msgSenders = new Set();
    const msgNotifs: any[] = [];
    
    validMsgs.forEach(msg => {
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

    const combined = [...storeNotifications, ...msgNotifs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 15);

    const seenIds = JSON.parse(localStorage.getItem('seen_notifications') || '[]');

    return combined.map(n => {
      const sender = profilesCache[n.sender_id] || null;
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
  }, [currentUser, storeNotifications, storeMessages, profilesCache]);

  // Fetch unknown profiles
  useEffect(() => {
    if (!currentUser) return;
    const fetchMissingProfiles = async () => {
      const combined = [...storeNotifications, ...storeMessages.filter(m => m.is_read === false)];
      const senderIds = [...new Set(combined.map(n => n.sender_id).filter(Boolean))];
      
      const missingIds = senderIds.filter(id => !profilesCache[id]);
      if (missingIds.length === 0) return;

      const newProfiles = await Promise.all(missingIds.map(async id => {
         const d = await getDoc(doc(db, 'profiles', id));
         return d.exists() ? { id: d.id, ...d.data() } : null;
      })).then(res => res.filter(Boolean));
        
      if (newProfiles.length > 0) {
        setProfilesCache(prev => {
          const next = { ...prev };
          newProfiles.forEach((p: any) => { next[p.id] = p; });
          return next;
        });
      }
    };
    fetchMissingProfiles();
  }, [storeNotifications, storeMessages, currentUser, profilesCache]);

  const handleNotificationsClick = async () => {
    const opening = !showNotifications;
    setShowNotifications(opening);
    setShowDropdown(false);
    
    if (opening && notifications.length > 0) {
      const seenIds = JSON.parse(localStorage.getItem('seen_notifications') || '[]');
      const newSeenIds = Array.from(new Set([...seenIds, ...notifications.map((n: any) => n.id)]));
      localStorage.setItem('seen_notifications', JSON.stringify(newSeenIds));
      localStorage.setItem('inbox_cleared_at', Date.now().toString());

      try {
        const unreadIds = storeNotifications.filter(n => !n.is_read).map(n => n.id);
        unreadIds.forEach(id => {
          updateDoc(doc(db, 'notifications', id), { is_read: true }).catch(() => {});
        });
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
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 z-[100] transition-colors safe-top">
      <div className="max-w-[1920px] mx-auto h-full px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Link to="/" className="flex items-center">
          <img src="https://i.postimg.cc/wxwt5tsk/retouch-2026030721254774.png" alt="Next" className="h-8 w-auto" />
        </Link>
      </div>

      <div className="flex items-center justify-end gap-1 relative">
        <Link 
          to="/lab"
          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-black dark:text-white"
          title="Lab (E-Books)"
        >
          <BookOpen size={24} />
        </Link>
        <Link 
          to="/theatre"
          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-black dark:text-white"
          title="Cinema Hall"
        >
          <Tv size={24} />
        </Link>
        <button 
          onClick={handleNotificationsClick}
          className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative ${showNotifications ? 'text-[#1877F2] bg-blue-50 dark:bg-blue-900/30' : 'text-black dark:text-white'}`}
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
          className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${showDropdown ? 'text-[#1877F2] bg-blue-50 dark:bg-blue-900/30' : 'text-black dark:text-white'}`}
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
      </div>
    </nav>
  );
};

export default Navbar;
