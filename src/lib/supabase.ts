import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  try {
    return (import.meta as any).env[key];
  } catch (e) {
    return undefined;
  }
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const supabase = createClient(
  supabaseUrl || 'https://zdrubxtuxotqyasmsuqz.supabase.co',
  supabaseKey || 'sb_publishable_RhysQ4jCq4MYYMH0wFOd5w_Q5jJSHgh'
);

