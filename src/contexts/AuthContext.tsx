
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
}

export const ThemeContext = createContext<ThemeContextType>({ 
  darkMode: false, 
  toggleDarkMode: () => {},
  desktopMode: false,
  toggleDesktopMode: () => {},
  nextoEnabled: true,
  toggleNexto: () => {},
  robotSize: 80,
  setRobotSize: () => {}
});

export const useTheme = () => useContext(ThemeContext);
