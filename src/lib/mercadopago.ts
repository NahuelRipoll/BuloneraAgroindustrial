import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export function paymentConfig() {
  if (process.env.NEXT_PUBLIC_MERCADOPAGO_ENABLED !== "true") throw new Error("Pagos deshabilitados");
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = new URL(process.env.APP_URL || "http://invalid.local");
  if (!token || !secret || !url || !key || appUrl.protocol !== "https:") throw new Error("Configuración de pagos incompleta");
  return { token, secret, origin: appUrl.origin, db: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) };
}

export async function mercadoPago<T>(token: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Mercado Pago respondió ${response.status}`);
  return response.json();
}

export function validSignature(id: string, requestId: string, signature: string, secret: string) {
  const parts = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=")));
  if (!parts.ts || !/^\d+$/.test(parts.ts) || !/^[a-f0-9]{64}$/i.test(parts.v1 ?? "") || !requestId) return false;
  const expected = createHmac("sha256", secret).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${parts.ts};`).digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, "hex"));
}

export type Payment = { id: number; status: string; external_reference: string; transaction_amount: number; currency_id: string; live_mode: boolean; collector_id: number; payer?: { id?: number | string } };

export async function confirmPayment(paymentId: string, expectedOrderId?: string) {
  const { token, db } = paymentConfig();
  const payment = await mercadoPago<Payment>(token, `/v1/payments/${encodeURIComponent(paymentId)}`);
  if (expectedOrderId && payment.external_reference !== expectedOrderId) throw new Error("El pago no corresponde al pedido");
  // Checkout Pro puede devolver live_mode=true con cuentas de prueba.
  // Admitirlo únicamente con vendedor test_user y el comprador de prueba configurado.
  if (payment.live_mode !== false) {
    const buyerId = process.env.MERCADOPAGO_TEST_BUYER_ID;
    if (!buyerId || !/^\d+$/.test(buyerId) || String(payment.payer?.id) !== buyerId) throw new Error("Se rechazó un pago real o no verificable en el entorno de pruebas");
    const seller = await mercadoPago<{ id: number; tags?: string[] }>(token, "/users/me");
    if (!seller.tags?.includes("test_user") || String(seller.id) !== String(payment.collector_id)) throw new Error("Se rechazó un pago real o de otro vendedor en el entorno de pruebas");
  }
  if (payment.status !== "approved") return payment.status;
  const { error } = await db.rpc("confirm_test_mercadopago_payment", {
    p_order_id: payment.external_reference,
    p_payment_id: String(payment.id),
    p_amount: payment.transaction_amount,
    p_currency: payment.currency_id,
    p_collector_id: String(payment.collector_id),
  });
  if (error) throw new Error("No se pudo confirmar el pedido");
  return "approved";
}
