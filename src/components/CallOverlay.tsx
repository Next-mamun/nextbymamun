import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '@/contexts/CallContext';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, User, FileUp, Download } from 'lucide-react';
import { getPosterUrl } from '@/lib/utils';

const CallOverlay = () => {
  const { status, currentCall, localStream, remoteStream, acceptCall, rejectCall, endCall, toggleMute, toggleVideo, isMuted, isVideoOff, sendFile, receivedFiles } = useCall();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, status, isMinimized]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, status, isMinimized]);

  if (status === 'idle' || !currentCall) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      sendFile(e.target.files[0]);
    }
  };

  if (status === 'ringing') {
    return (
      <div className="fixed inset-0 bg-black/90 z-[99999] flex flex-col items-center justify-between p-6 md:p-12 backdrop-blur-xl animate-in fade-in zoom-in duration-300 select-none">
        {/* Top Header */}
        <div className="flex flex-col items-center mt-6">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-3 shadow-lg">
            {currentCall.type === 'video' ? (
              <Video size={16} className="text-blue-400 animate-pulse" />
            ) : (
              <Phone size={16} className="text-green-400 animate-pulse" />
            )}
            <span className="text-xs font-bold uppercase tracking-widest text-white/90">
              Incoming {currentCall.type === 'video' ? 'Video' : 'Voice'} Call
            </span>
          </div>
          <p className="text-sm text-gray-300 font-medium animate-pulse">Ringing...</p>
        </div>

        {/* Center Caller Profile */}
        <div className="flex flex-col items-center my-auto">
          <div className="relative mb-6">
            {/* Pulsing Ripple Rings */}
            <div className="absolute -inset-4 rounded-full bg-blue-500/20 animate-ping opacity-60 pointer-events-none" />
            <div className="absolute -inset-8 rounded-full bg-blue-500/10 animate-pulse pointer-events-none" />
            
            <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl bg-gray-800">
              {currentCall.callerAvatar ? (
                <img 
                  src={getPosterUrl(currentCall.callerAvatar)} 
                  alt="Caller" 
                  className="w-full h-full object-cover" 
                  onError={(e: any) => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentCall.callerId}`; }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-800 flex items-center justify-center">
                  <User size={64} className="text-white/80" />
                </div>
              )}
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-white text-center mb-1 drop-shadow-md">
            {currentCall.callerName || 'Unknown Caller'}
          </h2>
          <p className="text-sm text-white/60 font-mono">
            @{currentCall.callerId?.slice(0, 12)}
          </p>
        </div>

        {/* Bottom Actions */}
        <div className="w-full max-w-sm flex items-center justify-around mb-8">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-2">
            <button 
              onClick={rejectCall} 
              className="w-18 h-18 md:w-20 md:h-20 bg-red-600 hover:bg-red-500 active:scale-95 rounded-full flex items-center justify-center text-white shadow-xl shadow-red-600/50 transition-all hover:scale-105"
            >
              <PhoneOff size={32} />
            </button>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-2">
            <button 
              onClick={acceptCall} 
              className="w-18 h-18 md:w-20 md:h-20 bg-green-500 hover:bg-green-400 active:scale-95 rounded-full flex items-center justify-center text-white shadow-xl shadow-green-500/50 transition-all hover:scale-110 animate-bounce"
            >
              {currentCall.type === 'video' ? <Video size={32} /> : <Phone size={32} />}
            </button>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Answer</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed z-[9999] transition-all duration-300 ${isMinimized ? 'bottom-20 right-4 w-48 h-72 rounded-2xl overflow-hidden shadow-2xl cursor-pointer hover:scale-105' : 'inset-0 bg-black'}`}>
      {/* Remote Video/Audio */}
      {currentCall.type === 'video' ? (
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover bg-black"
          onClick={() => isMinimized && setIsMinimized(false)}
        />
      ) : (
        <div 
          className="w-full h-full flex flex-col items-center justify-center bg-gray-900"
          onClick={() => isMinimized && setIsMinimized(false)}
        >
          <div className="w-32 h-32 rounded-full overflow-hidden mb-6 border-4 border-gray-700">
            {currentCall.callerAvatar ? (
              <img src={getPosterUrl(currentCall.callerAvatar)} alt="Remote" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <User size={60} className="text-gray-400" />
              </div>
            )}
          </div>
          {!isMinimized && <h2 className="text-3xl font-bold text-white mb-2">{currentCall.callerName}</h2>}
          <p className="text-gray-400">{status === 'calling' ? 'Calling...' : 'Connected'}</p>
          {/* Audio element for voice calls */}
          <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
        </div>
      )}

      {/* Local Video Picture-in-Picture */}
      {currentCall.type === 'video' && !isMinimized && (
        <div className="absolute top-4 right-4 w-28 h-40 bg-gray-800 rounded-xl overflow-hidden shadow-lg border-2 border-white/20">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>
      )}

      {/* Controls Overlay */}
      {!isMinimized && (
        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-6">
          
          {/* Received Files */}
          {receivedFiles.length > 0 && (
            <div className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-xl p-3 mb-4 flex flex-col gap-2 max-h-32 overflow-y-auto">
              <p className="text-xs text-white/70 font-bold uppercase tracking-wider">Received Files</p>
              {receivedFiles.map((file, idx) => (
                <a key={idx} href={file.url} download={file.name} className="flex items-center justify-between text-sm text-white bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors">
                  <span className="truncate pr-2">{file.name}</span>
                  <Download size={16} />
                </a>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              title="Send File over P2P"
            >
              <FileUp size={20} />
            </button>

            <button 
              onClick={toggleMute} 
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-sm ${isMuted ? 'bg-red-500/80 hover:bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            {currentCall.type === 'video' && (
              <button 
                onClick={toggleVideo} 
                className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-sm ${isVideoOff ? 'bg-red-500/80 hover:bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}
              >
                {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
              </button>
            )}

            <button 
              onClick={endCall} 
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-transform hover:scale-105 shadow-lg shadow-red-500/30"
            >
              <PhoneOff size={32} />
            </button>

            <button 
              onClick={() => setIsMinimized(true)} 
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors text-sm font-bold"
            >
              Min
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallOverlay;
