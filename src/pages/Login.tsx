
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User, Lock, Key } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPinField, setShowPinField] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { setCurrentUser } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, 'oauth_popup', 'width=500,height=600');
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password) {
      setError('Please enter all fields');
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username.toLowerCase())
      .single();

    if (fetchError || !data) {
      setError('User not found');
      setLoading(false);
      return;
    }

    // Check Password and optionally PIN
    if (data.password === password) {
      if (data.backup_pin && pin && data.backup_pin !== pin) {
        setError('Invalid Backup PIN');
        setLoading(false);
        return;
      }
      setCurrentUser(data);
      navigate('/');
    } else {
      setError('Invalid password');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center min-h-[90vh] gap-12 lg:gap-32 p-4 bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="max-w-[500px] text-center lg:text-left flex flex-col items-center lg:items-start">
        <img src="https://i.postimg.cc/wxwt5tsk/retouch-2026030721254774.png" alt="Next Media" className="h-24 w-auto mb-6 drop-shadow-lg" />
        <p className="text-3xl font-bold text-white leading-tight drop-shadow-md">
          Connect with friends and the world around you on Next.
        </p>
      </div>

      <div className="w-full max-w-[400px] bg-white/10 p-8 rounded-3xl shadow-2xl border border-white/10 backdrop-blur-xl">
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="relative">
            <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-xl focus:border-[#1877F2] focus:bg-white/10 outline-none text-lg text-white placeholder-gray-500 transition-all"
            />
          </div>
          
          <div className="relative">
            <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-xl focus:border-[#1877F2] focus:bg-white/10 outline-none text-lg text-white placeholder-gray-500 transition-all"
            />
          </div>
          
          {showPinField && (
            <div className="relative animate-in fade-in slide-in-from-top-1">
              <Key size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Backup PIN (Optional)"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={4}
                className="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-xl focus:border-[#1877F2] focus:bg-white/10 outline-none text-lg text-white placeholder-gray-500 transition-all"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}

          <button 
            type="submit"
            disabled={loading || isGoogleLoading}
            className="bg-[#1877F2] text-white py-4 rounded-xl text-xl font-bold hover:bg-blue-600 shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            {loading ? 'Authenticating...' : 'Log In'}
          </button>
          
          <button 
            type="button"
            onClick={() => setShowPinField(!showPinField)}
            className="text-gray-400 text-sm hover:text-white font-semibold transition-colors"
          >
            {showPinField ? 'Hide Backup PIN' : 'Use Backup PIN?'}
          </button>

          <div className="flex items-center gap-4 my-4">
            <div className="h-px bg-white/10 flex-1" />
            <span className="text-gray-500 text-sm font-medium">OR</span>
            <div className="h-px bg-white/10 flex-1" />
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || isGoogleLoading}
            className="w-full bg-white text-gray-900 py-3.5 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-100 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
          </button>

          <div className="h-px bg-white/10 my-2" />

          <Link 
            to="/register"
            className="bg-white/5 text-white py-4 rounded-xl text-lg font-bold hover:bg-white/10 transition-all text-center active:scale-[0.98] border border-white/10"
          >
            Create new account
          </Link>
        </form>
      </div>
    </div>
  );
};

export default Login;
