
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
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { CameraCapture, MediaEditor } from '@/components/MediaTools';

import PostCard from '@/components/PostCard';
import AdsterraAd from '@/components/AdsterraAd';
import { getPosterUrl } from '@/lib/utils';
import { redis } from '@/lib/redis';

import { useUpload } from '@/contexts/UploadContext';

const Feed: React.FC = () => {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { addUpload, uploads } = useUpload();
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | string | null>(null);
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | 'text'>('text');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  
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
  
  const viewedPostsRef = useRef<Set<string>>(new Set());
  const observer = useRef<IntersectionObserver | null>(null);

  // Fetch Reels
  const { data: reels = [] } = useQuery({
    queryKey: ['reels'],
    queryFn: async () => {
      const { data } = await supabase
        .from('reels')
        .select('*, profiles(*)')
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
      const cacheKey = `posts_cache_${selectedCategory}_${contentTypeFilter}_${pageParam}`;
      try {
        const cachedStr = await redis.get(cacheKey);
        if (cachedStr) {
          // Check if it's already an object or a string
          return typeof cachedStr === 'string' ? JSON.parse(cachedStr) : cachedStr;
        }
      } catch (e) {
        console.warn('Redis read failed frontend cache', e);
      }

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
      
      const responseData = data || [];
      try {
        // Cache in redis for 10 minutes (600s)
        await redis.setex(cacheKey, 600, JSON.stringify(responseData));
      } catch (e) {
        console.warn('Redis write failed frontend cache', e);
      }
      return responseData;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === POSTS_PER_PAGE ? allPages.length : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const [feedRandomSeed] = useState(() => Math.random());

  const posts = useMemo(() => {
    let flatPosts = Array.from(new Map((postsData?.pages.flat() || []).map(p => [p.id, p])).values()) as any[];
    
    // Only shuffle the first few pages simply so the user gets a unique feed at the top every entry
    // without completely breaking the illusion of pagination. We only do this if ALL types are shown.
    if (flatPosts.length > 0 && selectedCategory === 'All' && contentTypeFilter === 'All') {
      // Create a deterministic shuffle based on the mount seed
      const seededRandom = (seed: number) => {
        let x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };
      
      let currentSeed = feedRandomSeed;
      
      // We'll shuffle the top 20 items so the very latest ones get mixed up.
      const toShuffle = flatPosts.slice(0, 20);
      const remaining = flatPosts.slice(20);
      
      for (let i = toShuffle.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(currentSeed) * (i + 1));
        currentSeed += 1;
        [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
      }
      
      flatPosts = [...toShuffle, ...remaining];
    }
    
    return flatPosts;
  }, [postsData?.pages, selectedCategory, contentTypeFilter, feedRandomSeed]);

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

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedThumbnail(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'next_app_uploads');
    const cloudName = 'dcwe6ln0h';
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Cloudinary Upload Failed');
    const data = await res.json();
    return data.secure_url;
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

      let thumbnailUrl: string | undefined = undefined;
      if (selectedThumbnail) {
        try {
          thumbnailUrl = await uploadToCloudinary(selectedThumbnail);
        } catch (err) {
          console.error("Failed to upload custom thumbnail", err);
        }
      }

      const metadataObj: any = {
        userId: currentUser!.id,
        content: newPostContent,
        mediaType: mType,
        category: category,
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['posts'] });
        }
      };
      if (thumbnailUrl) {
         metadataObj.payload = { 
             user_id: currentUser!.id,
             content: newPostContent,
             category: category,
             views: 0,
             thumbnail_url: thumbnailUrl 
         };
      }
      addUpload(mediaUrl || '', 'post', metadataObj);

      setNewPostContent('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setSelectedThumbnail(null);
      setThumbnailPreview(null);
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
        <button 
          onClick={() => navigate('/reels')}
          className="px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border bg-white dark:bg-black text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 flex items-center gap-1"
        >
          <Clapperboard size={14} className="text-[#1877F2]" />
          Reels
        </button>
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

      <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mb-4">
        <div className="p-4 flex gap-3">
          <ProfilePhoto src={currentUser?.avatar_url || ''} alt="user" size="medium" />
          <div className="flex-1">
            <textarea 
              value={newPostContent} 
              onChange={(e) => setNewPostContent(e.target.value)} 
              placeholder="What's on your mind?" 
              className="w-full bg-transparent border-none outline-none resize-none text-[15px] text-gray-800 dark:text-white placeholder-gray-500 font-medium pt-2 min-h-[40px]" 
              rows={newPostContent.split('\n').length > 1 ? Math.min(newPostContent.split('\n').length, 5) : 1} 
              style={{ overflow: 'hidden' }}
            />
            
            {selectedFile && previewUrl && (
              <div className="relative mt-3 flex flex-col gap-2">
                <div className="relative bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden max-h-64 flex justify-center border border-gray-100 dark:border-gray-800">
                  {fileType === 'image' ? (
                    <img src={previewUrl} className="h-full w-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <video src={previewUrl} className="h-full w-full object-cover" />
                  )}
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button 
                      onClick={() => setShowEditor(true)}
                      className="bg-black/60 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/80 transition-all shadow-sm"
                      title="Edit Media"
                    >
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="bg-black/60 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/80 transition-all shadow-sm">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                
                {fileType === 'video' && (
                  <div className="flex gap-3 items-center bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800 mt-1">
                    <input type="file" ref={thumbnailInputRef} hidden onChange={handleThumbnailSelect} accept="image/*" />
                    <button onClick={() => thumbnailInputRef.current?.click()} className="text-xs font-bold text-[#1877F2] hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5">
                      <LucideImage size={14} /> {thumbnailPreview ? 'Change Cover' : 'Add Cover Image'}
                    </button>
                    {thumbnailPreview && (
                      <div className="relative w-8 h-8 rounded shrink-0 shadow-sm border border-gray-200 dark:border-gray-700">
                        <img src={thumbnailPreview} className="w-full h-full object-cover rounded" />
                        <button onClick={() => { setSelectedThumbnail(null); setThumbnailPreview(null); }} className="absolute -top-1.5 -right-1.5 bg-black text-white rounded-full shadow-md p-0.5">
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {!selectedFile && (
              (ytLink && getEmbedUrl(ytLink)) || 
              (!ytLink && newPostContent.match(/https?:\/\/(?:www\.|m\.|web\.)?(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch)\/[^\s]+/i) && getEmbedUrl(newPostContent.match(/https?:\/\/(?:www\.|m\.|web\.)?(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch)\/[^\s]+/i)?.[0] || ''))
            ) && (
              <div className="relative mt-3 bg-black rounded-xl overflow-hidden aspect-video flex justify-center shadow-inner">
                <iframe 
                  src={getEmbedUrl(ytLink) || getEmbedUrl(newPostContent.match(/https?:\/\/(?:www\.|m\.|web\.)?(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch)\/[^\s]+/i)?.[0] || '') || ''} 
                  className="w-full h-full border-none"
                  allowFullScreen
                />
                <button 
                  onClick={() => { setYtLink(''); }} 
                  className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/80 transition-all shadow-sm"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Options & Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-gray-100 dark:border-gray-800/60 px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30 gap-3">
          <div className="flex items-center gap-1 flex-wrap">
            <input type="file" ref={fileInputRef} hidden onChange={(e) => handleFileSelect(e)} accept="image/*,video/*" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full text-green-500 transition-colors group" title="Photo/Video">
              <LucideImage size={20} className="group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold text-gray-600 dark:text-gray-400 hidden sm:inline">Media</span>
            </button>
            <button onClick={() => setShowCamera(true)} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full text-blue-500 transition-colors group" title="Camera">
              <Camera size={20} className="group-hover:scale-110 transition-transform" />
            </button>
            <button onClick={() => setShowYoutube(!showYoutube)} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-red-500 transition-colors group" title="Embed Video">
              <LinkIcon size={20} className="group-hover:scale-110 transition-transform" />
            </button>
            <button onClick={() => setShowCategoryInput(!showCategoryInput)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors group ${showCategoryInput || postCategory !== 'Entertainment' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-500' : 'hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-400'}`}>
              <CheckCircle size={20} className="group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold whitespace-nowrap hidden sm:inline">{postCategory === 'Entertainment' && !showCategoryInput ? 'Category' : postCategory}</span>
            </button>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <button 
              onClick={handleCreatePost} 
              disabled={(!newPostContent.trim() && !selectedFile && !ytLink) || isUploading} 
              className="bg-[#1877F2] text-white px-6 py-2 rounded-full font-bold text-sm tracking-wide disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 transition-all shadow-md hover:shadow-lg disabled:shadow-none hover:scale-[1.02] active:scale-[0.98] shrink-0 ml-auto"
            >
              Post
            </button>
          </div>
        </div>

        {/* Expandable Menus */}
        <div className="overflow-hidden">
          {showCategoryInput && (
            <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-black animate-in slide-in-from-top-2 duration-200">
              <input 
                type="text" 
                placeholder="Type custom category..." 
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                autoFocus
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg outline-none border border-gray-200 dark:border-gray-700 focus:border-[#1877F2] text-sm font-medium shadow-sm text-gray-900 dark:text-white transition-colors"
              />
            </div>
          )}
          {!showCategoryInput && (newPostContent.trim() || selectedFile || ytLink) && (
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-black flex gap-2 overflow-x-auto scrollbar-hide">
              {categories.filter(c => c !== 'All').map(cat => (
                <button 
                  key={cat} 
                  onClick={() => setPostCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${postCategory === cat ? 'bg-black dark:bg-white text-white dark:text-black border-transparent shadow-sm' : 'bg-white dark:bg-black text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          {showYoutube && (
            <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-black animate-in slide-in-from-top-2 duration-200">
              <input 
                type="text" 
                placeholder="Paste YouTube or Facebook Link..." 
                value={ytLink}
                onChange={e => setYtLink(e.target.value)}
                autoFocus
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg outline-none border border-gray-200 dark:border-gray-700 focus:border-red-400 text-sm font-medium shadow-sm text-gray-900 dark:text-white transition-colors"
              />
            </div>
          )}
        </div>
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
                   <img src={getPosterUrl(reel.video_url)} onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} className="w-full h-full object-cover" />
                )}
                <video src={reel.video_url} className={`w-full h-full object-cover ${getPosterUrl(reel.video_url) ? 'hidden' : ''}`} muted playsInline />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <div className="bg-black/50 p-2 rounded-full backdrop-blur-sm">
                    <Clapperboard size={20} className="text-white" />
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10">
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
        <div className="flex flex-col gap-4">
           {[...Array(3)].map((_, i) => (
             <div key={i} className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 animate-pulse">
               <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
                 <div className="flex-1">
                   <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-2"></div>
                   <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
                 </div>
               </div>
               <div className="space-y-2 mb-4">
                 <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
                 <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-5/6"></div>
                 <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-4/6"></div>
               </div>
               <div className="w-full h-48 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
             </div>
           ))}
        </div>
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
