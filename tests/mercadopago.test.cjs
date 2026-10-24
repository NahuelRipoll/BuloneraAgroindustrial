const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHmac } = require('node:crypto');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

// Ejecutar el módulo real con las dos fronteras externas (HTTP y DB) simuladas.
function load(payment = {}) {
  const calls = [];
  const db = { rpc: async (...args) => { calls.push(args); return { error: null }; } };
  const context = {
    exports: {}, Buffer, URL, AbortSignal,
    process: { env: { NEXT_PUBLIC_MERCADOPAGO_ENABLED: 'true', MERCADOPAGO_ACCESS_TOKEN: 'test', MERCADOPAGO_WEBHOOK_SECRET: 'secret', NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'key', APP_URL: 'https://preview.example' } },
    require: (name) => name === '@supabase/supabase-js' ? { createClient: () => db } : require(name),
    fetch: async () => ({ ok: true, json: async () => payment }),
  };
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

const productId = '11111111-1111-4111-8111-111111111111';
function loadCheckout({ stock = 5, testSeller = true, redirectUrl = 'https://www.mercadopago.com.ar/checkout/test' } = {}) {
  const saved = [];
  const preferences = [];
  const db = { from: () => ({
    select: () => ({ eq: () => ({ in: async () => ({ data: [{ id: productId, name: 'Bulón', sku: 'B-1', price: 100, stock, featured: true, offer_price: 80, product_variants: [] }], error: null }) }) }),
    insert: async (row) => { saved.push(row); return { error: null }; },
  }) };
  const context = { exports: {}, URL, Date, console,
    require: (name) => name === 'next/server' ? { NextResponse: { json: (data, options) => ({ status: options?.status ?? 200, data }) } }
      : name === '@/lib/mercadopago' ? {
        paymentConfig: () => ({ db, token: 'test', origin: 'https://preview.example' }),
        mercadoPago: async (_token, path, body) => {
          if (path === '/users/me') return { id: 42, tags: testSeller ? ['test_user'] : [] };
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
