const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHmac } = require('node:crypto');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

// Ejecutar el módulo real con las dos fronteras externas (HTTP y DB) simuladas.
function load(payment = {}, { buyerId, seller = {}, rpcError = null, apiFails = false } = {}) {
  const calls = [];
  const db = { rpc: async (...args) => { calls.push(args); return { error: rpcError }; } };
  const context = {
    exports: {}, Buffer, URL, AbortSignal,
    process: { env: { NEXT_PUBLIC_MERCADOPAGO_ENABLED: 'true', MERCADOPAGO_ACCESS_TOKEN: 'test', MERCADOPAGO_WEBHOOK_SECRET: 'secret', NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'key', APP_URL: 'https://preview.example' } },
    require: (name) => name === '@supabase/supabase-js' ? { createClient: () => db } : require(name),
    fetch: async (url) => ({ ok: !apiFails, status: apiFails ? 503 : 200, json: async () => url.endsWith('/users/me') ? seller : payment }),
  };
  if (buyerId) context.process.env.MERCADOPAGO_TEST_BUYER_ID = buyerId;
  const code = stripTypeScriptTypes(readFileSync('src/lib/mercadopago.ts', 'utf8'))
    .replace(/import \{([^}]+)\} from "([^"]+)";/g, 'const {$1} = require("$2");')
    .replace(/export /g, '') + '\nObject.assign(exports, {paymentConfig, mercadoPago, validSignature, confirmPayment});';
  vm.runInNewContext(code, context);
  return { api: context.exports, calls, env: context.process.env };
}

test('firma válida; rechaza ID, request-id o secreto alterados', () => {
  const { api } = load();
  const hash = createHmac('sha256', 'secret').update('id:123;request-id:request;ts:123456;').digest('hex');
  const signature = `ts=123456,v1=${hash}`;
  assert.equal(api.validSignature('123', 'request', signature, 'secret'), true);
  assert.equal(api.validSignature('124', 'request', signature, 'secret'), false);
  assert.equal(api.validSignature('123', 'other', signature, 'secret'), false);
  assert.equal(api.validSignature('123', 'request', signature, 'other'), false);
  assert.equal(api.validSignature('123', 'request', 'ts=1,v1=bad', 'secret'), false);
  assert.equal(api.validSignature('123', '', signature, 'secret'), false);
});

test('rechaza pagos reales sin escribir en la base', async () => {
  const { api, calls } = load({ live_mode: true, status: 'approved' });
  await assert.rejects(api.confirmPayment('123'), /pago real/);
  assert.equal(calls.length, 0);
});

test('admite live_mode=true solo con vendedor de prueba y comprador configurado', async () => {
  const payment = { id: 123, live_mode: true, status: 'approved', external_reference: 'order', transaction_amount: 100, currency_id: 'ARS', collector_id: 456, payer: { id: 789 } };
  const { api, calls } = load(payment, { buyerId: '789', seller: { id: 456, tags: ['test_user'] } });
  assert.equal(await api.confirmPayment('123', 'order'), 'approved');
  assert.equal(calls.length, 1);
});

test('rechaza vendedor real, vendedor distinto o comprador no autorizado con live_mode=true', async () => {
  const payment = { id: 123, live_mode: true, status: 'approved', external_reference: 'order', collector_id: 456, payer: { id: 789 } };
  for (const config of [
    { buyerId: '789', seller: { id: 456, tags: [] } },
    { buyerId: '789', seller: { id: 999, tags: ['test_user'] } },
    { buyerId: '999', seller: { id: 456, tags: ['test_user'] } },
    { seller: { id: 456, tags: ['test_user'] } },
  ]) {
    const { api, calls } = load(payment, config);
    await assert.rejects(api.confirmPayment('123'), /pago real/);
    assert.equal(calls.length, 0);
  }
});

test('rechaza un pago correspondiente a otro pedido', async () => {
  const { api, calls } = load({ live_mode: false, external_reference: 'other', status: 'approved' });
  await assert.rejects(api.confirmPayment('123', 'expected'), /no corresponde/);
  assert.equal(calls.length, 0);
});

test('pago pendiente no crea venta', async () => {
  const { api, calls } = load({ live_mode: false, status: 'pending' });
  assert.equal(await api.confirmPayment('123'), 'pending');
  assert.equal(calls.length, 0);
});

test('rechazados, cancelados, en proceso, reintegrados y contracargos no crean ventas', async () => {
  for (const status of ['rejected', 'cancelled', 'in_process', 'refunded', 'charged_back']) {
    const { api, calls } = load({ live_mode: false, status });
    assert.equal(await api.confirmPayment('123'), status);
    assert.equal(calls.length, 0);
  }
});

test('fallos de Mercado Pago o de la base no devuelven una confirmación falsa', async () => {
  const unavailable = load({}, { apiFails: true });
  await assert.rejects(unavailable.api.confirmPayment('123'), /503/);
  assert.equal(unavailable.calls.length, 0);
  const failed = load({ id: 123, live_mode: false, status: 'approved', external_reference: 'order', transaction_amount: 200, currency_id: 'ARS', collector_id: 456 }, { rpcError: new Error('DB') });
  await assert.rejects(failed.api.confirmPayment('123'), /No se pudo confirmar/);
});

test('un aprobado con datos incompletos o inconsistentes se rechaza antes de escribir en la base', async () => {
  const valid = { id: 123, live_mode: false, status: 'approved', external_reference: 'order', transaction_amount: 200, currency_id: 'ARS', collector_id: 456 };
  for (const patch of [{ id: 124 }, { id: null }, { external_reference: '' }, { transaction_amount: null }, { transaction_amount: 0 }, { transaction_amount: -1 }, { transaction_amount: NaN }, { currency_id: null }, { currency_id: 'USD' }, { collector_id: null }]) {
    const { api, calls } = load({ ...valid, ...patch });
    await assert.rejects(api.confirmPayment('123'), /Datos de pago inválidos/);
    assert.equal(calls.length, 0);
  }
});

test('pago aprobado entrega a la transacción SQL los valores de la API', async () => {
  const { api, calls } = load({ id: 123, live_mode: false, status: 'approved', external_reference: 'order', transaction_amount: 1250.50, currency_id: 'ARS', collector_id: 456 });
  assert.equal(await api.confirmPayment('123', 'order'), 'approved');
  assert.equal(calls[0][0], 'confirm_test_mercadopago_payment');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1])), { p_order_id: 'order', p_payment_id: '123', p_amount: 1250.50, p_currency: 'ARS', p_collector_id: '456' });
});

test('pagos apagados por defecto y configuración HTTPS obligatoria', () => {
  const { api, env } = load();
  env.NEXT_PUBLIC_MERCADOPAGO_ENABLED = 'false';
  assert.throws(() => api.paymentConfig(), /deshabilitados/);
  env.NEXT_PUBLIC_MERCADOPAGO_ENABLED = 'true';
  env.APP_URL = 'http://localhost:3000';
  assert.throws(() => api.paymentConfig(), /incompleta/);
});

test('producción y master bloquean pagos aunque la bandera esté habilitada', () => {
  for (const environment of [{ VERCEL_ENV: 'production' }, { VERCEL_GIT_COMMIT_REF: 'master' }]) {
    const { api, env, calls } = load();
    Object.assign(env, environment);
    assert.throws(() => api.paymentConfig(), /deshabilitados/);
    assert.equal(calls.length, 0);
  }
});

test('la compilación oculta el botón en producción y conserva la configuración del preview', () => {
  const source = stripTypeScriptTypes(readFileSync('next.config.ts', 'utf8')).replace(/^import .*;\s*$/gm, '').replace('export default nextConfig;', 'exports.config = nextConfig;');
  for (const env of [{ VERCEL_ENV: 'production', NEXT_PUBLIC_MERCADOPAGO_ENABLED: 'true' }, { VERCEL_GIT_COMMIT_REF: 'master', NEXT_PUBLIC_MERCADOPAGO_ENABLED: 'true' }]) {
    const context = { exports: {}, process: { env } };
    vm.runInNewContext(source, context);
    assert.equal(context.exports.config.env.NEXT_PUBLIC_MERCADOPAGO_ENABLED, 'false');
  }
  const context = { exports: {}, process: { env: { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/mercado-pago' } } };
  vm.runInNewContext(source, context);
  assert.equal(context.exports.config.env, undefined);
});

const productId = '11111111-1111-4111-8111-111111111111';
function loadCheckout({ stock = 5, testSeller = true, redirectUrl = 'https://www.mercadopago.com.ar/checkout/test', catalog, catalogError = null, insertError = null, preferenceError = false } = {}) {
  const saved = [];
  const preferences = [];
  const db = { from: () => ({
    select: () => ({ eq: () => ({ in: async () => ({ data: catalog ?? [{ id: productId, name: 'Bulón', sku: 'B-1', price: 100, stock, featured: true, offer_price: 80, product_variants: [] }], error: catalogError }) }) }),
    insert: async (row) => { saved.push(row); return { error: insertError }; },
  }) };
  const context = { exports: {}, URL, Date, console,
    require: (name) => name === 'next/server' ? { NextResponse: { json: (data, options) => ({ status: options?.status ?? 200, data }) } }
      : name === '@/lib/mercadopago' ? {
        paymentConfig: () => ({ db, token: 'test', origin: 'https://preview.example' }),
        mercadoPago: async (_token, path, body) => {
          if (path === '/users/me') return { id: 42, tags: testSeller ? ['test_user'] : [] };
          if (preferenceError) throw new Error('API no disponible');
          preferences.push(body);
          return { init_point: redirectUrl };
        },
      } : require(name),
  };
  const code = stripTypeScriptTypes(readFileSync('src/app/api/checkout/route.ts', 'utf8'))
    .replace(/import \{([^}]+)\} from "([^"]+)";/g, 'const {$1} = require("$2");')
    .replace(/export /g, '') + '\nexports.POST = POST;';
  vm.runInNewContext(code, context);
  const request = (items, origin = 'https://preview.example') => ({ headers: new Headers({ origin }), text: async () => JSON.stringify({ items }) });
  return { post: context.exports.POST, saved, preferences, request };
}

test('checkout ignora el precio enviado y cobra la oferta de la base', async () => {
  const { post, request, saved, preferences } = loadCheckout();
  const response = await post(request([{ id: productId, sku: 'B-1', quantity: 2, unit_price: 1 }]));
  assert.equal(response.status, 200);
  assert.equal(saved[0].total, 160);
  assert.equal(preferences[0].items[0].unit_price, 80);
  assert.equal(preferences[0].external_reference, saved[0].id);
});

test('checkout devuelve el enlace externo y configura el retorno para cada resultado', async () => {
  const { post, request, saved, preferences } = loadCheckout();
  const response = await post(request([{ id: productId, sku: 'B-1', quantity: 1 }]));
  assert.equal(response.status, 200);
  assert.equal(response.data.url, 'https://www.mercadopago.com.ar/checkout/test');
  const back = new URL(preferences[0].back_urls.success);
  assert.equal(back.origin, 'https://preview.example');
  assert.equal(back.pathname, '/compra/resultado');
  assert.equal(back.searchParams.get('order'), saved[0].id);
  assert.equal(back.searchParams.get('token'), saved[0].status_token);
  assert.equal(preferences[0].back_urls.failure, back.href);
  assert.equal(preferences[0].back_urls.pending, back.href);
  assert.equal(preferences[0].auto_return, 'approved');
});

test('checkout rechaza redirecciones fuera de Mercado Pago o sin HTTPS', async () => {
  for (const redirectUrl of ['https://mercadopago.com.ar.ejemplo.com/pago', 'https://ejemplo.com/pago', 'http://www.mercadopago.com.ar/pago']) {
    const { post, request } = loadCheckout({ redirectUrl });
    assert.equal((await post(request([{ id: productId, sku: 'B-1', quantity: 1 }]))).status, 503);
  }
});

test('checkout rechaza falta de stock sin crear preferencia', async () => {
  const { post, request, saved, preferences } = loadCheckout({ stock: 1 });
  assert.equal((await post(request([{ id: productId, sku: 'B-1', quantity: 2 }]))).status, 409);
  assert.equal(saved.length, 0);
  assert.equal(preferences.length, 0);
});

test('checkout rechaza origen ajeno, líneas duplicadas y cantidades fraccionarias', async () => {
  const { post, request, saved } = loadCheckout();
  const line = { id: productId, sku: 'B-1', quantity: 1 };
  assert.equal((await post(request([line], 'https://other.example'))).status, 403);
  assert.equal((await post(request([line, line]))).status, 400);
  assert.equal((await post(request([{ ...line, quantity: 1.5 }]))).status, 400);
  assert.equal(saved.length, 0);
});

test('checkout bloquea una cuenta vendedora real antes de crear pedido', async () => {
  const { post, request, saved, preferences } = loadCheckout({ testSeller: false });
  assert.equal((await post(request([{ id: productId, sku: 'B-1', quantity: 1 }]))).status, 503);
  assert.equal(saved.length, 0);
  assert.equal(preferences.length, 0);
});

test('checkout rechaza cantidades inválidas, demasiadas líneas, SKU cambiado y borradores', async () => {
  const line = { id: productId, sku: 'B-1', quantity: 1 };
  for (const quantity of [0, -1, 1.5, '2', null, 10001]) {
    const api = loadCheckout();
    assert.equal((await api.post(api.request([{ ...line, quantity }]))).status, 400);
    assert.equal(api.saved.length, 0);
  }
  for (const items of [[], null, Array.from({ length: 51 }, (_, i) => ({ ...line, id: `${productId}-${i}` }))]) {
    const api = loadCheckout();
    assert.equal((await api.post(api.request(items))).status, 400);
  }
  for (const patch of [{ sku: 'CAMBIADO' }, { id: 'local-borrador' }]) {
    const api = loadCheckout();
    assert.equal((await api.post(api.request([{ ...line, ...patch }]))).status, 409);
    assert.equal(api.preferences.length, 0);
  }
});

test('checkout rechaza JSON roto, cuerpo excesivo y catálogo no disponible', async () => {
  const api = loadCheckout();
  for (const [text, status] of [['{', 400], ['x'.repeat(16001), 400]]) {
    const req = api.request([]); req.text = async () => text;
    assert.equal((await api.post(req)).status, status);
  }
  for (const options of [{ catalogError: new Error('DB') }, { insertError: new Error('DB') }, { preferenceError: true }]) {
    const failed = loadCheckout(options);
    assert.equal((await failed.post(failed.request([{ id: productId, sku: 'B-1', quantity: 1 }]))).status, 503);
    assert.equal(failed.preferences.length, 0);
  }
});

test('checkout cobra una medida con oferta y rechaza comprar la base de un grupo', async () => {
  const variantId = '22222222-2222-4222-8222-222222222222';
  const catalog = [{ id: productId, sku: 'GRUPO', name: 'Bulones', price: 100, stock: 99, featured: true, offer_price: 80,
    product_variants: [{ id: variantId, sku: '00045', price: 250, stock: 3, options: { Diámetro: 'M8', Largo: '30' } }] }];
  const api = loadCheckout({ catalog });
  const line = { id: `${productId}-${variantId}`, sku: '00045', quantity: 2, unit_price: 1 };
  assert.equal((await api.post(api.request([line]))).status, 200);
  assert.equal(api.saved[0].total, 400);
  assert.equal(api.preferences[0].items[0].unit_price, 200);
  assert.match(api.preferences[0].items[0].title, /M8 \/ 30/);
  assert.equal((await api.post(api.request([{ id: productId, sku: 'GRUPO', quantity: 1 }]))).status, 409);
  assert.equal((await api.post(api.request([{ ...line, quantity: 4 }]))).status, 409);
});

test('checkout rechaza precios cero y arma preferencia con expiración, moneda y webhook', async () => {
  const noPrice = loadCheckout({ catalog: [{ id: productId, sku: 'B-1', price: 0, stock: 5, featured: false, product_variants: [] }] });
  assert.equal((await noPrice.post(noPrice.request([{ id: productId, sku: 'B-1', quantity: 1 }]))).status, 409);
  const api = loadCheckout();
  const before = Date.now();
  await api.post(api.request([{ id: productId, sku: 'B-1', quantity: 1 }]));
  const preference = api.preferences[0];
  assert.equal(preference.items[0].currency_id, 'ARS');
  assert.equal(preference.notification_url, 'https://preview.example/api/mercadopago/webhook');
  assert.equal(preference.expires, true);
  assert.ok(new Date(preference.expiration_date_to).getTime() >= before + 29 * 60 * 1000);
});
