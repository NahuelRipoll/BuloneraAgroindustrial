const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const context = { exports: {} };
const source = stripTypeScriptTypes(readFileSync('src/lib/admin-photo-preview.ts', 'utf8')).replace(/^import .*;\s*$/gm, '').replace(/export /g, '');
vm.runInNewContext(source + '\nObject.assign(exports, { photoFilename, buildPhotoPreview });', context);
const { photoFilename, buildPhotoPreview } = context.exports;
const product = (patch = {}) => ({ id: 'one', remoteId: 'one', sku: '00123', name: 'Bulón', image: '', images: [], ...patch });
const row = (patch = {}) => ({ id: 'a', name: '00123-1.jpg', code: '00123', order: 1, selected: true, ...patch });

test('los nombres conservan ceros, guiones y el orden numérico', () => {
  const products = [product(), product({ id: 'group', remoteId: 'group', sku: 'GRP-ABC' })];
  assert.equal(photoFilename(products, '00123-2.JPG').code, '00123');
  assert.equal(photoFilename(products, '00123-2.JPG').order, 2);
  assert.equal(photoFilename(products, 'GRP-ABC-3.webp').code, 'GRP-ABC');
  assert.equal(photoFilename(products, '00123.png').order, 1);
  assert.equal(photoFilename(products, 'foto-sin-codigo.jpg').code, 'foto-sin-codigo');
});
test('un SKU completo tiene prioridad sobre un sufijo que parece orden', () => {
  const products = [product(), product({ id: 'two', remoteId: 'two', sku: '00123-1' })];
  assert.equal(photoFilename(products, '00123-1.jpg').code, '00123-1');
  assert.equal(photoFilename(products, '00123-1-2.jpg').code, '00123-1');
});
test('solo matchea artículos guardados, incluye medidas y rechaza códigos ambiguos', () => {
  const products = [product(), product({ id: 'local', remoteId: undefined, sku: 'LOCAL' }), product({ id: 'group', remoteId: 'group', sku: 'GRP', variants: [{ sku: '00045' }] })];
  const result = buildPhotoPreview(products, [row(), row({ id: 'b', code: '00045' }), row({ id: 'c', code: '123' }), row({ id: 'd', code: 'LOCAL' })]);
  assert.equal(result.groups.length, 2);
  assert.equal(result.rows[1].productId, 'group');
  assert.equal(result.rows[1].variant, true);
  assert.match(result.rows[2].error, /Sin coincidencia/);
  assert.match(result.rows[3].error, /Sin coincidencia/);
  assert.match(buildPhotoPreview([...products, product({ id: 'duplicate', remoteId: 'duplicate' })], [row()]).rows[0].error, /ambiguo/);
});
test('ordena las fotos y detecta posiciones repetidas incluso entre medidas del mismo producto', () => {
  const products = [product({ variants: [{ sku: 'M8' }, { sku: 'M10' }] })];
  const valid = buildPhotoPreview(products, [row({ code: 'M10', order: 2 }), row({ id: 'b', code: 'M8', order: 1 })]);
  assert.deepEqual(Array.from(valid.groups[0].rowIds), ['b', 'a']);
  const duplicate = buildPhotoPreview(products, [row({ code: 'M8' }), row({ id: 'b', code: 'M10' })]);
  assert.equal(duplicate.groups.length, 0);
  assert.match(duplicate.rows[0].error, /orden/);
  assert.match(duplicate.rows[1].error, /orden/);
});
test('respeta seis fotos totales, sin truncar ni contar archivos desmarcados', () => {
  const products = [product({ image: 'one.jpg', images: ['one.jpg', 'two.jpg', 'three.jpg', 'four.jpg', 'five.jpg'] })];
  const rows = [row(), row({ id: 'b', order: 2 })];
  assert.equal(buildPhotoPreview(products, rows).groups.length, 0);
  assert.match(buildPhotoPreview(products, rows).rows[0].error, /6 fotos/);
  const result = buildPhotoPreview(products, [rows[0], { ...rows[1], selected: false }]);
  assert.equal(result.groups[0].existingCount, 5);
  assert.equal(result.groups[0].total, 6);
});
test('bloquea órdenes inválidos y archivos rechazados; deja corregir o excluir filas', () => {
  const products = [product()];
  assert.match(buildPhotoPreview(products, [row({ order: 0 })]).rows[0].error, /orden/);
  assert.match(buildPhotoPreview(products, [row({ order: 1.5 })]).rows[0].error, /orden/);
  assert.equal(buildPhotoPreview(products, [row({ error: 'Archivo inválido' })]).groups.length, 0);
  assert.equal(buildPhotoPreview(products, [row({ code: 'AJENO', selected: false }), row({ id: 'b' })]).groups.length, 1);
  assert.equal(buildPhotoPreview(products, [row({ code: ' 00123 ' })]).rows[0].productId, 'one');
});
