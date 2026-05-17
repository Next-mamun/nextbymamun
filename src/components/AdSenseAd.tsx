import React, { useEffect, useState, useRef } from 'react';
import { ThumbsUp, MessageSquare, Share2 } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';

const AdSenseAd = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [adLoaded, setAdLoaded] = useState(false);
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    try {
      if (adRef.current && !adRef.current.hasAttribute('data-ad-status') && adRef.current.childNodes.length === 0) {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      }
    } catch (e: any) {
      if (!e.message?.includes('already have ads')) {
        console.error("AdSense error", e);
      }
    }

    if (adRef.current) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && (mutation.attributeName === 'data-ad-status' || mutation.attributeName === 'data-adsbygoogle-status')) {
            const status = adRef.current?.getAttribute('data-ad-status');
            const googleStatus = adRef.current?.getAttribute('data-adsbygoogle-status');
            if (status === 'unfilled') {
              setIsVisible(false);
            } else if (status === 'filled' || googleStatus === 'done') {
              // Wait a little bit for the iframe to actually render
              setTimeout(() => {
                 if (adRef.current && adRef.current.innerHTML.trim() !== "") {
                   setAdLoaded(true);
                 } else {
                   setIsVisible(false);
                 }
              }, 500);
            }
          }
        });
      });

      observer.observe(adRef.current, { attributes: true });

      // Fallback check after 3 seconds: if no ad is loaded, hide the container.
      // This stops ad blockers from showing a blank container.
      const fallbackTimer = setTimeout(() => {
        if (adRef.current) {
           const status = adRef.current.getAttribute('data-ad-status');
           const googleStatus = adRef.current.getAttribute('data-adsbygoogle-status');
           if (!adLoaded && status !== 'filled' && googleStatus !== 'done') {
             setIsVisible(false);
           }
        }
      }, 3000);

      return () => {
        observer.disconnect();
        clearTimeout(fallbackTimer);
      };
    }
  }, [adLoaded]);

  if (!isVisible) return null;

  return (
    <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-all mb-4">
      <div className="p-4 flex justify-between items-start">
        <div className="flex justify-between items-center w-full">
          <button className="flex gap-3 hover:opacity-80 transition-opacity cursor-pointer text-left w-full">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800 shrink-0">
              AD
            </div>
            <div>
              <p className="font-bold text-[15px] text-gray-900 dark:text-white leading-tight flex items-center gap-2">
                Sponsored
                <VerifiedBadge />
              </p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">Google AdSense</p>
            </div>
          </button>
        </div>
      </div>
      <p className="px-4 pb-3 text-[15px] text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
        Discover something new today! Check out this sponsored content below.
      </p>
      
      <div className="w-full relative flex justify-center bg-gray-50 dark:bg-gray-900 transition-all duration-300 min-h-[100px] overflow-hidden">
        <ins className="adsbygoogle"
             ref={adRef}
             style={{ display: "block", minWidth: "250px", width: "100%" }}
             data-ad-format="fluid"
             data-ad-layout-key="-6t+ed+2i-1n-4w"
             data-ad-client="ca-pub-1044610166642937"
             data-ad-slot="1210069105"></ins>
      </div>

      <div className="px-4 py-1">
        <div className="flex border-t border-gray-100 dark:border-gray-800 py-1 gap-1 mt-2">
          <button className="flex-1 flex items-center justify-center gap-2 py-2 font-bold text-gray-600 dark:text-gray-400 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"><ThumbsUp size={20} /> Like</button>
          <button className="flex-1 flex items-center justify-center gap-2 py-2 font-bold text-gray-600 dark:text-gray-400 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"><MessageSquare size={20} /> Comment</button>
          <button className="flex-1 flex items-center justify-center gap-2 py-2 font-bold text-gray-600 dark:text-gray-400 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"><Share2 size={20} /> Share</button>
        </div>
      </div>
    </div>
  );
};

export default AdSenseAd;
