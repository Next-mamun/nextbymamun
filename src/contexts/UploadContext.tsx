import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Draggable from 'react-draggable';
import { Pause, Play, X, RefreshCw } from 'lucide-react';
import * as idb from 'idb-keyval';
import * as tus from 'tus-js-client';

import imageCompression from 'browser-image-compression';

interface UploadTask {
  id: string;
  file?: File | string; // Can be a File or a processed base64 string
  progress: number;
  status: 'optimizing' | 'processing' | 'uploading' | 'success' | 'error' | 'paused';
  type: 'post' | 'story' | 'message' | 'reel' | 'profile';
  metadata?: any;
}


interface UploadContextType {
  uploads: UploadTask[];
  addUpload: (file: File | string, type: 'post' | 'story' | 'message' | 'reel' | 'profile', metadata?: any) => string;
  removeUpload: (id: string) => void;
  retryUpload: (id: string) => void;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const uploadsRef = useRef<UploadTask[]>([]);
  const intervals = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Keep ref in sync with state
  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  // Persistence: Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('next_uploads');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Set all to paused on reload to allow user to resume
      setUploads(parsed.map((u: any) => ({ ...u, status: u.status === 'success' ? 'success' : 'paused' })));
    }
  }, []);

  // Persistence: Save to localStorage on change
  useEffect(() => {
    const toSave = uploads.filter(u => u.status !== 'success');
    if (toSave.length > 0) {
      localStorage.setItem('next_uploads', JSON.stringify(toSave.map(({ file, ...rest }) => rest)));
    } else {
      localStorage.removeItem('next_uploads');
    }
  }, [uploads]);

  const abortControllers = useRef<{ [key: string]: AbortController }>({});

  const simulateProgress = (id: string, startProgress: number = 0, max: number = 90, speed: number = 5) => {
    if (intervals.current[id]) clearInterval(intervals.current[id]);
    
    let progress = startProgress;
    const interval = setInterval(() => {
      // Smoother progress increment
      const increment = (Math.random() * speed) / 5; 
      progress += increment;
      if (progress > max) {
        progress = max;
      }
      setUploads(prev => prev.map(u => u.id === id ? { ...u, progress: Math.min(progress, max) } : u));
    }, 100);
    
    intervals.current[id] = interval;
    return interval;
  };

  const processAndUpload = async (id: string, file: File | string, type: string, metadata: any, startProgress: number = 0) => {
    const interval = simulateProgress(id, startProgress, 90, 8);
    const controller = new AbortController();
    abortControllers.current[id] = controller;
    
    try {
      let mediaUrl = '';
      let mediaType = metadata?.mediaType || 'text';

      // Check if paused before starting
      if (uploadsRef.current.find(u => u.id === id)?.status === 'paused') return;

      // If it's a File or a base64 string, we need to process it
      if (file instanceof File || typeof file === 'string') {
        const isVideo = (file instanceof File && file.type.startsWith('video/')) || (typeof file === 'string' && file.startsWith('data:video/'));
        const isImage = (file instanceof File && file.type.startsWith('image/')) || (typeof file === 'string' && file.startsWith('data:image/'));

        console.log('Processing upload:', { id, isVideo, isImage, fileType: file instanceof File ? file.type : 'base64' });

        if (isVideo || isImage) {
          mediaType = isVideo ? 'video' : 'image';
          console.log(`Uploading ${mediaType} to Supabase Storage...`);
          
          try {
            let fileBody: File | Blob;
            let fileExt = '';
            
            if (file instanceof File) {
              fileBody = file;
              fileExt = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpeg');
            } else {
              const res = await fetch(file);
              fileBody = await res.blob();
              fileExt = fileBody.type.split('/')[1] || (isVideo ? 'mp4' : 'jpeg');
            }
            
            if (isVideo) {
              console.log('Video detected. Preparing direct TUS resumable chunked upload...');
              setUploads(prev => prev.map(x => x.id === id ? { ...x, status: 'uploading', progress: 0 } : x));
              clearInterval(interval);
            } else if (isImage) {
              try {
                console.log('Optimizing image...');
                const options = {
                  maxSizeMB: 1,
                  maxWidthOrHeight: 1920,
                  useWebWorker: true,
                };
                fileBody = await imageCompression(fileBody as File, options);
                let uploadFileExt = fileExt;
                if (fileBody.type && fileBody.type.includes('/')) {
                   uploadFileExt = fileBody.type.split('/')[1] || fileExt;
                }
                fileExt = uploadFileExt;
                console.log('Image optimized successfully.');
              } catch (err) {
                console.warn('Image optimization failed, uploading raw.', err);
              }
            }
            
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${metadata.userId}/${fileName}`;
            
            clearInterval(interval); // We use real progress now, so clear simulated one

            if (isVideo) {
               console.log('Starting resumable chunked upload via TUS (Fast & Reliable)...');
               await new Promise<void>(async (resolve, reject) => {
                const { data: { session } } = await supabase.auth.getSession();
                const uploadUrl = import.meta.env.VITE_SUPABASE_URL;

                if (!session || !uploadUrl) {
                  // Fallback if no auth (should not happen normally)
                  const { error } = await supabase.storage.from('media').upload(filePath, fileBody);
                  if (error) return reject(error);
                  return resolve();
                }

                const upload = new tus.Upload(fileBody as File | Blob, {
                  endpoint: `${uploadUrl}/storage/v1/upload/resumable`,
                  retryDelays: [0, 3000, 5000, 10000, 20000],
                  headers: {
                    authorization: `Bearer ${session.access_token}`,
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
                    'x-upsert': 'true',
                  },
                  uploadDataDuringCreation: true,
                  removeFingerprintOnSuccess: true,
                  metadata: {
                    bucketName: 'media',
                    objectName: filePath,
                    contentType: 'video/mp4',
                    cacheControl: '3600',
                  },
                  chunkSize: 6 * 1024 * 1024, // 6MB chunks for reliability
                  onError: (error) => {
                    console.error('TUS Chunked Upload failed:', error);
                    // Standard RLS error message if applicable
                    if (error.message && (error.message.includes('row-level security') || error.message.includes('RLS') || error.message.includes('403'))) {
                        return reject(new Error("Supabase Storage RLS Error: You need to add a Storage Policy in your Supabase dashboard to allow uploads to the 'media' bucket. Run this SQL in Supabase: CREATE POLICY \"Public Uploads\" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media');"));
                    }
                    reject(error);
                  },
                  onProgress: (bytesUploaded, bytesTotal) => {
                    const percentage = (bytesUploaded / bytesTotal) * 100;
                    setUploads(prev => prev.map(x => x.id === id ? { ...x, progress: percentage } : x));
                  },
                  onSuccess: () => {
                    console.log('TUS Chunked Upload successful.');
                    setUploads(prev => prev.map(x => x.id === id ? { ...x, progress: 100 } : x));
                    resolve();
                  }
                });

                if (controller.signal.aborted) {
                  upload.abort(true);
                  return reject(new Error('Aborted'));
                }
                
                controller.signal.addEventListener('abort', () => {
                  upload.abort(false, () => {
                    reject(new Error('Aborted'));
                  });
                });

                upload.start();
              });
            } else {
              // Standard upload for images/audio
              simulateProgress(id, 0, 95, 10);
              console.log('Starting direct upload...');
              let { error: uploadError } = await supabase.storage.from('media').upload(filePath, fileBody);
              
              if (uploadError && (uploadError.message.includes('bucket') || uploadError.message.includes('not found'))) {
                console.log('Bucket "media" might not exist. Attempting to create...');
                await supabase.storage.createBucket('media', { public: true });
                const retry = await supabase.storage.from('media').upload(filePath, fileBody);
                uploadError = retry.error;
              }

              if (uploadError) {
                console.error('Upload failed directly:', uploadError);
                if (uploadError.message.includes('row-level security') || uploadError.message.includes('RLS')) {
                   throw new Error("Supabase Storage RLS Error: You need to add a Storage Policy in your Supabase dashboard to allow uploads to the 'media' bucket. Run this SQL in Supabase: CREATE POLICY \"Public Uploads\" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media');");
                }
                throw uploadError;
              }
              
              setUploads(prev => prev.map(x => x.id === id ? { ...x, progress: 100 } : x));
            }
            
            const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
            mediaUrl = publicUrl;
            console.log('Upload to storage successful:', mediaUrl);
            
          } catch (storageError) {
            console.warn('Failed to use Supabase Storage. Falling back to base64 encoding (not recommended for large files).', storageError);
            // Fallback to base64 if storage fails (e.g., RLS issues, no bucket)
            if (file instanceof File) {
              if (file.size > 1024 * 1024 * 50) { // 50MB limit for base64 fallback
                throw new Error("File is too large for base64 fallback. Please configure Supabase Storage.");
              }
              mediaUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                controller.signal.addEventListener('abort', () => {
                  reader.abort();
                  reject(new Error('Aborted'));
                });
                reader.readAsDataURL(file);
              });
            } else {
              mediaUrl = file;
            }
          }
        }
      } else {
        mediaUrl = file as string; 
      }

      if (controller.signal.aborted) return;

      // Final check before database call
      const currentStatus = uploadsRef.current.find(u => u.id === id)?.status;
      if (currentStatus === 'paused' || currentStatus === undefined) {
        console.log('Upload paused or undefined, returning:', currentStatus);
        return;
      }

      setUploads(prev => prev.map(x => x.id === id ? { ...x, status: 'uploading' } : x));

      if (type === 'post') {
        let postData: any;
        if (metadata.payload) {
          postData = { ...metadata.payload, media_url: mediaUrl, media_type: mediaType };
        } else {
          postData = {
            user_id: metadata.userId,
            content: metadata.content || '',
            media_url: mediaUrl,
            media_type: mediaType,
            views: 0
          };
          if (metadata.category) postData.category = metadata.category;
        }

        const { error } = await supabase.from('posts').insert([postData]);
        if (error) throw error;
      } else if (type === 'story') {
         const { error } = await supabase.from('stories').insert([{
          user_id: metadata.userId,
          media_url: mediaUrl,
          media_type: mediaType,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }]);
        if (error) throw error;
      } else if (type === 'reel') {
        const payload = { ...metadata.payload };
        if (mediaUrl) payload.video_url = mediaUrl;
        const { error } = await supabase.from('reels').insert([payload]);
        if (error) throw error;
      } else if (type === 'message') {
        const payload = { ...metadata.payload };
        if (mediaUrl) payload.media_url = mediaUrl;
        const { error } = await supabase.from('messages').insert([payload]);
        if (error) throw error;
        await supabase.from('notifications').insert([{
          user_id: metadata.payload.receiver_id,
          sender_id: metadata.payload.sender_id,
          type: 'message',
          is_read: false,
          created_at: new Date().toISOString()
        }]);
      } else if (type === 'profile') {
        const payload = { ...metadata.payload };
        if (mediaUrl) {
          if ('cover_url' in payload) payload.cover_url = mediaUrl;
          else payload.avatar_url = mediaUrl;
        }
        const { error } = await supabase.from('profiles').update(payload).eq('id', metadata.userId);
        if (error) throw error;
      }

      clearInterval(interval);
      setUploads(prev => prev.map(u => u.id === id ? { ...u, progress: 100, status: 'success' } : u));
      idb.del(`file_${id}`); // Clean up IndexedDB

      if (metadata?.onSuccess) {
        await metadata.onSuccess();
      }

      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== id));
      }, 3000);

    } catch (error) {
      clearInterval(interval);
      if (error instanceof Error && error.message === 'Aborted') {
        console.log('Upload aborted');
      } else {
        console.error('Upload failed:', error);
        setUploads(prev => prev.map(u => u.id === id ? { ...u, status: 'error' } : u));
      }
    }
  };

  const addUpload = useCallback((file: File | string, type: 'post' | 'story' | 'message' | 'reel' | 'profile', metadata?: any) => {
    const id = Date.now().toString();
    const newUpload: UploadTask = { id, file, progress: 0, status: 'processing', type, metadata };
    
    // Synchronously update the ref so processAndUpload can see it immediately
    uploadsRef.current = [...uploadsRef.current, newUpload];
    
    setUploads(uploadsRef.current);
    
    // Save file to IndexedDB for persistence
    idb.set(`file_${id}`, file);

    processAndUpload(id, file, type, metadata);
    return id;
  }, []);

   const pauseUpload = useCallback((id: string) => {
    console.log('Pausing upload:', id);
    if (intervals.current[id]) {
      console.log('Clearing interval for:', id);
      clearInterval(intervals.current[id]);
      delete intervals.current[id];
    }
    if (abortControllers.current[id]) {
      console.log('Aborting controller for:', id);
      abortControllers.current[id].abort();
      delete abortControllers.current[id];
    }
    setUploads(prev => {
      const next = prev.map(u => u.id === id ? { ...u, status: 'paused' as const } : u);
      uploadsRef.current = next;
      return next;
    });
  }, []);

  const resumeUpload = useCallback(async (id: string) => {
    const upload = uploadsRef.current.find(u => u.id === id);
    if (upload) {
      setUploads(prev => {
        const next = prev.map(u => u.id === id ? { ...u, status: 'processing' as const } : u);
        uploadsRef.current = next;
        return next;
      });
      
      // Retrieve file from IndexedDB
      let file = upload.file;
      if (!file) {
        file = await idb.get(`file_${id}`);
      }
      
      if (file) {
        processAndUpload(id, file, upload.type, upload.metadata, upload.progress);
      } else {
        setUploads(prev => {
          const next = prev.map(u => u.id === id ? { ...u, status: 'error' as const } : u);
          uploadsRef.current = next;
          return next;
        });
      }
    }
  }, []);

  const removeUpload = useCallback((id: string) => {
    console.log('Removing upload:', id);
    if (intervals.current[id]) {
      console.log('Clearing interval for:', id);
      clearInterval(intervals.current[id]);
      delete intervals.current[id];
    }
    if (abortControllers.current[id]) {
      console.log('Aborting controller for:', id);
      abortControllers.current[id].abort();
      delete abortControllers.current[id];
    }
    setUploads(prev => {
      const next = prev.filter(u => u.id !== id);
      uploadsRef.current = next;
      return next;
    });
    idb.del(`file_${id}`);
  }, []);

  const retryUpload = useCallback((id: string) => {
    const upload = uploadsRef.current.find(u => u.id === id);
    if (upload) {
      removeUpload(id);
      addUpload(upload.file!, upload.type, upload.metadata);
    }
  }, [addUpload, removeUpload]);

  const nodeRefs = useRef<{ [key: string]: React.RefObject<HTMLDivElement> }>({});

  return (
    <UploadContext.Provider value={{ uploads, addUpload, removeUpload, retryUpload, pauseUpload, resumeUpload }}>
      {children}
      {/* Circular Progress Indicator */}
      {uploads.length > 0 && (
        <div className="fixed top-4 left-4 z-[9999] flex flex-col gap-2">
          {uploads.map(upload => (
            <div key={upload.id} className="relative group bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full p-2 shadow-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8" viewBox="0 0 36 36">
                <path
                  className="text-gray-200 dark:text-gray-700"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className={`${upload.status === 'error' ? 'text-red-500' : 'text-[#1877F2]'} transition-all duration-300`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${upload.progress}, 100`}
                />
              </svg>
              <span className={`absolute text-[10px] font-black ${upload.status === 'error' ? 'text-red-500' : 'text-[#1877F2]'} group-hover:opacity-0 transition-opacity`}>
                {upload.status === 'error' ? '!' : `${Math.round(upload.progress)}%`}
              </span>
              <button 
                onClick={() => upload.status === 'error' ? retryUpload(upload.id) : removeUpload(upload.id)}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full text-white"
                title={upload.status === 'error' ? 'Retry Upload' : 'Cancel Upload'}
              >
                {upload.status === 'error' ? <RefreshCw size={16} /> : <X size={16} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
};
