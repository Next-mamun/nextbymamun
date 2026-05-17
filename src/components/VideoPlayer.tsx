import React, { useRef, useEffect, useState } from 'react';
import { getPosterUrl } from '@/lib/utils';
import { useTheme } from '@/contexts/AuthContext';

interface VideoPlayerProps {
  src: string;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { autoplayVideos, saveDataMode } = useTheme();

  const poster = getPosterUrl(src);

  useEffect(() => {
    const handleOtherVideoPlaying = (e: CustomEvent) => {
      if (e.detail.src !== src) {
        if (!videoRef.current?.paused) {
          videoRef.current?.pause();
          setIsPlaying(false);
        }
      }
    };
    window.addEventListener('single-video-play' as any, handleOtherVideoPlaying);
    return () => window.removeEventListener('single-video-play' as any, handleOtherVideoPlaying);
  }, [src]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          if (!videoRef.current?.paused) {
            videoRef.current?.pause();
            setIsPlaying(false);
          }
        } else if (autoplayVideos && videoRef.current?.paused) {
          // Play only if it is sufficiently visible
          const playPromise = videoRef.current?.play();
          if (playPromise !== undefined) {
              playPromise.then(() => {
                  setIsPlaying(true);
                  window.dispatchEvent(new CustomEvent('single-video-play', { detail: { src } }));
              }).catch(e => console.log("Autoplay failed", e));
          }
        }
      },
      { threshold: 0.1, rootMargin: "-35% 0px -35% 0px" }
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => observer.disconnect();
  }, [autoplayVideos, src]);

  return (
    <div className={`relative w-full ${className}`}>
       <video
         ref={videoRef}
         src={src}
         poster={poster}
         controls
         playsInline
         preload={saveDataMode ? "none" : "metadata"}
         className="w-full max-h-[600px] rounded-lg bg-black object-contain"
         onPlay={() => setIsPlaying(true)}
         onPause={() => setIsPlaying(false)}
       />
    </div>
  );
};

export default VideoPlayer;
