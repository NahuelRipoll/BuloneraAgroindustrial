"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function PaymentResult() {
  const params = useSearchParams();
  const order = params.get("order");
  const token = params.get("token");
  const paymentId = params.get("payment_id") ?? params.get("collection_id");
  const [message, setMessage] = useState("Verificando el pago con Mercado Pago…");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!order || !token) { setMessage("Faltan los datos del pedido. Consultanos si necesitás ayuda."); return; }
    fetch("/api/checkout/status", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order, token, paymentId: paymentId && paymentId !== "null" ? paymentId : undefined }), signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No pudimos verificar el pedido.");
      setMessage(data.status === "paid" ? "Pago de prueba confirmado. Tu pedido quedó registrado." : ["rejected", "cancelled"].includes(data.status) ? "El pago no se completó. Podés volver a intentarlo desde el carrito." : "Tu pago todavía está pendiente de confirmación. Podés volver a consultar en unos instantes.");
    }).catch((error) => { if (!controller.signal.aborted) setMessage(error.message || "No pudimos verificar el pago."); });
    return () => controller.abort();
  }, [order, token, paymentId, attempt]);
  return <div style={{ margin: "24px 0" }}>
    <p role="status">{message}</p>
    {order ? <p>Pedido: <strong>{order}</strong></p> : null}
    <p>Entorno de pruebas. El envío o retiro se coordina por WhatsApp; no se cobra envío en este checkout.</p>
    <button className="button-outline" onClick={() => setAttempt((value) => value + 1)}>Consultar estado</button>
  </div>;
}
