
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Shield, UserCircle, Key } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateBio } from '../services/geminiService';
import { supabase } from '../lib/supabase';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    pin: ''
  });
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.firstName || !formData.lastName || !formData.username || !formData.password) {
      setError('Required fields are missing');
      setLoading(false);
      return;
    }

    const usernameLower = formData.username.toLowerCase();

    // Check for existing user
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', usernameLower).single();
    if (existing) {
      setError('Username already taken');
      setLoading(false);
      return;
    }

    try {
      const bio = await generateBio(usernameLower);
      const { data, error: insertError } = await supabase.from('profiles').insert([
        {
          username: usernameLower,
          password: formData.password,
          backup_pin: formData.pin || null,
          display_name: `${formData.firstName} ${formData.lastName}`,
          bio: bio,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${usernameLower}`
        }
      ]).select().single();

      if (insertError) throw insertError;
      
      setCurrentUser(data);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] p-4 bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="bg-white/10 p-6 sm:p-10 rounded-3xl shadow-2xl w-full max-w-[480px] border border-white/10 backdrop-blur-xl">
        <div className="mb-8 text-center">
          <img src="https://i.postimg.cc/wxwt5tsk/retouch-2026030721254774.png" alt="Next" className="h-16 w-auto mx-auto mb-4 drop-shadow-lg" />
          <h1 className="text-3xl font-black tracking-tight text-white">Create Account</h1>
          <p className="text-gray-400 font-medium mt-2">Join the Next community today.</p>
        </div>
        
        <form onSubmit={handleRegister} className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="First name"
                className="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#1877F2] focus:bg-white/10 text-white placeholder-gray-500 font-medium transition-all"
                onChange={e => setFormData({...formData, firstName: e.target.value})}
              />
            </div>
            <div className="relative flex-1">
              <input
                placeholder="Last name"
                className="w-full p-4 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#1877F2] focus:bg-white/10 text-white placeholder-gray-500 font-medium transition-all"
                onChange={e => setFormData({...formData, lastName: e.target.value})}
              />
            </div>
          </div>
          
          <div className="relative">
            <UserCircle size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Username (unique identifier)"
              className="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#1877F2] focus:bg-white/10 text-white placeholder-gray-500 font-medium transition-all"
              onChange={e => setFormData({...formData, username: e.target.value})}
            />
          </div>
          
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              placeholder="New password"
              className="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#1877F2] focus:bg-white/10 text-white placeholder-gray-500 font-medium transition-all"
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <div className="relative">
            <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Backup PIN (4 digits)"
              maxLength={4}
              className="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#1877F2] focus:bg-white/10 text-white placeholder-gray-500 font-medium transition-all"
              onChange={e => setFormData({...formData, pin: e.target.value})}
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}

          <p className="text-xs text-gray-500 text-center px-4 leading-relaxed">
            By clicking Sign Up, you agree to our <span className="text-gray-300 font-bold cursor-pointer hover:underline">Terms</span>, <span className="text-gray-300 font-bold cursor-pointer hover:underline">Privacy Policy</span> and <span className="text-gray-300 font-bold cursor-pointer hover:underline">Cookies Policy</span>.
          </p>

          <button 
            type="submit"
            disabled={loading || isGoogleLoading}
            className="bg-[#1877F2] text-white py-4 rounded-xl font-bold text-xl mt-2 hover:bg-blue-600 shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>

          <div className="flex items-center gap-4 my-2">
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
            {isGoogleLoading ? 'Connecting...' : 'Sign up with Google'}
          </button>

          <Link to="/login" className="text-gray-400 text-center mt-4 text-sm hover:text-white font-bold transition-colors">
            Already have an account? Log in
          </Link>
        </form>
      </div>
    </div>
  );
};

export default Register;
