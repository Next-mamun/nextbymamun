import React, { useRef, useEffect, useState } from 'react';
import { getPosterUrl } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const poster = getPosterUrl(src);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // If the video goes out of view (isIntersecting is false) and it is currently playing, pause it.
        if (!entry.isIntersecting && !videoRef.current?.paused) {
          videoRef.current?.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.2 } // Trigger when 20% visible or less
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className={`relative w-full ${className}`}>
       <video
         ref={videoRef}
         src={src}
         poster={poster}
         controls
         playsInline
         className="w-full max-h-[600px] rounded-lg bg-black object-contain"
         onPlay={() => setIsPlaying(true)}
         onPause={() => setIsPlaying(false)}
       />
    </div>
  );
};

export default VideoPlayer;
