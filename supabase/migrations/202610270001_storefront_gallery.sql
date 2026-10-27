create table public.storefront_gallery (
  id boolean primary key default true check (id),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 12)
);
alter table public.storefront_gallery enable row level security;
grant select on public.storefront_gallery to anon, authenticated;
grant insert, update on public.storefront_gallery to authenticated;
create policy "Public can read storefront gallery" on public.storefront_gallery for select using (true);
create policy "Admins can create storefront gallery" on public.storefront_gallery for insert to authenticated with check (public.is_catalog_admin());
create policy "Admins can update storefront gallery" on public.storefront_gallery for update to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
