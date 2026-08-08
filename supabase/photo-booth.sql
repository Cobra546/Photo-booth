-- Photo Booth Supabase setup for Chapter 2
-- Run once in the Supabase SQL Editor after creating the `photo-booth` bucket.
-- The website uses Realtime Broadcast for WebRTC signaling and Storage for strips.

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

-- The `photo-booth` Storage bucket should already exist.
-- These policies allow the public client to upload and read strips in that bucket.
drop policy if exists "photo booth upload" on storage.objects;
create policy "photo booth upload"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'photo-booth');

drop policy if exists "photo booth read" on storage.objects;
create policy "photo booth read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'photo-booth');

-- Safe to run repeatedly: only add the table to Realtime if it is not already there.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'photo_rooms'
  ) then
    alter publication supabase_realtime add table public.photo_rooms;
  end if;
end $$;
