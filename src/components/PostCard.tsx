
import React, { useState, useEffect, useRef } from 'react';
import { ThumbsUp, MessageSquare, Trash2, Eye, Send, MessageCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import ZoomableImage from '@/components/ZoomableImage';
import ProfilePhoto from '@/components/ProfilePhoto';
import VideoPlayer from '@/components/VideoPlayer';
import EmbedPlayer from '@/components/EmbedPlayer';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatTime } from '@/lib/utils';

interface PostCardProps {
  post: any;
  onObserve?: (el: HTMLElement) => void;
  isProfileView?: boolean;
}

const PostCard = React.memo(({ post, onObserve, isProfileView = false }: PostCardProps) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [localComments, setLocalComments] = useState<any[]>(post.comments || []);
  
  // Optimistic UI state
  const initialIsLiked = post.likes?.some((l: any) => l.user_id === currentUser?.id);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current && onObserve) {
      onObserve(cardRef.current);
    }
  }, [onObserve]);

  // Sync local state if post prop changes from server
  useEffect(() => {
    setIsLiked(post.likes?.some((l: any) => l.user_id === currentUser?.id));
    setLikesCount(post.likes?.length || 0);
    setLocalComments(post.comments || []);
  }, [post.likes, post.comments, currentUser?.id]);

  const handleLike = async () => {
    if (!currentUser) return;
    // Optimistic update
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikesCount(prev => newIsLiked ? prev + 1 : prev - 1);

    try {
      if (isLiked) {
        await supabase.from('likes').delete().match({ post_id: post.id, user_id: currentUser.id });
      } else {
        await supabase.from('likes').insert([{ post_id: post.id, user_id: currentUser.id }]);
        if (post.user_id !== currentUser.id) {
          await supabase.from('notifications').insert([{
            user_id: post.user_id,
            sender_id: currentUser.id,
            type: 'like',
            is_read: false,
            created_at: new Date().toISOString()
          }]);
          queryClient.invalidateQueries({ queryKey: ['notifications', post.user_id] });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    } catch (error) {
      // Revert on failure
      setIsLiked(isLiked);
      setLikesCount(post.likes?.length || 0);
      console.error("Failed to toggle like", error);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !currentUser) return;
    
    // Optimistic comment
    const newComment = {
      id: `temp-${Date.now()}`,
      post_id: post.id,
      user_id: currentUser.id,
      content: comment,
      created_at: new Date().toISOString(),
      profiles: currentUser
    };
    
    setLocalComments(prev => [...prev, newComment]);
    const commentText = comment;
    setComment('');

    try {
      await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser.id, content: commentText }]);
      if (post.user_id !== currentUser.id) {
        await supabase.from('notifications').insert([{
          user_id: post.user_id,
          sender_id: currentUser.id,
          type: 'comment',
          is_read: false,
          created_at: new Date().toISOString()
        }]);
        queryClient.invalidateQueries({ queryKey: ['notifications', post.user_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    } catch (error) {
      // Revert on error
      setLocalComments(post.comments || []);
      console.error("Failed to post comment", error);
    }
  };

  const triggerDelete = () => {
    setShowConfirmDelete(true);
  };

  const executeDelete = async () => {
    setShowConfirmDelete(false);
    const postId = post.id;
    // Optimistic delete: hide from all queries starting with 'posts'
    queryClient.setQueriesData({ queryKey: ['posts'] }, (oldData: any) => {
      if (!oldData || !oldData.pages) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page: any[]) => page.filter((p: any) => p.id !== postId))
      };
    });
    // Update userPosts cache
    queryClient.setQueriesData({ queryKey: ['userPosts'] }, (oldData: any) => {
       if (!oldData) return oldData;
       if (Array.isArray(oldData)) {
         return oldData.filter((p: any) => p.id !== postId);
       }
       return oldData;
    });

    try {
      await supabase.from('posts').delete().eq('id', postId);
    } catch (error) {
      console.error('Failed to delete post:', error);
      // Re-invalidate on failure
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
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
            <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">{formatTime(post.created_at, { showYear: true })}</p>
          </div>
        </Link>
        {post.user_id === currentUser?.id && <button onClick={triggerDelete} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"><Trash2 size={18} /></button>}
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
          {isProfileView && (
            <button onClick={() => navigate('/')} className="flex-1 flex items-center justify-center gap-2 py-2 font-bold text-[#1877F2] transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"><MessageCircle size={20} /> Feed</button>
          )}
        </div>
      </div>
      
      {showComments && (
        <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
          <div className="max-h-60 overflow-y-auto py-2 space-y-3 scrollbar-hide">
            {localComments.map((c: any, index: number) => (
              <div key={c.id || index} className="flex gap-2">
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

      <ConfirmDialog
        isOpen={showConfirmDelete}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        onConfirm={executeDelete}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>
  );
});

export default PostCard;
