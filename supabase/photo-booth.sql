-- Photo Booth Supabase setup
-- The Realtime Broadcast channel is used for WebRTC signaling.
-- Run this in Supabase SQL Editor if you want room metadata/expiry and Storage RLS.

create table if not exists public.photo_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null check (room_code ~ '^[A-Z0-9]{6}$'),
  status text not null default 'waiting' check (status in ('waiting','active','closed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);

create index if not exists photo_rooms_code_idx on public.photo_rooms(room_code);
alter table public.photo_rooms enable row level security;

drop policy if exists "photo rooms can be read" on public.photo_rooms;
create policy "photo rooms can be read"
on public.photo_rooms for select to anon, authenticated
using (expires_at > now());

drop policy if exists "photo rooms can be created" on public.photo_rooms;
create policy "photo rooms can be created"
on public.photo_rooms for insert to anon, authenticated
with check (expires_at > now());

drop policy if exists "photo rooms can be updated" on public.photo_rooms;
create policy "photo rooms can be updated"
on public.photo_rooms for update to anon, authenticated
using (expires_at > now())
with check (expires_at > now());

-- `photo-booth` should already exist as a Storage bucket.
-- Keep it public only if you want public share URLs.
drop policy if exists "photo booth upload" on storage.objects;
create policy "photo booth upload"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'photo-booth');

drop policy if exists "photo booth read" on storage.objects;
create policy "photo booth read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'photo-booth');

-- Optional: enable Realtime for room metadata if you later switch from
-- Broadcast-only signaling to database change events.
alter publication supabase_realtime add table public.photo_rooms;
