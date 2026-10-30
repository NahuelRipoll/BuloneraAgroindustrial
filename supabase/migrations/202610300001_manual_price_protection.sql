begin;

-- Specs are included in existing automatic backups and catalog restores.
update public.products
set specs = coalesce(specs, '{}'::jsonb) || '{"price_import_protected":true}'::jsonb
where not (coalesce(specs, '{}'::jsonb) ? 'price_import_protected')
  and (trim(sku) = '2121032' or name ~* '\mfoliar(es)?\M');

create function public.import_catalog_product_prices(p_product_id uuid, p_changes jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target public.products;
  change jsonb;
  current_price numeric;
  variant_id uuid;
  has_variants boolean;
  new_base numeric;
begin
  if not public.is_catalog_admin() then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('catalog_write'));
  select * into target from public.products where id = p_product_id for update;
  if not found then raise exception 'El artículo ya no existe'; end if;
  if coalesce((target.specs->>'price_import_protected')::boolean,
      trim(target.sku) = '2121032' or target.name ~* '\mfoliar(es)?\M') then
    raise exception 'Precio protegido: no se permiten importaciones para este artículo';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) = 0 then
    raise exception 'No hay cambios de precio válidos';
  end if;
  if (select count(*) from jsonb_array_elements(p_changes)) <>
     (select count(distinct lower(trim(c->>'sku'))) from jsonb_array_elements(p_changes) c) then
    raise exception 'Hay códigos vacíos o repetidos';
  end if;
  select exists(select 1 from public.product_variants where product_id = target.id) into has_variants;
  for change in select * from jsonb_array_elements(p_changes) loop
    if coalesce(change->>'after', '') !~ '^[0-9]+([.][0-9]+)?$'
       or (change->>'after')::numeric <= 0 then raise exception 'Precio nuevo inválido'; end if;
    if has_variants then
      select id, price into variant_id, current_price from public.product_variants
      where product_id = target.id and lower(trim(sku)) = lower(trim(change->>'sku')) for update;
      if not found then raise exception 'La medida cambió. Volvé a preparar la revisión'; end if;
    else
      if lower(trim(target.sku)) is distinct from lower(trim(change->>'sku')) then
        raise exception 'El código cambió. Volvé a preparar la revisión';
      end if;
      current_price := target.price;
    end if;
    if change->>'before' is null or
       (current_price <> (change->>'before')::numeric and current_price <> round((change->>'after')::numeric, 2)) then
      raise exception 'El precio cambió. Volvé a preparar la revisión';
    end if;
    if has_variants then
      update public.product_variants set price = round((change->>'after')::numeric, 2),
        transfer_price = round(round((change->>'after')::numeric, 2) * .9, 2) where id = variant_id;
    else
      update public.products set price = round((change->>'after')::numeric, 2),
        transfer_price = round(round((change->>'after')::numeric, 2) * .9, 2) where id = target.id;
    end if;
  end loop;
  if has_variants then
    select min(price) filter (where price > 0) into new_base from public.product_variants where product_id = target.id;
    update public.products set price = new_base, transfer_price = round(new_base * .9, 2) where id = target.id;
  end if;
  return target.id;
end;
$$;
revoke all on function public.import_catalog_product_prices(uuid,jsonb) from public, anon;
grant execute on function public.import_catalog_product_prices(uuid,jsonb) to authenticated;
commit;
