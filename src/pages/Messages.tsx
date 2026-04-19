
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Trash2, Send, Smile, Paperclip, MessageSquare, ArrowLeft, Check, CheckCheck, Ban, RefreshCw, X } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import ZoomableImage from '@/components/ZoomableImage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { MediaEditor } from '../components/MediaTools';
import { useUpload } from '@/contexts/UploadContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatTime } from '@/lib/utils';

const Messages: React.FC = () => {
  const { currentUser } = useAuth();
  const { addUpload } = useUpload();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showNewFriends, setShowNewFriends] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ file?: File, url: string, type: 'image' | 'video' } | null>(null);
  const [showMediaEditor, setShowMediaEditor] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (location.state?.userId) {
      const fetchUser = async () => {
        const { data } = await supabase.from('profiles').select('*').eq('id', location.state.userId).single();
        if (data) setSelectedChat(data);
      };
      fetchUser();
      // Clear state so it doesn't re-select on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      console.log("Fetching contacts for user:", currentUser?.id);
      if (!currentUser) return [];
      
      // 1. Fetch messages to find active conversations
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, content, media_url, media_type, created_at, id')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });
      
      if (msgError) {
        console.error("Error fetching messages for contacts:", msgError);
        throw msgError;
      }
      console.log("Fetched messages for contacts:", messages);

      const partnerMap = new Map<string, any>();
      messages?.forEach(m => {
        const partnerId = m.sender_id === currentUser.id ? m.receiver_id : m.sender_id;
        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, m);
        }
      });
      
      // 2. Fetch all accepted or pending friends
      const { data: friendships } = await supabase
        .from('friendships')
        .select('sender_id, receiver_id, status')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
      
      console.log("Fetched friendships:", friendships);

      const friendIds = friendships?.map(f => f.sender_id === currentUser.id ? f.receiver_id : f.sender_id) || [];
      
      // 3. Combine partner IDs and friend IDs
      const allContactIds = Array.from(new Set([...Array.from(partnerMap.keys()), ...friendIds]));
      console.log("All contact IDs:", allContactIds);
      
      if (allContactIds.length === 0) return [];

      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', allContactIds);
      
      if (profError) {
        console.error("Error fetching profiles for contacts:", profError);
        throw profError;
      }
      console.log("Fetched profiles for contacts:", profiles);
      if (!profiles) return [];

      const { data: blocks } = await supabase
        .from('friendships')
        .select('*')
        .eq('status', 'blocked')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

      const contactsWithMessages = profiles.map(profile => {
        const block = blocks?.find(b => 
          (b.sender_id === currentUser.id && b.receiver_id === profile.id) ||
          (b.sender_id === profile.id && b.receiver_id === currentUser.id)
        );
        const lastMsg = partnerMap.get(profile.id);
        const friendship = friendships?.find(f => 
          (f.sender_id === currentUser.id && f.receiver_id === profile.id) ||
          (f.sender_id === profile.id && f.receiver_id === currentUser.id)
        );
        
        return {
          ...profile,
          lastMessage: lastMsg,
          isNewFriend: !lastMsg && friendship?.status === 'pending',
          isFriend: friendship?.status === 'accepted',
          blockStatus: block ? {
            iBlockedThem: block.sender_id === currentUser.id,
            theyBlockedMe: block.sender_id === profile.id
          } : null
        };
      });

      console.log("Contacts with messages:", contactsWithMessages);

      // Sort: Active conversations at top (by time), New friends at bottom
      return contactsWithMessages.sort((a, b) => {
        if (a.lastMessage && b.lastMessage) {
          return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
        }
        if (a.lastMessage) return -1;
        if (b.lastMessage) return 1;
        return 0;
      });
    },
    enabled: !!currentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedChat?.id],
    queryFn: async () => {
      if (!selectedChat) return [];
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser?.id},receiver_id.eq.${selectedChat.id}),and(sender_id.eq.${selectedChat.id},receiver_id.eq.${currentUser?.id})`)
        .order('created_at', { ascending: true });
      
      if (!data) return [];
      // Filter duplicate messages by ID
      return Array.from(new Map(data.map(m => [m.id, m])).values());
    },
    enabled: !!selectedChat,
    staleTime: 0, // Messages should be fresh
  });

  const { data: blockData = null } = useQuery({
    queryKey: ['blockStatus', selectedChat?.id],
    queryFn: async () => {
      if (!selectedChat || !currentUser) return null;
      const { data } = await supabase.from('friendships')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedChat.id}),and(sender_id.eq.${selectedChat.id},receiver_id.eq.${currentUser.id})`)
        .eq('status', 'blocked')
        .maybeSingle();
      return data;
    },
    enabled: !!selectedChat && !!currentUser,
  });

  const isBlocked = !!blockData;
  const iBlockedThem = blockData?.sender_id === currentUser?.id;
  const theyBlockedMe = blockData?.sender_id === selectedChat?.id;

  const { data: isBlockedByMe = false } = useQuery({
    queryKey: ['isBlockedByMe', selectedChat?.id],
    queryFn: async () => {
      if (!selectedChat || !currentUser) return false;
      const { data } = await supabase.from('friendships')
        .select('*')
        .eq('sender_id', currentUser.id)
        .eq('receiver_id', selectedChat.id)
        .eq('status', 'blocked')
        .maybeSingle();
      return !!data;
    },
    enabled: !!selectedChat && !!currentUser,
  });

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: currentUser?.id,
        },
      },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const newState = channel.presenceState();
      const online = new Set(Object.keys(newState));
      setOnlineUsers(online);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString(), user_id: currentUser?.id });
      }
    });

    const globalMsgSub = supabase.channel('global_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUser.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        queryClient.invalidateQueries({ queryKey: ['blockStatus'] });
        queryClient.invalidateQueries({ queryKey: ['isBlockedByMe'] });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(globalMsgSub);
    };
  }, [currentUser?.id, queryClient]);

  useEffect(() => {
    if (selectedChat) {
      const markAsRead = async () => {
        if (!currentUser?.id || !selectedChat?.id) return;
        
        const { error: error1 } = await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('receiver_id', currentUser.id)
          .eq('sender_id', selectedChat.id)
          .eq('is_read', false);
        
        const { error: error2 } = await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('receiver_id', currentUser.id)
          .eq('sender_id', selectedChat.id)
          .is('is_read', null);
          
        if (error1 || error2) {
          console.error("Error marking as read:", error1 || error2);
        } else {
          queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
          queryClient.invalidateQueries({ queryKey: ['totalUnread'] });
          queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] });
        }
      };
      
      markAsRead();

      const msgSub = supabase.channel(`msgs_${selectedChat.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
          const { sender_id, receiver_id } = (payload.new as any);
          if ((sender_id === currentUser?.id && receiver_id === selectedChat.id) ||
              (sender_id === selectedChat.id && receiver_id === currentUser?.id)) {
            queryClient.invalidateQueries({ queryKey: ['messages', selectedChat.id] });
            if (sender_id === selectedChat.id) {
                markAsRead();
            }
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(msgSub); };
    }
  }, [selectedChat, currentUser?.id, queryClient]);

  const handleEmojiClick = (emojiData: any) => {
    setMessageText(prev => prev + emojiData.emoji);
  };

  const filteredContacts = contacts.filter(c => {
    const nameStr = c.display_name || '';
    const userStr = c.username || '';
    return nameStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userStr.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    if (file.type.startsWith('video/')) {
      setSelectedMedia({
        file: file,
        url: URL.createObjectURL(file),
        type: 'video'
      });
      setShowMediaEditor(true);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedMedia({
          url: e.target?.result as string,
          type: 'image'
        });
        setShowMediaEditor(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMediaSave = async (processedUrl: string) => {
    if (!selectedMedia || !selectedChat) return;
    setShowMediaEditor(false);
    
    const newMessage: any = {
      sender_id: currentUser!.id,
      receiver_id: selectedChat.id,
      content: '',
      media_url: '', // Will be updated by UploadContext
      media_type: selectedMedia.type
    };
    
    const uploadData = selectedMedia.type === 'video' && selectedMedia.file ? selectedMedia.file : processedUrl;
    
    addUpload(uploadData, 'message', {
      payload: newMessage,
      receiver_id: selectedChat.id,
      sender_id: currentUser!.id,
      onSuccess: async () => {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedChat.id] });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', selectedChat.id] });
      }
    });

    setSelectedMedia(null);
  };

  const handleBlockUser = async () => {
    if (!selectedChat) return;
    
    const { data: existingBlock } = await supabase.from('friendships')
        .select('*')
        .or(`and(sender_id.eq.${currentUser?.id},receiver_id.eq.${selectedChat.id}),and(sender_id.eq.${selectedChat.id},receiver_id.eq.${currentUser?.id})`)
        .eq('status', 'blocked')
        .single();

    if (existingBlock) {
        if (confirm(`Are you sure you want to unblock ${selectedChat.display_name}?`)) {
            await supabase.from('friendships').delete().eq('id', existingBlock.id);
            queryClient.invalidateQueries({ queryKey: ['blockStatus', selectedChat.id] });
        }
    } else {
        if (confirm(`Are you sure you want to block ${selectedChat.display_name}?`)) {
            await supabase.from('friendships').insert([{ 
                sender_id: currentUser?.id, 
                receiver_id: selectedChat.id, 
                status: 'blocked' 
            }]);
            queryClient.invalidateQueries({ queryKey: ['blockStatus', selectedChat.id] });
        }
    }
  };

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Attempting to send message:", { messageText, selectedChat, isBlocked });
    if (!messageText.trim() || !selectedChat || isBlocked) {
      console.log("Message sending aborted: validation failed");
      return;
    }
    
    const newMessage: any = {
       sender_id: currentUser!.id,
       receiver_id: selectedChat.id,
       content: messageText
    };
    
    console.log("Inserting message into Supabase:", newMessage);
    const { error } = await supabase.from('messages').insert([newMessage]);
    if (!error) {
      console.log("Message inserted successfully");
      setMessageText('');
      
      queryClient.invalidateQueries({ queryKey: ['messages', selectedChat.id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', selectedChat.id] });
    } else {
      console.error("Error sending message:", error);
    }
  };

  const triggerDeleteMessage = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDeleteMessage = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);

    // Optimistic delete
    if (selectedChat) {
      queryClient.setQueryData(['messages', selectedChat.id], (oldData: any[]) => {
        if (!oldData) return oldData;
        return oldData.filter(msg => msg.id !== id);
      });
    }

    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error && selectedChat) {
      console.error(error);
      queryClient.invalidateQueries({ queryKey: ['messages', selectedChat.id] });
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-full bg-white dark:bg-black rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden max-w-[1200px] mx-auto">
      {/* Contact Sidebar */}
      <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-[350px] border-r border-gray-100 dark:border-gray-800 flex flex-col bg-gray-50/50 dark:bg-black/50`}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-black sticky top-0 z-20">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">Chats</h1>
            <button 
              onClick={() => setShowNewFriends(!showNewFriends)}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition-all ${showNewFriends ? 'bg-[#1877F2] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
              {showNewFriends ? 'Back to Chats' : 'New Friends'}
            </button>
          </div>
          <div className="bg-[#f0f2f5] dark:bg-gray-900 rounded-full flex items-center px-4 py-2 border border-transparent focus-within:border-blue-300 transition-all">
            <Search size={18} className="text-gray-400" />
            <input 
              placeholder="Search Messenger" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none ml-2 text-sm w-full font-bold text-gray-700 dark:text-gray-200 placeholder-gray-500" 
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingContacts && contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <RefreshCw className="animate-spin text-blue-500" size={24} />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading Chats...</p>
            </div>
          ) : (showNewFriends ? filteredContacts.filter(c => c.isNewFriend) : filteredContacts.filter(c => !c.isNewFriend)).map(c => {
            const isOnline = onlineUsers.has(c.id);
            const lastMsg = c.lastMessage;
            
            return (
              <div 
                key={c.id} 
                onClick={() => { setSelectedChat(c); if(showNewFriends) setShowNewFriends(false); }} 
                className={`flex items-center gap-3 p-3 cursor-pointer rounded-2xl transition-all ${selectedChat?.id === c.id ? 'bg-[#e7f3ff] dark:bg-gray-800 text-[#1877F2] dark:text-blue-400 shadow-sm' : 'hover:bg-white dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 hover:shadow-sm'}`}
              >
                <div className="relative flex-shrink-0">
                  <img src={c.avatar_url} className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm" />
                  {isOnline && <div className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-green-500 border-2 border-white dark:border-black rounded-full"></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <p className="font-bold truncate flex items-center gap-1 text-[15px]">
                      {c.display_name}
                      {c.is_verified && <VerifiedBadge size={14} />}
                    </p>
                    {lastMsg && (
                      <span className="text-[10px] text-gray-400 font-medium ml-2 flex-shrink-0">
                        {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-sm truncate text-gray-500 dark:text-gray-400 font-medium">
                      {c.blockStatus ? (
                        <span className="text-red-500 flex items-center gap-1">
                          <Ban size={12} />
                          {c.blockStatus.iBlockedThem ? 'Blocked' : 'Blocked you'}
                        </span>
                      ) : (
                        <>
                          {c.isNewFriend ? <span className="text-blue-500 italic">Say hi to your new friend!</span> : (
                            <>
                              {lastMsg?.sender_id === currentUser?.id ? 'You: ' : ''}
                              {lastMsg?.media_url ? (lastMsg.media_type === 'video' ? '🎥 Video' : '📷 Photo') : lastMsg?.content}
                            </>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isOnline ? 'text-green-500' : 'text-gray-400'}`}>
                    {isOnline ? 'Active Now' : 'Offline'}
                  </p>
                </div>
              </div>
            );
          })}
          {showNewFriends && filteredContacts.filter(c => c.isNewFriend).length === 0 && (
            <div className="text-center py-10 text-gray-400 text-xs font-bold uppercase tracking-widest">No new friends to show</div>
          )}
          {!showNewFriends && filteredContacts.filter(c => !c.isNewFriend).length === 0 && (
            <div className="text-center py-10 text-gray-400 text-xs font-bold uppercase tracking-widest">No active chats</div>
          )}
        </div>
      </div>

      {/* Message Area */}
      <div className={`${!selectedChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-white dark:bg-black`}>
        {selectedChat ? (
          <>
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shadow-sm bg-white/80 dark:bg-black/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedChat(null)} className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" /></button>
                <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate(`/profile/${selectedChat.username}`)}>
                  <img src={selectedChat.avatar_url} className="w-10 h-10 rounded-full object-cover shadow-sm border border-gray-100 dark:border-gray-700" />
                  <div>
                    <p className="font-bold leading-none text-gray-900 dark:text-white flex items-center gap-1">
                      {selectedChat.display_name}
                      {selectedChat.is_verified && <VerifiedBadge />}
                    </p>
                    <p className={`text-[10px] mt-1 font-black tracking-widest ${onlineUsers.has(selectedChat.id) ? 'text-green-500' : 'text-gray-400'}`}>
                      {onlineUsers.has(selectedChat.id) ? 'REALTIME ACTIVE' : 'OFFLINE'}
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleBlockUser} 
                className={`p-2 rounded-full transition-all ${isBlockedByMe ? 'bg-red-500 text-white shadow-lg' : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500'}`} 
                title={isBlockedByMe ? "Unblock User" : "Block User"}
              >
                <Ban size={20} />
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50/30 dark:bg-gray-900/30 flex flex-col gap-3">
              {isBlocked ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="bg-red-100 dark:bg-red-900/20 p-6 rounded-full mb-4">
                    <Ban size={48} className="text-red-500" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
                    {iBlockedThem ? 'You blocked this user' : 'You are blocked'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-xs">
                    {iBlockedThem 
                      ? 'You have blocked this user. You cannot send or receive messages until you unblock them.' 
                      : 'This user has blocked you. You cannot send or receive messages in this conversation.'}
                  </p>
                  {iBlockedThem && (
                    <button 
                      onClick={handleBlockUser}
                      className="mt-6 px-6 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/25"
                    >
                      Unblock to Chat
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center my-10 animate-in fade-in zoom-in duration-300 cursor-pointer" onClick={() => navigate(`/profile/${selectedChat.username}`)}>
                    <img src={selectedChat.avatar_url} className="w-24 h-24 rounded-full mb-3 shadow-2xl border-4 border-white dark:border-black object-cover hover:scale-105 transition-transform" />
                    <h2 className="text-xl font-black text-gray-900 dark:text-white hover:underline flex items-center gap-2">
                      {selectedChat.display_name}
                      {selectedChat.is_verified && <VerifiedBadge size={20} />}
                    </h2>
                    <p className="text-gray-500 font-bold bg-white dark:bg-black px-3 py-1 rounded-full border border-gray-100 dark:border-gray-800 shadow-sm mt-2 text-xs">@{selectedChat.username}</p>
                  </div>

                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'} group relative animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      {msg.sender_id === currentUser?.id && (
                        <button onClick={() => triggerDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 mr-2 self-center text-red-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                      )}
                      <div className={`p-3.5 rounded-2xl max-w-[75%] shadow-sm text-[15px] font-medium leading-relaxed ${msg.sender_id === currentUser?.id ? 'bg-[#1877F2] text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'}`}>
                        {msg.media_url && (
                          <div className="mb-2 rounded-lg overflow-hidden bg-black/5 dark:bg-white/5">
                            {msg.media_type === 'image' ? (
                              <ZoomableImage src={msg.media_url} className="max-w-full h-auto rounded-lg" referrerPolicy="no-referrer" />
                            ) : (
                              <video src={msg.media_url} controls className="max-w-full h-auto rounded-lg" />
                            )}
                          </div>
                        )}
                        {msg.content && <span>{msg.content}</span>}
                        <div className={`flex items-center justify-end gap-1 mt-1 ${msg.sender_id === currentUser?.id ? 'text-blue-200' : 'text-gray-400'}`}>
                          <p className="text-[10px] text-right opacity-80">
                             {formatTime(msg.created_at)}
                          </p>
                          {msg.sender_id === currentUser?.id && (
                            msg.id.toString().startsWith('temp-') ? (
                              <Check size={12} className="opacity-50 animate-pulse" />
                            ) : (
                              <CheckCheck size={12} className={msg.is_read ? "text-blue-400" : "text-blue-200 opacity-60"} />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={scrollRef} />
                </>
              )}
            </div>
            
            <form onSubmit={handleSendMessage} className="p-5 bg-white dark:bg-black border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 relative">
              <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} accept="image/*,video/*" />
              <button 
                type="button" 
                disabled={isBlocked} 
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-[#1877F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all disabled:opacity-50"
              >
                <Paperclip size={22} />
              </button>
              
              <div className="flex-1 bg-[#f0f2f5] dark:bg-gray-900 rounded-2xl flex items-center px-4 py-2.5 border border-transparent focus-within:border-blue-300 transition-all relative">
                 <input 
                  value={messageText} 
                  onChange={e => setMessageText(e.target.value)} 
                  placeholder={isBlocked ? "You cannot message this user." : "Type a message..."}
                  disabled={isBlocked}
                  className="bg-transparent border-none outline-none text-[15px] w-full font-bold text-gray-800 dark:text-white placeholder-gray-500 disabled:cursor-not-allowed" 
                />
                <button 
                  type="button" 
                  disabled={isBlocked} 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`transition-all ${showEmojiPicker ? 'text-orange-500 scale-110' : 'text-[#1877F2]'} disabled:opacity-50`}
                >
                  <Smile size={22} />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-2 z-50 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
                    <div className="fixed inset-0" onClick={() => setShowEmojiPicker(false)}></div>
                    <div className="relative">
                      <EmojiPicker 
                        onEmojiClick={handleEmojiClick}
                        autoFocusSearch={false}
                        theme={Theme.AUTO}
                        width={300}
                        height={400}
                      />
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" disabled={!messageText.trim() || isBlocked} className="bg-[#1877F2] text-white p-2.5 rounded-full shadow-md hover:brightness-110 disabled:opacity-30 transition-all"><Send size={24} /></button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-200 dark:text-gray-800 bg-gray-50/10 dark:bg-gray-900/10">
            <div className="bg-white dark:bg-gray-900 p-12 rounded-full shadow-2xl mb-8">
               <MessageSquare size={100} strokeWidth={1} className="text-blue-50 dark:text-blue-900/20" />
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white">Next</p>
            <p className="mt-2 font-bold text-gray-400">Select a contact to start an instant conversation.</p>
          </div>
        )}
        {showMediaEditor && selectedMedia && (
          <MediaEditor 
            mediaUrl={selectedMedia.url} 
            mediaType={selectedMedia.type} 
            onSave={handleMediaSave} 
            onCancel={() => { setShowMediaEditor(false); setSelectedMedia(null); }} 
          />
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        title="Delete Message"
        message="Are you sure you want to delete this message for everyone?"
        onConfirm={executeDeleteMessage}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};

export default Messages;
