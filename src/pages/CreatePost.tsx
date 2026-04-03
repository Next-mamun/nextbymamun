import React, { useState, useCallback } from 'react';
import { UploadCloud, X, RefreshCw } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useUpload } from '@/contexts/UploadContext';

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

  const categories = ['Entertainment', 'Learning', 'AI', 'Technology', 'Music', 'Gaming', 'News', 'Lifestyle', 'Sports', 'Art'];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      const previewUrl = URL.createObjectURL(selectedFile);
      setPreview(previewUrl);
    }
  }, []);

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
    
    const mediaType = file ? (file.type.startsWith('video/') ? 'video' : 'image') : (validEmbedUrl ? 'video' : 'text');
    const mediaUrl = validEmbedUrl || ''; // If file, it will be handled by UploadContext

    const postData: any = {
      user_id: currentUser.id,
      content: caption,
      media_url: mediaUrl,
      media_type: mediaType,
      views: 0
    };

    if (showCategoryInput ? customCategory : postCategory) {
      postData.category = showCategoryInput ? customCategory : postCategory;
    }

    if (file) {
      addUpload(file, 'post', {
        userId: currentUser.id,
        payload: postData,
        onSuccess: () => console.log('Upload finished')
      });
      navigate('/');
    } else {
      setIsUploading(true);
      const { error } = await supabase.from('posts').insert([postData]);
      if (error) {
        alert(error.message || 'Failed to create post');
      } else {
        navigate('/');
      }
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 flex items-center justify-center transition-colors duration-300 pt-16 sm:pt-4">
      <div className="w-full max-w-2xl mx-auto p-6 md:p-8 rounded-2xl shadow-lg glass-card">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">Create New Post</h1>

        <div className="space-y-6">
          {!preview && !validEmbedUrl ? (
            <div
              {...getRootProps()}
              className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-300
                ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'}`}
            >
              <input {...getInputProps()} />
              <div className="text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Image or Video</p>
              </div>
            </div>
          ) : preview ? (
            <div className="relative w-full rounded-xl overflow-hidden bg-black">
              {file?.type.startsWith('image/') ? (
                <img src={preview} alt="Preview" className="w-full h-auto max-h-[50vh] object-contain" />
              ) : (
                <video src={preview} controls className="w-full h-auto max-h-[50vh] object-contain" />
              )}
              <button
                onClick={handleRemoveFile}
                className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/75 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="relative w-full rounded-xl overflow-hidden aspect-video bg-black border border-gray-200 dark:border-gray-700">
              <iframe 
                src={validEmbedUrl || ''} 
                className="w-full h-full"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                title="post-preview"
              />
              <button
                onClick={() => setYtLink('')}
                className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/75 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-600 dark:text-gray-400">Post Content</label>
              <button 
                onClick={() => setShowYoutube(!showYoutube)}
                className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${showYoutube ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}
              >
                {showYoutube ? 'Hide Link Option' : 'Add Link (YT/FB)'}
              </button>
            </div>
            
            {showYoutube && (
              <input 
                type="text" 
                placeholder="Paste YouTube or Facebook Link..." 
                value={ytLink}
                onChange={(e) => setYtLink(e.target.value)}
                className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            )}

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
              rows={4}
              className="w-full p-3 bg-transparent border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-300 resize-none"
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-600 dark:text-gray-400">Select Category</label>
                <button 
                  onClick={() => setShowCategoryInput(!showCategoryInput)}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  {showCategoryInput ? 'Choose from list' : 'Add custom category'}
                </button>
              </div>
              
              {showCategoryInput ? (
                <input 
                  type="text" 
                  placeholder="Enter custom category..." 
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button 
                      key={cat} 
                      onClick={() => setPostCategory(cat)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${postCategory === cat ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={(!file && !caption.trim() && !getYoutubeId(ytLink) && !getFacebookEmbedUrl(ytLink)) || isUploading}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-300 flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                Posting ({uploadProgress}%)...
              </>
            ) : (
              'Post'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
