import React from 'react';
import { BookOpen, AlertCircle } from 'lucide-react';

const Lab: React.FC = () => {
  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-140px)] md:h-full w-full bg-gray-50 dark:bg-black md:rounded-xl shadow-sm border-0 md:border border-gray-200 dark:border-gray-800 overflow-hidden max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <BookOpen className="text-[#1877F2]" size={20} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight">E-Books Library</h1>
            <p className="text-sm text-gray-500 font-medium">Browse and read books directly</p>
          </div>
        </div>
        <div className="flex items-start gap-2 mt-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800/30">
          <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
            Double-click a book to open it. Note: Google Drive may open the reader in a new secure tab.
          </p>
        </div>
      </div>

      {/* Embedded Drive Folder */}
      <div className="flex-1 w-full bg-white dark:bg-gray-900 relative">
        <iframe 
          src="https://drive.google.com/embeddedfolderview?id=17dLwRV5ENwdoZvYNQenOOd4YG2GjzeGq#list" 
          width="100%" 
          height="100%" 
          frameBorder="0"
          className="absolute inset-0 w-full h-full border-0"
          title="E-Books Lab"
          allow="autoplay"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
        ></iframe>
      </div>
    </div>
  );
};

export default Lab;
