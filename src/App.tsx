
import React, { useState, useEffect, createContext, useContext, Suspense, lazy, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import NextoRobot from '@/components/NextoRobot';
import { UserProfile as User } from '@/types';
import { auth, db } from '@/lib/firebase';
import { generateBio } from '@/services/geminiService';
import { onAuthStateChanged, signOut, getRedirectResult } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { useWakeLock } from '@/hooks/useWakeLock';
import { requestNotificationPermission } from '@/services/notificationService';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

// Handle dynamic import errors
window.addEventListener('error', (e) => {
  if (e.message && e.message.includes('Failed to fetch dynamically imported module')) {
    if (!sessionStorage.getItem('reloaded-for-chunk')) {
      sessionStorage.setItem('reloaded-for-chunk', 'true');
      window.location.reload();
    }
  }
});

// Primary pages imported directly for instant loading
import Feed from '@/pages/Feed';
import Messages from '@/pages/Messages';
import Friends from '@/pages/Friends';
import Profile from '@/pages/Profile';
import Notifications from '@/pages/Notifications';
import Reels from '@/pages/Reels';
import CreatePost from '@/pages/CreatePost';
import Lab from '@/pages/Lab';

// Less common pages can remain lazy
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Settings = lazy(() => import('@/pages/Settings'));

import { AuthContext, AuthContextType, ThemeContext, ThemeContextType, useAuth, useTheme } from '@/contexts/AuthContext';

const AppLayout: React.FC = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMessages = location.pathname.startsWith('/messages');

  const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<string | number>('100dvh');

  useEffect(() => {
    const initialHeight = window.innerHeight;
    
    const handleResize = () => {
      let keyboardOpen = false;
      
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      } else {
        setViewportHeight(window.innerHeight);
      }
      
      // Check window shrink (Android)
      if (window.innerHeight < initialHeight * 0.8) {
        keyboardOpen = true;
      }
      
      // Check visual viewport (iOS)
      if (window.visualViewport) {
        const offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.pageTop);
        if (offset > 50) {
          keyboardOpen = true;
        }
      }
      
      setIsKeyboardOpen(keyboardOpen);
    };
    
    handleResize();
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const queryClient = useQueryClient();
  const mainRef = useRef<HTMLElement>(null);
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    // DO NOT prevent default here or scrolling will break
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || isRefreshing) return;
    
    // For messages page, only allow pull-to-refresh if we are in the chat list (inbox)
    // and not currently scrolling down inside a scrollable container.
    // To be safe, let's just check if any ancestor has scrollTop > 0.
    let target = e.target as HTMLElement | null;
    let hasScrolledParent = false;
    while (target && target !== document.body) {
      if (target.scrollTop > 0) {
        hasScrolledParent = true;
        break;
      }
      target = target.parentElement;
    }

    if (hasScrolledParent) return;

    // For non-messages pages, also check mainEl
    const mainEl = mainRef.current;
    if (!isMessages && (!mainEl || mainEl.scrollTop > 0)) return;

    const currentY = e.touches[0].clientY;
    const distanceY = currentY - touchStart.y;
    
    // If pulling down
    if (distanceY > 0) {
      const progress = Math.min(distanceY / 150, 1);
      setPullProgress(progress);
    } else {
      setPullProgress(0);
    }
  };

  const onTouchEnd = async (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = Math.abs(touchStart.y - touchEnd.y);

    // Pull to refresh trigger
    if (pullProgress > 0.8 && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await queryClient.refetchQueries();
      } finally {
        setIsRefreshing(false);
        setPullProgress(0);
      }
    } else {
      setPullProgress(0);
    }

    // Swipe sensitivity thresholds - stricter to avoid accidental swipes when scrolling down
    const isHorizontalSwipe = Math.abs(distanceX) > 120 && distanceY < 40;
    
    if (isHorizontalSwipe) {
      handleSwipe(distanceX > 0 ? 'left' : 'right');
    }
    setTouchStart(null);
  };

  // The order of swipeable tabs
  const tabs = ['/', '/friends', '/reels', '/notifications', '/messages'];

  const handleSwipe = (direction: 'left' | 'right') => {
     // Ignore swipe navigation inside messages completely to avoid conflicts with message touch functionality
     const currentPath = location.pathname;
     if (currentPath.startsWith('/messages')) return;

     let currentIndex = tabs.findIndex(tab => currentPath === tab || (tab !== '/' && currentPath.startsWith(tab)));
     
     if (currentIndex === -1) {
       if (currentPath === '/') currentIndex = 0;
       else return;
     }

     if (direction === 'left' && currentIndex < tabs.length - 1) { // Swipe Left -> Next Tab
        navigate(tabs[currentIndex + 1]);
     } else if (direction === 'right' && currentIndex > 0) { // Swipe Right -> Prev Tab
        navigate(tabs[currentIndex - 1]);
     }
  };

  return (
    <div 
      className="w-full bg-[#f0f2f5] dark:bg-[#000000] flex flex-col transition-colors duration-300 overflow-hidden" 
      style={{ height: typeof viewportHeight === 'number' ? `${viewportHeight}px` : viewportHeight, paddingBottom: '0px' }}
    >
      <div 
        className="flex w-full h-full max-w-[1920px] mx-auto overflow-hidden relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {currentUser && <Navbar />}
        {currentUser && <div className="hidden md:block xl:min-w-[300px] shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto"><Sidebar /></div>}
        <main 
          ref={mainRef}
          className={`w-full flex-1 flex flex-col min-w-0 pt-14 ${isMessages ? (isKeyboardOpen ? 'pb-0' : 'pb-[60px]') : (isKeyboardOpen ? 'pb-0' : 'pb-[60px]')} md:pb-0 ${isMessages ? 'overflow-hidden bg-white dark:bg-black' : 'overflow-x-hidden overflow-y-auto px-0 md:p-4'} relative`}
        >
          {/* Pull to Refresh Indicator */}
          {(pullProgress > 0 || isRefreshing) && (
            <div 
              className="absolute top-14 left-0 w-full flex justify-center z-50 pointer-events-none transition-transform"
              style={{ transform: `translateY(${Math.min(pullProgress * 50, 50)}px)` }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-full shadow-md p-2 flex items-center justify-center">
                {isRefreshing ? (
                   <Loader2 className="w-6 h-6 text-[#1877F2] animate-spin" />
                ) : (
                   <div 
                     className="w-6 h-6 border-2 border-[#1877F2] border-t-transparent rounded-full" 
                     style={{ transform: `rotate(${pullProgress * 360}deg)` }}
                   />
                )}
              </div>
            </div>
          )}

          <div className="flex-1 w-full flex flex-col min-h-0">
          <Suspense fallback={
            <div className="h-full flex items-center justify-center min-h-[50vh]">
              <div className="fast-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1877F2]"></div>
            </div>
          }>
            <Routes>
              <Route path="/" element={currentUser ? <Feed /> : <Navigate to="/login" />} />
              <Route path="/post/:id" element={<Feed />} />
              <Route path="/login" element={!currentUser ? <Login /> : <Navigate to="/" />} />
              <Route path="/register" element={!currentUser ? <Register /> : <Navigate to="/" />} />
              <Route path="/messages" element={currentUser ? <Messages /> : <Navigate to="/login" />} />
              <Route path="/friends" element={currentUser ? <Friends /> : <Navigate to="/login" />} />
              <Route path="/notifications" element={currentUser ? <Notifications /> : <Navigate to="/login" />} />
              <Route path="/profile/:username" element={currentUser ? <Profile /> : <Navigate to="/login" />} />
              <Route path="/settings" element={currentUser ? <Settings /> : <Navigate to="/login" />} />
              <Route path="/create-post" element={currentUser ? <CreatePost /> : <Navigate to="/login" />} />
              <Route path="/reels" element={currentUser ? <Reels /> : <Navigate to="/login" />} />
              <Route path="/reels/:id" element={<Reels />} />
              <Route path="/lab" element={currentUser ? <Lab /> : <Navigate to="/login" />} />
            </Routes>
          </Suspense>
          </div>
        </main>
      </div>
      {currentUser && !isKeyboardOpen && (
        <div className="z-[100] relative bottom-nav-container">
          <BottomNav />
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  useWakeLock();
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('next_media_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loadingAuth, setLoadingAuth] = useState(() => {
    return localStorage.getItem('next_media_user') ? false : true;
  });

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

  const [bottomBarSize, setBottomBarSizeState] = useState<'small'|'medium'|'large'>(() => {
    return (localStorage.getItem('next_media_bottombarsize') as 'small'|'medium'|'large') || 'medium';
  });
  const setBottomBarSize = (size: 'small'|'medium'|'large') => {
    setBottomBarSizeState(size);
    localStorage.setItem('next_media_bottombarsize', size);
  };

  const [iconColor, setIconColorState] = useState(() => {
    return localStorage.getItem('next_media_iconcolor') || '#1877F2';
  });
  const setIconColor = (color: string) => {
    setIconColorState(color);
    localStorage.setItem('next_media_iconcolor', color);
  };

  const [autoplayVideos, setAutoplayVideosState] = useState(() => {
    const saved = localStorage.getItem('next_media_autoplay');
    return saved === null ? true : saved === 'true';
  });
  const setAutoplayVideos = (val: boolean) => {
    setAutoplayVideosState(val);
    localStorage.setItem('next_media_autoplay', String(val));
  };

  const [saveDataMode, setSaveDataModeState] = useState(() => {
    const saved = localStorage.getItem('next_media_savedata');
    return saved === 'true';
  });
  const setSaveDataMode = (val: boolean) => {
    setSaveDataModeState(val);
    localStorage.setItem('next_media_savedata', String(val));
  };

  const [highContrastMode, setHighContrastModeState] = useState(() => {
    const saved = localStorage.getItem('next_media_highcontrast');
    return saved === 'true';
  });
  const setHighContrastMode = (val: boolean) => {
    setHighContrastModeState(val);
    localStorage.setItem('next_media_highcontrast', String(val));
  };

  const [hapticFeedback, setHapticFeedbackState] = useState(() => {
    const saved = localStorage.getItem('next_media_haptic');
    return saved === null ? true : saved === 'true';
  });
  const setHapticFeedback = (val: boolean) => {
    setHapticFeedbackState(val);
    localStorage.setItem('next_media_haptic', String(val));
  };

  const [animationsEnabled, setAnimationsEnabledState] = useState(() => {
    const saved = localStorage.getItem('next_media_animations');
    return saved === null ? true : saved === 'true';
  });
  const setAnimationsEnabled = (val: boolean) => {
    setAnimationsEnabledState(val);
    localStorage.setItem('next_media_animations', String(val));
  };

  const [incognitoMode, setIncognitoModeState] = useState(() => {
    const saved = localStorage.getItem('next_media_incognito');
    return saved === 'true';
  });
  const setIncognitoMode = (val: boolean) => {
    setIncognitoModeState(val);
    localStorage.setItem('next_media_incognito', String(val));
  };

  const [soundEffects, setSoundEffectsState] = useState(() => {
    const saved = localStorage.getItem('next_media_sound');
    return saved === 'true';
  });
  const setSoundEffects = (val: boolean) => {
    setSoundEffectsState(val);
    localStorage.setItem('next_media_sound', String(val));
  };

  const [compactFeed, setCompactFeedState] = useState(() => {
    const saved = localStorage.getItem('next_media_compactfeed');
    return saved === 'true';
  });
  const setCompactFeed = (val: boolean) => {
    setCompactFeedState(val);
    localStorage.setItem('next_media_compactfeed', String(val));
  };

  const [showAllReels, setShowAllReelsState] = useState(() => {
    const saved = localStorage.getItem('next_media_showallreels');
    return saved === 'true'; // Default is false to show only uploaded
  });
  const setShowAllReels = (val: boolean) => {
    setShowAllReelsState(val);
    localStorage.setItem('next_media_showallreels', String(val));
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
    if (highContrastMode) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }, [highContrastMode]);

  useEffect(() => {
    if (!animationsEnabled) {
      document.body.classList.add('no-animations');
    } else {
      document.body.classList.remove('no-animations');
    }
  }, [animationsEnabled]);



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
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-content');
      localStorage.setItem('next_media_desktop', 'false');
    }
  }, [desktopMode]);

  const toggleDarkMode = () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    localStorage.setItem('next_media_theme', newVal ? 'dark' : 'light');
    if (newVal) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleDesktopMode = () => {
    const newVal = !desktopMode;
    setDesktopMode(newVal);
    localStorage.setItem('next_media_desktop', String(newVal));
  };
  const toggleNexto = () => {
    const newVal = !nextoEnabled;
    setNextoEnabled(newVal);
    localStorage.setItem('next_media_nexto', String(newVal));
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('next_media_user');
    setCurrentUser(null);
  };

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('next_media_user', JSON.stringify(currentUser));
      
      // Request notification on explicit user gesture
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
           setTimeout(() => {
             toast('Enable Push Notifications', {
                description: 'Get real-time alerts for new messages.',
                action: {
                  label: 'Allow',
                  onClick: async () => {
                    await requestNotificationPermission();
                  }
                },
                duration: Infinity,
                id: 'notif-prompt'
             });
           }, 2000);
        } else if (Notification.permission === 'granted') {
           requestNotificationPermission(); // Gets FCM token silently
        }
      }

      // Firebase Real-time Listeners for Notifications
      if (!auth.currentUser) return;

      const qMessages = query(collection(db, 'messages'), where('receiver_id', '==', currentUser.id), where('is_read', '==', false));
      const unsubMessages = onSnapshot(qMessages, (snapshot) => {
          // Handle message notifications
          const queryClient = (window as any).queryClient;
          if (queryClient) {
            queryClient.invalidateQueries({ queryKey: ['totalUnread'] });
            queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] });
          }
          
          snapshot.docChanges().forEach(async (change) => {
             if (change.type === 'added') {
               const data = change.doc.data();
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

               if (localStorage.getItem('next_media_sound') === 'true') {
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

               toast(`New message from ${sender?.display_name || 'Someone'}`, {
                 description: messageContent,
                 id: 'message-' + data.sender_id
               });
             }
          });
      });

      return () => {
        unsubMessages();
      };
    }
  }, [currentUser]);

  useEffect(() => {
    let unmounted = false;

    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          const userDoc = await getDoc(doc(db, 'profiles', result.user.uid));
          if (!userDoc.exists()) {
            const emailUser = result.user.email?.split('@')[0] || result.user.uid.substring(0, 8);
            const bio = await generateBio(emailUser);
            const newProfile = {
               username: emailUser,
               display_name: result.user.displayName || emailUser,
               email: result.user.email,
               bio: bio,
               avatar_url: result.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${emailUser}`,
               created_at: new Date().toISOString()
            };
            await setDoc(doc(db, 'profiles', result.user.uid), newProfile);
            if (!unmounted) setCurrentUser({ id: result.user.uid, ...newProfile } as any);
          }
        }
      } catch (err) {
        console.error("Redirect auth error:", err);
      }
    };
    
    handleRedirectResult();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
         fetchUserProfile(user.uid);
      } else {
         const saved = localStorage.getItem('next_media_user');
         if (saved) {
           setCurrentUser(JSON.parse(saved));
         } else {
           setCurrentUser(null);
         }
         setLoadingAuth(false);
      }
    });

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      let data = null;
      let error = null;
      let attempts = 0;
      
      while (attempts < 10) {
        const userDoc = await getDoc(doc(db, 'profiles', userId));
        if (userDoc.exists()) {
           data = { id: userDoc.id, ...userDoc.data() };
           break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
        
      if (data) {
        setCurrentUser(data as User);
        localStorage.setItem('next_media_user', JSON.stringify(data));
      } else {
        console.warn("Profile not found after retries. This is expected during registration.");
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
        robotSize, setRobotSize,
        bottomBarSize, setBottomBarSize,
        iconColor, setIconColor,
        autoplayVideos, setAutoplayVideos,
        saveDataMode, setSaveDataMode,
        highContrastMode, setHighContrastMode,
        hapticFeedback, setHapticFeedback,
        animationsEnabled, setAnimationsEnabled,
        incognitoMode, setIncognitoMode,
        soundEffects, setSoundEffects,
        compactFeed, setCompactFeed,
        showAllReels, setShowAllReels
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

