begin;

-- Restrictive policies remain effective even if another permissive policy is added.
do $$
declare target text;
begin
  foreach target in array array['products', 'product_variants', 'product_images', 'storefront_gallery'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', target);
    execute format('grant select on public.%I to anon, authenticated', target);
    execute format('grant insert, update, delete on public.%I to authenticated', target);
    execute format('create policy admin_insert_guard on public.%I as restrictive for insert to public with check (public.is_catalog_admin())', target);
    execute format('create policy admin_update_guard on public.%I as restrictive for update to public using (public.is_catalog_admin()) with check (public.is_catalog_admin())', target);
    execute format('create policy admin_delete_guard on public.%I as restrictive for delete to public using (public.is_catalog_admin())', target);
  end loop;
end;
$$;

revoke all on public.admin_members from public, anon, authenticated;
grant select on public.admin_members to authenticated;
create policy admin_members_no_insert on public.admin_members as restrictive for insert to public with check (false);
create policy admin_members_no_update on public.admin_members as restrictive for update to public using (false) with check (false);
create policy admin_members_no_delete on public.admin_members as restrictive for delete to public using (false);

create policy catalog_storage_insert_guard on storage.objects as restrictive for insert to public
with check (bucket_id <> 'product-images' or public.is_catalog_admin());
create policy catalog_storage_update_guard on storage.objects as restrictive for update to public
using (bucket_id <> 'product-images' or public.is_catalog_admin())
with check (bucket_id <> 'product-images' or public.is_catalog_admin());
create policy catalog_storage_delete_guard on storage.objects as restrictive for delete to public
using (bucket_id <> 'product-images' or public.is_catalog_admin());

create table public.catalog_backups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid,
  label text not null,
  scope text not null check (scope in ('catalog', 'product')),
  product_id uuid,
  transaction_id bigint,
  snapshot jsonb not null,
  unique (product_id, transaction_id)
);
alter table public.catalog_backups enable row level security;
revoke all on public.catalog_backups from public, anon, authenticated;
grant select on public.catalog_backups to authenticated;
create policy "Admins can read catalog backups" on public.catalog_backups for select to authenticated using (public.is_catalog_admin());

-- Internal helpers are never callable through the public API.
create function public.catalog_snapshot(p_product_id uuid default null)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'version', 1,
    'scope', case when p_product_id is null then 'catalog' else 'product' end,
    'products', coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.products p where p_product_id is null or p.id = p_product_id), '[]'::jsonb),
    'variants', coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from public.product_variants v where p_product_id is null or v.product_id = p_product_id), '[]'::jsonb),
    'images', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.product_images i where p_product_id is null or i.product_id = p_product_id), '[]'::jsonb),
    'gallery', case when p_product_id is null then coalesce((select jsonb_agg(to_jsonb(g)) from public.storefront_gallery g), '[]'::jsonb) else '[]'::jsonb end
  );
$$;
revoke all on function public.catalog_snapshot(uuid) from public, anon, authenticated;

create function public.backup_catalog_product()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid; target_ids uuid[]; payload jsonb; product_name text; parent_written_here boolean;
begin
  if tg_table_name = 'products' then
    target_ids := array[old.id];
  elsif tg_op = 'UPDATE' then
    target_ids := array[old.product_id, new.product_id];
  elsif tg_op = 'DELETE' then
    target_ids := array[old.product_id];
  else
    target_ids := array[new.product_id];
  end if;
  foreach target_id in array target_ids loop
    if exists (select 1 from public.catalog_backups where product_id = target_id and transaction_id = txid_current()) then continue; end if;
    select name, xmin::text = (txid_current() % 4294967296)::text into product_name, parent_written_here from public.products where id = target_id;
    if not found then continue; end if;
    -- A newly inserted parent has no previous complete version to preserve.
    if tg_table_name <> 'products' and tg_op = 'INSERT' and parent_written_here then continue; end if;
    payload := public.catalog_snapshot(target_id);
    insert into public.catalog_backups(created_by, label, scope, product_id, transaction_id, snapshot)
    values (auth.uid(), left('Antes de ' || lower(tg_op) || ': ' || product_name, 200), 'product', target_id, txid_current(), payload)
    on conflict (product_id, transaction_id) do nothing;
  end loop;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.backup_catalog_product() from public, anon, authenticated;
create trigger products_backup before update or delete on public.products for each row execute function public.backup_catalog_product();
create trigger variants_backup before insert or update or delete on public.product_variants for each row execute function public.backup_catalog_product();
create trigger images_backup before insert or update or delete on public.product_images for each row execute function public.backup_catalog_product();

create function public.create_catalog_backup(p_label text default 'Respaldo manual')
returns uuid language plpgsql security definer set search_path = '' as $$
declare backup_id uuid;
begin
  if not public.is_catalog_admin() then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  insert into public.catalog_backups(created_by, label, scope, snapshot)
  values (auth.uid(), left(coalesce(nullif(trim(p_label), ''), 'Respaldo manual'), 200), 'catalog', public.catalog_snapshot())
  returning id into backup_id;
  return backup_id;
end;
$$;
revoke all on function public.create_catalog_backup(text) from public, anon;
grant execute on function public.create_catalog_backup(text) to authenticated;

create function public.backup_storefront_gallery()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.catalog_backups(created_by, label, scope, snapshot)
  values (auth.uid(), 'Antes de editar fotos de Nosotros', 'catalog', public.catalog_snapshot());
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.backup_storefront_gallery() from public, anon, authenticated;
create trigger storefront_gallery_backup before update or delete on public.storefront_gallery for each row execute function public.backup_storefront_gallery();

-- A complete product, its variants and its photo list commit together.
create function public.save_catalog_product(p_product jsonb, p_variants jsonb, p_images jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if not public.is_catalog_admin() then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('catalog_write'));
  if jsonb_typeof(p_product) is distinct from 'object' or jsonb_typeof(p_variants) is distinct from 'array'
     or jsonb_typeof(p_images) is distinct from 'array' or jsonb_array_length(p_images) > 6 then
    raise exception 'Formato de producto inválido';
  end if;
  if coalesce(trim(p_product->>'name'), '') = '' or coalesce(trim(p_product->>'sku'), '') = ''
     or coalesce(trim(p_product->>'slug'), '') = '' then raise exception 'Completá nombre, SKU y slug'; end if;
  if (p_product->>'published')::boolean and ((p_product->>'price')::numeric <= 0 or jsonb_array_length(p_images) = 0) then
    raise exception 'Para publicar se requiere precio y foto';
  end if;
  select id into target_id from public.products where id = (p_product->>'id')::uuid;
  if target_id is null then select id into target_id from public.products where sku = p_product->>'sku'; end if;
  target_id := coalesce(target_id, (p_product->>'id')::uuid, gen_random_uuid());
  insert into public.products(id, slug, name, sku, brand, category, price, transfer_price, stock, badge, specs, published, featured, offer_price)
  values (target_id, p_product->>'slug', p_product->>'name', p_product->>'sku', p_product->>'brand', p_product->>'category',
    (p_product->>'price')::numeric, (p_product->>'transfer_price')::numeric, (p_product->>'stock')::integer, p_product->>'badge', coalesce(p_product->'specs', '{}'::jsonb),
    (p_product->>'published')::boolean, (p_product->>'featured')::boolean, (p_product->>'offer_price')::numeric)
  on conflict (id) do update set slug = excluded.slug, name = excluded.name, sku = excluded.sku, brand = excluded.brand, category = excluded.category,
    price = excluded.price, transfer_price = excluded.transfer_price, stock = excluded.stock, badge = excluded.badge, specs = excluded.specs,
    published = excluded.published, featured = excluded.featured, offer_price = excluded.offer_price
  returning id into target_id;
  delete from public.product_variants where product_id = target_id;
  insert into public.product_variants(id, product_id, sku, options, price, transfer_price, stock)
  select coalesce((v->>'id')::uuid, gen_random_uuid()), target_id, v->>'sku', v->'options', (v->>'price')::numeric, (v->>'transfer_price')::numeric, (v->>'stock')::integer
  from jsonb_array_elements(p_variants) v;
  delete from public.product_images where product_id = target_id;
  insert into public.product_images(product_id, storage_path, external_url, alt_text, position)
  select target_id, i->>'storage_path', i->>'external_url', coalesce(i->>'alt_text', ''), ordinality - 1
  from jsonb_array_elements(p_images) with ordinality as photo(i, ordinality);
  return target_id;
end;
$$;
revoke all on function public.save_catalog_product(jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.save_catalog_product(jsonb,jsonb,jsonb) to authenticated;

create function public.restore_catalog_backup(p_snapshot jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare safety_id uuid;
begin
  if not public.is_catalog_admin() then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  if p_snapshot->>'version' is distinct from '1' or coalesce(p_snapshot->>'scope', '') not in ('catalog', 'product')
     or jsonb_typeof(p_snapshot->'products') is distinct from 'array'
     or jsonb_typeof(p_snapshot->'variants') is distinct from 'array'
     or jsonb_typeof(p_snapshot->'images') is distinct from 'array'
     or jsonb_typeof(p_snapshot->'gallery') is distinct from 'array' then
    raise exception 'Formato de respaldo inválido';
  end if;
  if exists (select 1 from jsonb_array_elements(p_snapshot->'variants') v where not exists (select 1 from jsonb_array_elements(p_snapshot->'products') p where p->>'id' = v->>'product_id'))
     or exists (select 1 from jsonb_array_elements(p_snapshot->'images') i where not exists (select 1 from jsonb_array_elements(p_snapshot->'products') p where p->>'id' = i->>'product_id')) then
    raise exception 'El respaldo contiene relaciones inválidas';
  end if;
  perform pg_advisory_xact_lock(hashtext('catalog_write'));
  safety_id := public.create_catalog_backup('Antes de restaurar un respaldo');
  -- Merge by ID. Products absent from the backup are preserved, not deleted.
  insert into public.products select * from jsonb_populate_recordset(null::public.products, p_snapshot->'products')
  on conflict (id) do update set slug = excluded.slug, name = excluded.name, sku = excluded.sku, brand = excluded.brand, category = excluded.category,
    description = excluded.description, price = excluded.price, list_price = excluded.list_price, transfer_price = excluded.transfer_price,
    stock = excluded.stock, badge = excluded.badge, specs = excluded.specs, published = excluded.published, featured = excluded.featured, offer_price = excluded.offer_price;
  delete from public.product_variants where product_id in (select (p->>'id')::uuid from jsonb_array_elements(p_snapshot->'products') p);
  delete from public.product_images where product_id in (select (p->>'id')::uuid from jsonb_array_elements(p_snapshot->'products') p);
  insert into public.product_variants select * from jsonb_populate_recordset(null::public.product_variants, p_snapshot->'variants');
  insert into public.product_images select * from jsonb_populate_recordset(null::public.product_images, p_snapshot->'images');
  if p_snapshot->>'scope' = 'catalog' then
    insert into public.storefront_gallery(id, images)
    values (true, coalesce(p_snapshot->'gallery'->0->'images', '[]'::jsonb))
    on conflict (id) do update set images = excluded.images;
  end if;
  return safety_id;
end;
$$;
revoke all on function public.restore_catalog_backup(jsonb) from public, anon;
grant execute on function public.restore_catalog_backup(jsonb) to authenticated;

insert into public.catalog_backups(label, scope, snapshot)
values ('Estado inicial al activar respaldos', 'catalog', public.catalog_snapshot());

commit;
