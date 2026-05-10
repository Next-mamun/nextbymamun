import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Edit2, Plus, Save, X, MessageCircle, UserPlus, Check, Users, RefreshCw, Calendar, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import ZoomableImage from '@/components/ZoomableImage';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUpload } from '@/contexts/UploadContext';

import PostCard from '@/components/PostCard';

const Profile: React.FC = () => {
  const { username } = useParams();
  const { currentUser, setCurrentUser } = useAuth();
  const { addUpload } = useUpload();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ display_name: '', bio: '', avatar_url: '', cover_url: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const viewedPostsRef = useRef<Set<string>>(new Set());
  const observer = useRef<IntersectionObserver | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      if (!username) return null;
      let userData = null;
      
      const q = query(collection(db, 'profiles'), where('username', '==', username));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
         userData = { id: snap.docs[0].id, ...snap.docs[0].data() };
      } else {
         const docRef = doc(db, 'profiles', username);
         const docSnap = await getDoc(docRef);
         if (docSnap.exists()) {
             userData = { id: docSnap.id, ...docSnap.data() };
         }
      }
      return userData;
    },
    staleTime: 1000 * 60 * 5,
  });

  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const isOwnProfile = currentUser?.username === username || currentUser?.id === username;

  useEffect(() => {
    if (profile) {
      setEditData({ 
        display_name: profile.display_name, 
        bio: profile.bio || '', 
        avatar_url: profile.avatar_url,
        cover_url: profile.cover_url || ''
      });
    }
  }, [profile]);

  const getProfile = async (userId: string) => {
     if (!userId) return null;
     const userDoc = await getDoc(doc(db, 'profiles', userId));
     return userDoc.exists() ? userDoc.data() : null;
  };

  const { data: userPosts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['userPosts', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const q = query(collection(db, 'posts'), where('user_id', '==', profile.id), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      
      return await Promise.all(snapshot.docs.map(async d => {
        const postData = d.data();
        const profiles = profile; // We already have the profile
        
        // Fetch comments
        const commentsQuery = query(collection(db, 'comments'), where('post_id', '==', d.id));
        const commentsSnap = await getDocs(commentsQuery);
        const comments = await Promise.all(commentsSnap.docs.map(async cd => {
           const cdData = cd.data();
           const commentProfile = await getProfile(cdData.user_id);
           return { id: cd.id, ...cdData, profiles: commentProfile };
        }));

        // Fetch likes
        const likesQuery = query(collection(db, 'likes'), where('post_id', '==', d.id));
        const likesSnap = await getDocs(likesQuery);
        const likes = likesSnap.docs.map(ld => ({ id: ld.id, ...ld.data() }));

        return { id: d.id, ...postData, profiles, comments, likes };
      }));
    },
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: friendship } = useQuery({
    queryKey: ['friendship', currentUser?.id, profile?.id],
    queryFn: async () => {
      if (!profile?.id || !currentUser?.id || isOwnProfile) return null;
      let fData = null;
      
      const q1 = query(collection(db, 'friendships'), where('sender_id', '==', currentUser.id), where('receiver_id', '==', profile.id));
      const s1 = await getDocs(q1);
      if (!s1.empty) fData = { id: s1.docs[0].id, ...s1.docs[0].data() };
      
      if (!fData) {
         const q2 = query(collection(db, 'friendships'), where('sender_id', '==', profile.id), where('receiver_id', '==', currentUser.id));
         const s2 = await getDocs(q2);
         if (!s2.empty) fData = { id: s2.docs[0].id, ...s2.docs[0].data() };
      }
      
      return fData;
    },
    enabled: !!profile?.id && !isOwnProfile && !!currentUser?.id,
  });

  const friendStatus = friendship?.status || 'none';

  const { data: friendsCount = 0 } = useQuery({
    queryKey: ['friendsCount', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0;
      let count = 0;
      const q1 = query(collection(db, 'friendships'), where('status', '==', 'accepted'), where('sender_id', '==', profile.id));
      const s1 = await getDocs(q1);
      count += s1.size;
      
      const q2 = query(collection(db, 'friendships'), where('status', '==', 'accepted'), where('receiver_id', '==', profile.id));
      const s2 = await getDocs(q2);
      count += s2.size;
      return count;
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    if (profileLoading || postsLoading) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const postId = entry.target.getAttribute('data-post-id');
          if (postId && !viewedPostsRef.current.has(postId)) {
            incrementViewCount(postId);
            viewedPostsRef.current.add(postId);
          }
        }
      });
    }, { threshold: 0.5 });

    observer.current = obs;

    setTimeout(() => {
      const elements = document.querySelectorAll('[data-post-id]');
      elements.forEach(el => obs.observe(el));
    }, 100);

    return () => obs.disconnect();
  }, [profileLoading, postsLoading, userPosts.length]);

  const incrementViewCount = async (postId: string) => {
    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      if (postDoc.exists()) {
        const data = postDoc.data();
        await updateDoc(postRef, { views: (data.views || 0) + 1 });
        queryClient.invalidateQueries({ queryKey: ['userPosts', profile?.id] });
      }
    } catch (err) {
      console.error('Error updating views:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar') => {
    const file = e.target.files?.[0];
    if (file) {
      addUpload(file, 'profile', {
        userId: currentUser?.id,
        payload: { avatar_url: '' }, // URL will be added by UploadContext
        onSuccess: async () => {
          const uDoc = await getDoc(doc(db, 'profiles', currentUser?.id as string));
          if (uDoc.exists()) {
            setCurrentUser({ id: uDoc.id, ...uDoc.data() } as any);
            queryClient.invalidateQueries({ queryKey: ['profile', username] });
          }
        }
      });
    }
  };

  const handleSendRequest = async () => {
    if (!friendship) {
        try {
            await addDoc(collection(db, 'friendships'), { sender_id: currentUser?.id, receiver_id: profile.id, status: 'pending', created_at: new Date().toISOString() });
            await addDoc(collection(db, 'notifications'), {
              user_id: profile.id,
              sender_id: currentUser?.id,
              type: 'friend_request',
              created_at: new Date().toISOString(),
              is_read: false
            });
            queryClient.invalidateQueries({ queryKey: ['friendship', currentUser?.id, profile?.id] });
            setFeedback({ type: 'success', msg: 'Friend request sent successfully!' });
        } catch(e) {
            setFeedback({ type: 'error', msg: 'Failed to send friend request.' });
        }
    } else if (friendship.status === 'pending') {
        try {
            await deleteDoc(doc(db, 'friendships', friendship.id));
            queryClient.invalidateQueries({ queryKey: ['friendship', currentUser?.id, profile?.id] });
            setFeedback({ type: 'success', msg: 'Friend request cancelled.' });
        } catch(e) {
            setFeedback({ type: 'error', msg: 'Failed to cancel friend request.' });
        }
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleUpdate = async () => {
    setIsUploading(true);
    try {
       await updateDoc(doc(db, 'profiles', currentUser?.id as string), editData);
       const uDoc = await getDoc(doc(db, 'profiles', currentUser?.id as string));
       if (uDoc.exists()) {
           setCurrentUser({ id: uDoc.id, ...uDoc.data() } as any);
           setIsEditing(false); 
           queryClient.invalidateQueries({ queryKey: ['profile', username] });
       }
    } catch(e) {
       console.error("Failed to update profile", e);
    }
    setIsUploading(false);
  };

  if (profileLoading) return <div className="flex flex-col items-center justify-center p-40 gap-4"><div className="w-10 h-10 border-4 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div><p className="font-bold text-gray-500">Loading profile data...</p></div>;
  if (!profile) return <div className="p-20 text-center text-gray-500 font-bold">Profile not found.</div>;

  return (
    <div className="bg-white dark:bg-black min-h-screen relative overflow-hidden pt-4">
      {/* Photo Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowPhotoModal(false)}>
          <button className="absolute top-6 right-6 text-white hover:scale-110 transition-transform"><X size={32} /></button>
          <img src={profile.avatar_url} className="max-w-full max-h-full rounded-lg shadow-2xl animate-in zoom-in duration-300" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {feedback && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl font-bold animate-in fade-in slide-in-from-top-4 duration-300 ${feedback.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {feedback.msg}
        </div>
      )}
      <div className="w-full max-w-[1100px] mx-auto">
        <div className="relative mb-24">
          <div className="h-[200px] md:h-[300px] bg-[#60A5FA] rounded-b-xl overflow-hidden shadow-sm relative z-0">
            {(isEditing ? editData.cover_url : profile.cover_url) && (
              <img src={isEditing ? editData.cover_url : profile.cover_url} className="w-full h-full object-cover" />
            )}
          </div>
          
          <div className="absolute -bottom-20 left-4 md:left-10 flex flex-col md:flex-row items-center md:items-end gap-6 w-[calc(100%-32px)] md:w-full z-20">
            <div className="relative group cursor-pointer" onClick={() => !isEditing && setShowPhotoModal(true)}>
              <img src={isEditing ? editData.avatar_url : profile.avatar_url} className="w-36 h-36 md:w-44 md:h-44 rounded-full border-4 border-white dark:border-black shadow-2xl object-cover bg-white dark:bg-gray-800 hover:brightness-90 transition-all" />
              {isOwnProfile && (
                <>
                  <input type="file" ref={avatarInputRef} hidden onChange={(e) => handleFileUpload(e, 'avatar')} accept="image/*" />
                  <button onClick={(e) => { e.stopPropagation(); avatarInputRef.current?.click(); }} className="absolute bottom-2 right-2 bg-gray-100 dark:bg-gray-800 p-2.5 rounded-full border-2 border-white dark:border-black shadow-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50" disabled={isUploading}>
                    <Camera size={18} className="text-gray-600 dark:text-gray-300" />
                  </button>
                </>
              )}
            </div>
            <div className="flex-1 text-center md:text-left md:pb-2">
              {isEditing ? (
                <div className="flex flex-col gap-2 mt-2">
                  <input value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} className="text-3xl font-black border dark:border-gray-700 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300 text-gray-900 dark:text-white bg-transparent" />
                </div>
              ) : (
                <h1 className="text-4xl font-black text-gray-900 dark:text-white drop-shadow-md flex items-center gap-2">
                  {profile.display_name}
                  {profile.is_verified && <VerifiedBadge size={28} />}
                </h1>
              )}
              <p className="text-gray-700 dark:text-gray-300 font-bold bg-white/30 dark:bg-black/30 backdrop-blur-sm inline-block px-2 rounded-md mt-1">@{profile.username}</p>
            </div>
            <div className="flex gap-2 md:pb-2 mr-10">
              {isOwnProfile ? (
                isEditing ? (
                  <>
                    <button onClick={handleUpdate} disabled={isUploading} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-green-700 transition-all disabled:opacity-50">
                      {isUploading ? <><RefreshCw size={18} className="animate-spin" /> Saving...</> : <><Save size={18}/> Save</>}
                    </button>
                    <button onClick={() => setIsEditing(false)} className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"><X size={18}/> Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"><Edit2 size={18}/> Edit Profile</button>
                )
              ) : (
                <>
                  <button onClick={handleSendRequest} className={`${friendStatus === 'accepted' ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white' : 'bg-[#1877F2] text-white'} px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:brightness-110 transition-all`}>
                    {friendStatus === 'none' ? <><UserPlus size={18}/> Add Friend</> : <><Check size={18}/> {friendStatus.toUpperCase()}</>}
                  </button>
                  <button onClick={() => navigate('/messages', { state: { userId: profile.id } })} className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"><MessageCircle size={18}/> Message</button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Profile Details & Posts */}
        <div className="mt-4 px-4 md:px-10 flex flex-col md:flex-row gap-6 p-4 md:p-8 bg-[#f0f2f5] dark:bg-gray-900 rounded-t-3xl">
          <div className="w-full md:w-[300px] flex-shrink-0 flex flex-col gap-4">
            <div className="bg-white dark:bg-black p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-black mb-4 text-gray-900 dark:text-white">Intro</h2>
              {isEditing ? (
                <textarea value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} className="w-full border dark:border-gray-700 rounded-lg p-2 text-center italic text-gray-800 dark:text-white bg-transparent focus:ring-2 focus:ring-blue-200 outline-none" rows={3}/>
              ) : (
                <p className="text-center italic font-medium text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ 
                  __html: profile.bio ? profile.bio.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') : '' 
                }} />
              )}
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 font-medium"><Users className="text-gray-400" size={20} /> <span className="font-bold text-gray-900 dark:text-white">{friendsCount}</span> Friends</div>
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 font-medium"><Calendar className="text-gray-400" size={20} /> Member since {profile.created_at ? new Date(profile.created_at).getFullYear() : '2023'}</div>
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 font-medium"><CheckCircle className="text-gray-400" size={20} /> Active Next User</div>
              </div>
              <button onClick={() => setIsEditing(true)} className="w-full bg-[#f0f2f5] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 py-2.5 rounded-xl font-bold mt-6 text-gray-800 dark:text-white transition-colors">Edit Bio</button>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Recent Posts</h2>
            {userPosts.length === 0 ? (
              <div className="bg-white dark:bg-black p-20 rounded-2xl text-center border-2 border-dashed border-gray-200 dark:border-gray-800 text-gray-400 font-bold flex flex-col items-center gap-4">
                <Plus size={48} className="opacity-20" />
                <p>No posts published by {profile.display_name} yet.</p>
              </div>
            ) : userPosts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                isProfileView={true} 
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
