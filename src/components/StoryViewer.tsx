import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Story, User } from '@/types';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '@/App';
import { Eye } from 'lucide-react';
interface StoryViewerProps {
  stories: Story[];
  users: User[];
  initialStoryIndex: number;
  onClose: () => void;
}

const StoryViewer: React.FC<StoryViewerProps> = ({ stories, users, initialStoryIndex, onClose }) => {
  const { currentUser } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialStoryIndex);
  const [progress, setProgress] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [viewers, setViewers] = useState<any[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const storyDuration = 5000; // 5 seconds per story

  const currentUserForStory = users.find(u => u.id === stories[currentIndex]?.user_id);

  useEffect(() => {
    const recordView = async () => {
      const story = stories[currentIndex];
      if (!story || !currentUser) return;
      
      // Record view
      if (story.user_id !== currentUser.id) {
        await supabase.from('story_views').insert([{ story_id: story.id, viewer_id: currentUser.id }]).select().single();
      }

      // Fetch views if owner
      if (story.user_id === currentUser.id) {
        const { data, count } = await supabase
          .from('story_views')
          .select('*, profiles:viewer_id(*)', { count: 'exact' })
          .eq('story_id', story.id);
        
        setViewCount(count || 0);
        setViewers(data?.map(v => v.profiles) || []);
      }
    };

    recordView();
  }, [currentIndex, stories, currentUser]);

  useEffect(() => {
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      const newProgress = (elapsedTime / storyDuration) * 100;
      if (newProgress >= 100) {
        handleNext();
      } else {
        setProgress(newProgress);
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, stories]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (!currentUserForStory) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center animate-in fade-in">
      <div className="relative w-full max-w-md h-full max-h-[90vh] bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Progress Bars */}
        <div className="absolute top-2 left-2 right-2 flex items-center gap-1 z-20">
          {stories.map((_, index) => (
            <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-50 linear"
                style={{ width: `${index === currentIndex ? progress : (index < currentIndex ? 100 : 0)}%` }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-5 left-4 right-4 z-20 flex items-center justify-between">
          <Link to={`/profile/${currentUserForStory.username}`} className="flex items-center gap-3">
            <img src={currentUserForStory.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-white/80" alt="avatar" />
            <div>
              <p className="font-bold text-white text-sm">{currentUserForStory.display_name}</p>
              <p className="text-xs text-gray-300">@{currentUserForStory.username}</p>
            </div>
          </Link>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={28} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center relative">
          <img src={stories[currentIndex].media_url} className="max-h-full max-w-full object-contain" alt="story content" />
        </div>

        {/* View Count for Owner */}
        {currentUserForStory.id === currentUser?.id && (
          <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-sm font-bold cursor-pointer hover:bg-black/70 transition-colors">
            <Eye size={16} />
            <span>{viewCount} Views</span>
          </div>
        )}

        {/* Navigation */}
        <div 
          className="absolute left-0 top-0 h-full w-1/2 z-10" 
          onClick={handlePrev}
        />
        <div 
          className="absolute right-0 top-0 h-full w-1/2 z-10" 
          onClick={handleNext}
        />

        <button onClick={handlePrev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 p-2 rounded-full z-30 transition-colors">
          <ChevronLeft className="text-white" />
        </button>
        <button onClick={handleNext} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 p-2 rounded-full z-30 transition-colors">
          <ChevronRight className="text-white" />
        </button>
      </div>
    </div>
  );
};

export default StoryViewer;
