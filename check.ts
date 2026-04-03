import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zdrubxtuxotqyasmsuqz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcnVieHR1eG90cXlhc21zdXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjYwMjUsImV4cCI6MjA4NzAwMjAyNX0.bmabhbjLx_ZUmW0wJRx9fUY8Noiv9dz8i-pzWe-PEyI'
);

async function check() {
  const { data, error } = await supabase.from('notifications').select('*').limit(1);
  console.log('Data:', data);
  console.log('Error:', error);
}

check();
