create extension if not exists pgcrypto;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sku text not null unique,
  brand text not null default 'Sin marca',
  category text not null default 'Sin categoría',
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  list_price numeric(12,2) check (list_price is null or list_price >= 0),
  transfer_price numeric(12,2) not null check (transfer_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  badge text,
  specs jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  options jsonb not null default '{}'::jsonb,
  price numeric(12,2) not null check (price >= 0),
  transfer_price numeric(12,2) not null check (transfer_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique(product_id, storage_path)
);

create index products_published_idx on public.products(published);
create index products_category_idx on public.products(category);
create index products_brand_idx on public.products(brand);
create index product_variants_product_idx on public.product_variants(product_id);
create index product_images_product_position_idx on public.product_images(product_id, position);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;

create policy "Public can read published products" on public.products
for select using (published = true);
create policy "Public can read variants of published products" on public.product_variants
for select using (exists (select 1 from public.products p where p.id = product_id and p.published = true));
create policy "Public can read images of published products" on public.product_images
for select using (exists (select 1 from public.products p where p.id = product_id and p.published = true));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 6291456, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can view product images" on storage.objects
for select using (bucket_id = 'product-images');

comment on table public.products is 'Catálogo principal de la tienda';
comment on table public.product_variants is 'Medidas y opciones vendibles de cada producto';
comment on table public.product_images is 'Galería ordenada; position 0 es la portada';

