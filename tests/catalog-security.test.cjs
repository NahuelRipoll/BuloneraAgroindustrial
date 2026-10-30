const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

let db;
const productId = '11111111-1111-4111-8111-111111111111';
const variantId = '22222222-2222-4222-8222-222222222222';
const adminEmail = 'bulonera@bagroindustrial.com';
async function as(role, email = '') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ email, sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })]);
  await db.exec(`set role ${role}`);
}
const product = (patch = {}) => ({ id: productId, slug: 'bulon-test', name: 'Bulón original', sku: 'B-TEST', brand: 'Marca', category: 'Bulones', price: 100, transfer_price: 90, stock: 5, badge: null, specs: {}, published: true, featured: false, offer_price: null, ...patch });
const variants = [{ id: variantId, sku: 'B-M8', options: { Diámetro: 'M8' }, price: 100, transfer_price: 90, stock: 5 }];
const images = [{ storage_path: 'test/foto.jpg', external_url: null, alt_text: 'Foto original' }];
async function save(p = product(), v = variants, i = images) {
  return db.query('select public.save_catalog_product($1::jsonb, $2::jsonb, $3::jsonb) as id', [JSON.stringify(p), JSON.stringify(v), JSON.stringify(i)]);
}
async function scalar(sql, args = []) { return Object.values((await db.query(sql, args)).rows[0])[0]; }

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    grant all on storage.objects to anon, authenticated, service_role;
  `);
  for (const name of ['202609210001_catalog.sql', '202609210002_admin_auth.sql', '202609230001_featured_offers.sql', '202610270001_storefront_gallery.sql', '202610270002_catalog_protection.sql', '202610300001_manual_price_protection.sql']) {
    const sql = readFileSync(`supabase/migrations/${name}`, 'utf8').replace('create extension if not exists pgcrypto;', '');
    await db.exec(sql);
  }
});
after(async () => { if (db) await db.close(); });
beforeEach(async () => {
  await as('postgres');
  await db.exec('truncate public.products, public.product_variants, public.product_images, public.catalog_backups, public.storefront_gallery cascade');
  await as('authenticated', adminEmail);
  await save();
  await as('postgres');
  await db.exec('truncate public.catalog_backups');
});

test('visitantes y usuarios comunes no pueden guardar ni restaurar, ni elevarse a admin', async () => {
  await as('anon');
  await assert.rejects(save(), /permission denied/);
  await assert.rejects(db.query('select public.create_catalog_backup()'), /permission denied/);
  await as('authenticated', 'cliente@example.com');
  await assert.rejects(save(), /Acceso denegado/);
  await assert.rejects(db.query("select public.restore_catalog_backup('{}')"), /Acceso denegado/);
  await assert.rejects(db.query("insert into public.admin_members(email) values ('cliente@example.com')"), /permission denied/);
  await assert.rejects(db.query('truncate public.products cascade'), /permission denied/);
  assert.equal(await scalar('select count(*) from public.catalog_backups'), 0);
  await assert.rejects(db.query('select public.catalog_snapshot()'), /permission denied/);
});

test('la importación comprueba protección actual y permite seguir editando manualmente', async () => {
  const update = () => db.query('select public.import_catalog_product_prices($1, $2::jsonb)', [productId, JSON.stringify([{ sku: 'B-M8', before: 100, after: 250 }])]);
  await as('anon');
  await assert.rejects(update(), /permission denied/);
  await as('authenticated', 'cliente@example.com');
  await assert.rejects(update(), /Acceso denegado/);
  await as('authenticated', adminEmail);
  await save(product({ specs: { price_import_protected: true } }));
  await assert.rejects(update(), /protegido/);
  assert.equal(await scalar('select price from public.product_variants where id = $1', [variantId]), '100.00');
  await save(product({ price: 300, specs: { price_import_protected: true } }));
  assert.equal(await scalar('select price from public.products where id = $1', [productId]), '300.00');
  await save(product({ specs: { price_import_protected: false, Largo: '30' } }));
  await update();
  assert.equal(await scalar('select price from public.products where id = $1', [productId]), '250.00');
  assert.equal(await scalar('select stock from public.products where id = $1', [productId]), 5);
  assert.deepEqual(await scalar('select specs from public.products where id = $1', [productId]), { price_import_protected: false, Largo: '30' });
  assert.equal(await scalar('select count(*) from public.product_images'), 1);
});

test('el servidor protege excepciones iniciales y revierte importaciones obsoletas o parciales', async () => {
  await as('authenticated', adminEmail);
  const update = (changes) => db.query('select public.import_catalog_product_prices($1, $2::jsonb)', [productId, JSON.stringify(changes)]);
  for (const patch of [{ name: 'FOLIAR COBRA' }, { name: 'Foliares 10L' }, { sku: '2121032' }]) {
    await save(product(patch));
    await assert.rejects(update([{ sku: 'B-M8', before: 100, after: 250 }]), /protegido/);
  }
  await save();
  await assert.rejects(update([{ sku: 'B-M8', before: 99, after: 250 }]), /precio cambió/);
  await assert.rejects(update([{ sku: 'B-M8', before: 100, after: 250 }, { sku: 'INEXISTENTE', before: 100, after: 500 }]), /medida cambió/);
  assert.equal(await scalar('select price from public.product_variants where id = $1', [variantId]), '100.00');
  await save(product({ specs: { price_import_protected: false }, name: 'FOLIAR COBRA' }), []);
  await update([{ sku: 'B-TEST', before: 100, after: 200 }]);
  assert.equal(await scalar('select price from public.products where id = $1', [productId]), '200.00');
});

test('un admin puede guardar un producto completo; el público solo ve publicados', async () => {
  await as('authenticated', adminEmail);
  await save();
  assert.equal(await scalar('select count(*) from public.product_variants where product_id = $1', [productId]), 1);
  await as('anon');
  assert.equal(await scalar('select count(*) from public.products'), 1);
  await assert.rejects(db.query('select * from public.catalog_backups'), /permission denied/);
  await as('authenticated', adminEmail);
  await save(product({ published: false }));
  await as('anon');
  assert.equal(await scalar('select count(*) from public.products'), 0);
  assert.equal(await scalar('select count(*) from public.product_images'), 0);
  assert.equal(await scalar('select count(*) from public.product_variants'), 0);
});

test('las políticas restrictivas bloquean escrituras aunque exista una política permisiva accidental', async () => {
  await as('postgres');
  await db.exec(`create policy accidental_open_update on public.products for update to authenticated using (true) with check (true);
    create policy accidental_open_read on public.products for select to authenticated using (true);
    create policy accidental_storage_insert on storage.objects for insert to authenticated with check (true);`);
  await as('authenticated', 'cliente@example.com');
  assert.equal((await db.query("update public.products set price = 1 returning id")).rows.length, 0);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('product-images', 'intruso.jpg')"), /row-level security/);
  await as('authenticated', adminEmail);
  assert.equal(await scalar('select price from public.products where id = $1', [productId]), '100.00');
  await db.query("insert into storage.objects(bucket_id,name) values ('product-images', 'admin.jpg')");
  await as('postgres');
  await db.exec('drop policy accidental_open_update on public.products; drop policy accidental_open_read on public.products; drop policy accidental_storage_insert on storage.objects;');
});

test('un fallo al guardar revierte precio, variantes y fotos; pasar a producto simple limpia variantes', async () => {
  await as('authenticated', adminEmail);
  await assert.rejects(save(product({ price: 999 }), [{ ...variants[0], stock: -1 }]), /check constraint/);
  assert.equal(await scalar('select price from public.products where id = $1', [productId]), '100.00');
  assert.equal(await scalar('select count(*) from public.product_variants where product_id = $1', [productId]), 1);
  assert.equal(await scalar('select storage_path from public.product_images where product_id = $1', [productId]), 'test/foto.jpg');
  await save(product(), [], images);
  assert.equal(await scalar('select count(*) from public.product_variants where product_id = $1', [productId]), 0);
  await save();
});

test('el historial automático conserva el producto completo previo y permite recuperar una eliminación', async () => {
  await as('authenticated', adminEmail);
  await save(product({ name: 'Antes de eliminar' }));
  await db.query('delete from public.products where id = $1', [productId]);
  const snapshot = await scalar("select snapshot from public.catalog_backups where label like 'Antes de delete:%' order by created_at desc limit 1");
  assert.equal(snapshot.products[0].name, 'Antes de eliminar');
  assert.equal(snapshot.variants.length, 1);
  assert.equal(snapshot.images[0].storage_path, 'test/foto.jpg');
  await db.query('select public.restore_catalog_backup($1)', [JSON.stringify(snapshot)]);
  assert.equal(await scalar('select name from public.products where id = $1', [productId]), 'Antes de eliminar');
  assert.equal(await scalar('select count(*) from public.product_variants where product_id = $1', [productId]), 1);
});

test('respaldo completo restaura valores y galería, preserva productos nuevos y genera copia previa', async () => {
  await as('authenticated', adminEmail);
  await db.query("insert into public.storefront_gallery(id, images) values (true, '[{\"id\":\"one\",\"src\":\"/foto.jpg\",\"alt\":\"Local\"}]') on conflict(id) do update set images = excluded.images");
  const backupId = await scalar("select public.create_catalog_backup('Manual de prueba')");
  const snapshot = await scalar('select snapshot from public.catalog_backups where id = $1', [backupId]);
  await save(product({ price: 500 }));
  await save(product({ id: '33333333-3333-4333-8333-333333333333', sku: 'NUEVO', slug: 'nuevo', published: false }), [], []);
  await db.query("update public.storefront_gallery set images = '[]'");
  const safety = await scalar('select public.restore_catalog_backup($1)', [JSON.stringify(snapshot)]);
  assert.equal(await scalar('select price from public.products where id = $1', [productId]), '100.00');
  assert.equal(await scalar("select count(*) from public.products where sku = 'NUEVO'"), 1);
  assert.equal(await scalar("select images->0->>'alt' from public.storefront_gallery"), 'Local');
  const previous = await scalar('select snapshot from public.catalog_backups where id = $1', [safety]);
  assert.equal(previous.products.find(p => p.id === productId).price, 500);
});

test('un respaldo inválido no deja una restauración parcial ni un falso respaldo de seguridad', async () => {
  await as('authenticated', adminEmail);
  const backupId = await scalar('select public.create_catalog_backup()');
  const snapshot = await scalar('select snapshot from public.catalog_backups where id = $1', [backupId]);
  snapshot.products.find(p => p.id === productId).price = 777;
  snapshot.variants[0].stock = -1;
  const count = await scalar('select count(*) from public.catalog_backups');
  await assert.rejects(db.query('select public.restore_catalog_backup($1)', [JSON.stringify(snapshot)]), /check constraint/);
  assert.equal(await scalar('select price from public.products where id = $1', [productId]), '100.00');
  assert.equal(await scalar('select count(*) from public.catalog_backups'), count);
});

test('cambiar un SKU mantiene la identidad; importar el SKU existente no duplica el producto', async () => {
  await as('authenticated', adminEmail);
  await save(product({ sku: 'RENOMBRADO' }));
  assert.equal(await scalar("select id from public.products where sku = 'RENOMBRADO'"), productId);
  const result = await save(product({ id: '44444444-4444-4444-8444-444444444444', sku: 'RENOMBRADO' }));
  assert.equal(result.rows[0].id, productId);
  assert.equal(await scalar('select count(*) from public.products'), 1);
});

test('editar la galería conserva un respaldo completo previo sin dar acceso a usuarios comunes', async () => {
  await as('authenticated', adminEmail);
  await db.query('insert into public.storefront_gallery(id, images) values (true, $1::jsonb)', [JSON.stringify([{ id: 'old', src: '/vieja.jpg', alt: 'Anterior', position: { x: 20, y: 75 }, zoom: 2 }])]);
  await db.query("update public.storefront_gallery set images = '[]'");
  const snapshot = await scalar("select snapshot from public.catalog_backups where label = 'Antes de editar fotos de Nosotros' order by created_at desc limit 1");
  assert.equal(snapshot.gallery[0].images[0].alt, 'Anterior');
  assert.deepEqual(snapshot.gallery[0].images[0].position, { x: 20, y: 75 });
  assert.equal(snapshot.gallery[0].images[0].zoom, 2);
  await as('authenticated', 'cliente@example.com');
  assert.equal(await scalar('select count(*) from public.catalog_backups'), 0);
});

test('no guarda versiones incompletas de productos nuevos y protege ambos lados al mover una variante', async () => {
  await as('authenticated', adminEmail);
  const otherId = '55555555-5555-4555-8555-555555555555';
  await save(product({ id: otherId, sku: 'OTRO', slug: 'otro', published: false }), [], []);
  assert.equal(await scalar('select count(*) from public.catalog_backups where product_id = $1', [otherId]), 0);
  await db.query('update public.product_variants set product_id = $1 where id = $2', [otherId, variantId]);
  const previousSource = await scalar('select snapshot from public.catalog_backups where product_id = $1 order by created_at desc limit 1', [productId]);
  const previousTarget = await scalar('select snapshot from public.catalog_backups where product_id = $1 order by created_at desc limit 1', [otherId]);
  assert.equal(previousSource.variants.length, 1);
  assert.equal(previousTarget.variants.length, 0);
});
