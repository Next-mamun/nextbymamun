import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Clapperboard, PlusSquare, MessageCircle, User, Users } from 'lucide-react';
import { useAuth } from '@/App';

const BottomNav: React.FC = () => {
  const location = useLocation();
  const { currentUser } = useAuth();

  const isActive = (path: string) => location.pathname === path;

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

      <Link to="/messages" className={`flex flex-col items-center justify-center w-full h-full ${isActive('/messages') ? 'text-[#1A2933] dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
        <MessageCircle size={24} strokeWidth={isActive('/messages') ? 2.5 : 2} />
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
