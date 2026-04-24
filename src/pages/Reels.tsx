
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, X, Link as LinkIcon, ThumbsUp, MessageSquare, Share2, Music, UserPlus, Send, Video, Trash2, CheckCircle, Volume2, VolumeX, Eye, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Reel } from '@/types';
import ProfilePhoto from '@/components/ProfilePhoto';
import { formatTime, getPosterUrl } from '@/lib/utils';
import { redis } from '@/lib/redis';

import { useUpload } from '@/contexts/UploadContext';
import ConfirmDialog from '@/components/ConfirmDialog';

const REELS_PER_PAGE = 5;

const Reels: React.FC = () => {
  const { currentUser } = useAuth();
  const { addUpload } = useUpload();
  const queryClient = useQueryClient();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeReelId, setActiveReelId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Upload State
  const [ytLink, setYtLink] = useState('');
  const [caption, setCaption] = useState('');
  const [localFile, setLocalFile] = useState<File | string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showYoutube, setShowYoutube] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const {
    data: reelsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: reelsLoading,
  } = useInfiniteQuery({
    queryKey: ['reels_infinite'],
    queryFn: async ({ pageParam = 0 }) => {
      const cacheKey = `reels_page_${pageParam}`;
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return cached as any;
      } catch (e) {
        console.warn('Redis cache error', e);
      }

      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(*), likes(*), comments(*, profiles(*))')
        .eq('media_type', 'video')
        .not('media_url', 'ilike', '%youtube.com/embed%')
        .not('media_url', 'ilike', '%youtu.be%')
        .not('media_url', 'ilike', '%facebook.com%')
        .not('media_url', 'ilike', '%fb.watch%')
        .order('created_at', { ascending: false })
        .range(pageParam * REELS_PER_PAGE, (pageParam + 1) * REELS_PER_PAGE - 1);
      
      if (error) throw error;

      try {
        if (data && data.length > 0) {
          await redis.set(cacheKey, data, { ex: 30 }); // 30 sec cache for fresh content but fast load
        }
      } catch (e) {}

      return data || [];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === REELS_PER_PAGE ? allPages.length : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const reels = useMemo(() => 
    Array.from(new Map((reelsData?.pages.flat() || []).map(r => [r.id, r])).values()),
    [reelsData?.pages]
  );

  useEffect(() => {
    if (reels.length > 0 && !activeReelId) {
      setActiveReelId(reels[0].id);
    }
  }, [reels, activeReelId]);

  useEffect(() => {
    const channel = supabase.channel('reels_realtime_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: 'media_type=eq.video' }, () => {
        queryClient.invalidateQueries({ queryKey: ['reels_infinite'] });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['reels_infinite'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Intersection Observer for Auto-Play and Infinite Scroll
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (reelsLoading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-id');
          if (id) setActiveReelId(id);
          
          // Check for infinite scroll
          const index = entry.target.getAttribute('data-index');
          if (index && parseInt(index) === reels.length - 1 && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }
      });
    }, { threshold: 0.6 });

    // Observe all reel items
    document.querySelectorAll('.reel-item').forEach(el => observer.current?.observe(el));
  }, [reelsLoading, reels.length, hasNextPage, isFetchingNextPage, fetchNextPage]);


  // --- Upload Logic ---
  const getYoutubeId = (url: string | null | undefined) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getFacebookEmbedUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.match(/(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch)/i)) {
      if (url.includes('plugins/video.php')) return url;
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=560`;
    }
    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File is too large. Please select a video under 10MB.');
        return;
      }
      setLocalFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleCreateReel = async () => {
    if (!caption.trim() && !ytLink && !localFile) return;

    let targetLink = ytLink;
    if (!targetLink && !localFile) {
      const urlMatch = caption.match(/https?:\/\/(?:www\.|m\.|web\.)?(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch)\/[^\s]+/i);
      if (urlMatch) targetLink = urlMatch[0];
    }

    let payload: any = {
      user_id: currentUser?.id,
      caption,
      source_type: 'local',
      video_url: '' // Will be updated by UploadContext
    };

    const ytId = getYoutubeId(targetLink);
    const fbUrl = getFacebookEmbedUrl(targetLink);

    if (ytId) {
      payload.source_type = 'youtube';
      payload.youtube_id = ytId;
      payload.video_url = `https://www.youtube.com/embed/${ytId}`;
    } else if (fbUrl) {
      payload.source_type = 'youtube'; // fallback since DB only allows youtube or local
      payload.video_url = fbUrl;
    }

    if (!localFile && !payload.video_url) {
      alert('Please provide a valid video file or YouTube/Facebook link.');
      return;
    }

    addUpload(localFile || payload.video_url, 'reel', {
      payload,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['reels_infinite'] });
      }
    });

    setIsUploadModalOpen(false);
    setYtLink('');
    setCaption('');
    setLocalFile(null);
    setPreviewUrl(null);
  };

  const triggerDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);

    // Optimistic delete
    queryClient.setQueriesData({ queryKey: ['reels_infinite'] }, (oldData: any) => {
      if (!oldData || !oldData.pages) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page: any[]) => page.filter((r: any) => r.id !== id))
      };
    });
    try {
      await supabase.from('posts').delete().eq('id', id);
    } catch (e) {
      console.error(e);
      queryClient.invalidateQueries({ queryKey: ['reels_infinite'] });
    }
  };

  if (reelsLoading && reels.length === 0) return <div className="h-screen flex items-center justify-center text-[#1877F2] font-black">Loading Videos...</div>;

  return (
    <div className="fixed inset-0 z-40 bg-black overflow-y-scroll snap-y snap-mandatory scroll-smooth hide-scrollbar flex flex-col md:items-center">
      {/* Floating Actions removed */}

      {reels.length === 0 ? (
        <div className="h-full w-full flex flex-col items-center justify-center text-white/50 px-10 text-center shrink-0 mix-blend-screen">
          <Video size={80} strokeWidth={1} className="mb-4 opacity-20" />
          <p className="text-xl font-bold">No Videos Yet</p>
          <p className="text-sm">Be the first to share a moment on Next!</p>
        </div>
      ) : reels.map((reel, index) => (
        <div 
          key={reel.id} 
          data-id={reel.id}
          data-index={index}
          ref={lastElementRef}
          className="reel-item h-[100dvh] w-full md:w-[450px] shrink-0 snap-start md:snap-center relative flex items-center justify-center bg-black"
        >
          <ReelItem 
            reel={reel} 
            isActive={activeReelId === reel.id} 
            onDelete={() => triggerDelete(reel.id)} 
          />
        </div>
      ))}

      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        title="Delete Video"
        message="Are you sure you want to delete this video? This action cannot be undone."
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
              <h2 className="font-black text-xl text-gray-900 dark:text-white">Create Video</h2>
              <button onClick={() => setIsUploadModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={20} className="text-gray-600 dark:text-gray-300" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <textarea 
                placeholder="Write a caption..." 
                value={caption}
                onChange={e => setCaption(e.target.value)}
                className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl outline-none border-2 border-transparent focus:border-[#1877F2] min-h-[100px] text-gray-800 dark:text-white font-medium resize-none placeholder-gray-500"
              />
              
              <div 
                onClick={() => !localFile && !getYoutubeId(ytLink) && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl overflow-hidden flex flex-col items-center justify-center transition-all aspect-[9/16] ${localFile || getYoutubeId(ytLink) ? 'border-green-500 bg-black' : 'border-gray-300 dark:border-gray-700 hover:border-[#1877F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer'}`}
              >
                {localFile && previewUrl ? (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                      <video src={previewUrl} className="w-full h-full object-contain" controls />
                      <button onClick={(e) => { e.stopPropagation(); setLocalFile(null); setPreviewUrl(null); }} className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-red-500"><X size={16} /></button>
                  </div>
                ) : (getYoutubeId(ytLink) || getFacebookEmbedUrl(ytLink)) ? (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                      <iframe 
                        src={getYoutubeId(ytLink) ? `https://www.youtube.com/embed/${getYoutubeId(ytLink)}?rel=0&modestbranding=1&iv_load_policy=3&controls=1&disablekb=1` : (getFacebookEmbedUrl(ytLink) || '')} 
                        className="w-full h-full"
                        allowFullScreen
                        sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                        title="reel-preview"
                      />
                      <button onClick={(e) => { e.stopPropagation(); setYtLink(''); }} className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-red-500"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-[#1877F2]">
                        <Video size={32} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-700 dark:text-gray-300">Upload Video</p>
                        <p className="text-xs text-gray-400 mt-1">MP4, MOV (Max 10MB)</p>
                      </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => setShowYoutube(!showYoutube)}
                  className="text-sm font-bold text-[#1877F2] flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg transition-colors w-full"
                >
                  <LinkIcon size={16} />
                  {showYoutube ? 'Hide Link Option' : 'Add YouTube/Facebook Link'}
                </button>
                
                {showYoutube && (
                  <input 
                    type="text" 
                    placeholder="Paste Video Link..." 
                    value={ytLink}
                    onChange={e => setYtLink(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none border border-gray-200 dark:border-gray-700 focus:border-[#1877F2] text-sm text-gray-900 dark:text-white placeholder-gray-500"
                  />
                )}
              </div>

              <input type="file" ref={fileInputRef} hidden accept="video/*" onChange={handleFileUpload} />

              <button 
                onClick={handleCreateReel}
                disabled={(!localFile && !ytLink && !caption.match(/https?:\/\/(?:www\.|m\.|web\.)?(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch)\/[^\s]+/i))}
                className="w-full bg-[#1877F2] text-white py-3.5 rounded-xl font-bold shadow-lg hover:brightness-110 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                Share Video
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReelItem: React.FC<{ reel: any, isActive: boolean, onDelete: () => void }> = ({ reel, isActive, onDelete }) => {
  const { currentUser } = useAuth();
  const [views, setViews] = useState(reel.views || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasViewed = useRef(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const [isLiked, setIsLiked] = useState(reel.likes?.some((l: any) => l.user_id === currentUser?.id));
  const [likesCount, setLikesCount] = useState(reel.likes?.length || 0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState((reel.comments || []).slice().reverse());

  const poster = getPosterUrl(reel.media_url);

  const isYouTube = reel.media_url?.includes('youtube.com/embed') || reel.media_url?.includes('fb.watch') || reel.media_url?.includes('facebook.com');

  useEffect(() => {
    if (isActive) {
      setIsPlaying(true);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => {
            console.log("Autoplay prevented", e);
            setIsPlaying(false);
        });
      }
      
      // Increment view count
      if (!hasViewed.current) {
        const incrementView = async () => {
          try {
            const { data } = await supabase.from('posts').select('views').eq('id', reel.id).single();
            if (data) {
              await supabase.from('posts').update({ views: (data.views || 0) + 1 }).eq('id', reel.id);
              setViews(prev => prev + 1);
            }
          } catch (err) {
            console.error('Error updating views:', err);
          }
          hasViewed.current = true;
        };
        incrementView();
      }
    } else {
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  }, [isActive, reel.id]);

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLVideoElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > rect.width / 2) {
      pressTimer.current = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.playbackRate = 2.0;
        }
      }, 300); // 300ms hold to activate 2x speed
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLVideoElement>) => {
    e.stopPropagation();
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (videoRef.current) {
      videoRef.current.playbackRate = 1.0;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleLike = async () => {
    if (isLiked) {
      setLikesCount(prev => prev - 1);
      setIsLiked(false);
      await supabase.from('likes').delete().match({ post_id: reel.id, user_id: currentUser?.id });
    } else {
      setLikesCount(prev => prev + 1);
      setIsLiked(true);
      await supabase.from('likes').insert([{ post_id: reel.id, user_id: currentUser?.id }]);
      
      if (reel.user_id !== currentUser?.id) {
        await supabase.from('notifications').insert([{
          user_id: reel.user_id,
          sender_id: currentUser?.id,
          type: 'like',
          created_at: new Date().toISOString()
        }]);
      }
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    
    const { data, error } = await supabase
      .from('comments')
      .insert([{ post_id: reel.id, user_id: currentUser?.id, content: commentText }])
      .select('*, profiles(*)')
      .single();

    if (data) {
      setComments(prev => [data, ...prev]);
      setCommentText('');
      
      if (reel.user_id !== currentUser?.id) {
        await supabase.from('notifications').insert([{
          user_id: reel.user_id,
          sender_id: currentUser?.id,
          type: 'comment',
          created_at: new Date().toISOString()
        }]);
      }
    }
  };

  let ytUrl = reel.media_url;
  if (isYouTube && isActive) {
      try {
        const urlObj = new URL(reel.media_url);
        urlObj.searchParams.set('autoplay', '1');
        urlObj.searchParams.set('mute', '0');
        urlObj.searchParams.set('controls', '0');
        urlObj.searchParams.set('loop', '1');
        const playlistId = urlObj.pathname.split('/').pop();
        if (playlistId) {
            urlObj.searchParams.set('playlist', playlistId);
        }
        ytUrl = urlObj.toString();
      } catch (e) {}
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${reel.profiles?.display_name}`,
          text: reel.content,
          url: `${window.location.origin}/post/${reel.id}`,
        });
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/post/${reel.id}`);
        alert('Link copied to clipboard!');
      }
    } catch (e) {
      console.error('Error sharing', e);
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      {/* Video Layer */}
      <div className="w-full h-full md:w-[450px] relative bg-black flex items-center justify-center">
        {isYouTube ? (
          isActive ? (
            <iframe 
              src={ytUrl}
              className="w-full h-full object-contain pointer-events-none"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
              title="reel-player"
            />
          ) : (
             <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-[#1877F2] animate-spin" />
             </div>
          )
        ) : (
          <>
            <video 
              ref={videoRef}
              src={reel.media_url} 
              poster={poster}
              loop 
              muted={isMuted}
              playsInline
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onClick={togglePlayPause}
              className="w-full h-full object-contain cursor-pointer"
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                  <Play size={32} className="text-white ml-2" />
                </div>
              </div>
            )}
            {/* Speed Indicator */}
            {videoRef.current && videoRef.current.playbackRate > 1 && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-md pointer-events-none">
                2x Speed
              </div>
            )}
          </>
        )}
        
        {/* Mute Indicator (Local Video Only) */}
        {!isYouTube && (
           <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="absolute top-4 right-4 p-2 bg-black/40 rounded-full text-white backdrop-blur-sm z-20 hover:scale-110 transition-transform">
             {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
           </button>
        )}
      </div>

      {/* Overlay UI */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end p-4 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none">
        <div className="flex items-end justify-between w-full md:w-[450px] mx-auto pointer-events-auto pb-16 md:pb-4">
          <div className="space-y-3 max-w-[80%]">
            <Link to={`/profile/${reel.profiles?.username}`} className="flex items-center gap-3 group">
              <ProfilePhoto src={reel.profiles?.avatar_url || ''} alt="profile" size="medium" />
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm drop-shadow-md group-hover:underline flex items-center gap-1">
                  {reel.profiles?.display_name}
                  {reel.profiles?.is_verified && <VerifiedBadge />}
                </span>
                <span className="text-white/80 text-xs">@{reel.profiles?.username}</span>
              </div>
            </Link>
            
            <p className="text-white text-sm drop-shadow-md leading-snug line-clamp-2">{reel.content}</p>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-white/80 text-xs bg-white/10 px-2 py-1 rounded-md backdrop-blur-sm">
                <Eye size={12} />
                <span>{views} views</span>
              </div>
              <div className="flex items-center gap-2 text-white/70 text-xs bg-white/10 px-3 py-1 rounded-full w-fit backdrop-blur-sm">
                <Music size={12} />
                <span className="truncate max-w-[150px]">Original Audio • {reel.profiles?.display_name}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-5">
             <div className="flex flex-col items-center gap-1">
              <button 
                onClick={handleLike}
                className={`p-3 rounded-full backdrop-blur-md transition-all active:scale-90 ${isLiked ? 'bg-[#1877F2]' : 'bg-black/40 hover:bg-black/60'} text-white`}
              >
                <ThumbsUp size={24} fill={isLiked ? "currentColor" : "none"} />
              </button>
              <span className="text-white text-xs font-bold drop-shadow-md">{likesCount}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={() => setShowComments(true)}
                className="p-3 bg-black/40 rounded-full text-white backdrop-blur-md hover:bg-black/60 transition-all active:scale-90"
              >
                <MessageSquare size={24} />
              </button>
              <span className="text-white text-xs font-bold drop-shadow-md">{comments.length}</span>
            </div>

            <button onClick={handleShare} className="p-3 bg-black/40 rounded-full text-white backdrop-blur-md hover:bg-black/60 transition-all active:scale-90">
              <Share2 size={24} />
            </button>

            {reel.user_id === currentUser?.id && (
              <button 
                onClick={onDelete}
                className="p-3 bg-black/40 rounded-full text-white/80 backdrop-blur-md hover:bg-red-500 hover:text-white transition-all active:scale-90"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

       {/* Comments Drawer */}
       {showComments && (
         <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom duration-300 md:w-[450px] md:mx-auto">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
              <h3 className="text-white font-bold text-center flex-1">Comments ({comments.length})</h3>
              <button onClick={() => setShowComments(false)} className="text-white p-1 hover:bg-white/10 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
               {comments.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-white/30 gap-2">
                   <MessageSquare size={40} />
                   <p>No comments yet</p>
                 </div>
               ) : Array.from(new Map(comments.map((c: any) => [c.id, c])).values()).map((c: any) => (
                 <div key={c.id} className="flex gap-3 text-white group">
                    <Link to={`/profile/${c.profiles?.username}`}>
                      <ProfilePhoto src={c.profiles?.avatar_url || ''} alt="commenter" size="small" />
                    </Link>
                    <div className="flex-1">
                       <div className="flex items-baseline gap-2">
                         <Link to={`/profile/${c.profiles?.username}`} className="font-bold text-sm hover:underline text-gray-200 flex items-center gap-1">
                           {c.profiles?.display_name}
                           {c.profiles?.is_verified && <VerifiedBadge size={12} />}
                         </Link>
                         <span className="text-[10px] text-gray-500">{formatTime(c.created_at)}</span>
                       </div>
                       <p className="text-sm text-gray-300 mt-0.5">{c.content}</p>
                    </div>
                 </div>
               ))}
            </div>
            
            <form onSubmit={handleComment} className="p-3 bg-black border-t border-white/10 flex gap-2 items-center">
              <ProfilePhoto src={currentUser?.avatar_url || ''} alt="me" size="small" />
              <div className="flex-1 relative">
                <input 
                   value={commentText}
                   onChange={e => setCommentText(e.target.value)}
                   placeholder="Add a comment..." 
                   className="w-full bg-white/10 rounded-full px-4 py-2 text-white outline-none focus:bg-white/20 transition-colors text-sm pr-10" 
                />
                <button 
                   type="submit" 
                   disabled={!commentText.trim()}
                   className="absolute right-2 top-1/2 -translate-y-1/2 text-[#1877F2] disabled:opacity-30 hover:scale-110 transition-transform"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
         </div>
       )}
    </div>
  );
};

export default Reels;
