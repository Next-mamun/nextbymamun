
import React, { useState, useEffect, useRef } from 'react';
import { Image as LucideImage, Video, ThumbsUp, MessageSquare, Share2, Send, Trash2, X, CheckCircle, Clapperboard, Link as LinkIcon, Search, Eye, Camera, Pencil } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import ZoomableImage from '@/components/ZoomableImage';
import ProfilePhoto from '@/components/ProfilePhoto';
import VideoPlayer from '@/components/VideoPlayer';
import EmbedPlayer from '@/components/EmbedPlayer';
import { useAuth } from '@/App';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { CameraCapture, MediaEditor } from '@/components/MediaTools';

const Feed: React.FC = () => {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | 'text'>('text');
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [postCategory, setPostCategory] = useState('Entertainment');
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  
  const categories = ['All', 'Entertainment', 'Learning', 'AI', 'Technology', 'Music', 'Gaming', 'News', 'Lifestyle', 'Sports', 'Art'];
  const POSTS_PER_PAGE = 10;

  const [ytLink, setYtLink] = useState('');
  const [showYoutube, setShowYoutube] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewedPostsRef = useRef<Set<string>>(new Set());
  const observer = useRef<IntersectionObserver | null>(null);

  // Fetch Reels
  const { data: reels = [] } = useQuery({
    queryKey: ['reels'],
    queryFn: async () => {
      const { data } = await supabase
        .from('reels')
        .select('*, profiles:user_id(*), likes:reel_likes(*)')
        .limit(5)
        .order('created_at', { ascending: false });
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch Posts with Infinite Scroll
  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: postsLoading,
    refetch: refetchPosts
  } = useInfiniteQuery({
    queryKey: ['posts', selectedCategory],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('posts')
        .select('*, profiles:user_id(*), comments(*, profiles:user_id(*)), likes(*)')
        .order('created_at', { ascending: false });

      if (selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory);
      }

      const { data } = await query.range(pageParam * POSTS_PER_PAGE, (pageParam + 1) * POSTS_PER_PAGE - 1);
      return data || [];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === POSTS_PER_PAGE ? allPages.length : undefined;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const posts = postsData?.pages.flat() || [];

  useEffect(() => {
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
    return () => obs.disconnect();
  }, [posts.length]);

  const incrementViewCount = async (postId: string) => {
    try {
      const { data } = await supabase.from('posts').select('views').eq('id', postId).single();
      if (data) {
        await supabase.from('posts').update({ views: (data.views || 0) + 1 }).eq('id', postId);
      }
    } catch (err) {
      console.error('Error updating views:', err);
    }
  };

  useEffect(() => {
    const sub = supabase
      .channel('feed_complex')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['posts'] });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['posts'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [queryClient]);

  const filteredPosts = posts.filter(p => 
    p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.profiles?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const downscaleTo360p = async (base64: string, type: 'image' | 'video'): Promise<string> => {
    return new Promise((resolve) => {
      if (type === 'image') {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const targetHeight = 360;
          const aspectRatio = img.width / img.height;
          const targetWidth = Math.round(targetHeight * aspectRatio);
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, targetWidth, targetHeight);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      } else {
        resolve(base64);
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadstart = () => { setIsUploading(true); setUploadProgress(0); };
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const type = file.type.startsWith('video') ? 'video' : 'image';
        
        const downscaled = await downscaleTo360p(base64, type);
        setSelectedFile(downscaled);
        setFileType(type);
        setIsUploading(false);
        setUploadProgress(0);
      };
      reader.readAsDataURL(file);
    }
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
      // If it's already an embed URL, return it
      if (url.includes('plugins/video.php')) return url;
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=560`;
    }
    return null;
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    const ytId = getYoutubeId(url);
    const fbUrl = getFacebookEmbedUrl(url);
    // rel=0: show related videos from same channel only
    // modestbranding=1: hide youtube logo
    // iv_load_policy=3: hide annotations
    // disablekb=1: disable keyboard shortcuts
    if (ytId) return `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&iv_load_policy=3&controls=1&disablekb=1&autoplay=0`;
    if (fbUrl) return fbUrl;
    return null;
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !selectedFile && !ytLink) return;
    setIsUploading(true);
    setUploadProgress(20);
    
    try {
      let mediaUrl = selectedFile;
      let mType = selectedFile ? fileType : 'text';
      
      // Check for YouTube/Facebook link in ytLink field OR content if no media selected
      let targetLink = ytLink;
      
      // If no explicit link provided, scan the content
      if (!targetLink && !selectedFile) {
        // Improved regex to catch more URL variations
        const urlMatch = newPostContent.match(/https?:\/\/(?:www\.|m\.|web\.)?(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch)\/[^\s]+/i);
        if (urlMatch) targetLink = urlMatch[0];
      }

      const embedUrl = getEmbedUrl(targetLink);

      if (embedUrl) {
        mediaUrl = embedUrl;
        mType = 'video';
      }

      const postData: any = {
        user_id: currentUser!.id,
        content: newPostContent,
        media_url: mediaUrl,
        media_type: mType,
        views: 0
      };

      // Try to add category if selected
      if (showCategoryInput ? customCategory : postCategory) {
        postData.category = showCategoryInput ? customCategory : postCategory;
      }

      const { error: insertError } = await supabase.from('posts').insert([postData]);

      if (insertError) {
        console.warn('Full insert failed, trying basic insert...', insertError);
        // Fallback to basic insert if columns are missing
        const { error: fallbackError } = await supabase.from('posts').insert([{
          user_id: currentUser!.id,
          content: newPostContent,
          media_url: mediaUrl,
          media_type: mType
        }]);
        if (fallbackError) throw fallbackError;
      }

      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setNewPostContent('');
        setSelectedFile(null);
        setYtLink('');
        setShowYoutube(false);
        setShowCategoryInput(false);
        setCustomCategory('');
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
        queryClient.invalidateQueries({ queryKey: ['posts'] });
      }, 500);
    } catch (error: any) {
      console.error('Post creation error:', error);
      alert('Failed to post: ' + (error.message || 'Unknown error. Please ensure database columns "category" and "views" exist.'));
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-[600px] mx-auto w-full flex flex-col gap-4 pb-10">
      {/* Search Bar */}
      <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-3 flex items-center gap-3 sticky top-0 z-50">
        <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center px-4 py-2 border border-transparent focus-within:border-[#1877F2] transition-all">
          <Search size={18} className="text-gray-400" />
          <input 
            placeholder="Search posts, users..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none ml-2 text-sm w-full font-bold text-gray-700 dark:text-gray-200 placeholder-gray-500" 
          />
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
        {categories.map(cat => (
          <button 
            key={cat} 
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${selectedCategory === cat ? 'bg-[#1877F2] text-white border-[#1877F2] shadow-md' : 'bg-white dark:bg-black text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900'}`}
          >
            {cat}
          </button>
        ))}
      </div>
      {/* Upload Feedback Overlay */}
      {(isUploading || uploadSuccess) && (
        <div className="bg-white dark:bg-black border dark:border-gray-800 rounded-xl p-4 shadow-xl mb-2 animate-in slide-in-from-top-4 duration-300">
          {isUploading ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                <span>Uploading to Next Media...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-[#1877F2] h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600 font-bold justify-center py-1">
              <CheckCircle size={20} /> Content Shared Successfully!
            </div>
          )}
        </div>
      )}

      {/* Create Post Section */}
      <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-4">
          <div className="flex gap-2 mb-4 items-center">
            <textarea value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} placeholder="What's on your mind?" className="flex-1 bg-[#f0f2f5] dark:bg-gray-900 rounded-xl px-5 py-3 outline-none resize-none text-[15px] text-gray-800 dark:text-white placeholder-gray-400 font-medium" rows={2} />
          </div>
          {selectedFile && (
            <div className="relative mb-4 bg-black rounded-lg overflow-hidden max-h-48 flex justify-center border dark:border-gray-800">
              {fileType === 'image' ? (
                <img src={selectedFile} className="h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <video src={selectedFile} className="h-full" />
              )}
              <div className="absolute top-2 right-2 flex gap-2">
                <button 
                  onClick={() => setShowEditor(true)}
                  className="bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-all"
                  title="Edit Media"
                >
                  <Pencil size={14} />
                </button>
                <button onClick={() => setSelectedFile(null)} className="bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-all">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
          
          {!selectedFile && (
            (ytLink && getEmbedUrl(ytLink)) || 
            (!ytLink && newPostContent.match(/https?:\/\/(?:www\.|m\.|web\.)?(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch)\/[^\s]+/i) && getEmbedUrl(newPostContent.match(/https?:\/\/(?:www\.|m\.|web\.)?(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch)\/[^\s]+/i)?.[0] || ''))
          ) && (
            <div className="relative mb-4 bg-black rounded-lg overflow-hidden aspect-video flex justify-center border dark:border-gray-800">
              <iframe 
                src={getEmbedUrl(ytLink) || getEmbedUrl(newPostContent.match(/https?:\/\/(?:www\.|m\.|web\.)?(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch)\/[^\s]+/i)?.[0] || '') || ''} 
                className="w-full h-full"
                allowFullScreen
              />
              <button 
                onClick={() => {
                  setYtLink('');
                }} 
                className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-800 px-4 py-2 bg-white dark:bg-black flex-wrap gap-2">
          <div className="flex gap-1 flex-wrap">
            <input type="file" ref={fileInputRef} hidden onChange={(e) => handleFileSelect(e)} accept="image/*,video/*" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg text-green-500 transition-colors"><LucideImage size={22} /><span className="font-bold text-gray-700 dark:text-gray-300 text-sm">Photo/Video</span></button>
            <button onClick={() => setShowCamera(true)} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg text-blue-500 transition-colors"><Camera size={22} /><span className="font-bold text-gray-700 dark:text-gray-300 text-sm">Camera</span></button>
            <button onClick={() => setShowYoutube(!showYoutube)} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg text-[#1877F2] transition-colors"><LinkIcon size={22} /><span className="font-bold text-gray-700 dark:text-gray-300 text-sm">Embed Video</span></button>
            {(newPostContent.trim() || selectedFile || ytLink) && (
              <div className="relative group">
                <button onClick={() => setShowCategoryInput(!showCategoryInput)} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg text-orange-500 transition-colors">
                  <CheckCircle size={22} />
                  <span className="font-bold text-gray-700 dark:text-gray-300 text-sm">{showCategoryInput ? 'Custom' : postCategory}</span>
                </button>
              </div>
            )}
          </div>
          <button onClick={handleCreatePost} disabled={(!newPostContent.trim() && !selectedFile && !ytLink) || isUploading} className="bg-[#1877F2] text-white px-8 py-2 rounded-lg font-bold disabled:opacity-50 transition-all shadow-md hover:brightness-110">Post</button>
        </div>
        {(newPostContent.trim() || selectedFile || ytLink) && (
          showCategoryInput ? (
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 animate-in slide-in-from-top-2 duration-200">
              <input 
                type="text" 
                placeholder="Enter custom category..." 
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                className="w-full p-3 bg-white dark:bg-black rounded-xl outline-none border-2 border-transparent focus:border-[#1877F2] text-sm font-medium shadow-sm text-gray-900 dark:text-white"
              />
            </div>
          ) : (
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex gap-2 overflow-x-auto scrollbar-hide">
              {categories.filter(c => c !== 'All').map(cat => (
                <button 
                  key={cat} 
                  onClick={() => setPostCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${postCategory === cat ? 'bg-orange-500 text-white border-orange-500' : 'bg-white dark:bg-black text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-800'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )
        )}
        {showYoutube && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 animate-in slide-in-from-top-2 duration-200">
            <input 
              type="text" 
              placeholder="Paste YouTube or Facebook Video Link..." 
              value={ytLink}
              onChange={e => setYtLink(e.target.value)}
              className="w-full p-3 bg-white dark:bg-black rounded-xl outline-none border-2 border-transparent focus:border-[#1877F2] text-sm font-medium shadow-sm text-gray-900 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Quick Reels Ribbon */}
      {reels.length > 0 && (
        <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-black flex items-center gap-2 text-gray-900 dark:text-white"><Clapperboard size={20} className="text-[#1877F2]" /> Next Reels</h3>
            <Link to="/reels" className="text-[#1877F2] text-xs font-bold hover:underline">View All</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {reels.map(reel => (
              <Link to="/reels" key={reel.id} className="relative flex-shrink-0 w-32 h-56 rounded-xl overflow-hidden bg-black border dark:border-gray-800 shadow-sm">
                {reel.source_type === 'youtube' ? (
                   <img src={`https://img.youtube.com/vi/${reel.youtube_id}/mqdefault.jpg`} className="w-full h-full object-cover" />
                ) : (
                   <video src={reel.video_url} className="w-full h-full object-cover" />
                )}
                <div className="absolute bottom-2 left-2 flex items-center gap-1">
                   <ThumbsUp size={12} className="text-white drop-shadow-md" />
                   <span className="text-white text-[10px] font-bold drop-shadow-md">{reel.likes?.length || 0}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Combined Feed items */}
      {postsLoading && posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4"><div className="w-8 h-8 border-4 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div><p className="font-bold text-gray-500">Fast Loading...</p></div>
      ) : (
        <>
          {filteredPosts.map(post => (
            <PostCard 
              key={post.id} 
              post={post} 
              onObserve={(el) => observer.current?.observe(el)}
            />
          ))}
          {hasNextPage && (
            <button onClick={loadMore} disabled={isFetchingNextPage} className="w-full py-3 bg-white dark:bg-black border dark:border-gray-800 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors shadow-sm disabled:opacity-50">
              {isFetchingNextPage ? 'Loading more...' : 'Load More Posts'}
            </button>
          )}
          {!hasNextPage && posts.length > 0 && (
            <p className="text-center text-gray-400 font-bold py-4">You're all caught up!</p>
          )}
        </>
      )}

      {/* Story Viewer Modal Removed */}

      {/* Camera & Editor Modals */}
      {showCamera && (
        <CameraCapture 
          onCapture={async (url, type) => {
            const downscaled = await downscaleTo360p(url, type);
            setSelectedFile(downscaled);
            setFileType(type);
            setShowCamera(false);
          }}
          onCancel={() => setShowCamera(false)}
        />
      )}

      {showEditor && selectedFile && (
        <MediaEditor 
          mediaUrl={selectedFile}
          mediaType={fileType as 'image' | 'video'}
          onSave={(processed) => {
            setSelectedFile(processed);
            setShowEditor(false);
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  );
};

const PostCard: React.FC<{ post: any, onObserve: (el: HTMLElement) => void }> = ({ post, onObserve }) => {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [localComments, setLocalComments] = useState<any[]>(post.comments || []);
  
  // Optimistic UI state
  const initialIsLiked = post.likes?.some((l: any) => l.user_id === currentUser?.id);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      onObserve(cardRef.current);
    }
  }, []);

  // Sync local state if post prop changes from server
  useEffect(() => {
    setIsLiked(post.likes?.some((l: any) => l.user_id === currentUser?.id));
    setLikesCount(post.likes?.length || 0);
    setLocalComments(post.comments || []);
  }, [post.likes, post.comments]);

  const handleLike = async () => {
    // Optimistic update
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikesCount(prev => newIsLiked ? prev + 1 : prev - 1);

    try {
      if (isLiked) {
        await supabase.from('likes').delete().match({ post_id: post.id, user_id: currentUser?.id });
      } else {
        await supabase.from('likes').insert([{ post_id: post.id, user_id: currentUser?.id }]);
      }
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (error) {
      // Revert on failure
      setIsLiked(isLiked);
      setLikesCount(post.likes?.length || 0);
      console.error("Failed to toggle like", error);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    
    // Optimistic comment
    const newComment = {
      id: `temp-${Date.now()}`,
      post_id: post.id,
      user_id: currentUser?.id,
      content: comment,
      created_at: new Date().toISOString(),
      profiles: currentUser
    };
    
    setLocalComments(prev => [...prev, newComment]);
    const commentText = comment;
    setComment('');

    try {
      await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser?.id, content: commentText }]);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (error) {
      // Revert on error
      setLocalComments(post.comments || []);
      console.error("Failed to post comment", error);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      await supabase.from('posts').delete().eq('id', post.id);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    }
  };

  return (
    <div ref={cardRef} data-post-id={post.id} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 500px' }} className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-all">
      <div className="p-4 flex justify-between items-center">
        <Link to={`/profile/${post.profiles?.username || 'unknown'}`} className="flex gap-3 hover:opacity-80 transition-opacity">
          <ProfilePhoto src={post.profiles?.avatar_url || ''} alt="profile" size="small" />
          <div>
            <p className="font-bold text-[15px] text-gray-900 dark:text-white leading-tight flex items-center gap-2">
              {post.profiles?.display_name || 'Next User'}
              {post.profiles?.is_verified && <VerifiedBadge />}
              {post.category && <span className="text-[10px] bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full border border-orange-100 dark:border-orange-800">{post.category}</span>}
            </p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">{new Date(post.created_at).toLocaleString()}</p>
          </div>
        </Link>
        {post.user_id === currentUser?.id && <button onClick={handleDelete} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"><Trash2 size={18} /></button>}
      </div>
      <p className="px-4 pb-3 text-[15px] text-gray-800 dark:text-gray-200 leading-relaxed font-medium">{post.content}</p>
      {post.media_url && (
        <div className="bg-black flex items-center justify-center">
          {post.media_url.includes('/embed/') || post.media_url.includes('plugins/video.php') ? (
            <EmbedPlayer src={post.media_url} />
          ) : post.media_type === 'image' ? (
            <ZoomableImage src={post.media_url} className="w-full max-h-[600px] object-contain" referrerPolicy="no-referrer" />
          ) : (
            <VideoPlayer src={post.media_url} className="w-full max-h-[600px]" />
          )}
        </div>
      )}
      <div className="px-4 py-1">
        <div className="flex justify-between text-[13px] text-gray-500 dark:text-gray-400 py-2 font-bold">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5"><ThumbsUp size={12} className="text-white bg-[#1877F2] p-0.5 rounded-full" /> {likesCount} Likes</div>
            <div className="flex items-center gap-1.5"><Eye size={14} className="text-gray-400" /> {post.views || 0} Views</div>
          </div>
          <button onClick={() => setShowComments(!showComments)} className="hover:underline">{localComments.length} comments</button>
        </div>
        <div className="flex border-t border-gray-100 dark:border-gray-800 py-1 gap-1">
          <button onClick={handleLike} className={`flex-1 flex items-center justify-center gap-2 py-2 font-bold transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 ${isLiked ? 'text-[#1877F2]' : 'text-gray-600 dark:text-gray-400'}`}><ThumbsUp size={20} /> Like</button>
          <button onClick={() => setShowComments(!showComments)} className="flex-1 flex items-center justify-center gap-2 py-2 font-bold text-gray-600 dark:text-gray-400 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"><MessageSquare size={20} /> Comment</button>
        </div>
      </div>
      
      {showComments && (
        <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
          <div className="max-h-60 overflow-y-auto py-2 space-y-3 scrollbar-hide">
            {localComments.map((c: any) => (
              <div key={c.id} className="flex gap-2">
                <Link to={`/profile/${c.profiles?.username || 'unknown'}`}>
                  <ProfilePhoto src={c.profiles?.avatar_url || ''} alt="commenter" size="small" />
                </Link>
                <div className="bg-white dark:bg-black px-3 py-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex-1">
                  <Link to={`/profile/${c.profiles?.username || 'unknown'}`} className="font-bold text-[13px] text-gray-900 dark:text-white hover:underline flex items-center gap-1">
                    {c.profiles?.display_name || 'User'}
                    {c.profiles?.is_verified && <VerifiedBadge size={12} />}
                  </Link>
                  <p className="text-[14px] text-gray-800 dark:text-gray-200">{c.content}</p>
                </div>
              </div>
            ))}
            {localComments.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-2">No comments yet. Be the first!</p>
            )}
          </div>
          <form onSubmit={handleComment} className="mt-2 flex gap-2">
            <ProfilePhoto src={currentUser?.avatar_url || ''} alt="me" size="small" />
            <div className="flex-1 relative">
              <input 
                type="text" 
                value={comment} 
                onChange={(e) => setComment(e.target.value)} 
                placeholder="Write a comment..." 
                className="w-full bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-full px-4 py-1.5 text-sm outline-none focus:border-[#1877F2] pr-10 text-gray-900 dark:text-white placeholder-gray-500"
              />
              <button type="submit" disabled={!comment.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#1877F2] disabled:opacity-50">
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Camera & Editor Modals */}
    </div>
  );
};

export default Feed;
