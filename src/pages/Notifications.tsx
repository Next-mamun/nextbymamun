import React, { useState, useEffect } from 'react';
import { Bell, Heart, MessageSquare, UserPlus, Eye, MessageCircle, Check } from 'lucide-react';
import { useAuth } from '@/App';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const Notifications: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    fetchNotifications();

    const sub = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, (payload) => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [currentUser]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*, sender:sender_id(*)')
      .eq('user_id', currentUser?.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    setNotifications(data || []);
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser?.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="text-red-500" size={20} />;
      case 'comment': return <MessageSquare className="text-blue-500" size={20} />;
      case 'friend_request': return <UserPlus className="text-green-500" size={20} />;
      case 'story_view': return <Eye className="text-purple-500" size={20} />;
      case 'message': return <MessageCircle className="text-yellow-500" size={20} />;
      default: return <Bell className="text-gray-500" size={20} />;
    }
  };

  const getMessage = (n: any) => {
    const name = n.sender?.display_name || 'Someone';
    switch (n.type) {
      case 'like': return <><span className="font-bold">{name}</span> liked your post.</>;
      case 'comment': return <><span className="font-bold">{name}</span> commented on your post.</>;
      case 'friend_request': return <><span className="font-bold">{name}</span> sent you a friend request.</>;
      case 'story_view': return <><span className="font-bold">{name}</span> viewed your story.</>;
      case 'message': return <><span className="font-bold">{name}</span> sent you a message.</>;
      default: return <><span className="font-bold">{name}</span> interacted with you.</>;
    }
  };

  const handleNotificationClick = (n: any) => {
    markAsRead(n.id);
    if (n.type === 'friend_request') navigate('/friends');
    else if (n.type === 'message') navigate('/messages');
    else if (n.type === 'story_view') navigate('/');
    else navigate(`/profile/${currentUser?.username}`); // generic fallback
  };

  return (
    <div className="max-w-[800px] mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Notifications</h1>
        {notifications.some(n => !n.is_read) && (
          <button onClick={markAllAsRead} className="text-[#1877F2] font-bold hover:underline flex items-center gap-1">
            <Check size={18} /> Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center p-10 text-gray-500 font-bold animate-pulse">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center p-20 bg-white dark:bg-black rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <Bell size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-bold text-lg">No notifications yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-black rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          {notifications.map(n => (
            <div 
              key={n.id} 
              onClick={() => handleNotificationClick(n)}
              className={`p-4 border-b border-gray-100 dark:border-gray-800 flex items-start gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors ${!n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
            >
              <div className="relative">
                <img src={n.sender?.avatar_url} className="w-12 h-12 rounded-full object-cover" />
                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-black rounded-full p-0.5 shadow-sm">
                  {getIcon(n.type)}
                </div>
              </div>
              <div className="flex-1">
                <p className="text-gray-900 dark:text-gray-100">{getMessage(n)}</p>
                <p className="text-xs text-gray-500 mt-1 font-medium">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.is_read && <div className="w-3 h-3 bg-[#1877F2] rounded-full mt-2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
