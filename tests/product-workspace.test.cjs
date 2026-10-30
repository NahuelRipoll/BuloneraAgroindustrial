const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const { randomUUID } = require('node:crypto');
const vm = require('node:vm');
function load(file, exports, extra = {}) {
  const context = { exports: {}, crypto: { randomUUID }, ...extra };
  const source = stripTypeScriptTypes(readFileSync(`src/lib/${file}.ts`, 'utf8')).replace(/^import .*;\s*$/gm, '').replace(/export /g, '');
  vm.runInNewContext(source + `\nObject.assign(exports, { ${exports.join(',')} });`, context);
  return context.exports;
}
const prices = load('admin-price-preview', ['buildPricePreview', 'percentageInputs', 'applyPriceChanges', 'isPriceImportProtected']);
const entry = load('quick-product-entry', ['blankEntry', 'parseEntryPaste', 'prepareEntryRows', 'entryNumber']);
const pdf = load('pdf-price-table', ['parsePdfPricePage', 'parsePdfInventoryPage']);
const imports = load('admin-product-tools', ['groupTemplateVariants', 'parsePriceValue', 'extractPriceRecordsFromRows']);
const product = (patch = {}) => ({ id: 'one', sku: '00123', name: 'Bulón', brand: 'Marca', category: 'Bulones', price: 100, transferPrice: 90, stock: 10, variants: undefined, ...patch });

test('precios protegidos excluyen productos y medidas, conservando los demás cambios', () => {
  const protectedProduct = product({ priceImportProtected: true, variants: [{ sku: 'M8', price: 100 }] });
  const result = prices.buildPricePreview([protectedProduct, product({ id: 'two', sku: 'OTHER' })], [{ sku: 'M8', price: 250 }, { sku: 'OTHER', price: 300 }]);
  assert.deepEqual(Array.from(result.protectedCodes), ['M8']);
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].sku, 'OTHER');
  assert.equal(result.unmatched.length, 0);
});

test('la sierra y todos los foliares quedan protegidos hasta desactivar explícitamente', () => {
  assert.equal(prices.isPriceImportProtected(product({ sku: '2121032' })), true);
  for (const name of ['3412 FOLIAR MADURADOR', 'Foliares 10 litros']) {
    assert.equal(prices.isPriceImportProtected(product({ name })), true);
    assert.equal(prices.isPriceImportProtected(product({ name, priceImportProtected: false })), false);
  }
  assert.equal(prices.isPriceImportProtected(product()), false);
});

test('la protección administrativa no aparece en la ficha técnica pública', () => {
  const storefront = load('supabase-products', ['mapProductRows']);
  const rows = [{ id: 'one', sku: '00123', name: 'Bulón', price: 100, transfer_price: 90, specs: { price_import_protected: true, Largo: '30' }, product_images: [], product_variants: [] }];
  const result = storefront.mapProductRows(rows, {});
  assert.deepEqual(Object.keys(result[0].specs), ['Largo']);
  assert.equal(result[0].specs.Largo, '30');
});

test('una revisión anterior no puede modificar protegidos pero la edición manual sí', () => {
  const original = product();
  const preview = prices.buildPricePreview([original], [{ sku: original.sku, price: 250 }]);
  const protectedProduct = { ...original, priceImportProtected: true };
  assert.throws(() => prices.applyPriceChanges([protectedProduct], preview.changes), /protegido/);
  const manual = prices.applyPriceChanges([protectedProduct], preview.changes, true)[0];
  assert.equal(manual.price, 250);
  assert.equal(manual.priceImportProtected, true);
});

test('los códigos mantienen sus ceros y no se confunden con códigos parecidos', () => {
  const result = prices.buildPricePreview([product()], [{ sku: '123', price: 500 }, { sku: '00123', price: 200 }]);
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].after, 200);
  assert.deepEqual(Array.from(result.unmatched), ['123']);
});
test('precios repetidos diferentes y códigos ambiguos nunca se aplican automáticamente', () => {
  assert.equal(prices.buildPricePreview([product()], [{ sku: '00123', price: 200 }, { sku: '00123', price: 300 }]).conflicts.length, 1);
  assert.equal(prices.buildPricePreview([product(), product({ id: 'two' })], [{ sku: '00123', price: 200 }]).changes.length, 0);
});
test('los códigos ajenos se omiten antes de revisar conflictos o precios inválidos', () => {
  const result = prices.buildPricePreview([product()], [
    { sku: 'AJENO', price: 200 }, { sku: 'AJENO', price: 300 },
    { sku: 'OTRO', price: 0 }, { sku: '00123', price: 200 },
  ]);
  assert.deepEqual(Array.from(result.unmatched), ['AJENO', 'OTRO']);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.invalid, 0);
  assert.equal(result.changes.length, 1);
});
test('solo las coincidencias de productos y medidas se aplican sin crear artículos', () => {
  const products = [product(), product({ id: 'variants', sku: 'GRP', variants: [{ sku: '00045', price: 100, stock: 0 }] }), product({ id: 'unchanged', sku: '00067' })];
  const result = prices.buildPricePreview(products, [{ sku: '00123', price: 200 }, { sku: '00045', price: 300 }, { sku: '00067', price: 100 }, { sku: 'GRP', price: 500 }, { sku: '45', price: 600 }]);
  assert.equal(result.changes.length, 2);
  assert.equal(result.unchanged, 1);
  const updated = prices.applyPriceChanges(products, result.changes);
  assert.equal(updated.length, 3);
  assert.equal(updated[0].price, 200);
  assert.equal(updated[1].variants[0].price, 300);
  assert.equal(updated[1].variants[0].stock, 0);
  assert.equal(updated[2], products[2]);
});
test('Código tiene prioridad sobre la descripción Artículo al leer precios', () => {
  const rows = [['Artículo', 'Código', 'Lista 1', 'Lista 2', 'Lista 3'], ['Bulón', '00123', 200, 180, 160]];
  for (const list of [1, 2, 3]) {
    const result = imports.extractPriceRecordsFromRows(rows, list);
    assert.equal(result[0].sku, '00123');
    assert.equal(result[0].price, [200, 180, 160][list - 1]);
  }
});
test('el ajuste porcentual alcanza medidas y recalcula la base sin alterar otros rubros', () => {
  const products = [product({ variants: [{ sku: 'M8', diameter: 'M8', price: 100, stock: 3 }, { sku: 'M10', diameter: 'M10', price: 200, stock: 7 }] }), product({ id: 'two', sku: 'OTHER', category: 'Herramientas' })];
  const preview = prices.buildPricePreview(products, prices.percentageInputs(products, 10, '', 'Bulones'));
  const result = prices.applyPriceChanges(products, preview.changes);
  assert.equal(result[0].price, 110); assert.equal(result[0].variants[1].price, 220);
  assert.equal(result[0].variants[0].transferPrice, 99); assert.equal(result[1].price, 100);
  assert.equal(result[0].dirty, true);
});
test('no pisa cambios posteriores y permite reintentar los precios ya preparados', () => {
  const preview = prices.buildPricePreview([product()], [{ sku: '00123', price: 200 }]);
  assert.throws(() => prices.applyPriceChanges([product({ price: 150 })], preview.changes), /catálogo cambió/);
  assert.equal(prices.applyPriceChanges([product({ price: 200 })], preview.changes)[0].price, 200);
  assert.throws(() => prices.percentageInputs([product()], -100, '', ''), /porcentaje/);
});
test('la grilla acepta valores argentinos y agrupa medidas sin duplicar códigos', () => {
  const rows = entry.parseEntryPaste('Código\tArtículo\tMarca\tRubro\tPrecio\tStock\tDiámetro\tLargo\n00123\tBulón\tMarca\tBulones\t1.500,50\t5\tM8\t30\n00124\tBulón\tMarca\tBulones\t2.000,00\t6\tM10\t40');
  const result = entry.prepareEntryRows(rows, [], true);
  assert.equal(Object.keys(result.errors).length, 0); assert.equal(result.products.length, 1);
  assert.equal(result.products[0].variants[0].sku, '00123'); assert.equal(result.products[0].stock, 11);
  assert.equal(result.products[0].price, 1500.5); assert.equal(result.products[0].published, false);
  assert.equal(entry.entryNumber('1.500'), 1500);
});
test('la grilla rechaza duplicados, precios inválidos y stock fraccionario', () => {
  const rows = entry.parseEntryPaste('00123\tUno\t\t\t150abc\t1,5\n00123\tDos');
  const result = entry.prepareEntryRows(rows, [product({ sku: 'GROUP', variants: [{ sku: '00123', price: 100 }] })], false);
  assert.equal(Object.keys(result.errors).length, 2); assert.equal(result.products.length, 0);
  assert.ok(result.errors[rows[0].id].some(item => item.includes('ya existe')));
});

const item = (str, x, y, width) => ({ str, transform: [1, 0, 0, 1, x, y], width });
const pdfItems = () => [item('Código', 24, 311, 34), item('Lista 1', 354.7, 311, 31.57), item('Lista 2', 402, 311, 31.56), item('Lista 3', 449.27, 311, 31.57), item('Oferta', 500.3, 311, 29.41), item('00123', 22.56, 293, 38), item('Descripción con 999,99 que no es un precio', 104, 293, 410), item('66.085,80 61.680,08 52.868,64', 341.28, 293, 139.46), item('0,00', 510.12, 293, 19.32), item('36.410,9091', 558.36, 293.36, 55.2)];
test('el PDF separa las tres listas sin usar los números de descripción, oferta o costo', () => {
  const expected = [66085.8, 61680.08, 52868.64];
  for (const list of [1, 2, 3]) {
    const result = pdf.parsePdfPricePage(pdfItems(), list, 1);
    assert.equal(result.rows.length, 1); assert.equal(result.rows[0].sku, '00123'); assert.equal(result.rows[0].price, expected[list - 1]);
  }
});
test('el PDF excluye celdas ambiguas y páginas sin encabezado', () => {
  const items = pdfItems(); items.push(item('70.000,00', 341.28, 293, 44.99));
  assert.equal(pdf.parsePdfPricePage(items, 1, 1).rows.length, 0);
  assert.equal(pdf.parsePdfPricePage([], 1, 1).detected, false);
});
test('la carga administrativa recorre páginas más allá del límite de Supabase', async () => {
  const ranges = [];
  const rows = Array.from({ length: 1001 }, (_, index) => ({ id: `id-${index}`, slug: `p-${index}`, sku: `sku-${index}`, name: `Producto ${index}`, price: 100, transfer_price: 90, stock: 1, specs: {}, product_images: [], product_variants: [] }));
  const fake = { from: () => ({ select: () => ({ order: () => ({ range: async (start, end) => { ranges.push([start, end]); return { data: rows.slice(start, end + 1), error: null }; } }) }) }) };
  rows[0].name = 'FOLIAR MADURADOR';
  rows[1].specs = { price_import_protected: true, Detalle: 'Conservar' };
  const catalog = load('admin-catalog', ['loadAdminCatalog', 'mergeAdminDrafts'], { createSupabaseBrowserClient: () => fake, isPriceImportProtected: prices.isPriceImportProtected });
  const loaded = await catalog.loadAdminCatalog();
  assert.equal(loaded.length, 1001);
  assert.equal(loaded.find(p => p.id === 'id-0').priceImportProtected, true);
  assert.equal(loaded.find(p => p.id === 'id-1').priceImportProtected, true);
  assert.equal(loaded.find(p => p.id === 'id-1').catalogSpecs.Detalle, 'Conservar');
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);
  const result = catalog.mergeAdminDrafts([{ ...product(), remoteId: 'one' }], [{ ...product({ price: 200, dirty: true }), remoteId: 'one' }]);
  assert.equal(result[0].price, 200);
});

test('la plantilla Excel reúne medidas del mismo artículo y bloquea códigos de medida repetidos', () => {
  const row = (sku, diameter) => ({ rowNumber: 4, errors: [], warnings: [], product: { ...product({ sku }), slug: 'bulon-hexagonal', diameter, length: '30', image: '/foto.jpg', published: true } });
  const result = imports.groupTemplateVariants([row('SKU-M8', 'M8'), row('SKU-M10', 'M10')]);
  assert.equal(result.length, 1); assert.equal(result[0].product.variants.length, 2);
  assert.equal(result[0].product.stock, 20); assert.match(result[0].product.sku, /^GRP-/);
  assert.ok(imports.groupTemplateVariants([row('REPETIDO', 'M8'), row('REPETIDO', 'M10')])[0].errors.length > 0);
  assert.equal(imports.parsePriceValue('1.500,50'), 1500.5); assert.equal(imports.parsePriceValue('1500abc'), 0);
});

test('la conversión conserva códigos, precios cero y stock negativo o fraccionario', () => {
  const items = pdfItems().filter((item) => !item.str.includes('66.085'));
  items.push(item('0,00 0,00 0,00', 341.28, 293, 139.46), item('Mg.3 (%) Stock Actual', 718, 311, 107), item('-2,500', 797, 293.7, 27));
  const result = pdf.parsePdfInventoryPage(items, 1);
  assert.equal(result.rows[0].sku, '00123');
  assert.deepEqual(Array.from(result.rows[0].prices), [0, 0, 0]);
  assert.equal(result.rows[0].stock, -2.5); assert.equal(result.rows[0].issues.length, 0);
  items.push(item('4,000', 797, 293.7, 27));
  assert.equal(pdf.parsePdfInventoryPage(items, 1).rows[0].stock, null);
});

test('Excel y CSV permiten elegir cualquiera de las tres listas sin importar stock', () => {
  const rows = [['Código', 'Lista 1', 'Lista 2', 'Lista 3', 'Stock actual'], ['00123', 100, 90, 80, -5], ['00045', 0, 50, 40, 2]];
  assert.equal(imports.extractPriceRecordsFromRows(rows, 1).length, 1);
  assert.equal(imports.extractPriceRecordsFromRows(rows, 2)[0].price, 90);
  assert.equal(imports.extractPriceRecordsFromRows(rows, 3)[0].price, 80);
  assert.equal(imports.extractPriceRecordsFromRows(rows, 3)[0].sku, '00123');
  assert.equal(imports.extractPriceRecordsFromRows([['Código', 'Precio'], ['00123', 123]], 3)[0].price, 123);
  assert.throws(() => imports.extractPriceRecordsFromRows([['Código', 'Lista 1'], ['00123', 123]], 3), /No se encontró/);
});

test('el Excel generado mantiene los tipos y puede leerse de vuelta sin perder ceros', async () => {
  const { workbookBytes, consolidateInventory, priceCsv } = await import('../tools/lib/price-workbook.mjs');
  const { default: readXlsx } = await import('read-excel-file/node');
  const headers = ['Código', 'Lista 1', 'Lista 2', 'Lista 3', 'Stock actual'];
  const bytes = workbookBytes([{ name: 'Precios', headers, stockColumn: 4, rows: [['00123', 100.5, 90, 0, -2.5]] }]);
  const sheets = await readXlsx(Buffer.from(bytes));
  const data = Array.isArray(sheets[0]) ? sheets : sheets[0].data;
  assert.equal(data[1][0], '00123'); assert.equal(data[1][1], 100.5); assert.equal(data[1][4], -2.5);
  const conflict = consolidateInventory([{ sku: '00123', prices: [100, 90, 80], stock: 1, page: 1, issues: [] }, { sku: '00123', prices: [200, 90, 80], stock: 1, page: 2, issues: [] }]);
  assert.equal(conflict.rows[0][1], null); assert.equal(conflict.rows[0][2], 90); assert.equal(conflict.review.length, 1);
  assert.ok(priceCsv(headers, [['00123', 100.5, 90, 0, -2.5]]).includes('"00123";"100,5";"90";"0";"-2,5"'));
});

test('el script no sobrescribe una planilla existente sin autorización explícita', () => {
  const { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const { spawnSync } = require('node:child_process');
  const directory = mkdtempSync(join(tmpdir(), 'bulonera-conversion-'));
  const output = join(directory, 'existente.xlsx');
  try {
    writeFileSync(output, 'original');
    const result = spawnSync(process.execPath, ['tools/pdf-a-excel.mjs', join(directory, 'entrada.pdf'), output], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1); assert.match(result.stderr, /Ya existe/);
    assert.equal(readFileSync(output, 'utf8'), 'original');
  } finally { unlinkSync(output); rmdirSync(directory); }
});
