const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const context = { exports: {} };
const source = stripTypeScriptTypes(readFileSync('src/lib/storefront-framing.ts', 'utf8')).replace(/export /g, '');
vm.runInNewContext(source + '\nObject.assign(exports, { imageFraming, framingStyle, dragFraming });', context);
const { imageFraming, framingStyle, dragFraming } = context.exports;
test('las fotos anteriores conservan centro horizontal, borde superior y tamaño original', () => {
  const frame = imageFraming({});
  assert.equal(frame.position.x, 50); assert.equal(frame.position.y, 0); assert.equal(frame.zoom, 1);
  assert.equal(framingStyle({}).objectPosition, '50% 0%');
});
test('normaliza valores fuera de rango o inválidos sin propagar NaN', () => {
  const frame = imageFraming({ position: { x: -50, y: 150 }, zoom: 5 });
  assert.equal(frame.position.x, 0); assert.equal(frame.position.y, 100); assert.equal(frame.zoom, 3);
  assert.equal(imageFraming({ position: { x: NaN, y: Infinity }, zoom: -2 }).position.x, 50);
  assert.equal(imageFraming({ zoom: -2 }).zoom, 1);
  assert.equal(imageFraming({ position: null, zoom: '2' }).zoom, 1);
});
test('arrastrar desplaza la foto por el excedente real del recorte y limita sus bordes', () => {
  const size = { width: 200, height: 200, naturalWidth: 400, naturalHeight: 200 };
  const start = imageFraming({ position: { x: 50, y: 0 } });
  assert.equal(dragFraming(start, 50, 40, size).position.x, 25);
  assert.equal(dragFraming(start, 50, 40, size).position.y, 0);
  assert.equal(dragFraming(start, -999, 0, size).position.x, 100);
  assert.equal(dragFraming(start, 999, 0, size).position.x, 0);
});
test('el zoom permite arrastrar ambos ejes y comparte origen con object-position', () => {
  const start = imageFraming({ position: { x: 50, y: 50 }, zoom: 2 });
  const moved = dragFraming(start, 25, -25, { width: 100, height: 100, naturalWidth: 100, naturalHeight: 100 });
  assert.equal(moved.position.x, 25); assert.equal(moved.position.y, 75);
  assert.equal(framingStyle(moved).transform, 'scale(2)');
  assert.equal(framingStyle(moved).transformOrigin, '25% 75%');
  assert.equal(dragFraming(start, 10, 10, { width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 }).position.x, 50);
});
