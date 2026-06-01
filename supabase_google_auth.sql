-- This SQL script sets up a trigger to automatically create a user profile
-- in the 'public.profiles' table when a new user signs up via Google (or any other method).

-- 1. Create a function to handle new user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    -- Generate a unique username: email prefix + random suffix
    coalesce(
      split_part(new.email, '@', 1),
      'user'
    ) || '_' || substr(md5(random()::text), 1, 4),
    -- Use full name from metadata, or fallback to email prefix
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1),
      'New User'
    ),
    -- Use avatar from metadata, or fallback to a default
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'
    )
  )
  on conflict (id) do nothing; -- Prevent errors if profile already exists
  return new;
end;
$$;

-- 2. Create the trigger
-- First, drop it if it exists to avoid errors when running multiple times
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. (Optional) If you have existing users without profiles, you might need to manually insert them,
-- but this trigger handles all FUTURE sign-ups.
