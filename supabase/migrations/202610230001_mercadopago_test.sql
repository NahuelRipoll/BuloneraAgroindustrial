-- Compatible con el proyecto actual. No modifica catálogo, ventas reales ni stock.
begin;

create table public.mercadopago_test_orders (
  id uuid primary key,
  payment_method text not null default 'Mercado Pago (prueba)',
  status text not null check (status = 'paid'),
  total numeric(12,2) not null check (total > 0),
  created_at timestamptz not null default now()
);

create table public.mercadopago_test_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.mercadopago_test_orders(id),
  product_id uuid not null,
  product_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price > 0)
);

alter table public.mercadopago_test_orders enable row level security;
alter table public.mercadopago_test_order_items enable row level security;
revoke all on public.mercadopago_test_orders, public.mercadopago_test_order_items from anon, authenticated;
grant all on public.mercadopago_test_orders, public.mercadopago_test_order_items to service_role;

create table public.mercadopago_checkouts (
  id uuid primary key,
  status_token uuid not null,
  total numeric(12,2) not null check (total > 0),
  items jsonb not null,
  collector_id text not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  payment_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.mercadopago_checkouts enable row level security;
-- Sin políticas públicas: acceso exclusivo desde el servidor con service_role.
revoke all on public.mercadopago_checkouts from anon, authenticated;
grant all on public.mercadopago_checkouts to service_role;

create or replace function public.confirm_test_mercadopago_payment(
  p_order_id uuid, p_payment_id text, p_amount numeric, p_currency text, p_collector_id text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  checkout public.mercadopago_checkouts%rowtype;
  line jsonb;
begin
  select * into checkout from public.mercadopago_checkouts where id = p_order_id for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if p_currency <> 'ARS' or p_amount <> checkout.total or p_collector_id <> checkout.collector_id then
    raise exception 'El pago no coincide con el pedido';
  end if;
  if checkout.status = 'paid' then
    if checkout.payment_id <> p_payment_id then raise exception 'Pedido pagado con otro pago'; end if;
    return;
  end if;
  insert into public.mercadopago_test_orders(id, payment_method, status, total)
  values (checkout.id, 'Mercado Pago (prueba)', 'paid', checkout.total);
  for line in select * from jsonb_array_elements(checkout.items) loop
    insert into public.mercadopago_test_order_items(order_id, product_id, product_name, sku, quantity, unit_price)
    values (checkout.id, (line->>'product_id')::uuid, line->>'title', line->>'sku', (line->>'quantity')::integer, (line->>'unit_price')::numeric);
  end loop;
  update public.mercadopago_checkouts set status = 'paid', payment_id = p_payment_id, paid_at = now() where id = checkout.id;
end;
$$;

revoke all on function public.confirm_test_mercadopago_payment(uuid,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.confirm_test_mercadopago_payment(uuid,text,numeric,text,text) to service_role;

commit;
