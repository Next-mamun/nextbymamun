import React, { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface ZoomableImageProps {
  src: string;
  alt?: string;
  className?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

const ZoomableImage: React.FC<ZoomableImageProps> = ({ src, alt, className, referrerPolicy }) => {
  const [isOpen, setIsOpen] = useState(false);

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
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm" 
        >
          <button 
            className="absolute top-6 right-6 text-white p-2 bg-[#1877F2] hover:bg-[#166fe5] shadow-lg rounded-full transition-colors z-50 flex items-center justify-center"
            onClick={(e) => { 
              e.preventDefault();
              e.stopPropagation(); 
              setIsOpen(false); 
            }}
          >
            <X size={28} />
          </button>
          
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
                className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl animate-in zoom-in-95 duration-300 rounded-lg select-none cursor-grab active:cursor-grabbing" 
                referrerPolicy={referrerPolicy}
              />
            </TransformComponent>
          </TransformWrapper>
        </div>
      )}
    </>
  );
};

export default ZoomableImage;
