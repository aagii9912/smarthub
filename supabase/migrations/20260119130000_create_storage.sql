-- Create storage bucket for products if not exists
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

-- Set up security policies for products bucket
-- Set up security policies for products bucket
-- Allow public access to view images
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'products' );

-- Allow authenticated users to upload images
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
create policy "Authenticated users can upload"
  on storage.objects for insert
  with check ( bucket_id = 'products' and auth.role() = 'authenticated' );

-- Allow users to update their own images (or all for simplicity in this MVP)
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
create policy "Authenticated users can update"
  on storage.objects for update
  using ( bucket_id = 'products' and auth.role() = 'authenticated' );

-- Allow users to delete their own images
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
create policy "Authenticated users can delete"
  on storage.objects for delete
  using ( bucket_id = 'products' and auth.role() = 'authenticated' );
