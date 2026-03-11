
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/App';
import { supabase } from '../lib/supabase';
import { User, Lock, Key } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPinField, setShowPinField] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setCurrentUser } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      setError(error.message);
      setLoading(false);
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
          Connect with friends and the world around you on Next Media.
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
            disabled={loading}
            className="bg-[#1877F2] text-white py-4 rounded-xl text-xl font-bold hover:bg-blue-600 shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 active:scale-[0.98]"
          >
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
            className="w-full bg-white text-gray-900 py-3.5 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-100 transition-all shadow-sm active:scale-[0.98]"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
            Continue with Google
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
