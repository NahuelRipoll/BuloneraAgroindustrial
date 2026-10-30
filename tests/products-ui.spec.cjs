const { test, expect } = require('@playwright/test');
const { readFileSync, existsSync } = require('node:fs');

const local = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || local.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\r\n"']+)/m)?.[1];
if (!supabaseUrl) throw new Error('Se requiere NEXT_PUBLIC_SUPABASE_URL para interceptar Supabase sin usar datos reales.');
const host = new URL(supabaseUrl).host;
const member = 'bulonera@bagroindustrial.com';
const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const fixture = () => [
  { id: firstId, slug: 'regulador', name: 'Regulador de oxígeno', sku: '2120289', brand: 'Ferrolan', category: 'Herramientas', price: 100, transfer_price: 90, stock: 5, badge: null, published: false, featured: false, specs: {}, product_images: [], product_variants: [] },
  { id: secondId, slug: 'bulones', name: 'Bulón hexagonal', sku: 'GRP-BULON', brand: 'Marca', category: 'Bulones', price: 200, transfer_price: 180, stock: 10, badge: null, published: false, featured: false, specs: {}, product_images: [], product_variants: [{ id: '33333333-3333-4333-8333-333333333333', sku: '2121126', price: 200, transfer_price: 180, stock: 10, options: { Diámetro: 'M8', Largo: '30' } }] },
];

async function setup(page, { failSku, existingPhoto = false, failGallerySave = false } = {}) {
  const writes = [];
  const galleryWrites = [];
  let gallery = [{ id: 'local', src: '/imagenes/portada-local.jpeg', alt: 'Frente del local' }];
  const uploads = [];
  const errors = [];
  const products = fixture();
  if (existingPhoto) products[0].product_images = [{ external_url: '/imagenes/logo-icon.png', storage_path: null, position: 0 }];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ host, email }) => {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const access = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email, role: 'authenticated', exp: now + 3600 })}.mock`;
    localStorage.setItem(`sb-${host.split('.')[0]}-auth-token`, JSON.stringify({ access_token: access, refresh_token: 'mock-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', aud: 'authenticated', email, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: new Date().toISOString() } }));
  }, { host, email: member });
  await page.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.host !== host) return route.continue();
    if (url.pathname.endsWith('/admin_members')) return route.fulfill({ json: [{ email: member }] });
    if (url.pathname.endsWith('/storefront_gallery')) {
      if (request.method() === 'GET') return route.fulfill({ json: { id: true, images: gallery } });
      const body = request.postDataJSON(); galleryWrites.push(body);
      if (failGallerySave) { failGallerySave = false; return route.fulfill({ status: 500, json: { message: 'Publicación fallida simulada' } }); }
      gallery = body.images;
      return route.fulfill({ json: null });
    }
    if (url.pathname.endsWith('/products') && request.method() === 'GET') return route.fulfill({ json: products });
    if (url.pathname.startsWith('/storage/v1/object/product-images/') && request.method() === 'POST') {
      uploads.push(url.pathname);
      return route.fulfill({ json: { Key: url.pathname.split('/object/')[1] } });
    }
    if (url.pathname.startsWith('/storage/v1/object/public/product-images/') && request.method() === 'GET') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XkAAAAASUVORK5CYII=', 'base64') });
    if (url.pathname.endsWith('/rpc/import_catalog_product_prices')) {
      const body = request.postDataJSON(); writes.push(body);
      const product = products.find(item => item.id === body.p_product_id);
      if (product.sku === failSku) { failSku = null; return route.fulfill({ status: 500, json: { message: 'Fallo de guardado simulado' } }); }
      if (product.specs.price_import_protected) return route.fulfill({ status: 400, json: { message: 'Precio protegido' } });
      for (const change of body.p_changes) {
        const target = product.product_variants.length ? product.product_variants.find(v => v.sku === change.sku) : product;
        target.price = change.after; target.transfer_price = Math.round(change.after * 90) / 100;
      }
      if (product.product_variants.length) product.price = Math.min(...product.product_variants.map(v => v.price));
      return route.fulfill({ json: product.id });
    }
    if (url.pathname.endsWith('/rpc/save_catalog_product')) {
      const body = request.postDataJSON(); writes.push(body);
      if (body.p_product.sku === failSku) { failSku = null; return route.fulfill({ status: 500, json: { code: 'P0001', message: 'Fallo de guardado simulado' } }); }
      const data = { ...body.p_product, product_variants: body.p_variants, product_images: body.p_images };
      const index = products.findIndex((item) => item.id === data.id);
      if (index < 0) products.push(data); else products[index] = data;
      return route.fulfill({ json: data.id });
    }
    return route.fulfill({ status: 403, json: { message: 'Operación bloqueada por la prueba local' } });
  });
  return { writes, errors, uploads, galleryWrites };
}

test('módulos independientes y carga de varios artículos sin formularios individuales', async ({ page }) => {
  const { writes, errors } = await setup(page);
  await page.goto('/admin/productos');
  await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();
  await expect(page.locator('.product-module-card')).toHaveCount(6);
  await page.locator('a.product-module-card[href="/admin/productos/carga"]').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Carga rápida' })).toBeVisible();
  await page.getByLabel('Código / SKU fila 1', { exact: true }).fill('NUEVO-001');
  await page.getByLabel('Artículo fila 1', { exact: true }).fill('Artículo nuevo uno');
  await page.getByLabel('Precio fila 1', { exact: true }).fill('1.500,50');
  await page.getByLabel('Stock fila 1', { exact: true }).fill('5');
  await page.getByLabel('Código / SKU fila 2', { exact: true }).fill('NUEVO-002');
  await page.getByLabel('Artículo fila 2', { exact: true }).fill('Artículo nuevo dos');
  await expect(page.getByRole('button', { name: 'Guardar 2 artículos como borradores' })).toBeEnabled();
  await page.getByRole('button', { name: 'Guardar 2 artículos como borradores' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0].p_product.published).toBe(false); expect(writes[0].p_product.price).toBe(1500.5);
  await page.getByRole('link', { name: 'Catálogo', exact: true }).click();
  await page.getByPlaceholder('Nombre, SKU o medida').fill('NUEVO-001');
  await expect(page.getByRole('textbox', { name: 'Título de NUEVO-001' })).toHaveValue('Artículo nuevo uno');
  await page.screenshot({ path: '.next/ui-results/catalogo.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('edición pendiente y ajustes de medidas sobreviven a la navegación entre módulos', async ({ page }) => {
  const { writes, errors } = await setup(page);
  await page.goto('/admin/productos/catalogo');
  await page.getByRole('textbox', { name: 'Título de 2120289' }).fill('Nombre pendiente');
  await page.getByRole('link', { name: 'Precios', exact: true }).click();
  await page.getByRole('button', { name: 'Porcentaje', exact: true }).click();
  await page.getByLabel('Ajuste porcentual').fill('10');
  await page.getByRole('button', { name: 'Revisar ajuste' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Nuevo precio de 2121126' })).toHaveValue('220');
  expect(writes.length).toBe(0);
  await page.getByRole('link', { name: 'Catálogo', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Título de 2120289' })).toHaveValue('Nombre pendiente');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Título de 2120289' })).toHaveValue('Nombre pendiente');
  expect(errors).toEqual([]);
});

test('la protección persiste y excluye precios sin impedir su edición manual', async ({ page }) => {
  const { writes, errors } = await setup(page);
  await page.goto('/admin/productos/catalogo');
  const protection = page.getByRole('checkbox', { name: 'Excluir de importaciones de precios 2120289', exact: true });
  await protection.check();
  await page.getByRole('button', { name: 'Guardar 2120289', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].p_product.specs.price_import_protected).toBe(true);
  await page.reload();
  await expect(protection).toBeChecked();
  await page.screenshot({ path: '.next/ui-results/catalogo-precio-manual.png', fullPage: true });
  await page.getByRole('link', { name: 'Precios', exact: true }).click();
  await page.getByRole('button', { name: 'Pegar precios', exact: true }).click();
  await page.getByRole('textbox', { name: 'Listado de códigos y precios' }).fill('2120289\t250\n2121126\t350');
  await page.getByRole('button', { name: 'Revisar coincidencias' }).click();
  await expect(page.locator('.price-review-table tbody tr')).toHaveCount(1);
  await expect(page.getByText('1 códigos protegidos omitidos', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar precios seleccionados' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].p_product_id).toBe(secondId);
  await page.getByRole('button', { name: 'Grilla manual', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir grilla de precios' }).click();
  await page.getByRole('spinbutton', { name: 'Nuevo precio de 2120289', exact: true }).fill('275');
  await page.getByRole('button', { name: 'Guardar precios seleccionados' }).click();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2].p_product.price).toBe(275);
  expect(writes[2].p_product.specs.price_import_protected).toBe(true);
  expect(errors).toEqual([]);
});

test('precios: solo revisa y guarda coincidencias del catálogo', async ({ page }) => {
  const { writes, errors } = await setup(page);
  await page.goto('/admin/productos/precios');
  await page.getByRole('button', { name: 'Excel / CSV', exact: true }).click();
  await page.locator('input[type="file"][accept=".xlsx,.csv"]').setInputFiles({
    name: 'precios.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Artículo;Código;Lista 1;Lista 2;Lista 3\nRegulador;2120289;250;240;230\nMedida;2121126;350;340;330\nAjeno;AJENO;500;490;480\nAjeno;AJENO;600;590;580'),
  });
  await expect(page.locator('.price-review-table tbody tr')).toHaveCount(2);
  await expect(page.getByText(/1 códigos ajenos al catálogo omitidos/)).toBeVisible();
  await expect(page.getByText('AJENO', { exact: true })).toHaveCount(0);
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Guardar precios seleccionados' }).click();
  await expect(page.getByText('2 artículos guardados.', { exact: true }).first()).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes.map(item => item.p_product_id).sort()).toEqual([firstId, secondId].sort());
  expect(writes.find(item => item.p_product_id === firstId).p_changes[0].after).toBe(250);
  expect(writes.find(item => item.p_product_id === secondId).p_changes[0].after).toBe(350);
  await page.locator('input[type="file"][accept=".xlsx,.csv"]').setInputFiles({
    name: 'sin-coincidencias.csv', mimeType: 'text/csv', buffer: Buffer.from('Código;Precio\nAJENO;500'),
  });
  await expect(page.locator('.price-review-table tbody tr')).toHaveCount(0);
  await expect(page.getByText('No hay cambios de precio para aplicar a los artículos del catálogo con este listado.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar precios seleccionados' })).toBeDisabled();
  expect(writes).toHaveLength(2);
  expect(errors).toEqual([]);
});

async function photoFile(page, name, color) {
  const data = await page.evaluate((color) => {
    const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
    const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, 8, 8);
    return canvas.toDataURL('image/png').split(',')[1];
  }, color);
  return { name, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}

test('Nosotros: arrastra el encuadre, publica y conserva posición y zoom al recargar', async ({ page }) => {
  const { galleryWrites, errors } = await setup(page);
  await page.goto('/admin/nosotros');
  const frame = page.getByRole('group', { name: 'Encuadre de foto 1', exact: true });
  await expect(frame.getByRole('img')).toHaveCSS('object-position', '50% 0%');
  await expect.poll(() => frame.getByRole('img').evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('slider', { name: 'Zoom de foto 1', exact: true }).press('End');
  await frame.scrollIntoViewIfNeeded();
  const rect = await frame.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 40, rect.y + rect.height / 2 - 40, { steps: 5 });
  await page.mouse.up();
  const horizontal = page.getByRole('slider', { name: 'Posición horizontal de foto 1', exact: true });
  const vertical = page.getByRole('slider', { name: 'Posición vertical de foto 1', exact: true });
  expect(Number(await horizontal.inputValue())).toBeLessThan(50);
  expect(Number(await vertical.inputValue())).toBeGreaterThan(0);
  await frame.press('ArrowUp');
  const expected = await frame.getByRole('img').evaluate((image) => ({ position: image.style.objectPosition, transform: image.style.transform, origin: image.style.transformOrigin }));
  expect(galleryWrites).toHaveLength(0);
  await page.screenshot({ path: '.next/ui-results/nosotros-encuadre.png', fullPage: true });
  await page.getByRole('button', { name: 'Guardar y publicar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Fotos publicadas.');
  expect(galleryWrites).toHaveLength(1);
  expect(galleryWrites[0].images[0].zoom).toBe(3);
  expect(galleryWrites[0].images[0].position.x).toBeLessThan(50);
  await page.reload();
  await expect(page.getByRole('slider', { name: 'Zoom de foto 1', exact: true })).toHaveValue('300');
  await expect.poll(() => frame.getByRole('img').evaluate((image) => image.style.objectPosition)).toBe(expected.position);
  await page.goto('/#nosotros');
  const publicPhoto = page.locator('.storefront-photo');
  await expect.poll(() => publicPhoto.evaluate((image) => image.style.objectPosition)).toBe(expected.position);
  await expect.poll(() => publicPhoto.evaluate((image) => image.style.transform)).toBe(expected.transform);
  await expect.poll(() => publicPhoto.evaluate((image) => image.style.transformOrigin)).toBe(expected.origin);
  expect(errors).toEqual([]);
});

test('Nosotros: arrastre táctil, controles y restablecer; conserva cambios si falla publicar', async ({ page }) => {
  const { galleryWrites, errors } = await setup(page, { failGallerySave: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/nosotros');
  const frame = page.getByRole('group', { name: 'Encuadre de foto 1', exact: true });
  await expect.poll(() => frame.getByRole('img').evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Celular', exact: true }).click();
  await page.getByRole('slider', { name: 'Zoom de foto 1', exact: true }).press('End');
  await frame.scrollIntoViewIfNeeded();
  const rect = await frame.boundingBox();
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 30, y: y - 30, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  expect(Number(await page.getByRole('slider', { name: 'Posición horizontal de foto 1', exact: true }).inputValue())).toBeGreaterThan(50);
  await page.getByRole('slider', { name: 'Posición vertical de foto 1', exact: true }).press('End');
  await page.screenshot({ path: '.next/ui-results/nosotros-encuadre-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Guardar y publicar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('No se pudieron publicar');
  await expect(page.getByRole('slider', { name: 'Posición vertical de foto 1', exact: true })).toHaveValue('100');
  await page.getByRole('button', { name: 'Guardar y publicar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Fotos publicadas.');
  expect(galleryWrites).toHaveLength(2);
  await page.getByRole('button', { name: 'Restablecer encuadre de foto 1', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Zoom de foto 1', exact: true })).toHaveValue('100');
  await expect(frame.getByRole('img')).toHaveCSS('object-position', '50% 0%');
  expect(galleryWrites).toHaveLength(2);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('fotos por SKU: revisión, corrección, portada y conservación de la galería', async ({ page }) => {
  const { writes, errors, uploads } = await setup(page, { existingPhoto: true });
  await page.goto('/admin/productos/fotos');
  await expect(page.getByRole('heading', { name: 'Fotos del catálogo' })).toBeVisible();
  const input = page.getByLabel('Seleccionar fotos para revisar', { exact: true });
  await input.setInputFiles([
    await photoFile(page, '2120289-2.png', 'blue'),
    await photoFile(page, '2120289-1.png', 'red'),
    await photoFile(page, 'AJENO-3.png', 'yellow'),
    await photoFile(page, '2121126-1.png', 'green'),
  ]);
  await expect(page.locator('.photo-review-table tbody tr')).toHaveCount(4);
  await expect(page.getByText(/Sin coincidencia: corregí el código/)).toBeVisible();
  await expect(page.getByLabel('Aplicar foto AJENO-3.png', { exact: true })).not.toBeChecked();
  await expect(page.getByText('Bulón hexagonal · galería compartida de todas las medidas', { exact: true })).toBeVisible();
  expect(uploads).toHaveLength(0); expect(writes).toHaveLength(0);
  await page.getByLabel('Código destino de AJENO-3.png', { exact: true }).fill('2120289');
  await page.getByLabel('Aplicar foto AJENO-3.png', { exact: true }).check();
  await expect(page.getByText('3 nuevas + 1 existentes = 4 fotos', { exact: true })).toBeVisible();
  const firstGallery = page.locator('.photo-gallery-preview').filter({ hasText: 'Regulador de oxígeno' });
  await expect(firstGallery.locator('figure').first().getByRole('img')).toHaveAttribute('alt', '2120289-1.png');
  await page.getByRole('link', { name: 'Catálogo', exact: true }).click();
  await page.getByRole('link', { name: 'Fotos', exact: true }).click();
  await expect(page.locator('.photo-review-table tbody tr')).toHaveCount(4);
  await page.screenshot({ path: '.next/ui-results/fotos-revision.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: '.next/ui-results/fotos-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Guardar fotos seleccionadas' }).click();
  await expect(page.getByText('2 artículos con fotos guardadas.', { exact: true })).toBeVisible();
  expect(uploads).toHaveLength(4); expect(writes).toHaveLength(2);
  const simple = writes.find((item) => item.p_product.id === firstId);
  const grouped = writes.find((item) => item.p_product.id === secondId);
  expect(simple.p_images).toHaveLength(4);
  expect(simple.p_images[3].external_url).toBe('/imagenes/logo-icon.png');
  expect(simple.p_images.slice(0, 3).every(image => image.storage_path && !image.external_url)).toBe(true);
  expect(simple.p_product.price).toBe(100); expect(simple.p_product.stock).toBe(5); expect(simple.p_product.published).toBe(false);
  expect(grouped.p_images).toHaveLength(1); expect(grouped.p_variants[0].sku).toBe('2121126');
  await expect(page.locator('.photo-review-table tbody tr')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('fotos por SKU: bloquea órdenes repetidos y reintenta solo el artículo fallido', async ({ page }) => {
  const { writes, errors, uploads } = await setup(page, { failSku: 'GRP-BULON' });
  await page.goto('/admin/productos/fotos');
  await page.getByLabel('Seleccionar fotos para revisar', { exact: true }).setInputFiles([
    await photoFile(page, '2120289-1.png', 'red'),
    await photoFile(page, '2121126-1.png', 'blue'),
    await photoFile(page, 'GRP-BULON-1.png', 'green'),
  ]);
  await expect(page.getByRole('button', { name: 'Guardar fotos seleccionadas' })).toBeDisabled();
  await page.getByLabel('Orden de GRP-BULON-1.png', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Guardar fotos seleccionadas' }).click();
  await expect(page.getByText(/1 artículos con fotos guardadas\. 1 no se guardaron/)).toBeVisible();
  expect(writes).toHaveLength(2); expect(uploads).toHaveLength(3);
  await expect(page.locator('.photo-review-table tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Guardar fotos seleccionadas' }).click();
  await expect(page.getByText('1 artículos con fotos guardadas.', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(3); expect(uploads).toHaveLength(5);
  expect(writes[2].p_product.id).toBe(secondId); expect(writes[2].p_images).toHaveLength(2);
  await expect(page.locator('.photo-review-table tbody tr')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('fotos por SKU: una imagen ilegible no modifica el catálogo y puede quitarse', async ({ page }) => {
  const { writes, errors, uploads } = await setup(page);
  await page.goto('/admin/productos/fotos');
  await page.getByLabel('Seleccionar fotos para revisar', { exact: true }).setInputFiles([
    await photoFile(page, '2120289-1.png', 'red'),
    { name: '2121126-1.png', mimeType: 'image/png', buffer: Buffer.from('imagen-corrupta') },
  ]);
  await page.getByRole('button', { name: 'Guardar fotos seleccionadas' }).click();
  await expect(page.locator('.photo-manager').getByRole('alert')).toHaveText('No se pudo leer 2121126-1.png. No se guardó este lote.');
  expect(writes).toHaveLength(0); expect(uploads).toHaveLength(0);
  await page.getByRole('button', { name: 'Quitar foto 2121126-1.png', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar fotos seleccionadas' }).click();
  await expect(page.getByText('1 artículos con fotos guardadas.', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1); expect(uploads).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('PDF real: lectura local, vista previa y ningún guardado automático', async ({ page }) => {
  test.skip(!existsSync('data/Listado de precios.pdf'), 'El listado comercial no se incluye en el repositorio.');
  const { writes, errors } = await setup(page);
  await page.goto('/admin/productos/precios');
  await expect(page.getByText('Cargando el catálogo completo…')).toBeHidden();
  await page.locator('input[type="file"][accept=".pdf,application/pdf"]').setInputFiles('data/Listado de precios.pdf');
  await expect(page.getByRole('spinbutton', { name: 'Nuevo precio de 2120289' })).toHaveValue('66085.8', { timeout: 90000 });
  await expect(page.getByRole('spinbutton', { name: 'Nuevo precio de 2121126' })).toHaveValue('3725.72');
  expect(writes.length).toBe(0);
  await page.screenshot({ path: '.next/ui-results/precios-pdf.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('un lote con un fallo conserva solo el pendiente y permite reintentarlo', async ({ page }) => {
  const { writes, errors } = await setup(page, { failSku: 'GRP-BULON' });
  await page.goto('/admin/productos/precios');
  await page.getByRole('button', { name: 'Porcentaje', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar ajuste' }).click();
  await page.getByRole('button', { name: 'Guardar precios seleccionados' }).click();
  await expect(page.getByText('1 artículos guardados. 1 no se guardaron y siguen seleccionados para reintentar. Revisá el aviso del panel.', { exact: true })).toBeVisible();
  expect(writes.length).toBe(2);
  await page.getByRole('button', { name: 'Guardar precios seleccionados' }).click();
  await expect(page.getByText('1 artículos guardados.', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar precios seleccionados' })).toBeDisabled();
  expect(writes.length).toBe(3); expect(errors).toEqual([]);
});

test('los módulos se adaptan al teléfono sin desbordar el ancho de la página', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const module of ['', '/carga', '/catalogo', '/precios', '/fotos']) {
    await page.goto(`/admin/productos${module}`);
    await expect(page.locator('.product-workspace-title')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
  await page.screenshot({ path: '.next/ui-results/precios-mobile.png', fullPage: true });
});

test('el editor permite agregar y quitar medidas y recuperar cambios descartados', async ({ page }) => {
  const { writes, errors } = await setup(page);
  await page.goto('/admin/productos/catalogo');
  await page.locator('tr').filter({ hasText: 'GRP-BULON' }).getByRole('button', { name: 'Editar', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editar Bulón hexagonal' });
  await editor.getByRole('button', { name: '+ Agregar medida' }).click();
  await editor.getByLabel('SKU medida 2', { exact: true }).fill('NUEVO-M12');
  await editor.getByLabel('Diámetro medida 2', { exact: true }).fill('M12');
  await editor.getByLabel('Largo medida 2', { exact: true }).fill('40');
  await editor.getByLabel('Precio medida 2', { exact: true }).fill('300');
  await editor.getByLabel('Stock medida 2', { exact: true }).fill('4');
  await editor.getByRole('button', { name: 'Guardar producto', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].p_variants.length).toBe(2); expect(writes[0].p_variants[1].sku).toBe('NUEVO-M12');
  await expect(editor.getByRole('button', { name: 'Quitar medida 2' })).toBeEnabled();
  await editor.getByRole('button', { name: 'Quitar medida 2' }).click();
  await editor.getByRole('button', { name: 'Guardar producto', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].p_variants.length).toBe(1);
  await editor.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Título de 2120289' }).fill('Cambio a descartar');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Descartar todos los pendientes' }).click();
  await expect(page.getByRole('textbox', { name: 'Título de 2120289' })).toHaveValue('Regulador de oxígeno');
  expect(writes.length).toBe(2); expect(errors).toEqual([]);
});

test('Excel y CSV convertidos permiten elegir lista sin cambiar existencias', async ({ page }) => {
  const xlsx = 'data/convertidos/Listado de precios.xlsx', csv = 'data/convertidos/Listado de precios.csv';
  test.skip(!existsSync(xlsx) || !existsSync(csv), 'Los archivos comerciales convertidos no se incluyen en el repositorio.');
  const { writes, errors } = await setup(page);
  await page.goto('/admin/productos/precios');
  await page.getByRole('button', { name: 'Excel / CSV', exact: true }).click();
  await page.getByRole('combobox', { name: 'Lista a utilizar', exact: true }).selectOption('2');
  await page.locator('input[type="file"][accept=".xlsx,.csv"]').setInputFiles(xlsx);
  await expect(page.getByRole('spinbutton', { name: 'Nuevo precio de 2120289' })).toHaveValue('61680.08');
  await expect(page.getByRole('spinbutton', { name: 'Nuevo precio de 2121126' })).toHaveValue('3477.33');
  await page.getByRole('combobox', { name: 'Lista a utilizar', exact: true }).selectOption('3');
  await page.locator('input[type="file"][accept=".xlsx,.csv"]').setInputFiles(csv);
  await expect(page.getByRole('spinbutton', { name: 'Nuevo precio de 2120289' })).toHaveValue('52868.64');
  expect(writes.length).toBe(0);
  await page.getByRole('button', { name: 'Guardar precios seleccionados' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes.every(write => Object.keys(write).sort().join(',') === 'p_changes,p_product_id')).toBe(true);
  expect(errors).toEqual([]);
});
