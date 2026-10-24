import { NextResponse } from "next/server";
import { confirmPayment, paymentConfig, validSignature } from "@/lib/mercadopago";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { secret } = paymentConfig();
    const url = new URL(request.url);
    const id = url.searchParams.get("data.id") ?? "";
    if (!/^\d+$/.test(id) || !validSignature(id, request.headers.get("x-request-id") ?? "", request.headers.get("x-signature") ?? "", secret)) return new NextResponse(null, { status: 401 });
    const body = await request.json();
    if (body.type !== "payment") return NextResponse.json({ received: true });
    if (String(body.data?.id) !== id) return new NextResponse(null, { status: 400 });
    await confirmPayment(id);
    return NextResponse.json({ received: true });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
