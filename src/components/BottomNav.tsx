import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, PlusSquare, MessageCircle, User, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const BottomNav: React.FC = () => {
  const location = useLocation();
  const { currentUser } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const { data: totalUnread = 0 } = useQuery({
    queryKey: ['totalUnread'],
    queryFn: async () => {
      if (!currentUser) return 0;
      const { data } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', currentUser.id)
        .or('is_read.eq.false,is_read.is.null');
      
      if (!data) return 0;
      const uniqueSenders = new Set(data.map(msg => msg.sender_id));
      return uniqueSenders.size;
    },
    enabled: !!currentUser,
    refetchInterval: 10000, // Poll every 10s as a fallback
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 flex items-center justify-around z-50 pb-safe transition-colors">
      <Link to="/" className={`flex flex-col items-center justify-center w-full h-full ${isActive('/') ? 'text-[#1A2933] dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
        <Home size={24} strokeWidth={isActive('/') ? 2.5 : 2} />
        <span className="text-[10px] font-medium mt-1">Home</span>
      </Link>
      
      <Link to="/friends" className={`flex flex-col items-center justify-center w-full h-full ${isActive('/friends') ? 'text-[#1A2933] dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
        <Users size={24} strokeWidth={isActive('/friends') ? 2.5 : 2} />
        <span className="text-[10px] font-medium mt-1">Friends</span>
      </Link>

      <Link to="/create-post" className="flex flex-col items-center justify-center w-full h-full text-[#1A2933] dark:text-white">
        <div className="bg-[#1A2933] dark:bg-blue-600 text-white p-2 rounded-xl shadow-lg hover:scale-105 transition-transform">
          <PlusSquare size={24} />
        </div>
      </Link>

      <Link to="/messages" className={`flex flex-col items-center justify-center w-full h-full relative ${isActive('/messages') ? 'text-[#1A2933] dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
        <div className="relative">
          <MessageCircle size={24} strokeWidth={isActive('/messages') ? 2.5 : 2} />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white dark:border-black animate-in zoom-in duration-300">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium mt-1">Inbox</span>
      </Link>

      <Link to={`/profile/${currentUser?.username}`} className={`flex flex-col items-center justify-center w-full h-full ${isActive(`/profile/${currentUser?.username}`) ? 'text-[#1A2933] dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
        <User size={24} strokeWidth={isActive(`/profile/${currentUser?.username}`) ? 2.5 : 2} />
        <span className="text-[10px] font-medium mt-1">Profile</span>
      </Link>
    </div>
  );
};

export default BottomNav;
