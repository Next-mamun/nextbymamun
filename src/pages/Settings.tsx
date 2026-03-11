import React, { useState, useMemo, useEffect } from 'react';
import { 
  User, Lock, Bell, Shield, Globe, HelpCircle, Search, ChevronRight, 
  Monitor, Database, Briefcase, Smartphone, Key, UserX, EyeOff, 
  MessageSquare, Volume2, Moon, Sun, Type, HardDrive, Download, 
  BarChart3, DollarSign, AlertTriangle, FileText, RefreshCw, CheckCircle, Upload
} from 'lucide-react';
import { useAuth, useTheme } from '@/App';

import { supabase } from '../lib/supabase';
import { VerifiedBadge } from '@/components/VerifiedBadge';

// Reusable Toggle Component
const Toggle: React.FC<{ checked: boolean, onChange: () => void }> = ({ checked, onChange }) => (
  <button 
    onClick={onChange} 
    className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-300 ${checked ? 'bg-[#1A2933]' : 'bg-gray-300'}`}
  >
    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${checked ? 'left-[26px]' : 'left-0.5'}`} />
  </button>
);

// Reusable Section Component
const Section: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">{title}</h3>
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm transition-colors">
      {children}
    </div>
  </div>
);

// Reusable Row Component
const Row: React.FC<{ icon?: React.ReactNode, title: string, description?: string, action: React.ReactNode, border?: boolean }> = ({ icon, title, description, action, border = true }) => (
  <div className={`flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${border ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
    <div className="flex items-center gap-4 pr-4">
      {icon && <div className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">{icon}</div>}
      <div>
        <p className="font-bold text-gray-900 dark:text-gray-100 text-[15px]">{title}</p>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{description}</p>}
      </div>
    </div>
    <div className="flex-shrink-0">
      {action}
    </div>
  </div>
);

const Settings: React.FC = () => {
  const { currentUser } = useAuth();
  const { darkMode, toggleDarkMode, desktopMode, toggleDesktopMode, nextoEnabled, toggleNexto, robotSize, setRobotSize } = useTheme();
  const [activeTab, setActiveTab] = useState('display');
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (currentUser) {
      fetchProfile();
    }
  }, [currentUser]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', currentUser?.id).single();
    if (data) setProfile(data);
  };

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSave = async () => {
    if (!editingField || !currentUser) return;
    setIsSaving(true);
    
    try {
      if (editingField === 'password') {
        const { error } = await supabase.auth.updateUser({ password: editValue });
        if (error) throw error;
        alert('Password updated successfully!');
      } else {
        const updates = { [editingField]: editValue };
        const { error } = await supabase.from('profiles').update(updates).eq('id', currentUser.id);
        if (error) throw error;
        
        // Update local profile state
        setProfile(prev => ({ ...prev, ...updates }));
        
        // Update currentUser in localStorage (partial update)
        const savedUser = JSON.parse(localStorage.getItem('next_media_user') || '{}');
        localStorage.setItem('next_media_user', JSON.stringify({ ...savedUser, ...updates }));
        
        // Note: A full page reload or context update might be needed for the navbar to reflect changes immediately,
        // but for now this updates the settings view.
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred');
    } finally {
      setIsSaving(false);
      setEditingField(null);
    }
  };

  const renderAction = (field: string, currentValue: string, isPassword = false) => {
    if (editingField === field) {
      return (
        <div className="flex items-center gap-2">
          <input 
            type={isPassword ? "password" : "text"} 
            value={editValue} 
            onChange={e => setEditValue(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-800 dark:text-white"
            autoFocus
          />
          <button onClick={handleSave} disabled={isSaving} className="text-blue-500 hover:text-blue-600 font-bold text-sm">
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => setEditingField(null)} className="text-gray-500 hover:text-gray-600 font-bold text-sm">
            Cancel
          </button>
        </div>
      );
    }
    return (
      <button onClick={() => handleEdit(field, isPassword ? '' : currentValue)} className="text-blue-500 hover:text-blue-600 font-bold text-sm">
        Edit
      </button>
    );
  };

  const settingsTabs = [
    { id: 'display', icon: <Monitor size={20} />, label: 'Display & Accessibility', keywords: ['dark mode', 'light mode', 'font', 'size', 'nexto', 'robot'] },
    { id: 'account', icon: <User size={20} />, label: 'Account Center', keywords: ['password', 'security', 'logout'] },
  ];

  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return settingsTabs;
    const query = searchQuery.toLowerCase();
    return settingsTabs.filter(tab => 
      tab.label.toLowerCase().includes(query) || 
      tab.keywords.some(kw => kw.includes(query))
    );
  }, [searchQuery]);

  const nextoRobotSvg = (
    <svg viewBox="0 0 1024 1024" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bodyG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5ee0fd"/>
          <stop offset="100%" stop-color="#258be7"/>
        </linearGradient>
      </defs>
      <ellipse cx="512" cy="320" rx="220" ry="200" fill="url(#bodyG)"/>
      <ellipse cx="440" cy="260" rx="35" ry="35" fill="#000"/>
      <ellipse cx="585" cy="260" rx="35" ry="35" fill="#000"/>
      <path d="M450,330 Q512,380 575,330" fill="#d21c2c"/>
      <ellipse cx="512" cy="600" rx="230" ry="280" fill="url(#bodyG)"/>
    </svg>
  );

  useEffect(() => {
    if (searchQuery && filteredTabs.length > 0 && !filteredTabs.find(t => t.id === activeTab)) {
      setActiveTab(filteredTabs[0].id);
    }
  }, [searchQuery, filteredTabs, activeTab]);

  return (
    <div className="max-w-[1200px] mx-auto bg-white dark:bg-black rounded-2xl shadow-sm flex flex-col md:flex-row h-[calc(100vh-80px)] overflow-hidden border border-gray-200 dark:border-gray-800 transition-colors">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/50 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-black">
          <h1 className="text-2xl font-black mb-4 text-gray-900 dark:text-white">Settings</h1>
          <div className="bg-[#f0f2f5] dark:bg-gray-900 rounded-xl flex items-center px-3 py-2 border border-transparent focus-within:border-blue-300 transition-all">
            <Search size={18} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Search settings..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none ml-2 text-sm w-full font-bold text-gray-700 dark:text-gray-200 placeholder-gray-400"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 scrollbar-hide">
          {filteredTabs.length === 0 ? (
            <div className="text-center p-4 text-gray-500 font-bold text-sm">No settings found for "{searchQuery}"</div>
          ) : (
            filteredTabs.map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-between p-3 rounded-xl font-bold transition-all ${activeTab === tab.id ? 'bg-[#e7f3ff] dark:bg-gray-800 text-[#1A2933] dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-900'}`}
              >
                <div className="flex items-center gap-3">
                  {tab.icon}
                  {tab.label}
                </div>
                {activeTab === tab.id && <ChevronRight size={16} />}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-black relative scrollbar-hide">
        <div className="max-w-3xl mx-auto p-4 md:p-8 pb-20">
          
          {/* Display Settings */}
          {activeTab === 'display' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-3xl font-black mb-2 text-gray-900 dark:text-white">Display & Accessibility</h2>
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-8">Customize how the app looks and feels.</p>

              <Section title="Appearance">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                  <p className="font-bold text-gray-900 dark:text-white mb-3">Theme</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => darkMode && toggleDarkMode()}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl font-bold transition-colors ${!darkMode ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400'}`}
                    >
                      <Sun size={24} /> 
                      <span>Light Mode</span>
                    </button>
                    <button 
                      onClick={() => !darkMode && toggleDarkMode()}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl font-bold transition-colors ${darkMode ? 'border-blue-500 bg-gray-800 text-white' : 'border-gray-200 bg-white text-gray-600'}`}
                    >
                      <Moon size={24} /> 
                      <span>Dark Mode</span>
                    </button>
                  </div>
                </div>
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                  <p className="font-bold text-gray-900 dark:text-white mb-3">Viewport Mode</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => desktopMode && toggleDesktopMode()}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl font-bold transition-colors ${!desktopMode ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400'}`}
                    >
                      <Smartphone size={24} /> 
                      <span>Mobile Mode</span>
                    </button>
                    <button 
                      onClick={() => !desktopMode && toggleDesktopMode()}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl font-bold transition-colors ${desktopMode ? 'border-blue-500 bg-gray-800 text-white' : 'border-gray-200 bg-white text-gray-600'}`}
                    >
                      <Monitor size={24} /> 
                      <span>Desktop Mode</span>
                    </button>
                  </div>
                </div>
                <Row 
                  icon={nextoRobotSvg} 
                  title="Nexto" 
                  description="Enable the floating robot assistant overlay." 
                  action={<Toggle checked={nextoEnabled} onChange={toggleNexto} />} 
                  border={nextoEnabled}
                />
                {nextoEnabled && (
                  <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-gray-900 dark:text-white text-sm">Robot Size</p>
                      <span className="text-xs font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full">{robotSize}px</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setRobotSize(Math.max(40, robotSize - 5))}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
                      >
                        <Volume2 size={18} className="rotate-180" />
                      </button>
                      <input 
                        type="range" 
                        min="40" 
                        max="150" 
                        value={robotSize} 
                        onChange={(e) => setRobotSize(parseInt(e.target.value, 10))}
                        className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <button 
                        onClick={() => setRobotSize(Math.min(150, robotSize + 5))}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
                      >
                        <Volume2 size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* Account Settings */}
          {activeTab === 'account' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-3xl font-black mb-2 text-gray-900 dark:text-white">Account Center</h2>
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-8">Manage your account details.</p>
              
              <Section title="Profile Information">
                <Row icon={<User size={20}/>} title="Display Name" description={profile?.display_name || currentUser?.display_name} action={renderAction('display_name', profile?.display_name || currentUser?.display_name || '')} />
                <Row icon={<Smartphone size={20}/>} title="Username" description={`@${profile?.username || currentUser?.username}`} action={renderAction('username', profile?.username || currentUser?.username || '')} border={false} />
              </Section>

              <Section title="Security">
                <Row icon={<Lock size={20}/>} title="Password" description="Change your password" action={renderAction('password', '', true)} border={false} />
              </Section>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
