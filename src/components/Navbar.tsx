
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, MessageCircle, Bell, User, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/App';
import { supabase } from '../lib/supabase';
import { VerifiedBadge } from './VerifiedBadge';

import { useQuery } from '@tanstack/react-query';

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data } = await supabase
        .from('friendships')
        .select('*, profiles:sender_id(*)')
        .eq('receiver_id', currentUser.id)
        .eq('status', 'pending');
      
      if (!data) return [];
      
      const seenIds = JSON.parse(localStorage.getItem('seen_notifications') || '[]');
      return data.map(req => ({
        id: req.id,
        type: 'friend_request',
        text: `${req.profiles.display_name} sent you a friend request.`,
        avatar: req.profiles.avatar_url,
        link: '/friends',
        created_at: req.created_at,
        is_seen: seenIds.includes(req.id)
      }));
    },
    enabled: !!currentUser?.id,
    refetchInterval: 1000 * 30, // Refetch every 30 seconds
  });

  const handleNotificationsClick = () => {
    const opening = !showNotifications;
    setShowNotifications(opening);
    setShowDropdown(false);
    
    if (opening && notifications.length > 0) {
      const seenIds = JSON.parse(localStorage.getItem('seen_notifications') || '[]');
      const newSeenIds = Array.from(new Set([...seenIds, ...notifications.map((n: any) => n.id)]));
      localStorage.setItem('seen_notifications', JSON.stringify(newSeenIds));
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-transparent dark:border-transparent z-50 px-4 flex items-center justify-between shadow-sm transition-colors">
      <div className="flex items-center gap-2">
        <Link to="/" className="flex items-center">
          <img src="https://i.postimg.cc/wxwt5tsk/retouch-2026030721254774.png" alt="Next Media" className="h-8 w-auto" />
        </Link>
      </div>

      <div className="flex items-center justify-end gap-1 relative">
        <button 
          onClick={handleNotificationsClick}
          className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative ${showNotifications ? 'text-[#1A2933] dark:text-blue-400 bg-blue-50 dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'}`}
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
          className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${showDropdown ? 'text-[#1A2933] dark:text-blue-400 bg-blue-50 dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'}`}
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
                    onClick={() => setShowNotifications(false)}
                    className="flex items-start gap-3 p-3 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-xl transition-colors"
                  >
                    <img src={notif.avatar} className="w-12 h-12 rounded-full object-cover border dark:border-gray-700 shadow-sm" alt="avatar" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 dark:text-white font-medium leading-tight">{notif.text}</p>
                      <p className="text-xs text-[#1A2933] dark:text-blue-400 font-bold mt-1">
                        {new Date(notif.created_at).toLocaleDateString()}
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
              <img src={currentUser?.avatar_url} className="w-10 h-10 rounded-full object-cover border dark:border-gray-700 shadow-sm" alt="profile" />
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
