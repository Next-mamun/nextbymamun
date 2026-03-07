
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
}

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const ThemeContext = createContext<ThemeContextType>({ darkMode: false, toggleDarkMode: () => {} });

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

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('next_media_theme') === 'dark';
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

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const logout = () => {
    localStorage.removeItem('next_media_user');
    setCurrentUser(null);
  };

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('next_media_user', JSON.stringify(currentUser));
    }
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, logout }}>
      <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
        <HashRouter>
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
        </HashRouter>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
};

export default App;
