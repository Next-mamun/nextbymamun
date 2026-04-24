import React, { useState, useCallback } from 'react';
import { UploadCloud, X, RefreshCw, Link as LinkIcon, Clapperboard, Image } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useUpload } from '@/contexts/UploadContext';
import { invalidatePostsCache } from '@/lib/redis';

const CreatePost = () => {
  const { currentUser } = useAuth();
  const { addUpload } = useUpload();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [ytLink, setYtLink] = useState('');
  const [showYoutube, setShowYoutube] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [postCategory, setPostCategory] = useState('Entertainment');
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const categories = ['Entertainment', 'Learning', 'AI', 'Technology', 'Music', 'Gaming', 'News', 'Lifestyle', 'Sports', 'Art'];

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setYtLink(e.target.value);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      
      // Limit file size to 10MB
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('File is too large. Please select a file under 10MB.');
        return;
      }

      setFile(selectedFile);
      const previewUrl = URL.createObjectURL(selectedFile);
      setPreview(previewUrl);
    }
  }, []);

  const handleThumbnailDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'next_app_uploads');
    const cloudName = 'dcwe6ln0h';
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Cloudinary Upload Failed');
    const data = await res.json();
    return data.secure_url;
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi']
    },
    multiple: false,
  });

  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
    if (preview) {
      URL.revokeObjectURL(preview);
    }
  };

  const getYoutubeId = (url: string | null | undefined) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getFacebookEmbedUrl = (url: string | null | undefined) => {
    if (!url) return null;
    // Handle various FB URL formats including m.facebook.com
    if (url.match(/(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch)/i)) {
      if (url.includes('plugins/video.php')) return url;
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=560`;
    }
    return null;
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    const ytId = getYoutubeId(url);
    const fbUrl = getFacebookEmbedUrl(url);
    // rel=0: show related videos from same channel only
    // modestbranding=1: hide youtube logo
    // iv_load_policy=3: hide annotations
    // disablekb=1: disable keyboard shortcuts
    if (ytId) return `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&iv_load_policy=3&controls=1&disablekb=1&autoplay=0`;
    if (fbUrl) return fbUrl;
    return null;
  };

  // Derived link from input or caption
  const detectedLink = ytLink || caption.match(/https?:\/\/(?:www\.|m\.|web\.)?(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch)\/[^\s]+/i)?.[0] || '';
  const validEmbedUrl = getEmbedUrl(detectedLink);

  const handleSubmit = async () => {
    if (!currentUser) return;
    
    setIsUploading(true);
    let thumbnailUrl: string | undefined = undefined;
    if (thumbnailFile) {
      try {
        thumbnailUrl = await uploadToCloudinary(thumbnailFile);
      } catch (err) {
        console.error("Failed to upload custom thumbnail", err);
      }
    }

    const mediaType = file ? (file.type.startsWith('video/') ? 'video' : 'image') : (validEmbedUrl ? 'video' : 'text');
    const mediaUrl = validEmbedUrl || ''; // If file, it will be handled by UploadContext
    const category = showCategoryInput ? customCategory : postCategory;

    const postData: any = {
      user_id: currentUser.id,
      content: caption,
      media_url: mediaUrl,
      media_type: mediaType,
      category: category,
      views: 0
    };
    
    if (thumbnailUrl) {
      postData.thumbnail_url = thumbnailUrl;
    }

    if (file) {
      addUpload(file, 'post', {
        userId: currentUser.id,
        payload: postData,
        onSuccess: () => navigate('/')
      });
    } else {
      const { error } = await supabase.from('posts').insert([postData]);
      if (error) {
        alert(error.message || 'Failed to create post');
      } else {
        await invalidatePostsCache();
        navigate('/');
      }
    }
    
    if (!file) {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 flex items-center justify-center transition-colors duration-300 pt-16 sm:pt-4">
      <div className="w-full max-w-2xl mx-auto p-6 md:p-8 rounded-2xl shadow-lg glass-card">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">Create New Post</h1>

        <div className="space-y-6">
          {!preview && !validEmbedUrl ? (
            <div className="flex flex-col gap-6">
              <div
                {...getRootProps()}
                className={`group relative flex flex-col items-center justify-center w-full min-h-[300px] border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-500 overflow-hidden
                  ${isDragActive ? 'border-[#1877F2] bg-[#1877F2]/5 scale-105' : 'border-gray-300 dark:border-gray-700 hover:border-[#1877F2] dark:hover:border-[#1877F2] hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/50 dark:to-gray-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <input {...getInputProps()} />
                <div className="text-center z-10 flex flex-col items-center p-8">
                  <div className={`p-5 rounded-full mb-6 transition-all duration-500 shadow-sm
                    ${isDragActive ? 'bg-[#1877F2] text-white scale-110 shadow-[#1877F2]/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:bg-[#1877F2] group-hover:text-white group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(24,119,242,0.3)]'}`}>
                    <UploadCloud className="h-10 w-10" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {isDragActive ? 'Drop your file here' : 'Drag and drop video or photo'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-[280px]">
                    Your videos will be private until you publish them. Supports MP4, WebM, JPG, PNG & more.
                  </p>
                  <button className="bg-[#1877F2] text-white px-8 py-2.5 rounded-full font-bold shadow-md shadow-[#1877F2]/20 hover:bg-[#166fe5] hover:scale-105 transition-all">
                    Select Files
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full">
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800"></div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">OR EMBED</span>
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800"></div>
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#1877F2] transition-colors">
                  <LinkIcon size={20} />
                </div>
                <input
                  type="text"
                  placeholder="Paste YouTube or Facebook video link..."
                  value={detectedLink}
                  onChange={handleLinkChange}
                  className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-gray-800 rounded-xl outline-none border border-gray-200 dark:border-gray-700 focus:border-[#1877F2] dark:focus:border-[#1877F2] text-[15px] font-medium shadow-sm transition-all focus:shadow-[0_0_0_4px_rgba(24,119,242,0.1)] text-gray-900 dark:text-white"
                />
              </div>
            </div>
          ) : preview ? (
            <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-lg border border-gray-200 dark:border-gray-800 group">
                {file?.type.startsWith('image/') ? (
                  <img src={preview} alt="Preview" className="w-full h-auto max-h-[40vh] object-contain transition-transform duration-500 group-hover:scale-[1.01]" />
                ) : (
                  <video src={preview} controls className="w-full h-auto max-h-[40vh] object-contain transition-transform duration-500 group-hover:scale-[1.01]" />
                )}
                <button
                  onClick={handleRemoveFile}
                  className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-red-500 hover:scale-110 transition-all shadow-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Video Specific Tools */}
              {file?.type.startsWith('video/') && (
                 <div className="flex flex-col gap-4 p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                         <Image size={20} />
                       </div>
                       <div>
                         <h4 className="font-bold text-gray-900 dark:text-white text-sm">Custom Thumbnail</h4>
                         <p className="text-xs text-gray-500 dark:text-gray-400">Catch viewers' attention instantly</p>
                       </div>
                     </div>
                     <div className="flex items-center gap-3">
                       {thumbnailPreview && (
                         <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-black shadow-sm group/thumb">
                           <img src={thumbnailPreview} className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                             <button onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); }} className="text-white hover:text-red-400 drop-shadow-md">
                               <X size={16} />
                             </button>
                           </div>
                         </div>
                       )}
                       <label className="cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-bold py-2 px-4 rounded-xl transition-all border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md">
                         {thumbnailPreview ? 'Change' : 'Upload Image'}
                         <input type="file" hidden accept="image/*" onChange={handleThumbnailDrop} />
                       </label>
                     </div>
                   </div>
                 </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="relative w-full rounded-2xl overflow-hidden aspect-video bg-black shadow-lg border border-gray-200 dark:border-gray-800 group">
                <iframe 
                  src={validEmbedUrl || ''} 
                  className="w-full h-full border-none"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                  title="post-preview"
                />
                <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                <button
                  onClick={() => setYtLink('')}
                  className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-red-500 hover:scale-110 transition-all shadow-lg z-10"
                >
                  <X size={18} />
                </button>
              </div>
              
              {/* Embed Video Specific Tools */}
              <div className="flex flex-col gap-4 p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                      <Image size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">Custom Thumbnail</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Catch viewers' attention instantly</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {thumbnailPreview && (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-black shadow-sm group/thumb">
                        <img src={thumbnailPreview} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); }} className="text-white hover:text-red-400 drop-shadow-md">
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                    <label className="cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-bold py-2 px-4 rounded-xl transition-all border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md">
                      {thumbnailPreview ? 'Change' : 'Upload Image'}
                      <input type="file" hidden accept="image/*" onChange={handleThumbnailDrop} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Details Section */}
          <div className={`space-y-5 transition-all duration-500 ${!preview && !validEmbedUrl ? 'opacity-50 pointer-events-none blur-[1px]' : 'opacity-100'}`}>
            <div className="flex items-start gap-4 flex-col sm:flex-row">
              <div className="flex-1 space-y-4 w-full">
                <div className="relative">
                  <textarea
                    placeholder="Write a catchy description..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full h-32 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:border-[#1877F2] dark:focus:border-[#1877F2] focus:ring-4 focus:ring-[#1877F2]/10 transition-all resize-none text-[15px] text-gray-900 dark:text-white placeholder-gray-400 shadow-inner"
                  />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">Category</h4>
                    <button 
                      onClick={() => setShowCategoryInput(!showCategoryInput)}
                      className="text-xs font-bold text-[#1877F2] hover:bg-[#1877F2]/10 px-3 py-1 rounded-full transition-colors"
                    >
                      {showCategoryInput ? 'Choose from list' : '+ Custom Category'}
                    </button>
                  </div>
                  
                  {showCategoryInput ? (
                    <input
                      type="text"
                      placeholder="Type your own category..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none border border-gray-200 dark:border-gray-700 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-medium text-gray-900 dark:text-white"
                      autoFocus
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {categories.filter(c => c !== 'All').map(cat => (
                        <button
                          key={cat}
                          onClick={() => setPostCategory(cat)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm
                            ${postCategory === cat 
                              ? 'bg-gray-900 text-white dark:bg-white dark:text-black scale-105' 
                              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 rounded-full font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isUploading || (!file && !validEmbedUrl)}
              className="relative px-8 py-3 bg-[#1877F2] text-white rounded-full font-bold shadow-md shadow-[#1877F2]/20 hover:bg-[#166fe5] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 disabled:active:scale-100 overflow-hidden group"
            >
              <div className="absolute inset-0 w-full h-full bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              {isUploading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Publishing...</span>
                </div>
              ) : (
                'Publish Post'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
