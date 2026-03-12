
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2, ExternalLink, RefreshCw } from 'lucide-react';
import { useTheme } from '@/App';

const NextoRobot: React.FC = () => {
  const { robotSize } = useTheme();
  const [showWindow, setShowWindow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const robotSvg = (
    <svg
      viewBox="0 0 1024 1024"
      width={robotSize}
      height={robotSize}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Next Robot Logo"
      className="drop-shadow-lg cursor-pointer active:cursor-grabbing select-none"
    >
      <defs>
        <linearGradient id="bodyG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5ee0fd"/>
          <stop offset="100%" stopColor="#258be7"/>
        </linearGradient>
        <style>
          {`
            .eye { animation: blink 3s infinite; transform-origin: center; }
            @keyframes blink {
              0%,90%{opacity:1}
              95%{opacity:0}
              100%{opacity:1}
            }
          `}
        </style>
      </defs>

      {/* BODY */}
      <ellipse cx="512" cy="600" rx="230" ry="280" fill="url(#bodyG)"/>

      {/* ARMS */}
      <ellipse cx="300" cy="610" rx="50" ry="100" fill="url(#bodyG)"/>
      <ellipse cx="720" cy="610" rx="50" ry="100" fill="url(#bodyG)"/>

      {/* CHEST */}
      <rect x="400" y="540" width="220" height="120" rx="20" fill="#0c1b2c"/>
      <text x="425" y="615" fontSize="48" fill="#ffffff" fontFamily="Arial">▶ Next</text>

      {/* HEAD */}
      <ellipse cx="512" cy="320" rx="220" ry="200" fill="url(#bodyG)"/>

      {/* EYES */}
      <ellipse className="eye" cx="440" cy="260" rx="35" ry="35" fill="#000"/>
      <ellipse className="eye" cx="585" cy="260" rx="35" ry="35" fill="#000"/>

      {/* SMILE */}
      <path d="M450,330 Q512,380 575,330" fill="#d21c2c"/>

      {/* CHEEKS */}
      <circle cx="375" cy="310" r="30" fill="#ff7ea8" opacity=".8"/>
      <circle cx="650" cy="310" r="30" fill="#ff7ea8" opacity=".8"/>

      {/* ANTENNAS */}
      <line x1="400" y1="170" x2="360" y2="100" stroke="#4ba3f5" strokeWidth="20"/>
      <circle cx="360" cy="100" r="20" fill="#4ba3f5"/>

      <line x1="620" y1="170" x2="660" y2="100" stroke="#4ba3f5" strokeWidth="20"/>
      <circle cx="660" cy="100" r="20" fill="#4ba3f5"/>

      {/* SHADOW */}
      <ellipse cx="512" cy="900" rx="140" ry="30" fill="#000" opacity=".1"/>
    </svg>
  );

  return (
    <>
      {/* Draggable Robot */}
      <motion.div
        drag
        dragMomentum={false}
        onDragStart={() => {
          setIsDragging(true);
          document.body.style.overflow = 'hidden'; // Prevent scrolling/refresh while dragging
        }}
        onDragEnd={() => {
          // Small delay to prevent immediate click after drag
          setTimeout(() => setIsDragging(false), 100);
          document.body.style.overflow = ''; // Re-enable scrolling
        }}
        initial={{ x: window.innerWidth - 100, y: window.innerHeight - 150 }}
        className="fixed z-[9999] touch-none select-none"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          if (!isDragging) {
            setShowWindow(true);
          }
        }}
      >
        {robotSvg}
      </motion.div>

      {/* In-App Window (Iframe Modal) */}
      <AnimatePresence>
        {showWindow && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`fixed inset-0 z-[10000] flex items-center justify-center ${isFullScreen ? 'p-0' : 'p-4 md:p-8'} bg-black/60 backdrop-blur-sm`}
          >
            <div className={`bg-white dark:bg-gray-900 w-full ${isFullScreen ? 'h-full max-w-none rounded-none' : 'max-w-5xl h-[80vh] rounded-3xl'} overflow-hidden shadow-2xl flex flex-col border border-white/20 transition-all duration-300`}>
              {/* Header */}
              <div className="bg-gray-100 dark:bg-gray-800 p-2 flex items-center justify-end border-b border-gray-200 dark:border-gray-700 gap-2">
                <button 
                  onClick={() => {
                    setIsLoading(true);
                    const iframe = document.querySelector('iframe[title="Nexto Assistant"]') as HTMLIFrameElement;
                    if (iframe) iframe.src = iframe.src;
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
                  onClick={() => {
                    setShowWindow(false);
                    setIsFullScreen(false);
                  }}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content (Iframe) */}
              <div className="flex-1 relative bg-white">
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white dark:bg-gray-900 z-10">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-bold text-gray-500 animate-pulse">Connecting to Nexto...</p>
                  </div>
                )}
                <iframe 
                  src="https://nexto-done.vercel.app/" 
                  className="w-full h-full border-none"
                  onLoad={() => setIsLoading(false)}
                  title="Nexto Assistant"
                  allow="microphone; camera; clipboard-write; autoplay; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default NextoRobot;
