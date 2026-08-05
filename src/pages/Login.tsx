
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { generateBio } from '../services/geminiService';
import { User, Lock } from 'lucide-react';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { currentUser, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const returnUrl = searchParams.get('returnUrl') || '/';

  React.useEffect(() => {
    if (currentUser) {
      navigate(returnUrl);
    }
  }, [currentUser, navigate, returnUrl]);

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      setError('');
      const provider = new GoogleAuthProvider();
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      
      if (isStandalone) {
        await signInWithRedirect(auth, provider);
        return;
      }
      
      const result = await signInWithPopup(auth, provider);
      
      try {
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
          try {
            await setDoc(doc(db, 'profiles', result.user.uid), newProfile);
          } catch (e) {
            console.warn("Could not save profile to Firestore (quota?):", e);
          }
          setCurrentUser({ id: result.user.uid, ...newProfile } as any);
        } else {
          setCurrentUser({ id: userDoc.id, ...userDoc.data() } as any);
        }
      } catch (dbError) {
        console.warn("Firestore error during Google login (quota exceeded?):", dbError);
        const emailUser = result.user.email?.split('@')[0] || result.user.uid.substring(0, 8);
        setCurrentUser({ 
          id: result.user.uid, 
          username: emailUser, 
          email: result.user.email, 
          display_name: result.user.displayName || emailUser,
          avatar_url: result.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${emailUser}`
        } as any);
        toast.success("Logged in, but some data might be delayed (database busy).");
      }
      
      navigate(returnUrl);
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        const provider = new GoogleAuthProvider();
        await signInWithRedirect(auth, provider);
      } else {
        setError(error.message);
      }
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

    try {
      const isEmail = username.includes('@');
      
      if (isEmail) {
        // Direct email login bypasses initial Firestore lookup
        const userCredential = await signInWithEmailAndPassword(auth, username, password);
        try {
          const profileDoc = await getDoc(doc(db, 'profiles', userCredential.user.uid));
          if (profileDoc.exists()) {
             setCurrentUser({ id: profileDoc.id, ...profileDoc.data() } as any);
          } else {
             // Fallback if profile doesn't exist but auth succeeded
             setCurrentUser({ 
               id: userCredential.user.uid, 
               username: username.split('@')[0], 
               email: username, 
               display_name: username.split('@')[0] 
             } as any);
          }
        } catch (dbError) {
          console.warn("Firestore error during login (quota exceeded?):", dbError);
          // Fallback to memory state if DB is unreachable
          setCurrentUser({ 
            id: userCredential.user.uid, 
            username: username.split('@')[0], 
            email: username, 
            display_name: username.split('@')[0] 
          } as any);
          toast.success("Logged in, but some data might be delayed (database busy).");
        }
        
        navigate(returnUrl);
        setLoading(false);
        return;
      }

      // If username provided, we must lookup in Firestore
      let querySnapshot;
      try {
        const q = query(collection(db, 'profiles'), where('username', '==', username.toLowerCase()));
        querySnapshot = await getDocs(q);
      } catch (dbError) {
        console.error("Firestore lookup failed:", dbError);
        setError('Database is too busy (quota limit). Please log in using your Email address instead.');
        setLoading(false);
        return;
      }
       
      if (querySnapshot.empty) {
        setError('User not found');
        setLoading(false);
        return;
      }
       
      const profileDoc = querySnapshot.docs[0];
      const profileData = profileDoc.data();
       
      if (profileData.password === password || profileData.email) {
        if (profileData.email) {
           await signInWithEmailAndPassword(auth, profileData.email, password);
        } else {
           setCurrentUser({ id: profileDoc.id, ...profileData } as any);
        }
        
        try {
          const saved = localStorage.getItem('next_saved_accounts');
          let accounts = saved ? JSON.parse(saved) : [];
          if (!Array.isArray(accounts)) accounts = [];
          const newAcc = {
            id: profileDoc.id,
            username: profileData.username,
            display_name: profileData.display_name,
            email: profileData.email || `${profileData.username}@nextmedia.app`,
            password: password,
            avatar_url: profileData.avatar_url || ''
          };
          const idx = accounts.findIndex((a: any) => a.id === newAcc.id);
          if (idx > -1) {
            accounts[idx] = { ...accounts[idx], ...newAcc };
          } else {
            accounts.push(newAcc);
          }
          localStorage.setItem('next_saved_accounts', JSON.stringify(accounts));
        } catch (e) {
          console.error('Failed to save account to switcher:', e);
        }
        
        navigate(returnUrl);
      } else {
        setError('Invalid password');
      }
    } catch (err: any) {
       console.error(err);
       setError('Authentication failed. Are you sure you entered the correct password?');
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
              placeholder="Username or Email"
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

          {error && <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}

          <button 
            type="submit"
            disabled={loading || isGoogleLoading}
            className="bg-[#1877F2] text-white py-4 rounded-xl text-xl font-bold hover:bg-blue-600 shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            {loading ? 'Authenticating...' : 'Log In'}
          </button>

          <Link 
            to="/register"
            className="bg-white/5 text-white py-4 rounded-xl text-lg font-bold hover:bg-white/10 transition-all text-center active:scale-[0.98] border border-white/10"
          >
            Create new account
          </Link>
          
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
        </form>
      </div>
    </div>
  );
};

export default Login;
