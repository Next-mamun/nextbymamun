
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Home, Users, MessageCircle, Bell, User, LogOut, Menu, Clapperboard, X } from 'lucide-react';
import { useAuth } from '@/App';
import { supabase } from '../lib/supabase';
import { VerifiedBadge } from './VerifiedBadge';

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
    }
  }, [currentUser]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearching(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        setIsLoading(true);
        console.log('Searching for:', searchQuery);
        
        const { data: users, error: userError } = await supabase
          .from('profiles')
          .select('*')
          .or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
          .limit(5);
          
        if (userError) console.error('User search error:', userError);

        const { data: posts, error: postError } = await supabase
          .from('posts')
          .select('*, profiles:user_id(*)')
          .or(`content.ilike.%${searchQuery}%,media_type.ilike.%${searchQuery}%`)
          .limit(5);

        if (postError) console.error('Post search error:', postError);

        const combinedResults = [
          ...(users || []).map(u => ({ ...u, type: 'user' })),
          ...(posts || []).map(p => ({ ...p, type: 'post' }))
        ];
        
        setSearchResults(combinedResults);
        setIsLoading(false);
      } else {
        setSearchResults([]);
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchNotifications = async () => {
    // Fetch pending friend requests as notifications
    const { data } = await supabase
      .from('friendships')
      .select('*, profiles:sender_id(*)')
      .eq('receiver_id', currentUser?.id)
      .eq('status', 'pending');
    
    if (data) {
      const seenIds = JSON.parse(localStorage.getItem('seen_notifications') || '[]');
      const newNotifications = data.map(req => ({
        id: req.id,
        type: 'friend_request',
        text: `${req.profiles.display_name} sent you a friend request.`,
        avatar: req.profiles.avatar_url,
        link: '/friends',
        created_at: req.created_at,
        is_seen: seenIds.includes(req.id)
      }));
      setNotifications(newNotifications);
    }
  };

  const handleNotificationsClick = () => {
    const opening = !showNotifications;
    setShowNotifications(opening);
    setShowDropdown(false);
    
    if (opening && notifications.length > 0) {
      const seenIds = JSON.parse(localStorage.getItem('seen_notifications') || '[]');
      const newSeenIds = Array.from(new Set([...seenIds, ...notifications.map(n => n.id)]));
      localStorage.setItem('seen_notifications', JSON.stringify(newSeenIds));
      
      // Update local state to remove the red badge immediately
      setNotifications(prev => prev.map(n => ({ ...n, is_seen: true })));
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
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
          onClick={() => setIsSearchOpen(true)}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
        >
          <Search size={24} />
        </button>

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

        {/* Full Screen Search Overlay */}
        {isSearchOpen && (
          <div className="fixed inset-0 bg-white dark:bg-black z-[100] flex flex-col animate-in fade-in duration-200">
            <div className="h-14 border-b border-gray-100 dark:border-gray-800 flex items-center px-4 gap-4">
              <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); setSearchResults([]); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                <X size={24} className="text-gray-600 dark:text-gray-300" />
              </button>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Search Next Media..." 
                  value={searchQuery}
                  onChange={handleSearch}
                  className="w-full bg-gray-100 dark:bg-gray-900 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-500"
                />
                {isLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-black">
              {searchQuery.trim() === '' ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                  <Search size={48} strokeWidth={1} />
                  <p className="font-medium">Search for friends or creators</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Results</h3>
                  {isLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-sm text-gray-500">No results found for "{searchQuery}"</p>
                  ) : (
                    searchResults.map(item => (
                      item.type === 'user' ? (
                        <Link 
                          key={`user-${item.id}`} 
                          to={`/profile/${item.username}`} 
                          onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-xl transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-800"
                        >
                          <img src={item.avatar_url} className="w-12 h-12 rounded-full object-cover border dark:border-gray-700" alt="profile" />
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                              {item.display_name}
                              {item.is_verified && <VerifiedBadge />}
                            </p>
                            <p className="text-xs text-gray-500">@{item.username}</p>
                          </div>
                        </Link>
                      ) : (
                        <Link 
                          key={`post-${item.id}`} 
                          to={`/`} 
                          onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                          className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-xl transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-800"
                        >
                          {item.media_type === 'video' ? (
                            <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                              <Clapperboard size={20} className="text-white" />
                            </div>
                          ) : item.media_type === 'image' ? (
                            <img src={item.media_url} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" alt="post" />
                          ) : (
                            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                              <MessageCircle size={20} className="text-gray-500" />
                            </div>
                          )}
                          <div className="flex-1 overflow-hidden">
                            <p className="font-bold text-gray-900 dark:text-white text-sm">{item.profiles?.display_name}</p>
                            <p className="text-xs text-gray-500 truncate">{item.content}</p>
                            <p className="text-[10px] text-blue-500 font-bold mt-1 uppercase">{item.media_type}</p>
                          </div>
                        </Link>
                      )
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

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
