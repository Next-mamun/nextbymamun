
import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import Feed from '@/pages/Feed';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Messages from '@/pages/Messages';
import Friends from '@/pages/Friends';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import CreatePost from '@/pages/CreatePost';
import Notifications from '@/pages/Notifications';
import { UserProfile as User } from '@/types';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
}

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  desktopMode: boolean;
  toggleDesktopMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const ThemeContext = createContext<ThemeContextType>({ 
  darkMode: false, 
  toggleDarkMode: () => {},
  desktopMode: false,
  toggleDesktopMode: () => {}
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const useTheme = () => useContext(ThemeContext);

const App: React.FC = () => {
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

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('next_media_user');
    setCurrentUser(null);
  };

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('next_media_user', JSON.stringify(currentUser));
    }
  }, [currentUser]);

  useEffect(() => {
    // Check active session
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoadingAuth(false);
      }
    };

    fetchSession();

    // Listen for auth changes (like OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          fetchUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          localStorage.removeItem('next_media_user');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      // Poll for the profile since the database trigger might take a few milliseconds
      let data = null;
      let error = null;
      let attempts = 0;
      
      while (attempts < 5) {
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
          
        data = result.data;
        error = result.error;
        
        if (data) break;
        
        // Wait 200ms before retrying
        await new Promise(resolve => setTimeout(resolve, 200));
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1877F2]"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, logout }}>
      <ThemeContext.Provider value={{ darkMode, toggleDarkMode, desktopMode, toggleDesktopMode }}>
        <BrowserRouter>
          <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#000000] flex flex-col transition-colors duration-300">
            <div className={`flex flex-1 pb-16 max-w-[1920px] mx-auto w-full ${currentUser ? 'pt-14' : ''}`}>
              {currentUser && <Navbar />}
              {currentUser && <div className="hidden md:block"><Sidebar /></div>}
              <main className={`flex-1 overflow-y-auto ${currentUser ? 'p-0 md:p-4' : ''}`}>
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
                </Routes>
              </main>
            </div>
            {currentUser && <div className="z-[100] relative"><BottomNav /></div>}
          </div>
        </BrowserRouter>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
};

export default App;
