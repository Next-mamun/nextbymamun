import { supabase } from './src/lib/supabase';
async function test() {
  const { data, error } = await supabase.from('posts').insert({
    user_id: '1',
    content: 'test'
  });
  console.log('posts error:', error);
}
test();
