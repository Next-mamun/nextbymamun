import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ArrowLeft } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface ZoomableImageProps {
  src: string;
  alt?: string;
  className?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

const ZoomableImage: React.FC<ZoomableImageProps> = ({ src, alt, className, referrerPolicy }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Intercept physical and browser back buttons to close zoomed view
  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ zoomableOpen: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      if (!e.state || !e.state.zoomableOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen]);

  const handleCloseZoomable = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (window.history.state?.zoomableOpen) {
      window.history.back();
    } else {
      setIsOpen(false);
    }
  };

  return (
    <>
      <div 
        className="relative group cursor-zoom-in overflow-hidden w-full h-full flex items-center justify-center" 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
      >
        <img 
          src={src} 
          alt={alt} 
          className={`${className} transition-transform duration-300 group-hover:scale-[1.02]`} 
          referrerPolicy={referrerPolicy} 
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
           <div className="bg-white/20 backdrop-blur-md p-3 rounded-full text-white shadow-lg transform scale-90 group-hover:scale-100 transition-all duration-300">
             <ZoomIn size={28} />
           </div>
        </div>
      </div>

      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm" 
        >
          {/* Top Navigation Bar with Back Button */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-black/40 backdrop-blur-md px-6 flex items-center justify-between z-50 border-b border-white/5">
            <button 
              onClick={handleCloseZoomable}
              className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors bg-white/10 px-4 py-2 rounded-full font-bold text-sm"
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <span className="text-white/60 text-xs font-bold font-mono tracking-widest uppercase">Image Viewer</span>
            <button 
              onClick={handleCloseZoomable}
              className="p-2 bg-white/10 hover:bg-red-500 rounded-full text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="w-full h-full flex items-center justify-center pt-16">
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={5}
              centerZoomedOut={true}
              doubleClick={{ disabled: false, step: 1.5 }}
              panning={{ disabled: false }}
              wheel={{ disabled: false, step: 0.1 }}
              pinch={{ disabled: false }}
            >
              <TransformComponent wrapperClass="!w-full !h-full flex items-center justify-center" contentClass="!w-full !h-full flex items-center justify-center">
                <img 
                  src={src} 
                  alt={alt} 
                  className="max-w-[95vw] max-h-[85vh] object-contain shadow-2xl animate-in zoom-in-95 duration-300 rounded-lg select-none cursor-grab active:cursor-grabbing" 
                  referrerPolicy={referrerPolicy}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>
      )}
    </>
  );
};

export default ZoomableImage;
