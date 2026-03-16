import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface NativeAdProps {
  adUnitId?: string;
}

const NativeAd: React.FC<NativeAdProps> = ({ adUnitId }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (isVisible) {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error("AdSense error", e);
      }
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden animate-in fade-in duration-300">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Advertisment</span>
        <button 
          onClick={() => setIsVisible(false)}
          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
          title="Cancel"
        >
          <X size={14} className="text-gray-500" />
        </button>
      </div>
      <div className="p-0 flex justify-center w-full min-h-[250px] bg-gray-50 dark:bg-gray-900">
        {/* AdSense Container */}
        <ins className="adsbygoogle"
             style={{ display: 'block', width: '100%' }}
             data-ad-client="ca-pub-1044610166642937"
             data-ad-format="fluid"
             data-ad-layout-key="-6t+ed+2i-1n-4w"
             data-full-width-responsive="true"></ins>
      </div>
    </div>
  );
};

export default NativeAd;
