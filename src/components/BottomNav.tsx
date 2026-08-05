import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, PlusSquare, MessageCircle, User, Users, BookOpen } from 'lucide-react';
import { useAuth, useTheme } from '@/contexts/AuthContext';
import { useGlobalStore } from '@/store/useGlobalStore';

const BottomNav: React.FC = () => {
  const location = useLocation();
  const { currentUser } = useAuth();
  const { bottomBarSize, iconColor, darkMode } = useTheme();
  const isActive = (path: string) => location.pathname === path;
  
  const messages = useGlobalStore((state) => state.messages);

  const totalUnread = useMemo(() => {
    if (!currentUser) return 0;
    const clearedAt = parseInt(localStorage.getItem('inbox_cleared_at') || '0', 10);
    const validMsgs = messages.filter(msg => {
      if (msg.is_read !== false) return false;
      if (msg.deleted_for_everyone || (msg.deleted_for || []).includes(currentUser.id)) return false;
      const msgTime = typeof msg.created_at === 'string' ? new Date(msg.created_at).getTime() : msg.created_at?.toMillis ? msg.created_at.toMillis() : Date.now();
      return msgTime > clearedAt;
    });
    
    const uniqueSenders = new Set(validMsgs.map(msg => msg.sender_id));
    return uniqueSenders.size;
  }, [messages, currentUser]);

  const barHeightClass = useMemo(() => {
    switch(bottomBarSize) {
      case 'small': return 'h-12';
      case 'large': return 'h-20';
      case 'medium': 
      default: return 'h-16';
    }
  }, [bottomBarSize]);

  const iconSize = useMemo(() => {
    switch(bottomBarSize) {
      case 'small': return 20;
      case 'large': return 28;
      case 'medium': 
      default: return 24;
    }
  }, [bottomBarSize]);

  const activeColor = iconColor;
  const inactiveColor = darkMode ? '#9CA3AF' : '#6B7280'; // gray-400 : gray-500

  return (
    <div 
      className={`fixed left-0 right-0 ${barHeightClass} bg-white/80 dark:bg-black/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 flex items-center justify-around z-50 transition-all px-1`}
      style={{ bottom: 'var(--keyboard-offset, 0px)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Link to="/" className="flex flex-col items-center justify-center w-full h-full" style={{ color: isActive('/') ? activeColor : inactiveColor }}>
        <Home size={iconSize} strokeWidth={isActive('/') ? 2.5 : 2} />
        <span className="text-[10px] font-medium mt-1">Home</span>
      </Link>
      
      <Link to="/friends" className="flex flex-col items-center justify-center w-full h-full" style={{ color: isActive('/friends') ? activeColor : inactiveColor }}>
        <Users size={iconSize} strokeWidth={isActive('/friends') ? 2.5 : 2} />
        <span className="text-[10px] font-medium mt-1">Friends</span>
      </Link>

      <Link to="/create-post" className="flex flex-col items-center justify-center w-full h-full" style={{ color: darkMode ? '#ffffff' : '#1A2933' }}>
        <div className="p-2 rounded-xl shadow-lg hover:scale-105 transition-transform" style={{ backgroundColor: activeColor, color: 'white' }}>
          <PlusSquare size={iconSize} />
        </div>
      </Link>

      <Link 
        to="/messages" 
        className="flex flex-col items-center justify-center w-full h-full relative" 
        style={{ color: isActive('/messages') ? activeColor : inactiveColor }}
        onClick={() => {
          localStorage.setItem('inbox_cleared_at', Date.now().toString());
        }}
      >
        <div className="relative">
          <MessageCircle size={iconSize} strokeWidth={isActive('/messages') ? 2.5 : 2} />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white dark:border-black animate-in zoom-in duration-300">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium mt-1">Inbox</span>
      </Link>

      <Link to={`/profile/${currentUser?.username}`} className="flex flex-col items-center justify-center w-full h-full" style={{ color: isActive(`/profile/${currentUser?.username}`) ? activeColor : inactiveColor }}>
        <User size={iconSize} strokeWidth={isActive(`/profile/${currentUser?.username}`) ? 2.5 : 2} />
        <span className="text-[10px] font-medium mt-1">Profile</span>
      </Link>
    </div>
  );
};

export default BottomNav;
