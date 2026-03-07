
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, Send, Smile, Paperclip, MessageSquare, ArrowLeft, Check, CheckCheck, Ban, RefreshCw, X } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useAuth } from '@/App';
import { supabase } from '../lib/supabase';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import ZoomableImage from '@/components/ZoomableImage';

const Messages: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isBlocked, setIsBlocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEmojiClick = (emojiData: any) => {
    setMessageText(prev => prev + emojiData.emoji);
  };

  const filteredContacts = contacts.filter(c => 
    c.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const mType = file.type.startsWith('video/') ? 'video' : 'image';
      
      const newMessage: any = {
        sender_id: currentUser!.id,
        receiver_id: selectedChat.id,
        content: '',
        media_url: base64,
        media_type: mType,
        created_at: new Date().toISOString()
      };

      // Optimistic Update
      setMessages(prev => [...prev, { ...newMessage, id: 'temp-' + Date.now() }]);
      
      const { error: insertError } = await supabase.from('messages').insert([newMessage]);
      
      if (insertError) {
        console.warn('Full message insert failed, trying basic insert...', insertError);
        // Fallback if columns are missing
        const { error: fallbackError } = await supabase.from('messages').insert([{
          sender_id: currentUser!.id,
          receiver_id: selectedChat.id,
          content: '[Media Attachment]',
          created_at: new Date().toISOString()
        }]);
        if (fallbackError) alert('Failed to send file. Please ensure "media_url" column exists in "messages" table.');
        fetchMessages();
      }
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    if (!currentUser) return;
    
    fetchContacts();
    fetchUnreadCounts();

    // Subscribe to online users presence
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

    // Global message subscription for unread counts
    const globalMsgSub = supabase.channel('global_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUser.id}` }, (payload) => {
        if (selectedChat?.id !== payload.new.sender_id) {
          setUnreadCounts(prev => ({
            ...prev,
            [payload.new.sender_id]: (prev[payload.new.sender_id] || 0) + 1
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(globalMsgSub);
    };
  }, [currentUser?.id, selectedChat?.id]);

  const fetchUnreadCounts = async () => {
    const { data } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', currentUser?.id)
      .eq('is_read', false);
    
    if (data) {
      const counts: { [key: string]: number } = {};
      data.forEach((msg: any) => {
        counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  };

  useEffect(() => {
    if (selectedChat) {
      fetchMessages();
      checkBlockStatus();
      
      // Mark incoming messages as read when opening chat
      const markAsRead = async () => {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('receiver_id', currentUser?.id)
          .eq('sender_id', selectedChat.id)
          .eq('is_read', false);
        
        setUnreadCounts(prev => ({ ...prev, [selectedChat.id]: 0 }));
      };
      markAsRead();

      const msgSub = supabase.channel(`msgs_${selectedChat.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
          // If a new message arrives while chat is open, mark it as read
          if (payload.eventType === 'INSERT' && payload.new.receiver_id === currentUser?.id && payload.new.sender_id === selectedChat.id) {
            supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id);
          }
          fetchMessages();
        })
        .subscribe();

      const friendSub = supabase.channel(`friendship_${selectedChat.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
             checkBlockStatus();
        })
        .subscribe();

      return () => { 
          supabase.removeChannel(msgSub); 
          supabase.removeChannel(friendSub);
      };
    }
  }, [selectedChat]);

  const checkBlockStatus = async () => {
    const { data } = await supabase.from('friendships')
      .select('*')
      .or(`and(sender_id.eq.${currentUser?.id},receiver_id.eq.${selectedChat.id}),and(sender_id.eq.${selectedChat.id},receiver_id.eq.${currentUser?.id})`)
      .eq('status', 'blocked')
      .single();
    setIsBlocked(!!data);
  };

  const handleBlockUser = async () => {
    if (!selectedChat) return;
    if (confirm(`Are you sure you want to block ${selectedChat.display_name}?`)) {
        // Check if friendship exists
        const { data } = await supabase.from('friendships')
            .select('*')
            .or(`and(sender_id.eq.${currentUser?.id},receiver_id.eq.${selectedChat.id}),and(sender_id.eq.${selectedChat.id},receiver_id.eq.${currentUser?.id})`)
            .single();
        
        if (data) {
            await supabase.from('friendships').update({ status: 'blocked', sender_id: currentUser?.id, receiver_id: selectedChat.id }).eq('id', data.id);
        } else {
            await supabase.from('friendships').insert([{ sender_id: currentUser?.id, receiver_id: selectedChat.id, status: 'blocked' }]);
        }
        setIsBlocked(true);
    }
  };

  const fetchContacts = async () => {
    // Fetch all users to chat with (In a real app, only friends)
    const { data } = await supabase.from('profiles').select('*').neq('id', currentUser?.id);
    if (data) setContacts(data);
  };

  const fetchMessages = async () => {
    if (!selectedChat) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser?.id},receiver_id.eq.${selectedChat.id}),and(sender_id.eq.${selectedChat.id},receiver_id.eq.${currentUser?.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedChat) return;
    
    const newMessage: any = {
       sender_id: currentUser!.id,
       receiver_id: selectedChat.id,
       content: messageText,
       created_at: new Date().toISOString()
    };
    
    // Optimistic Update
    setMessages(prev => [...prev, { ...newMessage, id: 'temp-' + Date.now() }]);
    setMessageText('');

    const { error } = await supabase.from('messages').insert([newMessage]);
    if (error) fetchMessages(); // Rollback if error
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('Delete this message for everyone?')) return;
    
    // Instant deletion UI update (Optimistic)
    setMessages(prev => prev.filter(m => m.id !== id));
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) {
      alert('Failed to delete message.');
      fetchMessages();
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] bg-white dark:bg-black rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden max-w-[1200px] mx-auto">
      {/* Contact Sidebar */}
      <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-[350px] border-r border-gray-100 dark:border-gray-800 flex flex-col bg-gray-50/50 dark:bg-black/50`}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-black">
          <h1 className="text-2xl font-black mb-4 text-gray-900 dark:text-white">Chats</h1>
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
          {filteredContacts.map(c => {
            const isOnline = onlineUsers.has(c.id);
            return (
              <div key={c.id} onClick={() => setSelectedChat(c)} className={`flex items-center gap-3 p-4 cursor-pointer rounded-2xl transition-all ${selectedChat?.id === c.id ? 'bg-[#e7f3ff] dark:bg-gray-800 text-[#1877F2] dark:text-blue-400 shadow-sm' : 'hover:bg-white dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 hover:shadow-sm'}`}>
                <div className="relative">
                  <img src={c.avatar_url} className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm" />
                  {isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-black rounded-full"></div>}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="font-bold truncate flex items-center gap-1">
                    {c.display_name}
                    {c.is_verified && <VerifiedBadge />}
                  </p>
                  <p className={`text-[11px] font-bold uppercase tracking-wide ${isOnline ? 'text-green-500' : 'text-gray-400'}`}>
                    {isOnline ? 'Active Now' : 'Offline'}
                  </p>
                </div>
                {unreadCounts[c.id] > 0 && (
                  <div className="bg-[#1877F2] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm animate-in zoom-in duration-200">
                    {unreadCounts[c.id] > 9 ? '9+' : unreadCounts[c.id]}
                  </div>
                )}
              </div>
            );
          })}
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
              <button onClick={handleBlockUser} disabled={isBlocked} className={`p-2 rounded-full transition-all ${isBlocked ? 'bg-red-100 dark:bg-red-900/20 text-red-500 cursor-not-allowed' : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500'}`} title="Block User">
                <Ban size={20} />
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50/30 dark:bg-gray-900/30 flex flex-col gap-3">
              <div className="flex flex-col items-center my-10 animate-in fade-in zoom-in duration-300 cursor-pointer" onClick={() => navigate(`/profile/${selectedChat.username}`)}>
                <img src={selectedChat.avatar_url} className="w-24 h-24 rounded-full mb-3 shadow-2xl border-4 border-white dark:border-black object-cover hover:scale-105 transition-transform" />
                <h2 className="text-xl font-black text-gray-900 dark:text-white hover:underline flex items-center gap-2">
                  {selectedChat.display_name}
                  {selectedChat.is_verified && <VerifiedBadge size={20} />}
                </h2>
                <p className="text-gray-500 font-bold bg-white dark:bg-black px-3 py-1 rounded-full border border-gray-100 dark:border-gray-800 shadow-sm mt-2 text-xs">@{selectedChat.username}</p>
                {isBlocked && <p className="mt-2 text-red-500 font-bold text-sm bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full">You have blocked this user.</p>}
              </div>

              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'} group relative animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  {msg.sender_id === currentUser?.id && (
                    <button onClick={() => deleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 mr-2 self-center text-red-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
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
                         {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            </div>
            
            <form onSubmit={handleSendMessage} className="p-5 bg-white dark:bg-black border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 relative">
              <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} accept="image/*,video/*" />
              <button 
                type="button" 
                disabled={isBlocked || isUploading} 
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-[#1877F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all disabled:opacity-50"
              >
                {isUploading ? <RefreshCw size={22} className="animate-spin" /> : <Paperclip size={22} />}
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
            <p className="text-2xl font-black text-gray-900 dark:text-white">Next Messenger</p>
            <p className="mt-2 font-bold text-gray-400">Select a contact to start an instant conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
