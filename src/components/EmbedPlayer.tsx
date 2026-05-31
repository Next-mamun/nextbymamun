import React, { useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/AuthContext';

interface EmbedPlayerProps {
  src: string;
}

const EmbedPlayer: React.FC<EmbedPlayerProps> = ({ src }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { autoplayVideos } = useTheme();

  useEffect(() => {
    const handleOtherVideoPlaying = (e: CustomEvent) => {
      if (e.detail.src !== src) {
        // Send pause command to YouTube/Vimeo iframes
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), 
          '*'
        );
      }
    };
    window.addEventListener('single-video-play' as any, handleOtherVideoPlaying);
    return () => window.removeEventListener('single-video-play' as any, handleOtherVideoPlaying);
  }, [src]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), 
            '*'
          );
        } else if (entry.intersectionRatio >= 0.5 && autoplayVideos) {
           iframeRef.current?.contentWindow?.postMessage(
             JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 
             '*'
           );
           window.dispatchEvent(new CustomEvent('single-video-play', { detail: { src } }));
        }
      },
      { threshold: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0], rootMargin: "-30% 0px -30% 0px" }
    );

    if (iframeRef.current) {
      observer.observe(iframeRef.current);
    }

    return () => observer.disconnect();
  }, [autoplayVideos, src]);

  // Ensure enablejsapi=1 is present for YouTube API control
  const getEnhancedSrc = (url: string) => {
    let enhancedUrl = url;
    if (enhancedUrl.includes('youtube.com') || enhancedUrl.includes('youtu.be')) {
      if (!enhancedUrl.includes('enablejsapi=1')) {
        enhancedUrl = enhancedUrl.includes('?') ? `${enhancedUrl}&enablejsapi=1` : `${enhancedUrl}?enablejsapi=1`;
      }
    }
    return enhancedUrl;
  };

  return (
    <div className="w-full aspect-video">
      <iframe
        ref={iframeRef}
        src={getEnhancedSrc(src)}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
        title="video-embed"
      />
    </div>
  );
};

export default EmbedPlayer;
