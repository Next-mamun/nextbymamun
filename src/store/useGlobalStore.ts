import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idbStorage';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, getDoc, doc, startAfter } from 'firebase/firestore';
import { toast } from 'sonner';
import { getActiveDB, switchDB } from '@/lib/dbHelper';
import { supabase } from '@/lib/supabase';

interface Post {
  id: string;
  [key: string]: any;
}

interface Message {
  id: string;
  [key: string]: any;
}

interface Notification {
  id: string;
  [key: string]: any;
}

interface GlobalState {
  currentUser: any | null;
  feedPosts: Post[];
  notifications: Notification[];
  messages: Message[];
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  lastFeedFetch: number | null;
  postsLoading: boolean;
  postsError: any;
  hasMorePosts: boolean;
  
  setCurrentUser: (user: any) => void;
  setFeedPosts: (posts: Post[]) => void;
  addPostOptimistic: (post: Post) => void;
  updatePostOptimistic: (id: string, updates: Partial<Post>) => void;
  initMessageListener: (userId: string) => () => void;
  initNotificationListener: (userId: string) => () => void;
  fetchHomeFeed: (loadMore?: boolean, forceRefresh?: boolean) => Promise<void>;
  clearStore: () => void;
}

let messageUnsub: (() => void) | null = null;
let notifUnsub: (() => void) | null = null;
let initialMessageLoad = true;

export const useGlobalStore = create<GlobalState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      feedPosts: [],
      notifications: [],
      messages: [],
      unreadMessagesCount: 0,
      unreadNotificationsCount: 0,
      lastFeedFetch: null,
      postsLoading: false,
      postsError: null,
      hasMorePosts: true,

      setCurrentUser: (user) => set({ currentUser: user }),

      setFeedPosts: (posts) => set({ feedPosts: posts, lastFeedFetch: Date.now() }),
      
      addPostOptimistic: (post) => set((state) => ({ 
        feedPosts: [post, ...state.feedPosts] 
      })),

      updatePostOptimistic: (id, updates) => set((state) => ({
        feedPosts: state.feedPosts.map(p => p.id === id ? { ...p, ...updates } : p)
      })),

      fetchHomeFeed: async (loadMore = false, forceRefresh = false) => {
        const { lastFeedFetch, feedPosts } = get();
        // If we have posts and fetched within last 5 minutes, do not refetch unless forced
        if (!loadMore && !forceRefresh && feedPosts.length > 0 && lastFeedFetch && Date.now() - lastFeedFetch < 5 * 60 * 1000) {
          return;
        }

        try {
          set({ postsLoading: true, postsError: null });
          const activeDB = getActiveDB();
          let fetchedDocs: any[] = [];
          
          const profileCache = new Map();
          const getProfile = async (userId: string) => {
             if (!userId) return null;
             if (profileCache.has(userId)) return profileCache.get(userId);
             try {
               const userDoc = await getDoc(doc(db, 'profiles', userId));
               const data = userDoc.exists() ? userDoc.data() : null;
               profileCache.set(userId, data);
               return data;
             } catch (e) {
               return { display_name: 'Unknown User' };
             }
          };

          const fetchFromFirebase = async () => {
             let q = query(collection(db, 'posts'), orderBy('created_at', 'desc'), limit(10));
             if (loadMore && feedPosts.length > 0) {
               const lastPost = feedPosts[feedPosts.length - 1];
               if (lastPost.created_at) {
                 q = query(collection(db, 'posts'), orderBy('created_at', 'desc'), limit(10), startAfter(lastPost.created_at));
               }
             }
             const snap = await getDocs(q);
             fetchedDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          };

          const fetchFromSupabase = async () => {
             let supaQuery = supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(10);
             if (loadMore && feedPosts.length > 0) {
                const lastPost = feedPosts[feedPosts.length - 1];
                let dateVal = new Date().toISOString();
                if (lastPost.created_at) {
                   dateVal = typeof lastPost.created_at === 'string' ? lastPost.created_at : 
                     (lastPost.created_at.toDate ? lastPost.created_at.toDate().toISOString() : dateVal);
                }
                supaQuery = supaQuery.lt('created_at', dateVal);
             }
             const { data, error } = await supaQuery;
             if (error) throw error;
             if (data) fetchedDocs = data;
          };

          try {
            if (activeDB === 'firebase') {
              try {
                await fetchFromFirebase();
              } catch (err) {
                console.warn("Firebase fetch failed, switching DB:", err);
                switchDB('firebase');
                await fetchFromSupabase();
              }
            } else {
              try {
                await fetchFromSupabase();
              } catch (err) {
                console.warn("Supabase fetch failed, switching DB:", err);
                switchDB('supabase');
                await fetchFromFirebase();
              }
            }
          } catch (err) {
             console.error("Both databases failed.", err);
             throw err;
          }

          if (fetchedDocs.length === 0 && loadMore) {
             set({ hasMorePosts: false, postsLoading: false });
             return;
          }

          const populatedPosts = await Promise.all(fetchedDocs.map(async (data) => {
            const profiles = await getProfile(data.user_id);
            return { ...data, profiles, comments: [], likes: [] };
          })) as Post[];
          
          set((state) => ({ 
            feedPosts: loadMore ? [...state.feedPosts, ...populatedPosts] : populatedPosts, 
            lastFeedFetch: Date.now(),
            hasMorePosts: populatedPosts.length === 10,
            postsLoading: false
          }));
        } catch (error: any) {
          console.error("Error fetching home feed:", error);
          set({ postsLoading: false, postsError: error });
        }
      },

      initMessageListener: (userId: string) => {
        if (messageUnsub) return messageUnsub;
        initialMessageLoad = true;
        
        const qMessages = query(
          collection(db, 'messages'), 
          where('receiver_id', '==', userId),
          orderBy('created_at', 'desc')
        );

        messageUnsub = onSnapshot(qMessages, (snapshot) => {
          const msgs = snapshot.docs.map(document => ({ id: document.id, ...document.data() })) as Message[];
          const unread = msgs.filter(m => m.is_read === false).length;
          set({ messages: msgs, unreadMessagesCount: unread });

          // Handle new message notifications
          if (!initialMessageLoad) {
            snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added') {
                const data = change.doc.data();
                if (data.deleted_for_everyone || (data.deleted_for || []).includes(userId)) return;
                
                const isAtMessages = window.location.pathname.startsWith('/messages');
                if (isAtMessages) return;
                
                const senderDoc = await getDoc(doc(db, 'profiles', data.sender_id));
                const sender = senderDoc.data();
                
                let messageContent = data.content;
                if (typeof data.content === 'string') {
                  if (data.content.includes('"JSON_PAYLOAD"')) {
                    try {
                      const obj = JSON.parse(data.content);
                      messageContent = obj.text || (data.media_url ? 'Sent an attachment' : 'New message');
                    } catch(e) {}
                  } else if (data.content.startsWith('{')) {
                    try {
                      const obj = JSON.parse(data.content);
                      if (obj.text) messageContent = obj.text;
                    } catch(e) {}
                  }
                }

                const isMuted = localStorage.getItem(`muted_${data.sender_id}`) === 'true';

                if (localStorage.getItem('next_media_sound') === 'true' && !isMuted) {
                  try {
                    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                    const ctx = new AudioContext();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(800, ctx.currentTime);
                    gain.gain.setValueAtTime(0.1, ctx.currentTime);
                    osc.start();
                    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.3);
                    osc.stop(ctx.currentTime + 0.3);
                  } catch(e) { console.warn('Audio play blocked', e); }
                }

                if (!isMuted) {
                  toast(`New message from ${sender?.display_name || 'Someone'}`, {
                    description: messageContent,
                    id: 'message-' + data.sender_id
                  });
                }
              }
            });
          }
          initialMessageLoad = false;
        });

        return messageUnsub;
      },

      initNotificationListener: (userId: string) => {
        if (notifUnsub) return notifUnsub;

        const qNotifs = query(
          collection(db, 'notifications'),
          where('user_id', '==', userId),
          orderBy('created_at', 'desc')
        );

        notifUnsub = onSnapshot(qNotifs, (snapshot) => {
          const notifs = snapshot.docs.map(document => ({ id: document.id, ...document.data() })) as Notification[];
          const unread = notifs.filter(n => n.is_read === false).length;
          set({ notifications: notifs, unreadNotificationsCount: unread });
        });

        return notifUnsub;
      },

      clearStore: () => {
        if (messageUnsub) messageUnsub();
        if (notifUnsub) notifUnsub();
        messageUnsub = null;
        notifUnsub = null;
        set({
          currentUser: null,
          feedPosts: [],
          notifications: [],
          messages: [],
          unreadMessagesCount: 0,
          unreadNotificationsCount: 0,
          lastFeedFetch: null
        });
      }
    }),
    {
      name: 'next_media_global_store',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ 
        currentUser: state.currentUser, 
        feedPosts: state.feedPosts, 
        lastFeedFetch: state.lastFeedFetch,
        messages: state.messages,
        notifications: state.notifications,
        unreadMessagesCount: state.unreadMessagesCount,
        unreadNotificationsCount: state.unreadNotificationsCount
      }),
    }
  )
);
