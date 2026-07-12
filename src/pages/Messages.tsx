import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, Trash2, Send, Smile, Paperclip, MessageSquare, ArrowLeft, Check, CheckCheck, Ban, RefreshCw, X, CornerUpLeft, EyeOff, Mic, Eye, Play, Pause } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useAuth } from '@/contexts/AuthContext';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import ZoomableImage from '@/components/ZoomableImage';
import VideoPlayer from '@/components/VideoPlayer';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { redis } from '@/lib/redis';

// Firebase imports
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc, updateDoc, setDoc, onSnapshot, orderBy, limit, addDoc, serverTimestamp, or, and } from 'firebase/firestore';

import { MediaEditor } from '../components/MediaTools';
import { useUpload } from '@/contexts/UploadContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatTime } from '@/lib/utils';
import { triggerNotification } from '@/services/notificationService';
import { toast } from 'sonner';

const CustomAudioPlayer = ({ src, isSender }: { src: string; isSender?: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    const updateDuration = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Playback failed", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current && duration > 0) {
      const seekTime = (Number(e.target.value) / 100) * duration;
      audioRef.current.currentTime = seekTime;
      setProgress(Number(e.target.value));
    }
  };

  const formatAudioTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className={`flex items-center gap-3 w-full min-w-[200px] sm:min-w-[240px] max-w-[280px] px-1 py-0.5`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <button 
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${isSender ? 'bg-white text-[#1877F2] shadow-sm' : 'bg-[#1877F2] text-white shadow-md'}`}
      >
        {isPlaying ? <Pause fill="currentColor" size={18} /> : <Play fill="currentColor" size={20} className="ml-1" />}
      </button>

      <div className="flex-1 flex flex-col justify-center">
        <div className="relative w-full flex items-center h-6 group">
           <input
             type="range"
             min="0"
             max="100"
             value={progress || 0}
             onChange={handleSeek}
             className={`w-full h-1.5 rounded-full appearance-none cursor-pointer transition-all ${isSender ? 'bg-black/10 accent-white' : 'bg-gray-200 dark:bg-gray-700 accent-[#1877F2]'}`}
             style={{ 
               background: `linear-gradient(to right, ${isSender ? 'white' : '#1877F2'} ${progress}%, ${isSender ? 'rgba(0,0,0,0.1)' : 'var(--tw-colors-gray-200)'} ${progress}%)` 
             }}
           />
        </div>
        <div className={`text-[11px] font-medium leading-none mt-0.5 flex justify-between tracking-wide ${isSender ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
          <span>{formatAudioTime(audioRef.current?.currentTime || 0)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

const Messages: React.FC = () => {
  const { currentUser } = useAuth();
  const { addUpload } = useUpload();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(50);

  const [inputOffset, setInputOffset] = useState(0);
  const [isDraggingInput, setIsDraggingInput] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (isInputFocused && inputOffset === 0) {
      setInputOffset(300);
    } else if (!isInputFocused) {
      setInputOffset(0);
    }
  }, [isInputFocused]);

  useEffect(() => {
    const handleMove = (e: any) => {
      if (!isDraggingInput) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - dragStartYRef.current;
      setInputOffset(Math.max(0, dragStartOffsetRef.current - deltaY));
    };
    const handleUp = () => setIsDraggingInput(false);

    if (isDraggingInput) {
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, [isDraggingInput]);

  const handleInputTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setIsDraggingInput(true);
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      dragStartYRef.current = clientY;
      dragStartOffsetRef.current = inputOffset;
      if (e.cancelable) e.preventDefault();
    }
    lastTapRef.current = now;
  };

  const handleScroll = (e: any) => {
    if (e.target.scrollTop === 0 && messages.length > visibleLimit) {
      const oldHeight = e.target.scrollHeight;
      setVisibleLimit(prev => prev + 50);
      setTimeout(() => {
        e.target.scrollTop = e.target.scrollHeight - oldHeight;
      }, 0);
    }
  };

  useEffect(() => {
    if (selectedChat && currentUser) {
      const draftKey = `message_draft_${currentUser.id}_${selectedChat.id}`;
      const draft = localStorage.getItem(draftKey);
      if (draft !== null) {
        setMessageText(draft);
      } else {
        setMessageText('');
      }
    } else {
      setMessageText('');
    }
  }, [selectedChat, currentUser]);

  const handleMessageTextChange = (text: string) => {
    setMessageText(text);
    if (currentUser && selectedChat) {
      const draftKey = `message_draft_${currentUser.id}_${selectedChat.id}`;
      if (text.trim() === '') {
        localStorage.removeItem(draftKey);
      } else {
        localStorage.setItem(draftKey, text);
      }

      if (!isTyping) {
        setIsTyping(true);
        setDoc(doc(db, 'typing_status', `${currentUser.id}_${selectedChat.id}`), { is_typing: true, timestamp: serverTimestamp() }, { merge: true }).catch(() => {});
      }
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        setDoc(doc(db, 'typing_status', `${currentUser.id}_${selectedChat.id}`), { is_typing: false, timestamp: serverTimestamp() }, { merge: true }).catch(() => {});
      }, 2000);
    }
  };

  useEffect(() => {
    if (!currentUser || !selectedChat) {
      setOtherUserTyping(false);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'typing_status', `${selectedChat.id}_${currentUser.id}`), (doc) => {
      if (doc.exists() && doc.data()?.is_typing) {
        setOtherUserTyping(true);
      } else {
        setOtherUserTyping(false);
      }
    });
    return () => unsubscribe();
  }, [selectedChat, currentUser]);

  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showNewFriends, setShowNewFriends] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ file?: File, url: string, type: 'image' | 'video' } | null>(null);
  const [showMediaEditor, setShowMediaEditor] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<{file: File, url: string} | null>(null);
  const [isVoiceViewOnce, setIsVoiceViewOnce] = useState(false);
  const [activeViewOnceMedia, setActiveViewOnceMedia] = useState<any>(null);
  
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (location.state?.userId) {
      const fetchUser = async () => {
        const docSnap = await getDoc(doc(db, 'profiles', location.state.userId));
        if (docSnap.exists()) {
           setSelectedChat({ id: docSnap.id, ...docSnap.data() });
        }
      };
      fetchUser();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      console.log("Fetching contacts for user:", currentUser?.id);
      if (!currentUser) return [];

      // 1. Fetch messages to find active conversations
      const msgQuery = query(
        collection(db, 'messages'),
        or(where('sender_id', '==', currentUser.id), where('receiver_id', '==', currentUser.id)),
        limit(500)
      );
      const msgSnap = await getDocs(msgQuery);
      let messages = msgSnap.docs.map(d => ({id: d.id, ...d.data()} as any));
      
      // Sort in memory to avoid composite index requirement
      messages.sort((a, b) => {
        const timeA = typeof a.created_at === 'string' ? new Date(a.created_at).getTime() : a.created_at?.toMillis ? a.created_at.toMillis() : Date.now();
        const timeB = typeof b.created_at === 'string' ? new Date(b.created_at).getTime() : b.created_at?.toMillis ? b.created_at.toMillis() : Date.now();
        return timeB - timeA;
      });
      
      const partnerMap = new Map<string, any>();
      messages.forEach(m => {
        const partnerId = m.sender_id === currentUser.id ? m.receiver_id : m.sender_id;
        let parsedM: any = { ...m };
        if (typeof m.content === 'string') {
          if (m.content.includes('"JSON_PAYLOAD"')) {
            try {
              const obj = JSON.parse(m.content);
              parsedM.content = obj.text;
              parsedM.is_view_once = obj.is_view_once;
              parsedM.parent_message_id = obj.parent_message_id;
            } catch(e) {}
          } else if (m.content.startsWith('{')) {
            try {
              const obj = JSON.parse(m.content);
              if (obj.text !== undefined) parsedM.content = obj.text;
            } catch(e) {}
          }
        }
        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, parsedM);
        }
      });
      
      // 2. Fetch all accepted or pending friends
      const friendshipsSnap = await getDocs(query(
        collection(db, 'friendships'),
        or(where('sender_id', '==', currentUser.id), where('receiver_id', '==', currentUser.id))
      ));
      const friendships = friendshipsSnap.docs.map(d => ({id: d.id, ...d.data()} as any));
      
      const friendIds = friendships.map(f => f.sender_id === currentUser.id ? f.receiver_id : f.sender_id) || [];
      
      // 3. Combine partner IDs and friend IDs
      const allContactIds = Array.from(new Set([...Array.from(partnerMap.keys()), ...friendIds])).filter(Boolean);
      
      if (allContactIds.length === 0) return [];

      // Fetch profiles in chunks since Firestore 'in' query has a limit of 10-30 depending on structure.
      // Better yet, just fetch 'em one by one or in small batches.
      const profiles = await Promise.all(allContactIds.map(async (id) => {
        const d = await getDoc(doc(db, 'profiles', id));
        return d.exists() ? { id: d.id, ...d.data() } : null;
      })).then(res => res.filter(Boolean));

      const blocks = friendships.filter(f => f.status === 'blocked');

      const contactsWithMessages = profiles.map((profile: any) => {
        const block = blocks.find(b => 
          (b.sender_id === currentUser.id && b.receiver_id === profile.id) ||
          (b.sender_id === profile.id && b.receiver_id === currentUser.id)
        );
        const lastMsg = partnerMap.get(profile.id);
        const friendship = friendships.find(f => 
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

      const sortedContacts = contactsWithMessages.sort((a, b) => {
        if (a.lastMessage && b.lastMessage) {
          const timeA = typeof a.lastMessage.created_at === 'string' ? new Date(a.lastMessage.created_at).getTime() : a.lastMessage.created_at?.toMillis ? a.lastMessage.created_at.toMillis() : Date.now();
          const timeB = typeof b.lastMessage.created_at === 'string' ? new Date(b.lastMessage.created_at).getTime() : b.lastMessage.created_at?.toMillis ? b.lastMessage.created_at.toMillis() : Date.now();
          return timeB - timeA;
        }
        if (a.lastMessage) return -1;
        if (b.lastMessage) return 1;
        return 0;
      });

      return sortedContacts;
    },
    enabled: !!currentUser,
    staleTime: 60 * 1000, 
    gcTime: Infinity,
  });

  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedChat || !currentUser) {
      setMessages([]);
      setVisibleLimit(50);
      return;
    }
    
    setVisibleLimit(50);

    const q1 = query(
      collection(db, 'messages'),
      where('sender_id', '==', currentUser.id),
      where('receiver_id', '==', selectedChat.id)
    );

    const q2 = query(
      collection(db, 'messages'),
      where('sender_id', '==', selectedChat.id),
      where('receiver_id', '==', currentUser.id)
    );

    let messages1: any[] = [];
    let messages2: any[] = [];

    const handleMessagesUpdate = () => {
      const combined = [...messages1, ...messages2];
      
      // Remove duplicate keys just in case
      const uniqueMap = new Map<string, any>();
      combined.forEach(m => {
        uniqueMap.set(m.id, m);
      });
      const data = Array.from(uniqueMap.values());

      // Sort chronologically
      data.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeA - timeB;
      });

      const finalData = data.map(m => {
        let parsed: any = { ...m };
        if (typeof m.content === 'string') {
          if (m.content.includes('"JSON_PAYLOAD"')) {
            try {
              const obj = JSON.parse(m.content);
              parsed.content = obj.text;
              parsed.is_view_once = obj.is_view_once;
              parsed.parent_message_id = obj.parent_message_id;
            } catch(e) {}
          } else if (m.content.startsWith('{')) {
            try {
              const obj = JSON.parse(m.content);
              if (obj.text !== undefined) parsed.content = obj.text;
            } catch(e) {}
          }
        }
        return parsed;
      });

      setMessages(finalData);

      // Check for incoming unread messages and mark them as read
      const unreadCount = finalData.filter(m => m.sender_id === selectedChat.id && !m.is_read).length;
      if (unreadCount > 0) {
        // Play notification sound and vibrate
        try {
          if ('vibrate' in navigator) navigator.vibrate(200);
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
          }
        } catch(e) {}

        queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
        queryClient.invalidateQueries({ queryKey: ['totalUnread'] });
      }

      finalData.forEach(async (m) => {
        if (m.sender_id === selectedChat.id && !m.is_read) {
          try {
            await updateDoc(doc(db, 'messages', m.id), { is_read: true });
          } catch(e) {}
        }
      });
    };

    const processSnapshot = (snapshot: any) => {
      return snapshot.docs.map((d: any) => {
        const item = d.data();
        let createdAt = new Date().toISOString();
        if (item.created_at && typeof item.created_at.toDate === 'function') {
          createdAt = item.created_at.toDate().toISOString();
        } else if (typeof item.created_at === 'string') {
          createdAt = item.created_at;
        } else if (item.local_created_at) {
          createdAt = item.local_created_at;
        }
        return { id: d.id, ...item, created_at: createdAt } as any;
      });
    };

    const unsub1 = onSnapshot(q1, { includeMetadataChanges: true }, (snapshot) => {
      messages1 = processSnapshot(snapshot);
      handleMessagesUpdate();
    }, (error) => {
      console.error("onSnapshot messages q1 error:", error);
    });

    const unsub2 = onSnapshot(q2, { includeMetadataChanges: true }, (snapshot) => {
      messages2 = processSnapshot(snapshot);
      handleMessagesUpdate();
    }, (error) => {
      console.error("onSnapshot messages q2 error:", error);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [selectedChat?.id, currentUser?.id]);

  const { data: blockData = null } = useQuery({
    queryKey: ['blockStatus', selectedChat?.id],
    queryFn: async () => {
      if (!selectedChat || !currentUser) return null;
      const q1 = query(
        collection(db, 'friendships'),
        where('sender_id', '==', currentUser.id),
        where('receiver_id', '==', selectedChat.id),
        where('status', '==', 'blocked'),
        limit(1)
      );
      const q2 = query(
        collection(db, 'friendships'),
        where('sender_id', '==', selectedChat.id),
        where('receiver_id', '==', currentUser.id),
        where('status', '==', 'blocked'),
        limit(1)
      );
      const snap1 = await getDocs(q1);
      const snap2 = await getDocs(q2);
      if (!snap1.empty) return {id: snap1.docs[0].id, ...snap1.docs[0].data()};
      if (!snap2.empty) return {id: snap2.docs[0].id, ...snap2.docs[0].data()};
      return null;
    },
    enabled: !!selectedChat && !!currentUser,
  });

  const isBlocked = !!blockData;
  const iBlockedThem = (blockData as any)?.sender_id === currentUser?.id;
  const theyBlockedMe = (blockData as any)?.sender_id === selectedChat?.id;

  const { data: isBlockedByMe = false } = useQuery({
    queryKey: ['isBlockedByMe', selectedChat?.id],
    queryFn: async () => {
      if (!selectedChat || !currentUser) return false;
      const q = query(
        collection(db, 'friendships'),
        where('sender_id', '==', currentUser.id),
        where('receiver_id', '==', selectedChat.id),
        where('status', '==', 'blocked'),
        limit(1)
      );
      const snap = await getDocs(q);
      return !snap.empty;
    },
    enabled: !!selectedChat && !!currentUser,
  });

  // Realtime Listeners
  useEffect(() => {
    if (!currentUser) return;

    // Listen to all incoming messages where we are receiver
    const unsubMessages = onSnapshot(
      query(collection(db, 'messages'), where('receiver_id', '==', currentUser.id)),
      () => {
        queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] });
      }
    );

    const unsubFriendships = onSnapshot(
      query(collection(db, 'friendships'), or(where('receiver_id', '==', currentUser.id), where('sender_id', '==', currentUser.id))),
      () => {
        queryClient.invalidateQueries({ queryKey: ['blockStatus'] });
        queryClient.invalidateQueries({ queryKey: ['isBlockedByMe'] });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      }
    );

    return () => {
      unsubMessages();
      unsubFriendships();
    };
  }, [currentUser?.id, queryClient]);

  const handleEmojiClick = (emojiData: any) => {
    handleMessageTextChange(messageText + emojiData.emoji);
  };

  const filteredContacts = contacts.filter((c: any) => {
    const nameStr = c.display_name || '';
    const userStr = c.username || '';
    return nameStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userStr.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Please select a valid image or video file.');
      return;
    }

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

  const handleMediaSave = async (processedUrl: string, isViewOnce: boolean = false) => {
    if (!selectedMedia || !selectedChat) return;
    setShowMediaEditor(false);
    
    const payloadExtra = { JSON_PAYLOAD: true, text: '', is_view_once: isViewOnce, parent_message_id: replyingTo?.id || null };
    const newMessage: any = {
      sender_id: currentUser!.id,
      receiver_id: selectedChat.id,
      content: JSON.stringify(payloadExtra),
      media_url: '', // Will be updated by UploadContext
      media_type: selectedMedia.type,
      created_at: serverTimestamp(),
      local_created_at: new Date().toISOString()
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
    setReplyingTo(null);
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
         throw new Error("MediaDevicesNotSupported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        } 
      });
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/ogg;codecs=opus',
        'audio/webm'
      ];
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType || undefined,
        audioBitsPerSecond: 128000
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType || 'audio/webm' });
        
        let fileExt = 'webm';
        if (selectedMimeType.includes('mp4')) fileExt = 'mp4';
        else if (selectedMimeType.includes('ogg')) fileExt = 'ogg';

        const audioFile = new File([audioBlob], `voice_message.${fileExt}`, { type: selectedMimeType || 'audio/webm' });
        
        setRecordedAudio({
          file: audioFile,
          url: URL.createObjectURL(audioBlob)
        });
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      if (err.message === "MediaDevicesNotSupported") {
         alert("Microphone is not supported in this environment or connection is not secure. Please open the app in a new tab.");
      } else if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
         alert("Microphone access is denied. Please unblock it by clicking the lock icon (🔒) or settings (⚙️) icon next to the browser's address bar, and allow microphone permissions. You may need to refresh the page after changing the setting.");
      } else {
         alert("Could not access microphone: " + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleCancelAudio = () => {
    setRecordedAudio(null);
    setIsVoiceViewOnce(false);
  };

  const handleSendAudio = () => {
    if (!recordedAudio || !selectedChat) return;

    const uploadData = recordedAudio.file;
    const payloadExtra = { JSON_PAYLOAD: true, text: '', is_view_once: isVoiceViewOnce, parent_message_id: replyingTo?.id || null };
    const newMessage: any = {
       sender_id: currentUser!.id,
       receiver_id: selectedChat.id,
       content: JSON.stringify(payloadExtra),
       media_url: '',
       media_type: 'audio',
       created_at: serverTimestamp(),
      local_created_at: new Date().toISOString()
    };
    
    // Add optimistic UI to messages immediately
    const tempId = `temp-${Date.now()}`;
    queryClient.setQueryData(['messages', selectedChat.id], (old: any) => {
      const optimisticMsg = {
        ...newMessage,
        id: tempId,
        created_at: new Date().toISOString(),
        is_read: false,
        content: '',
        media_url: recordedAudio.url,
        is_view_once: payloadExtra.is_view_once,
        parent_message_id: payloadExtra.parent_message_id
      };
      return [...(old || []), optimisticMsg];
    });

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
    
    setReplyingTo(null);
    setRecordedAudio(null);
    setIsVoiceViewOnce(false);
  };

  const handleViewOnce = async (msg: any) => {
    setActiveViewOnceMedia(msg);
  };

  const closeViewOnce = async () => {
    const msg = activeViewOnceMedia;
    setActiveViewOnceMedia(null);
    if (!msg) return;

    // Destroy
    const payloadExtra = { JSON_PAYLOAD: true, text: 'Viewed ' + (msg.media_type || 'media'), is_view_once: false, parent_message_id: msg.parent_message_id };
    try {
        await updateDoc(doc(db, 'messages', msg.id), { media_url: null, content: JSON.stringify(payloadExtra) });
        if (currentUser && selectedChat) {
          const cacheKey = `messages_cache_${[currentUser.id, selectedChat.id].sort().join('_')}`;
          try { await redis.del(cacheKey); } catch (e) {}
        }
        queryClient.invalidateQueries({ queryKey: ['messages', selectedChat?.id] });
    } catch(e) {}
  };

  const handleBlockUser = async () => {
    if (!selectedChat) return;
    
    const q1 = query(collection(db, 'friendships'), where('sender_id', '==', currentUser?.id), where('receiver_id', '==', selectedChat.id), where('status', '==', 'blocked'), limit(1));
    const q2 = query(collection(db, 'friendships'), where('sender_id', '==', selectedChat.id), where('receiver_id', '==', currentUser?.id), where('status', '==', 'blocked'), limit(1));
    
    const snap1 = await getDocs(q1);
    const snap2 = await getDocs(q2);
    
    const existingBlock = !snap1.empty ? snap1.docs[0] : (!snap2.empty ? snap2.docs[0] : null);

    if (existingBlock) {
        if (confirm(`Are you sure you want to unblock ${selectedChat.display_name}?`)) {
            await deleteDoc(doc(db, 'friendships', existingBlock.id));
            queryClient.invalidateQueries({ queryKey: ['blockStatus', selectedChat.id] });
            queryClient.invalidateQueries({ queryKey: ['isBlockedByMe', selectedChat.id] });
        }
    } else {
        if (confirm(`Are you sure you want to block ${selectedChat.display_name}?`)) {
            await addDoc(collection(db, 'friendships'), { 
                sender_id: currentUser?.id, 
                receiver_id: selectedChat.id, 
                status: 'blocked' 
            });
            queryClient.invalidateQueries({ queryKey: ['blockStatus', selectedChat.id] });
            queryClient.invalidateQueries({ queryKey: ['isBlockedByMe', selectedChat.id] });
        }
    }
  };

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'auto' }); }, [messages]);

  useEffect(() => {
    const handleResize = () => {
      scrollRef.current?.scrollIntoView({ behavior: 'auto' });
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [selectedChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedChat || isBlocked) return;
    
    const payloadExtra = { JSON_PAYLOAD: true, text: messageText, is_view_once: false, parent_message_id: replyingTo?.id || null };
    const newMessage: any = {
       sender_id: currentUser!.id,
       receiver_id: selectedChat.id,
       content: JSON.stringify(payloadExtra),
       created_at: serverTimestamp(),
      local_created_at: new Date().toISOString(),
       is_read: false
    };

    // Optimistic UI update
    const tempId = `temp-${Date.now()}`;
    queryClient.setQueryData(['messages', selectedChat.id], (old: any) => {
      const optimisticMsg = {
        ...newMessage,
        id: tempId,
        content: payloadExtra.text,
        is_view_once: payloadExtra.is_view_once,
        parent_message_id: payloadExtra.parent_message_id,
        created_at: new Date().toISOString() // for UI only
      };
      return [...(old || []), optimisticMsg];
    });

    handleMessageTextChange('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    
    try {
      await addDoc(collection(db, 'messages'), newMessage);
      
      // Trigger Push Notification
      try {
        triggerNotification(
          selectedChat.id,
          currentUser?.display_name || 'New Message',
          messageText,
          { type: 'message', sender_id: currentUser?.id }
        );
      } catch (notifErr) {
        console.error('Notification failed:', notifErr);
      }

      const cacheKey = `messages_cache_${[currentUser!.id, selectedChat.id].sort().join('_')}`;
      try { await redis.del(cacheKey); } catch (e) {}
      
      queryClient.invalidateQueries({ queryKey: ['messages', selectedChat.id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', selectedChat.id] });
    } catch(e: any) {
      console.error(e);
      toast.error('Failed to send message: ' + e.message);
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

    try {
        await deleteDoc(doc(db, 'messages', id));
        if (selectedChat && currentUser) {
          const cacheKey = `messages_cache_${[currentUser.id, selectedChat.id].sort().join('_')}`;
          try { await redis.del(cacheKey); } catch (e) {}
          queryClient.invalidateQueries({ queryKey: ['messages', selectedChat.id] });
        }
    } catch(error) {
       console.error(error);
       queryClient.invalidateQueries({ queryKey: ['messages', selectedChat?.id] });
    }
  };

  return (
    <div id="chat-page-container" className="flex flex-1 md:flex-row min-h-0 h-full w-full bg-white dark:bg-black md:rounded-xl shadow-xl border-x-0 md:border border-gray-200 dark:border-gray-800 max-w-[1200px] mx-auto overflow-hidden">
      {/* Contact Sidebar */}
      <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} min-h-0 w-full md:w-[350px] border-r border-gray-100 dark:border-gray-800 flex flex-col bg-gray-50/50 dark:bg-black/50`}>
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
        <div id="inbox-list" className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
          {loadingContacts && contacts.length === 0 ? (
            <div className="flex flex-col gap-2 px-2 pt-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 w-full animate-pulse">
                  <div className="w-14 h-14 bg-gray-200 dark:bg-gray-800 rounded-full flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/5"></div>
                    </div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (showNewFriends ? filteredContacts.filter((c: any) => c.isNewFriend) : filteredContacts.filter((c: any) => !c.isNewFriend)).map((c: any) => {
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
          {showNewFriends && filteredContacts.filter((c: any) => c.isNewFriend).length === 0 && (
            <div className="text-center py-10 text-gray-400 text-xs font-bold uppercase tracking-widest">No new friends to show</div>
          )}
          {!showNewFriends && filteredContacts.filter((c: any) => !c.isNewFriend).length === 0 && (
            <div className="text-center py-10 text-gray-400 text-xs font-bold uppercase tracking-widest">No active chats</div>
          )}
        </div>
      </div>

      {/* Message Area */}
      <div className={`${!selectedChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-white dark:bg-black relative min-h-0`}>
        {selectedChat ? (
          <>
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shadow-sm bg-white dark:bg-black shrink-0 z-10">
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
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['messages', selectedChat?.id] });
                    queryClient.invalidateQueries({ queryKey: ['friendships', currentUser?.id] });
                  }}
                  className="p-2 rounded-full transition-all text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  title="Refresh Chat"
                >
                  <RefreshCw size={20} />
                </button>
                <button 
                  onClick={handleBlockUser} 
                  className={`p-2 rounded-full transition-all ${isBlockedByMe ? 'bg-red-500 text-white shadow-lg' : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500'}`} 
                  title={isBlockedByMe ? "Unblock User" : "Block User"}
                >
                  <Ban size={20} />
                </button>
              </div>
            </div>
            
            <div id="chat-messages" onScroll={handleScroll} className="flex-1 p-3 md:p-6 overflow-y-auto bg-gray-50/30 dark:bg-gray-900/30 flex flex-col gap-3 min-h-0 transition-all duration-300" style={{ paddingBottom: inputOffset > 0 ? `${inputOffset + 24}px` : '1.5rem' }}>
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

                  {(messages.length > visibleLimit ? messages.slice(messages.length - visibleLimit) : messages).map((msg: any) => {
                    const parentMsg = msg.parent_message_id ? messages.find((m: any) => m.id === msg.parent_message_id) : null;
                    return (
                    <motion.div 
                      key={msg.id} 
                      className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'} group relative animate-in fade-in slide-in-from-bottom-2 duration-300 w-full`}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={{ left: 0, right: 0.5 }}
                      onDragEnd={(e, info) => {
                        if (info.offset.x > 50) {
                          setReplyingTo(msg);
                        }
                      }}
                    >
                      {msg.sender_id === currentUser?.id && (
                        <button onClick={() => triggerDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 mr-2 self-center text-red-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                      )}
                      
                      <div className={`p-3.5 rounded-2xl max-w-[75%] shadow-sm text-[15px] font-medium leading-relaxed ${msg.sender_id === currentUser?.id ? 'bg-[#1877F2] text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'}`}>
                        {parentMsg && (
                          <div className={`mb-2 p-2 rounded-xl text-xs opacity-80 border-l-4 ${msg.sender_id === currentUser?.id ? 'bg-white/20 border-white/50 text-white' : 'bg-gray-100 dark:bg-gray-700 border-[#1877F2] text-gray-800 dark:text-gray-300'}`}>
                            <p className="font-bold mb-0.5">{parentMsg.sender_id === currentUser?.id ? 'You' : selectedChat.display_name}</p>
                            <p className="line-clamp-1">{parentMsg.content || (parentMsg.media_url ? 'Media' : '')}</p>
                          </div>
                        )}
                        {msg.is_view_once && msg.media_url && msg.sender_id !== currentUser?.id ? (
                          <button onClick={() => handleViewOnce(msg)} className="flex items-center gap-2 px-4 py-2 bg-black/10 dark:bg-black/30 rounded-xl hover:bg-black/20 dark:hover:bg-black/50 transition-colors">
                            {msg.media_type === 'audio' ? <Mic size={20} /> : <Eye size={20} />}
                            <span className="font-bold text-sm">View Once</span>
                          </button>
                        ) : msg.media_url ? (
                          <div className={`mb-2 rounded-lg overflow-hidden relative ${msg.media_type === 'audio' ? 'bg-transparent overflow-visible' : 'bg-black/5 dark:bg-white/5'}`}>
                            {msg.is_view_once && (
                              <div className={`absolute shadow-sm bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full z-10 flex items-center gap-1 font-bold ${msg.media_type === 'audio' ? '-top-3 -right-2' : 'top-2 right-2'}`}>
                                <Eye size={10} /> 1
                              </div>
                            )}
                            {msg.media_type === 'image' ? (
                              <ZoomableImage src={msg.media_url} className="max-w-full h-auto rounded-lg" referrerPolicy="no-referrer" />
                            ) : msg.media_type === 'audio' ? (
                              <CustomAudioPlayer src={msg.media_url} isSender={msg.sender_id === currentUser?.id} />
                            ) : (
                              <VideoPlayer src={msg.media_url} className="max-w-full h-auto rounded-lg" />
                            )}
                          </div>
                        ) : null}
                        {msg.content && <span>{msg.content}</span>}
                        <div className={`flex items-center justify-end gap-1 mt-1 ${msg.sender_id === currentUser?.id ? 'text-blue-200' : 'text-gray-400'}`}>
                          <p className="text-[10px] text-right opacity-80">
                             {formatTime(msg.created_at)}
                          </p>
                          {msg.sender_id === currentUser?.id && (
                            msg.id?.toString().startsWith('temp-') ? (
                              <Check size={12} className="opacity-50 animate-pulse" />
                            ) : (
                              <CheckCheck size={12} className={msg.is_read ? "text-red-500" : "text-blue-200 opacity-60"} />
                            )
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )})}
                  {otherUserTyping && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="flex justify-start mb-4"
                    >
                      <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-1">
                         <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                         <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                         <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </motion.div>
                  )}
                  <div ref={scrollRef} />
                </>
              )}
            </div>
            
            <div className="relative">
              {replyingTo && (
                <div className="absolute bottom-full left-0 right-0 bg-white/90 dark:bg-black/90 backdrop-blur border-t border-gray-100 dark:border-gray-800 p-3 px-5 flex items-center justify-between z-20 slide-in-from-bottom-2 animate-in duration-200">
                  <div className="border-l-4 border-[#1877F2] pl-3 flex-1">
                    <p className="text-xs font-bold text-[#1877F2]">Replying to {replyingTo.sender_id === currentUser?.id ? 'Yourself' : selectedChat.display_name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">{replyingTo.content || 'Media message'}</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500">
                    <X size={20} />
                  </button>
                </div>
              )}
              <form 
                onSubmit={handleSendMessage} 
                className="p-3 md:p-5 bg-white dark:bg-black border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 md:gap-3 relative z-30 shrink-0 select-none"
                style={{ 
                  transform: inputOffset > 0 ? `translateY(-${inputOffset}px)` : 'none', 
                  transition: isDraggingInput ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  touchAction: isDraggingInput ? 'none' : 'auto'
                }}
              >
                {inputOffset > 0 && (
                  <div 
                    className="absolute -top-6 left-0 right-0 h-8 flex items-center justify-center cursor-ns-resize"
                    onMouseDown={handleInputTouchStart}
                    onTouchStart={handleInputTouchStart}
                  >
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full shadow-sm"></div>
                  </div>
                )}
                {!recordedAudio && (
                  <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} accept="*/*" />
                )}
                
                {!recordedAudio && (
                  <button 
                    type="button" 
                    disabled={isBlocked || isRecording} 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 md:p-2.5 text-[#1877F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all disabled:opacity-50 shrink-0"
                  >
                    <Paperclip size={22} />
                  </button>
                )}
                
                {recordedAudio ? (
                  <div className="flex-1 bg-blue-50 dark:bg-blue-900/10 rounded-2xl flex items-center pl-1 pr-4 py-1.5 border border-blue-200 dark:border-blue-800/50 justify-between gap-3">
                    <CustomAudioPlayer src={recordedAudio.url} isSender={false} />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCancelAudio}
                        className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsVoiceViewOnce(!isVoiceViewOnce)}
                        className={`p-1.5 rounded-full transition-colors ${isVoiceViewOnce ? 'bg-[#1877F2] text-white' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                        title="View Once"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </div>
                ) : isRecording ? (
                  <div className="flex-1 bg-red-50 dark:bg-red-900/10 rounded-2xl flex items-center px-4 py-2.5 border border-red-200 dark:border-red-800/50 justify-between">
                    <div className="flex items-center gap-2 text-red-500 animate-pulse">
                      <Mic size={20} />
                      <span className="font-bold">Recording...</span>
                    </div>
                    <span className="text-red-500 font-mono font-bold">
                      {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                ) : (
                  <div className="flex-1 bg-[#f0f2f5] dark:bg-gray-900 rounded-2xl flex items-center px-4 py-2.5 border border-transparent focus-within:border-blue-300 transition-all relative">
                    <input 
                      ref={inputRef}
                      value={messageText} 
                      onChange={e => handleMessageTextChange(e.target.value)} 
                      onFocus={() => {
                        setIsInputFocused(true);
                        setTimeout(() => {
                          scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        }, 300);
                      }}
                      onBlur={() => setIsInputFocused(false)}
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
                )}
                
                {recordedAudio ? (
                  <button type="button" onClick={handleSendAudio} disabled={isBlocked} className="bg-[#1877F2] text-white p-2 md:p-2.5 rounded-full shadow-md hover:brightness-110 disabled:opacity-30 transition-all shrink-0">
                    <Send size={24} />
                  </button>
                ) : messageText.trim() ? (
                  <button type="submit" disabled={isBlocked} className="bg-[#1877F2] text-white p-2 md:p-2.5 rounded-full shadow-md hover:brightness-110 disabled:opacity-30 transition-all shrink-0"><Send size={24} /></button>
                ) : (
                  <button 
                    type="button" 
                    disabled={isBlocked} 
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-2.5 rounded-full shadow-md transition-all shrink-0 select-none ${isRecording ? 'bg-red-500 text-white hover:brightness-110 scale-110 animate-pulse' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-[#1877F2] dark:hover:text-blue-400 disabled:opacity-30'}`}
                  >
                    {isRecording ? <div className="w-6 h-6 rounded-sm bg-white" /> : <Mic size={24} />}
                  </button>
                )}
              </form>
            </div>
            
            {activeViewOnceMedia && (
              <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
                <button 
                  onClick={closeViewOnce}
                  className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                  <X size={24} />
                </button>
                <div className="max-w-4xl w-full max-h-[80vh] flex flex-col items-center justify-center relative">
                   <div className="absolute top-4 left-4 bg-black/50 px-3 py-1.5 rounded-full text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md">
                     <Eye size={14} /> View Once Mode
                   </div>
                   {activeViewOnceMedia.media_type === 'image' ? (
                     <img src={activeViewOnceMedia.media_url} className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
                   ) : activeViewOnceMedia.media_type === 'audio' ? (
                     <div className="bg-white/10 p-8 rounded-3xl w-full max-w-md">
                        <CustomAudioPlayer src={activeViewOnceMedia.media_url} isSender={false} />
                     </div>
                   ) : (
                     <VideoPlayer src={activeViewOnceMedia.media_url} className="max-w-full max-h-[80vh] rounded-xl shadow-2xl" />
                   )}
                </div>
                <p className="text-gray-400 mt-6 font-bold text-sm bg-white/5 px-4 py-2 rounded-full backdrop-blur-sm">This media will be destroyed when you close this window.</p>
              </div>
            )}
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
