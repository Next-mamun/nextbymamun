import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2, RefreshCw, Loader2, ThumbsUp, MessageSquare, Share2 } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';

const AdsterraAd = () => {
  const [iframeHeight, setIframeHeight] = useState(250);
  const [showModal, setShowModal] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  const adUrl = "https://www.profitablecpmratenetwork.com/ea5z8bt2q?key=adafad77a6c4b7f864d08b70c2c1808e";

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ad-resize') {
        setIframeHeight(Math.max(event.data.height, 90));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <>
      {isVisible && (
        <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-all mb-4">
          <div className="p-4 flex justify-between items-start">
            <button onClick={() => { setShowModal(true); setIsLoading(true); }} className="flex gap-3 hover:opacity-80 transition-opacity cursor-pointer text-left">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800 shrink-0">
                SP
              </div>
              <div>
                <p className="font-bold text-[15px] text-gray-900 dark:text-white leading-tight flex items-center gap-2">
                  Sponsored
                  <VerifiedBadge />
                </p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">Promoted Content</p>
              </div>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shrink-0 ml-2"
            >
              Cancel
            </button>
          </div>
          <p className="px-4 pb-3 text-[15px] text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
            Discover something new today! Check out this sponsored content below.
          </p>
          
          <div className="w-full relative flex justify-center bg-gray-50 dark:bg-gray-900 transition-all duration-300">
            <iframe
              src="/ad.html"
              sandbox="allow-scripts allow-same-origin allow-forms"
              style={{ 
                width: '100%', 
                border: 'none', 
                overflow: 'hidden', 
                height: `${iframeHeight}px`,
                minHeight: '90px'
              }}
              title="Advertisement"
            />
          </div>

          <div className="px-4 py-1">
            <div className="flex border-t border-gray-100 dark:border-gray-800 py-1 gap-1 mt-2">
              <button className="flex-1 flex items-center justify-center gap-2 py-2 font-bold text-gray-600 dark:text-gray-400 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"><ThumbsUp size={20} /> Like</button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2 font-bold text-gray-600 dark:text-gray-400 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"><MessageSquare size={20} /> Comment</button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2 font-bold text-gray-600 dark:text-gray-400 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"><Share2 size={20} /> Share</button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`fixed inset-0 z-[10000] flex items-center justify-center ${isFullScreen ? 'p-0' : 'p-4 md:p-8'} bg-black/60 backdrop-blur-sm`}
          >
            <div className={`bg-white dark:bg-gray-900 w-full ${isFullScreen ? 'h-full max-w-none rounded-none' : 'max-w-[95vw] md:max-w-3xl h-fit max-h-[90vh] rounded-3xl'} overflow-hidden shadow-2xl flex flex-col border border-white/20 transition-all duration-300`}>
              <div className="bg-gray-100 dark:bg-gray-800 p-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 gap-2">
                <span className="text-xs font-bold text-gray-400 px-2 uppercase tracking-widest">Sponsored</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setIsLoading(true);
                      const iframe = document.querySelector('iframe[title="Ad Content"]') as HTMLIFrameElement;
                      if (iframe) iframe.src = adUrl;
                    }}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw size={18} />
                  </button>
                  <button 
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
                    title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                  >
                    {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                  <button 
                    onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 relative bg-white dark:bg-gray-800 overflow-auto min-h-[300px]">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
                    <Loader2 className="animate-spin text-[#1877F2]" size={40} />
                  </div>
                )}
                <iframe 
                  src={adUrl}
                  className="w-full h-full border-none min-h-[600px]"
                  title="Ad Content"
                  onLoad={() => setIsLoading(false)}
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  allow="autoplay; encrypted-media"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AdsterraAd;
