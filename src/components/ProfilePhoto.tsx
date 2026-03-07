import React from 'react';

interface ProfilePhotoProps {
  src: string;
  alt: string;
  hasStory?: boolean;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  onClick?: () => void;
}

const ProfilePhoto: React.FC<ProfilePhotoProps> = ({ src, alt, hasStory = false, size = 'medium', onClick }) => {
  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-12 h-12',
    large: 'w-20 h-20',
    xlarge: 'w-32 h-32 md:w-40 md:h-40',
  };

  const ringPadding = {
    small: 'p-[2px]',
    medium: 'p-[2px]',
    large: 'p-1',
    xlarge: 'p-1.5',
  }

  const ringClass = hasStory ? 'story-ring' : '';

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full flex-shrink-0 ${ringClass} ${onClick ? 'cursor-pointer' : ''} transition-transform hover:scale-105`}
      onClick={onClick}
    >
      <div className={`bg-white dark:bg-gray-800 rounded-full w-full h-full ${ringPadding[size]}`}>
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-full rounded-full object-cover border-2 border-white dark:border-gray-800"
        />
      </div>
    </div>
  );
};

export default ProfilePhoto;
