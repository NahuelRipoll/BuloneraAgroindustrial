import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { mercadoPago, paymentConfig } from "@/lib/mercadopago";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { token, origin, db } = paymentConfig();
    if (request.headers.get("origin") !== origin) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
    const raw = await request.text();
    if (raw.length > 16000) return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 400 });
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Pedido inválido." }, { status: 400 }); }
    const lines: { id: string; sku: string; quantity: number }[] = body?.items;
    if (!Array.isArray(lines) || !lines.length || lines.length > 50 || lines.some((line) => !line || typeof line.id !== "string" || typeof line.sku !== "string" || line.sku.length > 100 || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 10000) || new Set(lines.map((line) => line.id)).size !== lines.length) {
      return NextResponse.json({ error: "Revisá los productos y cantidades del carrito." }, { status: 400 });
    }
    const productIds = lines.map((line) => line.id.slice(0, 36));
    if (productIds.some((id) => !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))) return NextResponse.json({ error: "Publicá los productos en el catálogo de pruebas antes de pagarlos." }, { status: 409 });
    const seller = await mercadoPago<{ id: number; tags?: string[] }>(token, "/users/me");
    if (!seller.tags?.includes("test_user")) return NextResponse.json({ error: "Configurá una cuenta vendedora de prueba para continuar." }, { status: 503 });
    const { data: products, error } = await db.from("products").select("id,name,sku,price,stock,featured,offer_price,product_variants(id,sku,price,stock,options)").eq("published", true).in("id", productIds);
    if (error || !products) throw new Error("Catálogo no disponible");
    const items = [];
    for (const line of lines) {
      const product = products.find((p) => p.id === line.id || p.product_variants.some((v) => `${p.id}-${v.id}` === line.id));
      const variant = product?.product_variants.find((v) => `${product.id}-${v.id}` === line.id);
      const sellable = variant ?? product;
      if (!product || !sellable || sellable.sku !== line.sku || (!variant && product.product_variants.length) || sellable.stock < line.quantity) {
        return NextResponse.json({ error: "Un producto cambió o no tiene stock. Actualizá el carrito. Los borradores locales no se pueden pagar." }, { status: 409 });
      }
      const offer = product.featured && Number(product.offer_price) > 0 ? Number(product.offer_price) : null;
      const price = variant ? (offer && Number(product.price) > 0 ? Math.round(Number(variant.price) * offer / Number(product.price)) : Number(variant.price)) : offer ?? Number(product.price);
      if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ error: "Este producto requiere una cotización por WhatsApp." }, { status: 409 });
      items.push({ id: line.id, title: `${product.name}${variant ? ` — ${Object.values(variant.options ?? {}).join(" / ")}` : ""}`, quantity: line.quantity, unit_price: price, currency_id: "ARS", product_id: product.id, sku: sellable.sku });
    }
    const total = Math.round(items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0) * 100) / 100;
    const id = randomUUID();
    const statusToken = randomUUID();
    const { error: insertError } = await db.from("mercadopago_checkouts").insert({ id, status_token: statusToken, total, items, collector_id: String(seller.id) });
    if (insertError) throw new Error("No se pudo guardar el pedido");
    const back = `${origin}/compra/resultado?order=${id}&token=${statusToken}`;
    const preference = await mercadoPago<{ init_point: string }>(token, "/checkout/preferences", {
      items: items.map(({ id, title, quantity, unit_price, currency_id }) => ({ id, title, quantity, unit_price, currency_id })),
      external_reference: id,
      back_urls: { success: back, failure: back, pending: back },
      auto_return: "approved",
      notification_url: `${origin}/api/mercadopago/webhook`,
      expires: true,
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    const redirect = new URL(preference.init_point);
    if (redirect.protocol !== "https:" || !(redirect.hostname === "mercadopago.com.ar" || redirect.hostname.endsWith(".mercadopago.com.ar"))) throw new Error("URL de pago inválida");
    return NextResponse.json({ url: redirect.href });
  } catch (error) {
    console.error("Checkout:", error instanceof Error ? error.message : "Error inesperado");
    return NextResponse.json({ error: "No pudimos iniciar el pago. Probá nuevamente o consultanos por WhatsApp." }, { status: 503 });
  }
}
