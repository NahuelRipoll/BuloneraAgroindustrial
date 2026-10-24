import { NextResponse } from "next/server";
import { confirmPayment, paymentConfig } from "@/lib/mercadopago";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { db, origin } = paymentConfig();
    if (request.headers.get("origin") !== origin) return new NextResponse(null, { status: 403 });
    const { order, token, paymentId } = await request.json();
    if (typeof order !== "string" || typeof token !== "string" || order.length !== 36 || token.length !== 36) return new NextResponse(null, { status: 400 });
    const { data, error } = await db.from("mercadopago_checkouts").select("status,total").eq("id", order).eq("status_token", token).maybeSingle();
    if (error) throw error;
    if (!data) return new NextResponse(null, { status: 404 });
    if (data.status !== "paid" && paymentId) {
      if (typeof paymentId !== "string" || !/^\d{1,30}$/.test(paymentId)) return new NextResponse(null, { status: 400 });
      const paymentStatus = await confirmPayment(paymentId, order);
      return NextResponse.json({ status: paymentStatus === "approved" ? "paid" : paymentStatus, total: data.total }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No pudimos verificar el pago. Conservá el número de pedido y consultanos." }, { status: 503 });
  }
}
