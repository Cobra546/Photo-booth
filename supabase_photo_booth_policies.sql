-- Photo Booth storage policies
-- Run this once in the Supabase SQL Editor for project dqjoinjlsjiprildawjg.
-- The app uploads with the public/anon client key, so INSERT must be allowed for anon.

create policy "photo_booth_anon_upload"
on storage.objects
for insert
to anon
with check (bucket_id = 'photo-booth');

create policy "photo_booth_authenticated_upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'photo-booth');

-- If these policies already exist, do not run the statements again;
-- instead keep the existing equivalent INSERT policies.
