import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('messages').insert([{
    sender_id: '123e4567-e89b-12d3-a456-426614174000',
    receiver_id: '123e4567-e89b-12d3-a456-426614174000',
    content: 'test',
    is_view_once: true,
    parent_message_id: null
  }]);
  console.log('Error:', error);
}
run();
