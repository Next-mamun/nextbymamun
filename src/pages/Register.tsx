
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Shield, UserCircle, Key } from 'lucide-react';
import { useAuth } from '@/App';
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
  const { setCurrentUser } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/#/`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      setError(error.message);
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
          <img src="https://i.postimg.cc/wxwt5tsk/retouch-2026030721254774.png" alt="Next Media" className="h-16 w-auto mx-auto mb-4 drop-shadow-lg" />
          <h1 className="text-3xl font-black tracking-tight text-white">Create Account</h1>
          <p className="text-gray-400 font-medium mt-2">Join the Next Media community today.</p>
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
            disabled={loading}
            className="bg-[#1877F2] text-white py-4 rounded-xl font-bold text-xl mt-2 hover:bg-blue-600 shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
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
            className="w-full bg-white text-gray-900 py-3.5 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-100 transition-all shadow-sm active:scale-[0.98]"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
            Sign up with Google
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
