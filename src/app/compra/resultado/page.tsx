import Link from "next/link";
import { Suspense } from "react";
import { PaymentResult } from "@/components/payment-result";

export default function PaymentResultPage() {
  return <main className="container" style={{ padding: "60px 20px", maxWidth: 720 }}>
    <h1>Resultado de tu compra</h1>
    <Suspense fallback={<p>Verificando el pago…</p>}><PaymentResult /></Suspense>
    <Link className="button-outline" href="/tienda">Volver a la tienda</Link>
  </main>;
}
