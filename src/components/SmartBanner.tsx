import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const SmartBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if device is Android and not already in standalone mode (PWA/TWA)
    const isAndroid = /android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    // Also check if they closed it recently
    const hasClosedBanner = sessionStorage.getItem('closed_smart_banner');

    if (isAndroid && !isStandalone && !hasClosedBanner) {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible) return null;

  const handleClose = () => {
    sessionStorage.setItem('closed_smart_banner', 'true');
    setIsVisible(false);
  };

  const handleOpenApp = () => {
    const currentUrl = window.location.href;
    const hostname = window.location.hostname;
    const pathname = window.location.pathname + window.location.search;
    
    // Android Intent URI
    const intentUri = `intent://${hostname}${pathname}#Intent;scheme=https;package=next.isbest;S.browser_fallback_url=https://play.google.com/store/apps/details?id=next.isbest;end`;
    
    window.location.href = intentUri;
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3 overflow-hidden">
        <button onClick={handleClose} className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-white">
          <X size={18} />
        </button>
        <img src="https://i.postimg.cc/wxwt5tsk/retouch-2026030721254774.png" alt="Next Logo" className="w-8 h-8 object-contain rounded-md bg-black" />
        <div className="flex flex-col truncate">
          <span className="text-sm font-bold text-gray-900 dark:text-white truncate">Next App</span>
          <span className="text-xs text-gray-500 truncate">Faster & Better Experience</span>
        </div>
      </div>
      <button 
        onClick={handleOpenApp}
        className="ml-3 px-4 py-1.5 bg-[#1877F2] text-white text-sm font-bold rounded-full whitespace-nowrap hover:bg-blue-600 transition-colors"
      >
        Open App
      </button>
    </div>
  );
};

export default SmartBanner;
