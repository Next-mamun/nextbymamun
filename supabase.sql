
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Existing tables assumed to be present (profiles, posts, etc.)

-- 9. Reels table
CREATE TABLE IF NOT EXISTS public.reels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  caption TEXT,
  video_url TEXT NOT NULL, -- Direct Base64 or YouTube URL
  thumbnail_url TEXT,
  source_type TEXT CHECK (source_type IN ('local', 'youtube')) DEFAULT 'local',
  youtube_id TEXT, -- Extracted ID if youtube
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 10. Reel Likes
CREATE TABLE IF NOT EXISTS public.reel_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(reel_id, user_id)
);

-- 11. Reel Comments
CREATE TABLE IF NOT EXISTS public.reel_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable Realtime for all core tables
ALTER PUBLICATION supabase_realtime ADD TABLE 
  public.profiles, 
  public.posts, 
  public.likes, 
  public.comments, 
  public.friendships, 
  public.messages, 
  public.stories, 
  public.story_views, 
  public.reels, 
  public.reel_likes, 
  public.reel_comments;
