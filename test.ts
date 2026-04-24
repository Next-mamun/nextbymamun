import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const payload = {
    user_id: '123e4567-e89b-12d3-a456-426614174000', // dummy
    caption: 'Test',
    video_url: 'https://example.com/video.mp4',
    source_type: 'local'
  };
  const { data, error } = await supabase.from('reels').insert([payload]);
  console.log('insert error:', error);
}

check();
