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

async function setup(page, { failSku } = {}) {
  const writes = [];
  const errors = [];
  const products = fixture();
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
    if (url.pathname.endsWith('/products') && request.method() === 'GET') return route.fulfill({ json: products });
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
  return { writes, errors };
}

test('módulos independientes y carga de varios artículos sin formularios individuales', async ({ page }) => {
  const { writes, errors } = await setup(page);
  await page.goto('/admin/productos');
  await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();
  await expect(page.locator('.product-module-card')).toHaveCount(5);
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
  expect(writes.map(item => item.p_product.id).sort()).toEqual([firstId, secondId].sort());
  expect(writes.find(item => item.p_product.id === firstId).p_product.price).toBe(250);
  expect(writes.find(item => item.p_product.id === secondId).p_variants[0].price).toBe(350);
  await page.locator('input[type="file"][accept=".xlsx,.csv"]').setInputFiles({
    name: 'sin-coincidencias.csv', mimeType: 'text/csv', buffer: Buffer.from('Código;Precio\nAJENO;500'),
  });
  await expect(page.locator('.price-review-table tbody tr')).toHaveCount(0);
  await expect(page.getByText('No hay cambios de precio para aplicar a los artículos del catálogo con este listado.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar precios seleccionados' })).toBeDisabled();
  expect(writes).toHaveLength(2);
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
  for (const module of ['', '/carga', '/catalogo', '/precios']) {
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
  expect(writes.find((write) => write.p_product.sku === '2120289').p_product.stock).toBe(5);
  expect(writes.find((write) => write.p_product.sku === 'GRP-BULON').p_variants[0].stock).toBe(10);
  expect(errors).toEqual([]);
});
