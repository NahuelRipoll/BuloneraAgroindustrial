const { test, expect } = require('@playwright/test');

const order = '11111111-1111-4111-8111-111111111111';
const token = '22222222-2222-4222-8222-222222222222';
const result = `/compra/resultado?order=${order}&token=${token}&payment_id=123`;
const cart = [{ product: { id: order, name: 'Producto de prueba', sku: '00123', price: 100, transferPrice: 90, stock: 5, image: '/imagenes/producto-sin-foto.svg', specs: {} }, quantity: 2 }];

async function setup(page, respond) {
  const requests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(cart => { if (!localStorage.getItem('bulonera-cart')) localStorage.setItem('bulonera-cart', JSON.stringify(cart)); }, cart);
  await page.route('**/api/checkout/status', async route => {
    requests.push(route.request().postDataJSON());
    await respond(route, requests.length);
  });
  return { requests, errors };
}

for (const [status, message] of [
  ['paid', 'Pago de prueba confirmado. Tu pedido quedó registrado.'],
  ['pending', 'Tu pago todavía está pendiente de confirmación.'],
  ['in_process', 'Tu pago todavía está pendiente de confirmación.'],
  ['rejected', 'El pago no se completó.'],
  ['cancelled', 'El pago no se completó.'],
]) {
  test(`resultado ${status}: muestra el estado del servidor y conserva el carrito`, async ({ page }) => {
    const { requests, errors } = await setup(page, route => route.fulfill({ json: { status, total: 200 } }));
    await page.goto(result + '&status=approved');
    await expect(page.getByRole('status')).toContainText(message);
    expect(requests).toEqual([{ order, token, paymentId: '123' }]);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bulonera-cart')))).toEqual(cart);
    await page.reload();
    await expect(page.getByRole('status')).toContainText(message);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bulonera-cart')))).toEqual(cart);
    expect(errors).toEqual([]);
  });
}

test('pendiente pasa a aprobado al consultar otra vez sin depender del status de la URL', async ({ page }) => {
  const { requests, errors } = await setup(page, (route, count) => route.fulfill({ json: { status: count === 1 ? 'pending' : 'paid', total: 200 } }));
  await page.goto(result + '&status=approved');
  await expect(page.getByRole('status')).toContainText('pendiente');
  await page.getByRole('button', { name: 'Consultar estado' }).click();
  await expect(page.getByRole('status')).toContainText('Pago de prueba confirmado');
  expect(requests).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('sin datos no consulta y un retorno sin payment_id conserva el pedido pendiente', async ({ page }) => {
  const { requests } = await setup(page, route => route.fulfill({ json: { status: 'pending', total: 200 } }));
  await page.goto('/compra/resultado');
  await expect(page.getByRole('status')).toContainText('Faltan los datos del pedido');
  expect(requests).toHaveLength(0);
  await page.goto(`/compra/resultado?order=${order}&token=${token}`);
  await expect(page.getByRole('status')).toContainText('pendiente');
  expect(requests[0]).toEqual({ order, token });
});

test('un error de API no muestra aprobación y permite recuperar la consulta', async ({ page }) => {
  const { errors } = await setup(page, (route, count) => count === 1 ? route.fulfill({ status: 503, json: { error: 'No pudimos verificar el pago.' } }) : route.fulfill({ json: { status: 'paid', total: 200 } }));
  await page.goto(result);
  await expect(page.getByRole('status')).toHaveText('No pudimos verificar el pago.');
  await page.getByRole('button', { name: 'Consultar estado' }).click();
  await expect(page.getByRole('status')).toContainText('Pago de prueba confirmado');
  expect(errors).toEqual([]);
});

test('respuesta vacía o no JSON muestra un aviso comprensible', async ({ page }) => {
  await setup(page, route => route.fulfill({ status: 403, body: '' }));
  await page.goto(result);
  await expect(page.getByRole('status')).toHaveText('No pudimos verificar el pedido.');
});

test('carrito usa total sin transferencia y conserva productos cuando falla el checkout', async ({ page }) => {
  const { errors } = await setup(page, route => route.fulfill({ json: { status: 'pending' } }));
  const calls = [];
  await page.route('**/api/checkout', async route => { calls.push(route.request().postDataJSON()); await route.fulfill({ status: 409, json: { error: 'Un producto cambió o no tiene stock.' } }); });
  await page.goto('/tienda');
  await page.getByRole('button', { name: /Carrito/ }).click();
  const drawer = page.getByRole('complementary', { name: 'Carrito', exact: true });
  await expect(drawer.getByText('Total con Mercado Pago', { exact: true })).toBeVisible();
  await expect(drawer.locator('.cart-foot')).toContainText(/200/);
  await expect(drawer.locator('.cart-foot')).toContainText(/180/);
  await page.getByRole('button', { name: 'Ir a Mercado Pago (prueba)' }).click();
  await expect(drawer.getByRole('alert')).toHaveText('Un producto cambió o no tiene stock.');
  await expect(page.getByRole('button', { name: 'Ir a Mercado Pago (prueba)' })).toBeEnabled();
  expect(calls[0]).toEqual({ items: [{ id: order, sku: '00123', quantity: 2 }] });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bulonera-cart')))).toEqual(cart);
  expect(errors).toEqual([]);
});

test('carrito muestra un mensaje claro si el checkout responde sin JSON', async ({ page }) => {
  await setup(page, route => route.fulfill({ json: { status: 'pending' } }));
  await page.route('**/api/checkout', route => route.fulfill({ status: 503, body: '' }));
  await page.goto('/tienda');
  await page.getByRole('button', { name: /Carrito/ }).click();
  await page.getByRole('button', { name: 'Ir a Mercado Pago (prueba)' }).click();
  await expect(page.getByRole('complementary', { name: 'Carrito', exact: true }).getByRole('alert')).toHaveText('No pudimos iniciar el pago.');
  await expect(page.getByRole('button', { name: 'Ir a Mercado Pago (prueba)' })).toBeEnabled();
});

test('el botón evita pedidos repetidos y abre solamente el checkout externo devuelto', async ({ page }) => {
  await setup(page, route => route.fulfill({ json: { status: 'pending' } }));
  let calls = 0, release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/checkout', async route => { calls++; await pending; await route.fulfill({ json: { url: 'https://www.mercadopago.com.ar/checkout/test' } }); });
  await page.route('https://www.mercadopago.com.ar/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Checkout externo simulado</h1>' }));
  await page.goto('/tienda');
  await page.getByRole('button', { name: /Carrito/ }).click();
  await page.getByRole('button', { name: 'Ir a Mercado Pago (prueba)' }).click();
  await expect(page.getByRole('button', { name: 'Redirigiendo a Mercado Pago…' })).toBeDisabled();
  expect(calls).toBe(1);
  release();
  await expect(page).toHaveURL('https://www.mercadopago.com.ar/checkout/test');
});
