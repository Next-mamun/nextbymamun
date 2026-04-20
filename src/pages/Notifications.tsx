import React, { useEffect } from 'react';
import { Bell, Heart, MessageSquare, UserPlus, Eye, MessageCircle, Check, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatTime } from '@/lib/utils';

const Notifications: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading: loading } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      
      const { data: notifs, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser?.id)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) {
        console.error("Error fetching notifications:", error);
      }
      
      const { data: unreadMsgs } = await supabase
        .from('messages')
        .select('*')
        .eq('receiver_id', currentUser.id)
        .or('is_read.eq.false,is_read.is.null')
        .order('created_at', { ascending: false })
        .limit(50);
        
      const validNotifs = notifs || [];
      const validMsgs = unreadMsgs || [];
      
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

      const combined = [...validNotifs, ...msgNotifs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50);
      
      if (combined.length === 0) return [];

      // Fetch sender profiles manually to avoid foreign key syntax issues
      const senderIds = [...new Set(combined.map(n => n.sender_id).filter(Boolean))];
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', senderIds);
          
        if (profiles) {
          const profileMap = profiles.reduce((acc: any, p: any) => {
            acc[p.id] = p;
            return acc;
          }, {});
          
          return combined.map(n => ({
            ...n,
            sender: profileMap[n.sender_id] || null
          }));
        }
      }

      return combined;
    },
    enabled: !!currentUser,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    if (!currentUser) return;

    const sub = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser?.id}` }, (payload) => {
        console.log('New notification:', payload);
        queryClient.invalidateQueries({ queryKey: ['notifications', currentUser?.id] });
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [currentUser, queryClient]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications', currentUser?.id] });
  };

  const markAllAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser?.id);
    queryClient.invalidateQueries({ queryKey: ['notifications', currentUser?.id] });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="text-red-500" size={20} />;
      case 'comment': return <MessageSquare className="text-blue-500" size={20} />;
      case 'friend_request': return <UserPlus className="text-green-500" size={20} />;
      case 'friend_accept': return <CheckCircle className="text-blue-500" size={20} />;
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
      case 'friend_accept': return <><span className="font-bold">{name}</span> accepted your friend request.</>;
      case 'story_view': return <><span className="font-bold">{name}</span> viewed your story.</>;
      case 'message': return <><span className="font-bold">{name}</span> sent you a message.</>;
      default: return <><span className="font-bold">{name}</span> interacted with you.</>;
    }
  };

  const handleNotificationClick = async (n: any) => {
    if (!n.id.toString().startsWith('msg-')) {
      await supabase.from('notifications').delete().eq('id', n.id);
    }
    queryClient.invalidateQueries({ queryKey: ['notifications', currentUser?.id] });
    
    if (n.type === 'friend_request' || n.type === 'friend_accept') navigate('/friends');
    else if (n.type === 'message') navigate('/messages', { state: { userId: n.sender_id } });
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
                <p className="text-xs text-gray-500 mt-1 font-medium">{formatTime(n.created_at, { showYear: true })}</p>
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
