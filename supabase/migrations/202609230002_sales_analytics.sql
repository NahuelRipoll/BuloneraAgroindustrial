create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_email text,
  customer_name text,
  province text not null default 'Sin informar',
  payment_method text not null default 'Sin informar',
  status text not null default 'pending' check (status in ('pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled')),
  total numeric(12,2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_product_idx on public.order_items(product_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Admins can read orders" on public.orders for select to authenticated using (public.is_catalog_admin());
create policy "Admins can read order items" on public.order_items for select to authenticated using (public.is_catalog_admin());

comment on table public.orders is 'Ventas finalizadas o en proceso para analíticas comerciales';
comment on table public.order_items is 'Detalle histórico de artículos incluidos en cada venta';
