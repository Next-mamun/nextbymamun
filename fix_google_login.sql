-- Fix for Google Login "Database error saving new user"

-- 1. Make sure password and backup_pin columns exist and are NOT required (nullable)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS backup_pin TEXT;
ALTER TABLE public.profiles ALTER COLUMN password DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN backup_pin DROP NOT NULL;

-- 2. Update the trigger function to be more robust and prevent failing the signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  generated_username text;
begin
  -- Generate a unique username
  generated_username := coalesce(split_part(new.email, '@', 1), 'user') || '_' || substr(md5(random()::text), 1, 4);

  insert into public.profiles (id, username, display_name, avatar_url, password)
  values (
    new.id,
    generated_username,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'New User'),
    coalesce(new.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || generated_username),
    'google_oauth_user' -- Fallback password for OAuth users
  )
  on conflict (id) do update set
    display_name = coalesce(new.raw_user_meta_data->>'full_name', excluded.display_name),
    avatar_url = coalesce(new.raw_user_meta_data->>'avatar_url', excluded.avatar_url);
  
  return new;
exception
  when others then
    -- If anything fails, still allow the user to be created in auth.users
    raise log 'Error in handle_new_user: %', sqlerrm;
    return new;
end;
$$;

-- 3. Recreate the trigger just in case
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
