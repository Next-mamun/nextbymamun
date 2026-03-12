
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Edit2, Plus, Save, X, MessageCircle, UserPlus, Check, Trash2, ThumbsUp, MessageSquare, Users, RefreshCw, Calendar, CheckCircle, Eye } from 'lucide-react';
import { useAuth } from '@/App';
import { supabase } from '../lib/supabase';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import ZoomableImage from '@/components/ZoomableImage';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const Profile: React.FC = () => {
  const { username } = useParams();
  const { currentUser, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ display_name: '', bio: '', avatar_url: '', cover_url: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const viewedPostsRef = useRef<Set<string>>(new Set());
  const observer = useRef<IntersectionObserver | null>(null);

  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const isOwnProfile = currentUser?.username === username;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      let { data } = await supabase.from('profiles').select('*').ilike('username', username || '').single();
      
      if (!data && username && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username)) {
         const { data: byId } = await supabase.from('profiles').select('*').eq('id', username).single();
         data = byId;
      }
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

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

  const { data: userPosts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['userPosts', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from('posts')
        .select('*, profiles:user_id(*), comments(*, profiles:user_id(*)), likes(*)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 2,
  });

  const { data: friendStatus = 'none' } = useQuery({
    queryKey: ['friendStatus', currentUser?.id, profile?.id],
    queryFn: async () => {
      if (!profile?.id || isOwnProfile) return 'none';
      const { data } = await supabase.from('friendships')
        .select('*')
        .or(`and(sender_id.eq.${currentUser?.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${currentUser?.id})`)
        .single();
      return data?.status || 'none';
    },
    enabled: !!profile?.id && !isOwnProfile,
  });

  const { data: friendsCount = 0 } = useQuery({
    queryKey: ['friendsCount', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0;
      const { count } = await supabase.from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`);
      return count || 0;
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
      const { data } = await supabase.from('posts').select('views').eq('id', postId).single();
      if (data) {
        await supabase.from('posts').update({ views: (data.views || 0) + 1 }).eq('id', postId);
        queryClient.invalidateQueries({ queryKey: ['userPosts', profile?.id] });
      }
    } catch (err) {
      console.error('Error updating views:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar') => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setEditData(prev => ({ ...prev, avatar_url: base64 }));
        
        if (!isEditing) {
          const updateObj = { avatar_url: base64 };
          const { data, error } = await supabase.from('profiles').update(updateObj).eq('id', currentUser?.id).select().single();
          if (!error) {
            setCurrentUser(data);
            queryClient.invalidateQueries({ queryKey: ['profile', username] });
          }
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendRequest = async () => {
    if (friendStatus !== 'none') return;
    const { error } = await supabase.from('friendships').insert([{ sender_id: currentUser?.id, receiver_id: profile.id }]);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['friendStatus', currentUser?.id, profile?.id] });
      setFeedback({ type: 'success', msg: 'Friend request sent successfully!' });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: 'error', msg: 'Failed to send friend request.' });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleUpdate = async () => {
    setIsUploading(true);
    const { data, error } = await supabase.from('profiles').update(editData).eq('id', currentUser?.id).select().single();
    if (!error) { 
      setCurrentUser(data); 
      setIsEditing(false); 
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
    }
    setIsUploading(false);
  };

  const deletePost = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    await supabase.from('posts').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['userPosts', profile?.id] });
  };

  const getYoutubeId = (url: string | null | undefined) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getFacebookEmbedUrl = (url: string | null | undefined) => {
    if (!url) return null;
    // Handle various FB URL formats including m.facebook.com
    if (url.match(/(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch)/i)) {
      if (url.includes('plugins/video.php')) return url;
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=560`;
    }
    return null;
  };

  const getEmbedUrl = (url: string) => {
    if (url.includes('/embed/') || url.includes('plugins/video.php')) return url;

    const ytId = getYoutubeId(url);
    const fbUrl = getFacebookEmbedUrl(url);
    if (ytId) return `https://www.youtube.com/embed/${ytId}`;
    if (fbUrl) return fbUrl;
    return null;
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
                  <button onClick={() => navigate('/messages')} className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"><MessageCircle size={18}/> Message</button>
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
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 font-medium"><Calendar className="text-gray-400" size={20} /> Member since {new Date(profile.created_at).getFullYear()}</div>
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 font-medium"><CheckCircle className="text-gray-400" size={20} /> Active Next Media User</div>
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
              <div key={post.id} data-post-id={post.id} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 500px' }} className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="p-4 flex justify-between items-center">
                  <div className="flex gap-3">
                    <img src={profile.avatar_url} className="w-10 h-10 rounded-full object-cover shadow-sm border dark:border-gray-700" />
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {profile.display_name}
                        {profile.is_verified && <VerifiedBadge />}
                        {post.category && <span className="text-[10px] bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full border border-orange-100 dark:border-orange-800">{post.category}</span>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(post.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {isOwnProfile && <button onClick={() => deletePost(post.id)} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"><Trash2 size={18} /></button>}
                </div>
                {post.content && <p className="px-4 pb-3 text-gray-800 dark:text-gray-200 leading-relaxed font-medium">{post.content}</p>}
                {post.media_url && (
                  <div className="bg-black w-full">
                    {post.media_url.includes('/embed/') || post.media_url.includes('plugins/video.php') ? (
                      <div className="relative pt-[56.25%] w-full">
                        <iframe 
                          src={post.media_url.includes('youtube.com/embed') ? `${post.media_url}${post.media_url.includes('?') ? '&' : '?'}rel=0&modestbranding=1&iv_load_policy=3&controls=1&disablekb=1&autoplay=0` : post.media_url}
                          className="absolute top-0 left-0 w-full h-full"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                          title="profile-post-embed"
                        />
                      </div>
                    ) : post.media_type === 'image' ? (
                      <ZoomableImage src={post.media_url} className="w-full max-h-[500px] object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <video src={post.media_url} controls className="w-full max-h-[500px]" />
                    )}
                  </div>
                )}
                <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                   <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 font-bold text-sm"><ThumbsUp size={16} /> {post.likes?.length || 0}</div>
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 font-bold text-sm"><MessageCircle size={16} /> {post.comments?.length || 0}</div>
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 font-bold text-sm"><Eye size={16} /> {post.views || 0} Views</div>
                   </div>
                   <button onClick={() => navigate('/')} className="text-[#1877F2] font-bold text-sm hover:underline">View in Feed</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
