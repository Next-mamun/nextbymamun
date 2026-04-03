
import React, { useState, useEffect, createContext, useContext, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import NextoRobot from '@/components/NextoRobot';
import { UserProfile as User } from '@/types';
import { supabase } from '@/lib/supabase';
import { useWakeLock } from '@/hooks/useWakeLock';
import { requestNotificationPermission } from '@/services/notificationService';
import { toast } from 'sonner';

// Handle dynamic import errors
window.addEventListener('error', (e) => {
  if (e.message && e.message.includes('Failed to fetch dynamically imported module')) {
    window.location.reload();
  }
});

// Cleanup huge base64 posts that crash the feed
const cleanupHugePosts = async () => {
  try {
    const { error } = await supabase
      .from('posts')
      .delete()
      .like('media_url', 'data:%');
    if (error) console.error('Cleanup error:', error);
    else console.log('Cleaned up base64 posts');
  } catch (e) {
    console.error(e);
  }
};
cleanupHugePosts();

// Lazy load pages for better performance
const Feed = lazy(() => import('@/pages/Feed'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Messages = lazy(() => import('@/pages/Messages'));
const Friends = lazy(() => import('@/pages/Friends'));
const Profile = lazy(() => import('@/pages/Profile'));
const Settings = lazy(() => import('@/pages/Settings'));
const CreatePost = lazy(() => import('@/pages/CreatePost'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Reels = lazy(() => import('@/pages/Reels'));

import { AuthContext, AuthContextType, ThemeContext, ThemeContextType, useAuth, useTheme } from '@/contexts/AuthContext';

const AppLayout: React.FC = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const isMessages = location.pathname.startsWith('/messages');

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#000000] flex flex-col transition-colors duration-300">
      <div className={`flex flex-1 pb-16 max-w-[1920px] mx-auto w-full ${currentUser ? 'pt-14' : ''}`}>
        {currentUser && !isMessages && <Navbar />}
        {currentUser && <div className="hidden md:block"><Sidebar /></div>}
        <main className={`flex-1 overflow-y-auto ${currentUser ? 'p-0 md:p-4' : ''}`}>
          <Suspense fallback={
            <div className="h-full flex items-center justify-center">
              <div className="fast-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1877F2]"></div>
            </div>
          }>
            <Routes>
              <Route path="/" element={currentUser ? <Feed /> : <Navigate to="/login" />} />
              <Route path="/login" element={!currentUser ? <Login /> : <Navigate to="/" />} />
              <Route path="/register" element={!currentUser ? <Register /> : <Navigate to="/" />} />
              <Route path="/messages" element={currentUser ? <Messages /> : <Navigate to="/login" />} />
              <Route path="/friends" element={currentUser ? <Friends /> : <Navigate to="/login" />} />
              <Route path="/notifications" element={currentUser ? <Notifications /> : <Navigate to="/login" />} />
              <Route path="/profile/:username" element={currentUser ? <Profile /> : <Navigate to="/login" />} />
              <Route path="/settings" element={currentUser ? <Settings /> : <Navigate to="/login" />} />
              <Route path="/create-post" element={currentUser ? <CreatePost /> : <Navigate to="/login" />} />
              <Route path="/reels" element={currentUser ? <Reels /> : <Navigate to="/login" />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      {currentUser && <div className="z-[100] relative"><BottomNav /></div>}
    </div>
  );
};

const App: React.FC = () => {
  useWakeLock();
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('next_media_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('next_media_theme') === 'dark';
  });

  const [desktopMode, setDesktopMode] = useState(() => {
    return localStorage.getItem('next_media_desktop') === 'true';
  });

  const [nextoEnabled, setNextoEnabled] = useState(() => {
    const saved = localStorage.getItem('next_media_nexto');
    return saved === null ? true : saved === 'true';
  });

  const [robotSize, setRobotSizeState] = useState(() => {
    const saved = localStorage.getItem('next_media_robot_size');
    return saved ? parseInt(saved, 10) : 80;
  });

  const setRobotSize = (size: number) => {
    setRobotSizeState(size);
    localStorage.setItem('next_media_robot_size', String(size));
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('next_media_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('next_media_theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    
    if (desktopMode) {
      viewportMeta.setAttribute('content', 'width=1024');
      localStorage.setItem('next_media_desktop', 'true');
    } else {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      localStorage.setItem('next_media_desktop', 'false');
    }
  }, [desktopMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);
  const toggleDesktopMode = () => setDesktopMode(!desktopMode);
  const toggleNexto = () => {
    const newVal = !nextoEnabled;
    setNextoEnabled(newVal);
    localStorage.setItem('next_media_nexto', String(newVal));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('next_media_user');
    setCurrentUser(null);
  };

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('next_media_user', JSON.stringify(currentUser));
      requestNotificationPermission();

      // Global Real-time Listeners for Notifications
      const messageSub = supabase.channel('global_notifications')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`
        }, async (payload) => {
          // Invalidate unread counts globally
          const queryClient = (window as any).queryClient;
          if (queryClient) {
            queryClient.invalidateQueries({ queryKey: ['totalUnread'] });
            queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] });
          }

          // Don't show notification if already in messages with this sender
          const isAtMessages = window.location.pathname.startsWith('/messages');
          if (isAtMessages || payload.eventType !== 'INSERT') return;

          // Fetch sender info for better notification
          const { data: sender } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', payload.new.sender_id)
            .single();
          
          toast(`New message from ${sender?.display_name || 'Someone'}`, {
            description: payload.new.content,
            id: 'message-' + payload.new.sender_id
          });
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`
        }, async (payload) => {
          const queryClient = (window as any).queryClient;
          if (queryClient) {
            queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] });
          }

          // Fetch sender info
          const { data: sender } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', payload.new.sender_id)
            .single();

          let title = 'New Notification';
          let body = '';

          switch (payload.new.type) {
            case 'like':
              title = `${sender?.display_name || 'Someone'} liked your post`;
              break;
            case 'comment':
              title = `${sender?.display_name || 'Someone'} commented on your post`;
              break;
            case 'friend_request':
              title = `New friend request from ${sender?.display_name || 'Someone'}`;
              break;
            case 'friend_accept':
              title = `${sender?.display_name || 'Someone'} accepted your friend request`;
              break;
            case 'mention':
              title = `${sender?.display_name || 'Someone'} mentioned you`;
              break;
          }

          toast(title, {
            description: body,
            id: 'notif-' + payload.new.id
          });
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        }, async (payload) => {
          const content = payload.new.content || '';
          const mentionPattern = new RegExp(`@${currentUser.username}\\b`, 'i');
          
          if (mentionPattern.test(content)) {
            const { data: author } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', payload.new.user_id)
              .single();

            toast(`${author?.display_name || 'Someone'} mentioned you`, {
              description: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
              id: 'mention-' + payload.new.id
            });
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(messageSub);
      };
    }
  }, [currentUser]);

  useEffect(() => {
    // Check active session
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        const saved = localStorage.getItem('next_media_user');
        if (saved) {
          setCurrentUser(JSON.parse(saved));
        } else {
          setCurrentUser(null);
        }
        setLoadingAuth(false);
      }
    };

    fetchSession();

    // Listen for auth changes (like OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
            window.close();
            return;
          }
          fetchUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          localStorage.removeItem('next_media_user');
        }
      }
    );

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          fetchUserProfile(session.user.id);
        }
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      // Poll for the profile since the database trigger might take a few milliseconds
      let data = null;
      let error = null;
      let attempts = 0;
      
      while (attempts < 3) {
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
          
        data = result.data;
        error = result.error;
        
        if (data) break;
        
        // Wait 100ms before retrying
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
        
      if (data) {
        setCurrentUser(data);
        localStorage.setItem('next_media_user', JSON.stringify(data));
      } else if (error) {
        console.error("Error fetching profile:", error);
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    } finally {
      setLoadingAuth(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#000000] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="fast-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1877F2]"></div>
          <p className="text-gray-500 dark:text-gray-400 font-bold animate-pulse">Loading Next...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, logout }}>
      <ThemeContext.Provider value={{ 
        darkMode, toggleDarkMode, 
        desktopMode, toggleDesktopMode, 
        nextoEnabled, toggleNexto,
        robotSize, setRobotSize
      }}>
        <BrowserRouter>
          <AppLayout />
          {nextoEnabled && <NextoRobot />}
        </BrowserRouter>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
};

export default App;
