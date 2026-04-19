
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as LucideImage, Video, ThumbsUp, Send, X, CheckCircle, Clapperboard, Link as LinkIcon, Search, Camera, Pencil } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import ZoomableImage from '@/components/ZoomableImage';
import ProfilePhoto from '@/components/ProfilePhoto';
import VideoPlayer from '@/components/VideoPlayer';
import EmbedPlayer from '@/components/EmbedPlayer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { CameraCapture, MediaEditor } from '@/components/MediaTools';

import PostCard from '@/components/PostCard';
import AdsterraAd from '@/components/AdsterraAd';

import { useUpload } from '@/contexts/UploadContext';

const Feed: React.FC = () => {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { addUpload, uploads } = useUpload();
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | 'text'>('text');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [contentTypeFilter, setContentTypeFilter] = useState<'All' | 'Image' | 'Text' | 'Video'>('All');
  
  useEffect(() => {
    setSearchQuery('');
  }, [selectedCategory, contentTypeFilter]);
  const [postCategory, setPostCategory] = useState('Entertainment');
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
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
        .select('*, profiles(*), likes:reel_likes(*)')
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
    refetch: refetchPosts,
    error: postsError
  } = useInfiniteQuery({
    queryKey: ['posts', selectedCategory, contentTypeFilter],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('posts')
        .select('*, profiles(*), comments(*, profiles(*)), likes(*)')
        .order('created_at', { ascending: false });

      if (selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory);
      }
      
      if (contentTypeFilter !== 'All') {
        const type = contentTypeFilter === 'Video' ? 'video' : contentTypeFilter.toLowerCase();
        query = query.eq('media_type', type);
      }

      const { data, error } = await query.range(pageParam * POSTS_PER_PAGE, (pageParam + 1) * POSTS_PER_PAGE - 1);
      if (error) {
        console.error("Error fetching posts:", error);
        throw error;
      }
      return data || [];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === POSTS_PER_PAGE ? allPages.length : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const posts = useMemo(() => 
    Array.from(new Map((postsData?.pages.flat() || []).map(p => [p.id, p])).values()),
    [postsData?.pages]
  );

  const handleObserve = useCallback((el: HTMLElement) => {
    observer.current?.observe(el);
  }, []);

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
  }, []);

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

  const filteredPosts = useMemo(() => {
    const baseFiltered = posts.filter(p => {
      const contentStr = p.content || '';
      const nameStr = p.profiles?.display_name || '';
      const matchesSearch = contentStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nameStr.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });

    // Implement Algorithm: 3 Videos -> 3 Images -> 3 Text -> Repeat
    const videos = baseFiltered.filter(p => p.media_type === 'video' || (p.media_url && (p.media_url.includes('youtube.com') || p.media_url.includes('facebook.com'))));
    const images = baseFiltered.filter(p => p.media_type === 'image');
    const texts = baseFiltered.filter(p => !videos.includes(p) && !images.includes(p));

    const result: any[] = [];
    let vIdx = 0, iIdx = 0, tIdx = 0;

    while (vIdx < videos.length || iIdx < images.length || tIdx < texts.length) {
      // Add 3 videos
      for (let i = 0; i < 3 && vIdx < videos.length; i++) {
        result.push(videos[vIdx++]);
      }
      // Add 3 images
      for (let i = 0; i < 3 && iIdx < images.length; i++) {
        result.push(images[iIdx++]);
      }
      // Add 3 texts
      for (let i = 0; i < 3 && tIdx < texts.length; i++) {
        result.push(texts[tIdx++]);
      }
    }

    return result;
  }, [posts, searchQuery]);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, { threshold: 0.1 });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith('video') ? 'video' : 'image';
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setFileType(type);
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

      const category = showCategoryInput ? customCategory : postCategory;

      setIsUploading(true);
      addUpload(mediaUrl || '', 'post', {
        userId: currentUser!.id,
        content: newPostContent,
        mediaType: mType,
        category: category,
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['posts'] });
        }
      });

      setNewPostContent('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setYtLink('');
      setShowYoutube(false);
      setShowCategoryInput(false);
      setCustomCategory('');
      setIsUploading(false); // Reset immediately so they can post again

    } catch (error: any) {
      setIsUploading(false);
      console.error('Post creation error:', error);
      alert('Failed to post: ' + (error.message || 'Unknown error.'));
    }
  };

  return (
    <div className="max-w-[90vmin] mx-auto w-full flex flex-col gap-[2vmin] pb-[10vmin]">
      {/* Search Bar */}
      <div className="bg-white dark:bg-black rounded-[2vmin] shadow-sm border border-gray-200 dark:border-gray-800 p-[1vmin] flex items-center gap-[1vmin] sticky top-0 z-50">
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

      {/* Content Type Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
        {(['All', 'Image', 'Text', 'Video'] as const).map(type => (
          <button 
            key={type} 
            onClick={() => setContentTypeFilter(type)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${contentTypeFilter === type ? 'bg-[#1877F2] text-white border-[#1877F2] shadow-md' : 'bg-white dark:bg-black text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900'}`}
          >
            {type}
          </button>
        ))}
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

      {/* Create Post Section */}
      <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-4">
          <div className="flex gap-2 mb-4 items-center">
            <textarea value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} placeholder="What's on your mind?" className="flex-1 bg-[#f0f2f5] dark:bg-gray-900 rounded-xl px-5 py-3 outline-none resize-none text-[15px] text-gray-800 dark:text-white placeholder-gray-400 font-medium" rows={2} />
          </div>
          {selectedFile && previewUrl && (
            <div className="relative mb-4 bg-black rounded-lg overflow-hidden max-h-48 flex justify-center border dark:border-gray-800">
              {fileType === 'image' ? (
                <img src={previewUrl} className="h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <video src={previewUrl} className="h-full" />
              )}
              <div className="absolute top-2 right-2 flex gap-2">
                <button 
                  onClick={() => setShowEditor(true)}
                  className="bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-all"
                  title="Edit Media"
                >
                  <Pencil size={14} />
                </button>
                <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-all">
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

      {/* Quick Videos Ribbon */}
      {reels.length > 0 && (
        <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-black flex items-center gap-2 text-gray-900 dark:text-white"><Clapperboard size={20} className="text-[#1877F2]" /> Next Videos</h3>
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
      {postsError ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <p className="font-bold text-red-500">Error loading posts: {postsError.message}</p>
          <button onClick={() => window.location.reload()} className="bg-[#1877F2] text-white px-4 py-2 rounded-lg font-bold">Retry</button>
        </div>
      ) : postsLoading && posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4"><div className="w-8 h-8 border-4 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div><p className="font-bold text-gray-500">Fast Loading...</p></div>
      ) : (
        <>
          {/* Optimistic Uploads */}
          {uploads.filter(u => u.type === 'post').map(upload => (
            <div key={upload.id} className={`bg-white dark:bg-black rounded-xl shadow-sm border ${upload.status === 'error' ? 'border-red-500' : 'border-[#1877F2] animate-pulse'} p-4`}>
              <div className="flex items-center gap-3 mb-3">
                <ProfilePhoto src={currentUser?.avatar_url || ''} alt="me" size="medium" />
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">{currentUser?.display_name}</h4>
                  <p className={`text-xs font-bold ${upload.status === 'error' ? 'text-red-500' : 'text-[#1877F2]'}`}>
                    {upload.status === 'error' ? 'Upload Failed. Please retry.' : `Uploading... ${Math.round(upload.progress)}%`}
                  </p>
                </div>
              </div>
              {upload.metadata?.content && <p className="text-gray-800 dark:text-gray-200 mb-3 text-sm">{upload.metadata.content}</p>}
              <div className={`w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-800 mt-2 overflow-hidden ${upload.status === 'error' ? 'hidden' : ''}`}>
                <div className="bg-[#1877F2] h-1.5 rounded-full transition-all duration-300" style={{ width: `${upload.progress}%` }}></div>
              </div>
            </div>
          ))}

          <AnimatePresence mode="popLayout">
            {filteredPosts.map((post, index) => (
              <motion.div 
                key={post.id}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
              >
                <PostCard 
                  post={post} 
                  onObserve={handleObserve}
                />
                {index > 0 && (index + 1) % 4 === 0 && <AdsterraAd />}
              </motion.div>
            ))}
          </AnimatePresence>
          {hasNextPage && (
            <div ref={loadMoreRef} className="py-4 text-center font-bold text-gray-500">
              {isFetchingNextPage ? 'Loading more...' : 'Loading...'}
            </div>
          )}
          {!hasNextPage && posts.length > 0 && (
            <p className="text-center text-gray-400 font-bold py-4">You're all caught up!</p>
          )}
          {!postsLoading && posts.length === 0 && uploads.filter(u => u.type === 'post').length === 0 && (
            <div className="text-center py-10">
              <p className="text-gray-500 dark:text-gray-400 font-bold">No posts found.</p>
              <p className="text-sm text-gray-400 mt-2">Be the first to create a post!</p>
            </div>
          )}
        </>
      )}

      {/* Story Viewer Modal Removed */}

      {/* Camera & Editor Modals */}
      {showCamera && (
        <CameraCapture 
          onCapture={(url, type) => {
            setSelectedFile(url);
            setFileType(type);
            setShowCamera(false);
          }}
          onCancel={() => setShowCamera(false)}
        />
      )}

      {showEditor && selectedFile && previewUrl && (
        <MediaEditor 
          mediaUrl={previewUrl}
          mediaType={fileType as 'image' | 'video'}
          onSave={(processed) => {
            setSelectedFile(processed);
            setPreviewUrl(processed);
            setShowEditor(false);
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  );
};

export default Feed;
