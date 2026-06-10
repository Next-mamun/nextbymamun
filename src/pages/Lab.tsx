import React, { useState } from 'react';
import { BookOpen, AlertCircle, Code, ChevronLeft, Play, ExternalLink } from 'lucide-react';

const Lab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'menu' | 'ebooks' | 'coderunner'>('menu');
  const [htmlCode, setHtmlCode] = useState(`<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: sans-serif; text-align: center; margin-top: 50px; }
  h1 { color: #1877F2; }
</style>
</head>
<body>
  <h1>Hello Lab!</h1>
  <p>Write your HTML, CSS, and JS here.</p>
  <button onclick="alert('Running offline!')">Test JavaScript</button>
</body>
</html>`);
  const [runCode, setRunCode] = useState(htmlCode);

  const handleRunCode = () => {
    setRunCode(htmlCode);
  };

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-140px)] md:h-full w-full bg-gray-50 dark:bg-black md:rounded-xl shadow-sm border-0 md:border border-gray-200 dark:border-gray-800 overflow-hidden max-w-[1200px] mx-auto">
      
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-3">
          {activeTab !== 'menu' && (
            <button 
              onClick={() => setActiveTab('menu')}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft size={24} className="text-gray-700 dark:text-gray-300" />
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            {activeTab === 'coderunner' ? <Code className="text-[#1877F2]" size={20} /> : <BookOpen className="text-[#1877F2]" size={20} />}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight">
              {activeTab === 'menu' ? 'Lab Area' : activeTab === 'ebooks' ? 'E-Books Library' : 'Code Runner'}
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              {activeTab === 'menu' ? 'Select a tool to get started' : activeTab === 'ebooks' ? 'Browse and read books directly' : 'Run HTML, CSS & JS directly in your browser'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-900">
        {activeTab === 'menu' && (
          <div className="p-4 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => setActiveTab('ebooks')}
              className="flex flex-col items-center justify-center gap-4 p-8 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all group active:scale-95"
            >
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-500 dark:text-blue-300 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                <BookOpen size={32} />
              </div>
              <div className="text-center">
                <h2 className="font-bold text-lg text-gray-900 dark:text-white">E-Books Library</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Read books without downloading</p>
              </div>
            </button>

            <button 
              onClick={() => setActiveTab('coderunner')}
              className="flex flex-col items-center justify-center gap-4 p-8 bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-2xl hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 transition-all group active:scale-95"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-800 text-green-500 dark:text-green-300 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                <Code size={32} />
              </div>
              <div className="text-center">
                <h2 className="font-bold text-lg text-gray-900 dark:text-white">Code Runner</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Offline HTML/JS executor</p>
              </div>
            </button>
          </div>
        )}

        {activeTab === 'ebooks' && (
          <div className="flex flex-col h-full w-full absolute inset-0">
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 p-3 border-b border-blue-100 dark:border-blue-800/30 shrink-0">
              <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
                  Double-click a book to open it. It will open securely within the browser.
                </p>
                <a 
                  href="https://drive.google.com/drive/folders/17dLwRV5ENwdoZvYNQenOOd4YG2GjzeGq" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  <ExternalLink size={14} /> Open in new tab
                </a>
              </div>
            </div>
            <iframe 
              src="https://drive.google.com/embeddedfolderview?id=17dLwRV5ENwdoZvYNQenOOd4YG2GjzeGq#list" 
              width="100%" 
              height="100%" 
              frameBorder="0"
              className="w-full h-full border-0 flex-1"
              title="E-Books Lab"
              allow="autoplay"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            ></iframe>
          </div>
        )}

        {activeTab === 'coderunner' && (
          <div className="flex flex-col h-full w-full absolute inset-0 md:flex-row">
            <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-800">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 px-2 uppercase tracking-wider">HTML/CSS/JS Editor</span>
                <button 
                  onClick={handleRunCode}
                  className="flex items-center gap-1 px-4 py-1.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-sm font-bold rounded-md transition-colors"
                >
                  <Play size={16} fill="currentColor" /> Run Code
                </button>
              </div>
              <textarea
                value={htmlCode}
                onChange={(e) => setHtmlCode(e.target.value)}
                className="flex-1 w-full bg-[#1e1e1e] text-[#d4d4d4] p-4 font-mono text-sm border-none focus:ring-0 resize-none outline-none"
                spellCheck="false"
                placeholder="Write your HTML code here..."
              ></textarea>
            </div>
            <div className="flex-1 flex flex-col bg-white h-[50vh] md:h-auto">
              <div className="p-2 bg-gray-100 dark:bg-gray-900 border-b border-t md:border-t-0 border-gray-200 dark:border-gray-800 flex items-center">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 px-2 uppercase tracking-wider">Preview (Offline output)</span>
              </div>
              <iframe 
                srcDoc={runCode}
                title="Code Preview" 
                className="w-full h-full border-none bg-white"
                sandbox="allow-scripts allow-forms allow-popups allow-modals"
              ></iframe>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Lab;
