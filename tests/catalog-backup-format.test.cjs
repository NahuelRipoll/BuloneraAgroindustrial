const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');

const source = stripTypeScriptTypes(readFileSync('src/lib/catalog-backup-format.ts', 'utf8'))
  .replace(/export /g, '') + '\nexports.api = { validateArchive, validateSnapshot, validAssetPath, collectAssetPaths };';
const context = { exports: {}, URL, Set };
vm.runInNewContext(source, context);
const { validateArchive, validateSnapshot, validAssetPath, collectAssetPaths } = context.exports.api;
const origin = 'https://catalog.supabase.co';
const id = '11111111-1111-4111-8111-111111111111';
const snapshot = () => ({ version: 1, scope: 'catalog', products: [{ id, name: 'Bulón', sku: 'B1' }], variants: [], images: [{ product_id: id, storage_path: 'products/photo.jpg', external_url: null }], gallery: [{ id: true, images: [{ id: 'one', src: `${origin}/storage/v1/object/public/product-images/storefront/local.jpg`, alt: 'Local' }] }] });
const archive = () => ({ format: 'bulonera-catalog-backup', version: 1, exportedAt: new Date().toISOString(), sourceUrl: origin, snapshot: snapshot(), assets: [{ path: 'products/photo.jpg', contentType: 'image/jpeg', base64: 'YWJj' }, { path: 'storefront/local.jpg', contentType: 'image/jpeg', base64: 'YWJj' }] });

test('el respaldo incluye fotos del producto y Nosotros sin descargar enlaces externos', () => {
  const value = snapshot();
  value.images.push({ product_id: id, external_url: 'https://otro-sitio.com/foto.jpg' });
  value.images.push({ product_id: id, external_url: `${origin}/storage/v1/object/public/product-images/products/photo.jpg` });
  assert.deepEqual(Array.from(collectAssetPaths(value, origin)), ['products/photo.jpg', 'storefront/local.jpg']);
  assert.doesNotThrow(() => validateArchive(archive(), origin));
});

test('rechaza otro proyecto, archivos incompletos, duplicados y contenido incompatible', () => {
  assert.throws(() => validateArchive(archive(), 'https://otro.supabase.co'), /otro proyecto/);
  const missing = archive(); missing.assets.pop();
  assert.throws(() => validateArchive(missing, origin), /faltan fotos/);
  const duplicate = archive(); duplicate.assets.push(duplicate.assets[0]);
  assert.throws(() => validateArchive(duplicate, origin), /repetida/);
  const invalid = archive(); invalid.assets[0].contentType = 'text/html';
  assert.throws(() => validateArchive(invalid, origin), /foto inválida/);
  const invalidBase64 = archive(); invalidBase64.assets[0].base64 = '<script>';
  assert.throws(() => validateArchive(invalidBase64, origin), /foto inválida/);
});

test('rechaza rutas de traversal, fotos ajenas y relaciones huérfanas antes de restaurar', () => {
  for (const path of ['../foto.jpg', '/foto.jpg', 'one/../two.jpg', 'one\\two.jpg', 'one/%2e%2e/two.jpg', 'foto.jpg?token=1']) assert.equal(validAssetPath(path), false);
  const wrongPath = archive(); wrongPath.assets[0].path = '../foto.jpg';
  assert.throws(() => validateArchive(wrongPath, origin), /foto inválida/);
  const orphan = snapshot(); orphan.images[0].product_id = 'otro';
  assert.throws(() => validateSnapshot(orphan), /sin producto/);
  const duplicate = snapshot(); duplicate.products.push(duplicate.products[0]);
  assert.throws(() => validateSnapshot(duplicate), /repetidos/);
});

test('un respaldo de producto no puede reemplazar la galería ni incluir más productos', () => {
  const value = snapshot(); value.scope = 'product';
  assert.throws(() => validateSnapshot(value), /alcance inválido/);
  value.gallery = [];
  assert.doesNotThrow(() => validateSnapshot(value));
});
