const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { createHmac } = require('node:crypto');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');

let db;
const orderId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const line = { product_id: otherId, title: 'Bulón de prueba', sku: '00123', quantity: 2, unit_price: 100 };
async function scalar(sql) { return Object.values((await db.query(sql)).rows[0])[0]; }
async function seed(id = orderId, items = [line]) {
  await db.query('insert into public.mercadopago_checkouts(id,status_token,total,items,collector_id) values ($1,$2,200,$3::jsonb,$4)', [id, otherId, JSON.stringify(items), '456']);
}
async function confirm({ id = orderId, payment = '123', amount = 200, currency = 'ARS', seller = '456' } = {}) {
  return db.query('select public.confirm_test_mercadopago_payment($1,$2,$3,$4,$5)', [id, payment, amount, currency, seller]);
}
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create table public.products(id uuid primary key, stock integer);
    create table public.orders(id uuid primary key);
    create table public.order_items(id uuid primary key);
    insert into public.products values ('${otherId}', 5);
    insert into public.orders values ('${otherId}');
    insert into public.order_items values ('${otherId}');`);
  await db.exec(readFileSync('supabase/migrations/202610230001_mercadopago_test.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/202610300002_mercadopago_confirmation_validation.sql', 'utf8'));
});
beforeEach(async () => {
  await db.exec('reset role; truncate public.mercadopago_test_order_items, public.mercadopago_test_orders, public.mercadopago_checkouts;');
  await seed();
});
after(async () => { await db?.close(); });

test('confirmación SQL crea una compra de prueba y conserva stock y ventas reales', async () => {
  await db.exec('set role service_role');
  await confirm();
  assert.equal(await scalar('select count(*) from public.mercadopago_test_orders'), 1);
  assert.equal(await scalar('select count(*) from public.mercadopago_test_order_items'), 1);
  assert.equal(await scalar('select status from public.mercadopago_checkouts'), 'paid');
  await db.exec('reset role');
  assert.equal(await scalar('select stock from public.products'), 5);
  assert.equal(await scalar('select count(*) from public.orders'), 1);
  assert.equal(await scalar('select count(*) from public.order_items'), 1);
});

test('repetir confirmaciones, incluso en paralelo, no duplica compras ni renglones', async () => {
  await Promise.all([confirm(), confirm(), confirm()]);
  assert.equal(await scalar('select count(*) from public.mercadopago_test_orders'), 1);
  assert.equal(await scalar('select count(*) from public.mercadopago_test_order_items'), 1);
});

test('rechaza importe, moneda o receptor diferentes sin registrar compras', async () => {
  for (const patch of [{ amount: 199.99 }, { currency: 'USD' }, { seller: '999' }, { id: otherId }]) await assert.rejects(confirm(patch));
  assert.equal(await scalar('select count(*) from public.mercadopago_test_orders'), 0);
  assert.equal(await scalar('select status from public.mercadopago_checkouts'), 'pending');
});

test('rechaza datos nulos e identificadores de pago vacíos', async () => {
  for (const patch of [{ amount: null }, { currency: null }, { seller: null }, { payment: null }, { payment: '' }]) {
    await assert.rejects(confirm(patch));
  }
  assert.equal(await scalar('select count(*) from public.mercadopago_test_orders'), 0);
});

test('un pago no puede confirmar dos pedidos y un pedido no admite dos pagos', async () => {
  await seed(otherId);
  await confirm();
  await assert.rejects(confirm({ payment: '124' }), /otro pago/);
  await assert.rejects(confirm({ id: otherId }));
  assert.equal(await scalar('select count(*) from public.mercadopago_test_orders'), 1);
  assert.equal(await scalar(`select status from public.mercadopago_checkouts where id = '${otherId}'`), 'pending');
});

test('una línea inválida revierte toda la transacción, incluido el encabezado', async () => {
  await db.exec('truncate public.mercadopago_checkouts');
  await seed(orderId, [line, { ...line, quantity: 0 }]);
  await assert.rejects(confirm());
  assert.equal(await scalar('select count(*) from public.mercadopago_test_orders'), 0);
  assert.equal(await scalar('select count(*) from public.mercadopago_test_order_items'), 0);
  assert.equal(await scalar('select status from public.mercadopago_checkouts'), 'pending');
});

test('visitantes y usuarios autenticados no pueden leer ni confirmar compras de prueba', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`reset role; set role ${role}`);
    for (const table of ['mercadopago_checkouts', 'mercadopago_test_orders', 'mercadopago_test_order_items']) {
      await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
    }
    await assert.rejects(confirm(), /permission denied/);
  }
});

function integration({ amount = 200, status = 'approved' } = {}) {
  const origin = 'https://preview.example';
  let paymentStatus = status;
  const adapter = {
    rpc: async (_name, args) => {
      try { await confirm({ id: args.p_order_id, payment: args.p_payment_id, amount: args.p_amount, currency: args.p_currency, seller: args.p_collector_id }); return { error: null }; }
      catch (error) { return { error }; }
    },
    from: () => ({ select: () => {
      const filters = {};
      const query = { eq: (key, value) => { filters[key] = value; return query; }, maybeSingle: async () => {
        const { rows } = await db.query('select status,total from public.mercadopago_checkouts where id=$1 and status_token=$2', [filters.id, filters.status_token]);
        return { data: rows[0] ?? null, error: null };
      } };
      return query;
    } }),
  };
  const context = { exports: {}, URL, Buffer, AbortSignal,
    process: { env: { NEXT_PUBLIC_MERCADOPAGO_ENABLED: 'true', MERCADOPAGO_ACCESS_TOKEN: 'test', MERCADOPAGO_WEBHOOK_SECRET: 'secret', NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key', APP_URL: origin } },
    fetch: async () => ({ ok: true, json: async () => ({ id: 123, live_mode: false, external_reference: orderId, transaction_amount: amount, currency_id: 'ARS', collector_id: 456, status: paymentStatus }) }),
    require: name => name === '@supabase/supabase-js' ? { createClient: () => adapter } : require(name),
  };
  const compile = file => stripTypeScriptTypes(readFileSync(file, 'utf8')).replace(/import \{([^}]+)\} from "([^"]+)";/g, 'const {$1} = require("$2");').replace(/export /g, '');
  vm.runInNewContext(compile('src/lib/mercadopago.ts') + '\nObject.assign(exports,{paymentConfig,confirmPayment,validSignature});', context);
  const routes = {};
  for (const [name, file] of [['webhook', 'src/app/api/mercadopago/webhook/route.ts'], ['status', 'src/app/api/checkout/status/route.ts']]) {
    const routeContext = { exports: {}, URL, require: name => name === 'next/server' ? { NextResponse: Response } : context.exports };
    vm.runInNewContext(compile(file) + '\nexports.POST=POST;', routeContext);
    routes[name] = routeContext.exports.POST;
  }
  const ts = '1781009491';
  const signature = createHmac('sha256', 'secret').update(`id:123;request-id:req;ts:${ts};`).digest('hex');
  return {
    notify: () => routes.webhook(new Request(origin + '/api/mercadopago/webhook?data.id=123', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-request-id': 'req', 'x-signature': `ts=${ts},v1=${signature}` }, body: JSON.stringify({ type: 'payment', data: { id: '123' } }) })),
    consult: () => routes.status(new Request(origin + '/api/checkout/status', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ order: orderId, token: otherId, paymentId: '123' }) })),
    approve: () => { paymentStatus = 'approved'; },
  };
}

test('webhook firmado recorre ruta, API y SQL reales sin duplicar; importe alterado no confirma', async () => {
  await db.exec('set role service_role');
  const wrong = integration({ amount: 1 });
  assert.equal((await wrong.notify()).status, 503);
  assert.equal(await scalar('select count(*) from public.mercadopago_test_orders'), 0);
  const valid = integration();
  assert.equal((await valid.notify()).status, 200);
  assert.equal((await valid.notify()).status, 200);
  assert.equal(await scalar('select count(*) from public.mercadopago_test_orders'), 1);
  assert.equal(await scalar('select count(*) from public.mercadopago_test_order_items'), 1);
  assert.equal((await (await valid.consult()).json()).status, 'paid');
});

test('el retorno recupera un pago sin webhook y las reconsultas mantienen una sola compra', async () => {
  await db.exec('set role service_role');
  const api = integration({ status: 'pending' });
  assert.equal((await (await api.consult()).json()).status, 'pending');
  assert.equal(await scalar('select count(*) from public.mercadopago_test_orders'), 0);
  api.approve();
  assert.equal((await (await api.consult()).json()).status, 'paid');
  assert.equal((await (await api.consult()).json()).status, 'paid');
  assert.equal(await scalar('select count(*) from public.mercadopago_test_orders'), 1);
});
