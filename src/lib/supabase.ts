
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zdrubxtuxotqyasmsuqz.supabase.co';
const supabaseKey = 'sb_publishable_RhysQ4jCq4MYYMH0wFOd5w_Q5jJSHgh'; // This is the public key

export const supabase = createClient(supabaseUrl, supabaseKey);
