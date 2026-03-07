export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  cover_url?: string;
  bio?: string;
  is_verified?: boolean;
  verification_document_url?: string;
  verification_status?: 'none' | 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export type User = UserProfile;

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  created_at: string;
  profiles: User;
  story_views: any[];
}

export interface Reel {
  id: string;
  user_id: string;
  caption: string;
  video_url: string;
  thumbnail_url?: string;
  source_type: 'local' | 'youtube' | 'facebook';
  youtube_id?: string;
  created_at: string;
  profiles: User;
  likes: any[];
  comments: any[];
  views?: number;
}
