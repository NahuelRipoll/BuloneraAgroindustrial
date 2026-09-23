alter table public.products
add column if not exists featured boolean not null default false;

alter table public.products
add column if not exists offer_price numeric(12,2)
check (offer_price is null or offer_price >= 0);

update public.products
set featured = true,
    offer_price = round(price * 0.90, 2)
where id in (
  select id from public.products
  where published = true
  order by name
  limit 4
)
and not exists (select 1 from public.products where featured = true);

create index if not exists products_featured_idx
on public.products(featured)
where published = true and featured = true;

comment on column public.products.featured is
'Indica si el producto aparece en la sección Ofertas de la portada';

comment on column public.products.offer_price is
'Precio promocional aplicado mientras el producto está destacado';
