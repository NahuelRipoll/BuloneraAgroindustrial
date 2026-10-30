import { writeFile, mkdir } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd());
const createCheckout = process.argv.includes('--create-checkout');
const origin = new URL(process.env.APP_URL).origin;
if (!new URL(origin).hostname.endsWith('.vercel.app')) throw new Error('Esta herramienta solo admite el preview de Vercel.');
const report = { date: new Date().toISOString(), preview: origin, createsTestCheckouts: createCheckout, checks: [] };
const results = report.checks;
let checkoutToInspect;
const apiToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
async function mp(path) {
  const response = await fetch('https://api.mercadopago.com' + path, { headers: { Authorization: `Bearer ${apiToken}` }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Mercado Pago HTTP ${response.status}`);
  return response.json();
}
async function post(path, data, options = {}) {
  const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: options.origin || origin, ...options.headers }, body: JSON.stringify(data), signal: AbortSignal.timeout(25000) });
  let body; try { body = await response.json(); } catch { body = null; }
  return { status: response.status, body };
}
function check(name, actual, expected) {
  const passed = actual === expected;
  results.push({ name, actual, expected, passed });
  if (!passed) throw new Error(`${name}: se esperaba ${expected}, se obtuvo ${actual}`);
}
async function main() {
  const seller = await mp('/users/me');
  check('Vendedor es cuenta de prueba', seller.tags?.includes('test_user') === true, true);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  async function catalog() {
    const { data, error } = await db.from('products').select('id,sku,price,stock,featured,offer_price,product_variants(id,sku,price,stock)').eq('published', true).order('id');
    if (error) throw new Error('No se pudo leer el catálogo público.');
    return data;
  }
  const products = await catalog();
  const candidates = products.flatMap(p => p.product_variants.length ? p.product_variants.map(v => ({ product: p, id: `${p.id}-${v.id}`, sku: v.sku, stock: v.stock, price: Number(v.price) })) : [{ product: p, id: p.id, sku: p.sku, stock: p.stock, price: Number(p.price) }]);
  const sellable = candidates.find(c => c.stock > 0 && c.price > 0);
  if (!sellable) throw new Error('No hay artículos publicados con stock para probar.');
  const line = { id: sellable.id, sku: sellable.sku, quantity: 1 };
  check('Cantidad cero', (await post('/api/checkout', { items: [{ ...line, quantity: 0 }] })).status, 400);
  check('Líneas duplicadas', (await post('/api/checkout', { items: [line, line] })).status, 400);
  check('Origen ajeno', (await post('/api/checkout', { items: [line] }, { origin: 'https://other.example' })).status, 403);
  check('SKU alterado', (await post('/api/checkout', { items: [{ ...line, sku: 'AUDIT-SKU-INEXISTENTE' }] })).status, 409);
  const stockCandidate = candidates.find(c => c.stock >= 0 && c.stock < 10000);
  if (stockCandidate) check('Stock insuficiente', (await post('/api/checkout', { items: [{ id: stockCandidate.id, sku: stockCandidate.sku, quantity: stockCandidate.stock + 1 }] })).status, 409);
  check('Token inválido', (await post('/api/checkout/status', { order: '11111111-1111-4111-8111-111111111111', token: 'invalido' })).status, 400);
  check('Pedido ajeno', (await post('/api/checkout/status', { order: '11111111-1111-4111-8111-111111111111', token: '22222222-2222-4222-8222-222222222222' })).status, 404);
  check('Webhook sin firma', (await post('/api/mercadopago/webhook?data.id=123', { type: 'payment', data: { id: '123' } })).status, 401);
  const ts = String(Math.floor(Date.now() / 1000)), requestId = 'catalog-audit-20261030';
  const hash = createHmac('sha256', secret).update(`id:123;request-id:${requestId};ts:${ts};`).digest('hex');
  check('Notificación de otro tipo firmada', (await post('/api/mercadopago/webhook?data.id=123', { type: 'merchant_order', data: { id: '123' } }, { headers: { 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${hash}` } })).status, 200);
  if (createCheckout) {
    const choices = [sellable];
    const variant = candidates.find(c => c.product.product_variants.length && c.stock > 0 && c.price > 0 && c.id !== sellable.id);
    if (variant) choices.push(variant);
    for (const choice of choices) {
      const checkout = await post('/api/checkout', { items: [{ id: choice.id, sku: choice.sku, quantity: 1, unit_price: 1 }] });
      check(`Checkout de prueba ${choice.product.product_variants.length ? 'medida' : 'simple'}`, checkout.status, 200);
      const url = new URL(checkout.body.url);
      check('Redirección HTTPS a Mercado Pago', url.protocol === 'https:' && (url.hostname === 'mercadopago.com.ar' || url.hostname.endsWith('.mercadopago.com.ar')), true);
      const preferenceId = url.searchParams.get('pref_id');
      if (!preferenceId) throw new Error('No se obtuvo el identificador de preferencia.');
      const preference = await mp('/checkout/preferences/' + encodeURIComponent(preferenceId));
      check('Receptor de preferencia corresponde al vendedor de prueba', String(preference.collector_id), String(seller.id));
      const offer = choice.product.featured && Number(choice.product.offer_price) > 0 ? Number(choice.product.offer_price) : null;
      const expectedPrice = choice.product.product_variants.length ? (offer && Number(choice.product.price) > 0 ? Math.round(choice.price * offer / Number(choice.product.price)) : choice.price) : offer ?? choice.price;
      check('Importe real ignora precio alterado', Number(preference.items[0].unit_price), expectedPrice);
      check('Moneda de preferencia', preference.items[0].currency_id, 'ARS');
      check('Retorno y webhook apuntan al preview', new URL(preference.back_urls.success).origin === origin && new URL(preference.notification_url).origin === origin, true);
      const back = new URL(preference.back_urls.success);
      const statusBody = { order: back.searchParams.get('order'), token: back.searchParams.get('token') };
      const status = await post('/api/checkout/status', statusBody);
      check('Checkout nuevo queda pendiente', status.body?.status, 'pending');
      check('Importe guardado coincide', Number(status.body?.total), expectedPrice);
      const mismatch = await post('/api/checkout/status', { ...statusBody, token: '22222222-2222-4222-8222-222222222222' });
      check('Token de otro pedido no permite consultar', mismatch.status, 404);
      await writeFile(`backups/mercadopago-checkout-${choice.product.product_variants.length ? 'medida' : 'simple'}.json`, JSON.stringify({ url: url.href, back: back.href, order: statusBody.order }, null, 2));
      checkoutToInspect = url.href;
    }
  }
  const after = await catalog();
  check('La prueba no cambia catálogo ni stock', JSON.stringify(products) === JSON.stringify(after), true);
  if (checkoutToInspect && process.argv.includes('--inspect-checkout')) {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true });
    try {
      const page = await browser.newPage({ locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
      await page.goto(checkoutToInspect, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForFunction(() => document.body.innerText.trim().length > 40, {}, { timeout: 20000 }).catch(() => {});
      report.externalCheckout = { host: new URL(page.url()).hostname, path: new URL(page.url()).pathname, title: await page.title(), text: (await page.locator('body').innerText()).slice(0, 1600) };
      await page.screenshot({ path: 'backups/mercadopago-checkout-access-final.png', fullPage: true });
    } finally { await browser.close(); }
  }
}
await mkdir('backups', { recursive: true });
try { await main(); } catch (error) { report.error = error.message; process.exitCode = 1; }
await writeFile('backups/mercadopago-preview-validation.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
