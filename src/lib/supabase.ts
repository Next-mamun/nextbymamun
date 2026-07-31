import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl || 'https://zdrubxtuxotqyasmsuqz.supabase.co',
  supabaseKey || 'sb_publishable_RhysQ4jCq4MYYMH0wFOd5w_Q5jJSHgh'
);
