
import React, { createContext, useContext } from 'react';
import { UserProfile as User } from '@/types';

export interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  desktopMode: boolean;
  toggleDesktopMode: () => void;
  nextoEnabled: boolean;
  toggleNexto: () => void;
  robotSize: number;
  setRobotSize: (size: number) => void;
  bottomBarSize: 'small' | 'medium' | 'large';
  setBottomBarSize: (size: 'small' | 'medium' | 'large') => void;
  iconColor: string;
  setIconColor: (color: string) => void;
  autoplayVideos: boolean;
  setAutoplayVideos: (val: boolean) => void;
  saveDataMode: boolean;
  setSaveDataMode: (val: boolean) => void;
  highContrastMode: boolean;
  setHighContrastMode: (val: boolean) => void;
  hapticFeedback: boolean;
  setHapticFeedback: (val: boolean) => void;
  animationsEnabled: boolean;
  setAnimationsEnabled: (val: boolean) => void;
  incognitoMode: boolean;
  setIncognitoMode: (val: boolean) => void;
  soundEffects: boolean;
  setSoundEffects: (val: boolean) => void;
  compactFeed: boolean;
  setCompactFeed: (val: boolean) => void;
}

export const ThemeContext = createContext<ThemeContextType>({ 
  darkMode: false, 
  toggleDarkMode: () => {},
  desktopMode: false,
  toggleDesktopMode: () => {},
  nextoEnabled: true,
  toggleNexto: () => {},
  robotSize: 80,
  setRobotSize: () => {},
  bottomBarSize: 'medium',
  setBottomBarSize: () => {},
  iconColor: '#1877F2',
  setIconColor: () => {},
  autoplayVideos: true,
  setAutoplayVideos: () => {},
  saveDataMode: false,
  setSaveDataMode: () => {},
  highContrastMode: false,
  setHighContrastMode: () => {},
  hapticFeedback: true,
  setHapticFeedback: () => {},
  animationsEnabled: true,
  setAnimationsEnabled: () => {},
  incognitoMode: false,
  setIncognitoMode: () => {},
  soundEffects: false,
  setSoundEffects: () => {},
  compactFeed: false,
  setCompactFeed: () => {}
});

export const useTheme = () => useContext(ThemeContext);
