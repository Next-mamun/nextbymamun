import React, { useRef, useEffect } from 'react';

interface EmbedPlayerProps {
  src: string;
}

const EmbedPlayer: React.FC<EmbedPlayerProps> = ({ src }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          // Send pause command to YouTube/Vimeo iframes
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), 
            '*'
          );
        }
      },
      { threshold: 0.1 }
    );

    if (iframeRef.current) {
      observer.observe(iframeRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Ensure enablejsapi=1 is present for YouTube API control
  const getEnhancedSrc = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      if (!url.includes('enablejsapi=1')) {
        return url.includes('?') ? `${url}&enablejsapi=1` : `${url}?enablejsapi=1`;
      }
    }
    return url;
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
