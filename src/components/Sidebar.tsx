
import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Bookmark, Flag, Calendar, Settings, ChevronDown, UserCircle, TrendingUp, Hash } from 'lucide-react';
import { useAuth } from '@/App';
import { VerifiedBadge } from './VerifiedBadge';

const SidebarItem = React.memo<{ icon: React.ReactNode, label: string | React.ReactNode, to: string }>(({ icon, label, to }) => (
  <Link to={to} className="flex items-center gap-3 p-3 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors">
    <div className="text-[#1877F2]">{icon}</div>
    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{label}</span>
  </Link>
));

const Sidebar: React.FC = () => {
  const { currentUser } = useAuth();

  const trendingTopics = [
    { tag: '#NextMediaLaunch', posts: '125K' },
    { tag: '#AIArt', posts: '84K' },
    { tag: '#TechNews2024', posts: '56K' },
    { tag: '#ReactJS', posts: '42K' },
    { tag: '#WebDevelopment', posts: '28K' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-[360px] h-[calc(100vh-56px)] sticky top-14 p-2 overflow-y-auto scrollbar-hide">
      <SidebarItem 
        icon={<img src={currentUser?.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="me" />} 
        label={
          <div className="flex items-center gap-1">
            {currentUser?.display_name || 'Profile'}
            {currentUser?.is_verified && <VerifiedBadge />}
          </div>
        } 
        to={`/profile/${currentUser?.username}`}
      />
      <SidebarItem icon={<Users size={24} />} label="Friends" to="/friends" />
      <SidebarItem icon={<UserCircle size={24} />} label="Groups" to="/" />
      <SidebarItem icon={<Flag size={24} />} label="Pages" to="/" />
      <SidebarItem icon={<Bookmark size={24} />} label="Saved" to="/" />
      <SidebarItem icon={<Calendar size={24} />} label="Events" to="/" />
      <SidebarItem icon={<Settings size={24} />} label="Settings" to="/settings" />
      <SidebarItem icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clapperboard"><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>} label="Videos" to="/reels" />
      
      <button className="flex items-center gap-3 p-3 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors mb-4">
        <div className="bg-gray-200 dark:bg-gray-700 p-1.5 rounded-full"><ChevronDown size={18} className="text-gray-600 dark:text-gray-300" /></div>
        <span className="font-medium text-sm text-gray-700 dark:text-gray-300">See more</span>
      </button>

      <div className="border-t border-gray-300 dark:border-gray-700 mx-2 my-2"></div>

      <div className="px-3 py-2">
        <h3 className="text-gray-500 dark:text-gray-400 font-bold text-[15px] mb-3 flex items-center gap-2">
          <TrendingUp size={18} /> Trending Topics
        </h3>
        <div className="flex flex-col gap-3">
          {trendingTopics.map((topic, index) => (
            <div key={index} className="flex items-start gap-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors">
              <div className="bg-[#e7f3ff] dark:bg-blue-900/20 text-[#1877F2] p-1.5 rounded-md mt-0.5">
                <Hash size={16} />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{topic.tag}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{topic.posts} posts</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto p-4 text-[13px] text-gray-500 dark:text-gray-400">
        <p>Privacy · Terms · Advertising · Cookies · Meta © 2024</p>
      </div>
    </aside>
  );
};

export default React.memo(Sidebar);
