
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Video, RotateCcw, Check, Scissors, Type, Smile, Download, Crop } from 'lucide-react';
import Draggable from 'react-draggable';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import Cropper from 'react-easy-crop';

interface MediaEditorProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  onSave: (processedUrl: string) => void;
  onCancel: () => void;
}

const StickerOverlay = ({ s, containerSize, handleDrag }: any) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  return (
    <Draggable 
      nodeRef={nodeRef}
      bounds="parent" 
      defaultPosition={{ x: (s.x / 100) * containerSize.width, y: (s.y / 100) * containerSize.height }}
      onStop={(e, data) => handleDrag(e, data, 'sticker', s.id)}
    >
      <div ref={nodeRef} className="absolute top-0 left-0 cursor-move p-2 border border-dashed border-white/50">
        <div style={{ transform: 'translate(-50%, -50%)', fontSize: `${s.size || 40}px` }}>
          {s.emoji}
        </div>
      </div>
    </Draggable>
  );
};

export const MediaEditor: React.FC<MediaEditorProps> = ({ mediaUrl, mediaType, onSave, onCancel }) => {
  const [text, setText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(24);
  const [showTextInput, setShowTextInput] = useState(false);
  const [stickers, setStickers] = useState<{ id: string, emoji: string, x: number, y: number, size: number }[]>([]);
  const [textPosition, setTextPosition] = useState({ x: 50, y: 50 }); // percentages
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Cropping state
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [currentMediaUrl, setCurrentMediaUrl] = useState(mediaUrl);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.onloadedmetadata = () => {
        setVideoDuration(videoRef.current?.duration || 0);
      };
    }
  }, [mediaType, mediaUrl]);

  useEffect(() => {
    if (containerRef.current) {
      const observer = new ResizeObserver(entries => {
        for (let entry of entries) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  const handleDrag = (e: any, data: any, type: 'text' | 'sticker', id?: string) => {
    if (!containerSize.width || !containerSize.height) return;
    const xPct = (data.x / containerSize.width) * 100;
    const yPct = (data.y / containerSize.height) * 100;

    if (type === 'text') {
      setTextPosition({ x: xPct, y: yPct });
    } else if (type === 'sticker' && id) {
      setStickers(stickers.map(s => s.id === id ? { ...s, x: xPct, y: yPct } : s));
    }
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    if (!croppedAreaPixels || mediaType !== 'image') return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = currentMediaUrl;
    await new Promise((resolve) => (img.onload = resolve));

    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;

    ctx.drawImage(
      img,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    const croppedUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCurrentMediaUrl(croppedUrl);
    setIsCropping(false);
  };

  const onEmojiClick = (emojiObject: any) => {
    const id = Date.now().toString();
    setStickers([...stickers, { id, emoji: emojiObject.emoji, x: 50, y: 50, size: 40 }]);
    setSelectedStickerId(id);
    setShowEmojiPicker(false);
  };

  const processMedia = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const targetHeight = 360;
    let targetWidth = 640;

    if (mediaType === 'image') {
      const img = new Image();
      img.src = currentMediaUrl;
      await new Promise((resolve) => (img.onload = resolve));
      
      const aspectRatio = img.width / img.height;
      targetWidth = Math.round(targetHeight * aspectRatio);
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      
      if (text) {
        ctx.font = `bold ${textSize}px Arial`;
        ctx.fillStyle = textColor;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(text, (textPosition.x / 100) * targetWidth, (textPosition.y / 100) * targetHeight);
        ctx.fillText(text, (textPosition.x / 100) * targetWidth, (textPosition.y / 100) * targetHeight);
      }

      stickers.forEach(s => {
        ctx.font = `${s.size || 40}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.emoji, (s.x / 100) * targetWidth, (s.y / 100) * targetHeight);
      });

      onSave(canvas.toDataURL('image/jpeg', 0.8));
    } else {
      // Video processing logic remains similar but needs to account for positions if possible
      onSave(mediaUrl); // Fallback for video simplicity
    }
  };

  if (isCropping) {
    return (
      <div className="fixed inset-0 bg-black z-[1000] flex flex-col items-center justify-center p-4">
        <div className="relative w-full max-w-md h-[60vh] bg-gray-900 rounded-2xl overflow-hidden mb-6">
          <Cropper
            image={currentMediaUrl}
            crop={crop}
            zoom={zoom}
            aspect={4 / 3}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-gray-500 font-bold">Zoom</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
            />
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsCropping(false)}
              className="flex-1 py-3 rounded-xl font-bold bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              Cancel
            </button>
            <button 
              onClick={handleCropSave}
              className="flex-1 py-3 rounded-xl font-bold bg-[#1877F2] text-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-[1000] flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex gap-2">
        <button onClick={onCancel} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20"><X /></button>
      </div>

      <div ref={containerRef} className="relative inline-block max-w-full max-h-[70vh] bg-black rounded-lg overflow-hidden shadow-2xl">
        {mediaType === 'image' ? (
          <img src={currentMediaUrl} className="max-w-full max-h-[70vh] object-contain block" />
        ) : (
          <video ref={videoRef} src={currentMediaUrl} className="max-w-full max-h-[70vh] block" />
        )}
        
        {/* Draggable Overlays */}
        {text && containerSize.width > 0 && (
          <Draggable 
            nodeRef={textRef}
            bounds="parent" 
            defaultPosition={{ x: (textPosition.x / 100) * containerSize.width, y: (textPosition.y / 100) * containerSize.height }}
            onStop={(e, data) => handleDrag(e, data, 'text')}
          >
            <div ref={textRef} className="absolute top-0 left-0 cursor-move">
              <div style={{ transform: 'translate(-50%, -50%)' }}>
                <p style={{ color: textColor, fontSize: `${textSize}px` }} className="font-bold drop-shadow-lg p-2 border border-dashed border-white/50">{text}</p>
              </div>
            </div>
          </Draggable>
        )}

        {containerSize.width > 0 && stickers.map(s => (
          <div key={s.id} onClick={() => setSelectedStickerId(s.id)}>
            <StickerOverlay s={s} containerSize={containerSize} handleDrag={handleDrag} />
            {selectedStickerId === s.id && (
              <div className="absolute inset-0 pointer-events-none border-2 border-blue-500 rounded-lg" style={{ 
                left: `${(s.x / 100) * containerSize.width}%`, 
                top: `${(s.y / 100) * containerSize.height}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                transform: 'translate(-50%, -50%)'
              }} />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl">
        <div className="flex justify-around mb-6">
          {mediaType === 'image' && (
            <button onClick={() => setIsCropping(true)} className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300">
              <Crop size={24} />
              <span className="text-xs font-bold">Crop</span>
            </button>
          )}
          <button onClick={() => setShowTextInput(!showTextInput)} className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300">
            <Type size={24} />
            <span className="text-xs font-bold">Text</span>
          </button>
          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300">
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

        {showEmojiPicker && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50">
            <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.AUTO} />
          </div>
        )}

        {selectedStickerId && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-blue-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase">Sticker Size</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setStickers(stickers.filter(s => s.id !== selectedStickerId))} className="text-red-500 hover:text-red-700 font-bold text-xs uppercase">Delete</button>
                <button onClick={() => setSelectedStickerId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
            </div>
            <input 
              type="range" 
              min="20" 
              max="200" 
              value={stickers.find(s => s.id === selectedStickerId)?.size || 40} 
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setStickers(stickers.map(s => s.id === selectedStickerId ? { ...s, size: newSize } : s));
              }} 
              className="w-full"
            />
          </div>
        )}

        {showTextInput && (
          <div className="mb-4">
            <input 
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add text..."
              className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2 mb-3 outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white font-bold"
            />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-gray-500 font-bold">Size</span>
                <input 
                  type="range" 
                  min="12" 
                  max="72" 
                  value={textSize} 
                  onChange={(e) => setTextSize(Number(e.target.value))} 
                  className="flex-1"
                />
              </div>
              <button onClick={() => setText('')} className="text-red-500 hover:text-red-700 font-bold text-xs uppercase ml-4">Clear Text</button>
            </div>
            <div className="flex gap-2 justify-center">
              {['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'].map(color => (
                <button
                  key={color}
                  onClick={() => setTextColor(color)}
                  className={`w-8 h-8 rounded-full border-2 ${textColor === color ? 'border-blue-500 scale-110' : 'border-gray-300'} transition-all`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
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
