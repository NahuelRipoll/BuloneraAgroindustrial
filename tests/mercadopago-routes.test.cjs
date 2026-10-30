const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const { createHmac } = require('node:crypto');
const vm = require('node:vm');

function route(file, api) {
  const context = { exports: {}, URL, console, require: name => name === 'next/server' ? { NextResponse: Response } : api };
  const source = stripTypeScriptTypes(readFileSync(file, 'utf8')).replace(/import \{([^}]+)\} from "([^"]+)";/g, 'const {$1} = require("$2");').replace(/export /g, '');
  vm.runInNewContext(source + '\nexports.POST = POST;', context);
  return context.exports.POST;
}
const origin = 'https://preview.example';
const order = '11111111-1111-4111-8111-111111111111';
const token = '22222222-2222-4222-8222-222222222222';
function statusRoute({ status = 'pending', payment = 'approved', dbError = null, confirmError = false } = {}) {
  const confirmations = [], queries = [];
  const db = { from: table => ({ select: fields => {
    const filters = {};
    const query = { eq: (key, value) => { filters[key] = value; return query; }, maybeSingle: async () => {
      queries.push({ table, fields, filters });
      return { data: filters.id === order && filters.status_token === token ? { status, total: 200 } : null, error: dbError };
    } };
    return query;
  } }) };
  const post = route('src/app/api/checkout/status/route.ts', {
    paymentConfig: () => ({ db, origin }),
    confirmPayment: async (...args) => { confirmations.push(args); if (confirmError) throw new Error('Pago ajeno'); return payment; },
  });
  const request = (patch = {}, from = origin) => new Request(origin + '/api/checkout/status', { method: 'POST', headers: { Origin: from, 'Content-Type': 'application/json' }, body: JSON.stringify({ order, token, paymentId: '123', ...patch }) });
  return { post, request, confirmations, queries };
}

test('consulta exige origen y token del pedido y no confirma solicitudes ajenas', async () => {
  const { post, request, confirmations, queries } = statusRoute();
  assert.equal((await post(request({}, 'https://other.example'))).status, 403);
  assert.equal(queries.length, 0);
  assert.equal((await post(request({ token: '33333333-3333-4333-8333-333333333333' }))).status, 404);
  assert.equal((await post(request({ token: 'invalido' }))).status, 400);
  assert.equal(confirmations.length, 0);
});

test('consulta usa la API, convierte aprobado a paid y evita cachear resultados', async () => {
  for (const state of ['approved', 'pending', 'in_process', 'rejected', 'cancelled']) {
    const { post, request, confirmations } = statusRoute({ payment: state });
    const response = await post(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal((await response.json()).status, state === 'approved' ? 'paid' : state);
    assert.deepEqual(confirmations, [['123', order]]);
  }
});

test('consultas sin pago y pedidos pagados no vuelven a confirmar', async () => {
  for (const options of [{ status: 'paid' }, { status: 'pending' }]) {
    const { post, request, confirmations } = statusRoute(options);
    const response = await post(request({ paymentId: undefined }));
    assert.equal((await response.json()).status, options.status);
    assert.equal(confirmations.length, 0);
  }
});

test('consulta rechaza ID inválido y falla sin confirmar ante problemas de base o pago ajeno', async () => {
  const { post, request, confirmations } = statusRoute();
  for (const paymentId of ['abc', '1'.repeat(31), '-1']) assert.equal((await post(request({ paymentId }))).status, 400);
  assert.equal(confirmations.length, 0);
  for (const options of [{ dbError: new Error('DB') }, { confirmError: true }]) {
    const api = statusRoute(options);
    assert.equal((await api.post(api.request())).status, 503);
  }
});

function webhook({ fail = false } = {}) {
  const confirmations = [];
  // La verificación criptográfica se carga del módulo real con sus fronteras simuladas.
  const context = { exports: {}, Buffer, require: name => require(name) };
  const source = stripTypeScriptTypes(readFileSync('src/lib/mercadopago.ts', 'utf8')).replace(/^import .*;\s*$/gm, '').replace(/export /g, '');
  vm.runInNewContext('const {createHmac,timingSafeEqual}=require("node:crypto");\n' + source + '\nexports.validSignature=validSignature;', context);
  const post = route('src/app/api/mercadopago/webhook/route.ts', {
    paymentConfig: () => ({ secret: 'test-secret' }), validSignature: context.exports.validSignature,
    confirmPayment: async id => { confirmations.push(id); if (fail) throw new Error('API no disponible'); return 'approved'; },
  });
  const request = ({ id = '123', bodyId = id, signature, type = 'payment' } = {}) => {
    const ts = '1781009491';
    const hash = createHmac('sha256', 'test-secret').update(`id:${id};request-id:req;ts:${ts};`).digest('hex');
    return new Request(origin + '/api/mercadopago/webhook?data.id=' + id, { method: 'POST', headers: { 'x-request-id': 'req', 'x-signature': signature ?? `ts=${ts},v1=${hash}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type, data: { id: bodyId } }) });
  };
  return { post, request, confirmations };
}

test('webhook verifica firma y coincidencia de ID antes de consultar el pago', async () => {
  const { post, request, confirmations } = webhook();
  assert.equal((await post(request({ signature: 'ts=1,v1=bad' }))).status, 401);
  assert.equal((await post(request({ id: 'abc' }))).status, 401);
  assert.equal((await post(request({ bodyId: '456' }))).status, 400);
  assert.equal(confirmations.length, 0);
  assert.equal((await post(request())).status, 200);
  assert.deepEqual(confirmations, ['123']);
});

test('webhook ignora otros tipos firmados y responde 503 para permitir reintentos de errores', async () => {
  const api = webhook();
  assert.equal((await api.post(api.request({ type: 'merchant_order' }))).status, 200);
  assert.equal(api.confirmations.length, 0);
  const failed = webhook({ fail: true });
  assert.equal((await failed.post(failed.request())).status, 503);
});
