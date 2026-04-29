create extension if not exists pgcrypto;
create extension if not exists postgis;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email, 'Nearby user'),
    null
  )
  on conflict (id) do update
    set display_name = excluded.display_name;

  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_locations (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  room_key text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_key text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists room_messages_room_key_created_at_idx on public.room_messages (room_key, created_at desc);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists on_user_locations_updated_at on public.user_locations;
create trigger on_user_locations_updated_at
before update on public.user_locations
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_locations enable row level security;
alter table public.room_messages enable row level security;

-- Enable realtime on tables
alter table public.user_locations replica identity full;
alter publication supabase_realtime add table public.user_locations;
alter table public.room_messages replica identity full;
alter publication supabase_realtime add table public.room_messages;

create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Locations are readable by authenticated users"
  on public.user_locations for select
  to authenticated
  using (true);

create policy "Users can manage own location"
  on public.user_locations for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Room messages readable by authenticated users"
  on public.room_messages for select
  to authenticated
  using (true);

create policy "Users can send messages"
  on public.room_messages for insert
  to authenticated
  with check (auth.uid() = user_id);
