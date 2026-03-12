
import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Video, RotateCcw, Check, Scissors, Type, Smile, Download } from 'lucide-react';

interface MediaEditorProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  onSave: (processedUrl: string) => void;
  onCancel: () => void;
}

export const MediaEditor: React.FC<MediaEditorProps> = ({ mediaUrl, mediaType, onSave, onCancel }) => {
  const [text, setText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [stickers, setStickers] = useState<{ id: string, emoji: string, x: number, y: number }[]>([]);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.onloadedmetadata = () => {
        setVideoDuration(videoRef.current?.duration || 0);
      };
    }
  }, [mediaType, mediaUrl]);

  const processMedia = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set 360p dimensions (maintaining aspect ratio)
    const targetHeight = 360;
    let targetWidth = 640;

    if (mediaType === 'image') {
      const img = new Image();
      img.src = mediaUrl;
      await new Promise((resolve) => (img.onload = resolve));
      
      const aspectRatio = img.width / img.height;
      targetWidth = Math.round(targetHeight * aspectRatio);
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      
      // Draw Text
      if (text) {
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.textAlign = 'center';
        ctx.strokeText(text, targetWidth / 2, targetHeight - 40);
        ctx.fillText(text, targetWidth / 2, targetHeight - 40);
      }

      // Draw Stickers
      stickers.forEach(s => {
        ctx.font = '40px Arial';
        ctx.fillText(s.emoji, (s.x / 100) * targetWidth, (s.y / 100) * targetHeight);
      });

      onSave(canvas.toDataURL('image/jpeg', 0.8));
    } else {
      // For video, we'd ideally use FFmpeg.wasm, but for a simple "360p" resize on client:
      // We can capture a frame or just pass the original if it's too complex.
      // However, the user asked for 360p. We can try to redraw the video on canvas.
      // But for a full video file, we can't easily "save" it from canvas without MediaRecorder.
      
      const video = videoRef.current;
      if (!video) return;

      const aspectRatio = video.videoWidth / video.videoHeight;
      targetWidth = Math.round(targetHeight * aspectRatio);
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => onSave(reader.result as string);
        reader.readAsDataURL(blob);
      };

      video.currentTime = (trimStart / 100) * videoDuration;
      video.play();
      recorder.start();

      const drawFrame = () => {
        if (video.paused || video.ended || video.currentTime >= (trimEnd / 100) * videoDuration) {
          recorder.stop();
          video.pause();
          return;
        }
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        
        if (text) {
          ctx.font = 'bold 24px Arial';
          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          ctx.fillText(text, targetWidth / 2, targetHeight - 40);
        }
        
        requestAnimationFrame(drawFrame);
      };

      drawFrame();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[1000] flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex gap-2">
        <button onClick={onCancel} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20"><X /></button>
      </div>

      <div className="relative max-w-full max-h-[70vh] bg-black rounded-lg overflow-hidden shadow-2xl">
        {mediaType === 'image' ? (
          <img src={mediaUrl} className="max-w-full max-h-full object-contain" />
        ) : (
          <video ref={videoRef} src={mediaUrl} className="max-w-full max-h-full" />
        )}
        
        {/* Overlays for preview */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-end pb-10">
          {text && <p className="text-white font-bold text-2xl drop-shadow-lg">{text}</p>}
        </div>
      </div>

      <div className="mt-6 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl">
        <div className="flex justify-around mb-6">
          <button onClick={() => setShowTextInput(!showTextInput)} className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300">
            <Type size={24} />
            <span className="text-xs font-bold">Text</span>
          </button>
          <button onClick={() => setStickers([...stickers, { id: Date.now().toString(), emoji: '🔥', x: 50, y: 50 }])} className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300">
            <Smile size={24} />
            <span className="text-xs font-bold">Sticker</span>
          </button>
          {mediaType === 'video' && (
            <button className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300">
              <Scissors size={24} />
              <span className="text-xs font-bold">Trim</span>
            </button>
          )}
        </div>

        {showTextInput && (
          <input 
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add text..."
            className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2 mb-4 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold"
          />
        )}

        {mediaType === 'video' && (
          <div className="mb-6">
            <p className="text-xs font-bold text-gray-500 mb-2">TRIM VIDEO</p>
            <div className="flex gap-4">
              <input type="range" value={trimStart} onChange={(e) => setTrimStart(Number(e.target.value))} className="flex-1" />
              <input type="range" value={trimEnd} onChange={(e) => setTrimEnd(Number(e.target.value))} className="flex-1" />
            </div>
          </div>
        )}

        <button 
          onClick={processMedia}
          className="w-full bg-[#1877F2] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg"
        >
          <Check size={20} /> Apply & Save (360p)
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

interface CameraCaptureProps {
  onCapture: (mediaUrl: string, type: 'image' | 'video') => void;
  onCancel: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  useEffect(() => {
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [facingMode]);

  const startCamera = async () => {
    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode }, 
        audio: true 
      });
      setStream(newStream);
      if (videoRef.current) videoRef.current.srcObject = newStream;
    } catch (err) {
      console.error('Camera error:', err);
      alert('Could not access camera.');
      onCancel();
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL('image/jpeg'), 'image');
  };

  const startRecording = () => {
    if (!stream) return;
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onloadend = () => onCapture(reader.result as string, 'video');
      reader.readAsDataURL(blob);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <div className="fixed inset-0 bg-black z-[1000] flex flex-col items-center justify-center">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      
      <div className="absolute top-6 left-6 right-6 flex justify-between">
        <button onClick={onCancel} className="p-3 bg-black/50 rounded-full text-white"><X /></button>
        <button onClick={() => setFacingMode(facingMode === 'user' ? 'environment' : 'user')} className="p-3 bg-black/50 rounded-full text-white"><RotateCcw /></button>
      </div>

      <div className="absolute bottom-10 flex items-center gap-10">
        <button 
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 scale-110' : 'bg-transparent'}`}
        >
          <Video size={32} className="text-white" />
        </button>
        
        <button 
          onClick={takePhoto}
          className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-110 transition-all"
        >
          <Camera size={28} className="text-black" />
        </button>
      </div>
    </div>
  );
};
