create table public.admin_members (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

insert into public.admin_members (email) values
  ('bulonera@bagroindustrial.com'),
  ('nahuelripoll33@gmail.com')
on conflict (email) do nothing;

alter table public.admin_members enable row level security;

create or replace function public.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_members
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create policy "Admins can see their membership" on public.admin_members
for select to authenticated using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "Admins can insert products" on public.products for insert to authenticated with check (public.is_catalog_admin());
create policy "Admins can update products" on public.products for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "Admins can delete products" on public.products for delete to authenticated using (public.is_catalog_admin());
create policy "Admins can read all products" on public.products for select to authenticated using (public.is_catalog_admin());

create policy "Admins can insert variants" on public.product_variants for insert to authenticated with check (public.is_catalog_admin());
create policy "Admins can update variants" on public.product_variants for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "Admins can delete variants" on public.product_variants for delete to authenticated using (public.is_catalog_admin());
create policy "Admins can read all variants" on public.product_variants for select to authenticated using (public.is_catalog_admin());

alter table public.product_images alter column storage_path drop not null;
alter table public.product_images add column if not exists external_url text;
alter table public.product_images add constraint product_images_has_source check (storage_path is not null or external_url is not null);
create unique index product_images_storage_unique on public.product_images(product_id, storage_path) where storage_path is not null;

create policy "Admins can insert images" on public.product_images for insert to authenticated with check (public.is_catalog_admin());
create policy "Admins can update images" on public.product_images for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
create policy "Admins can delete images" on public.product_images for delete to authenticated using (public.is_catalog_admin());
create policy "Admins can read all images" on public.product_images for select to authenticated using (public.is_catalog_admin());

create policy "Admins can upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_catalog_admin());
create policy "Admins can update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_catalog_admin()) with check (bucket_id = 'product-images' and public.is_catalog_admin());
create policy "Admins can delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_catalog_admin());

