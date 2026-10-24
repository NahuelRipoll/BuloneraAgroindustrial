"use client";

import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { formatCurrency } from "@/lib/format";
import { useState } from "react";

export function CartDrawer() {
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const { items, isOpen, closeCart, updateQuantity, removeItem, subtotal, transferTotal, clearCart } = useCart();

  async function checkout() {
    if (paying) return;
    setPaying(true);
    setPaymentError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map(({ product, quantity }) => ({ id: product.id, sku: product.sku, quantity })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No pudimos iniciar el pago.");
      window.location.assign(data.url);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "No pudimos iniciar el pago.");
      setPaying(false);
    }
  }

  if (!isOpen) return null;

  const orderText = [
    "Hola, quiero consultar por este pedido:",
    ...items.map((line) => `- ${line.quantity} x ${line.product.name} (${formatCurrency(line.product.price)} c/u)`),
    `Subtotal: ${formatCurrency(subtotal)}`,
    `Total por transferencia: ${formatCurrency(transferTotal)}`,
  ].join("\n");
  const checkoutUrl = `https://wa.me/5492634564130?text=${encodeURIComponent(orderText)}`;

  return (
    <>
      <div className="cart-overlay" onClick={closeCart} />
      <aside className="cart-drawer" aria-label="Carrito">
        <div className="cart-head">
          <h3>
            <ShoppingCart size={20} /> Mi Carrito
          </h3>
          <button className="icon-button" onClick={closeCart} aria-label="Cerrar carrito">
            <X />
          </button>
        </div>

        <div className="cart-items">
          {items.length === 0 ? (
            <div className="card" style={{ textAlign: "center" }}>
              <ShoppingCart size={48} />
              <p>Tu carrito está vacío.</p>
            </div>
          ) : (
            items.map((line) => (
              <article className="cart-item" key={line.product.id}>
                <img src={line.product.image} alt={line.product.name} />
                <div>
                  <h4 style={{ fontSize: 14 }}>{line.product.name}</h4>
                  <strong className="transfer">{formatCurrency(line.product.price)}</strong>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                    <div className="qty">
                      <button onClick={() => updateQuantity(line.product.id, line.quantity - 1)} aria-label="Restar unidad">
                        <Minus size={14} />
                      </button>
                      <span>{line.quantity}</span>
                      <button onClick={() => updateQuantity(line.product.id, line.quantity + 1)} aria-label="Sumar unidad">
                        <Plus size={14} />
                      </button>
                    </div>
                    <button className="icon-button" onClick={() => removeItem(line.product.id)} aria-label="Quitar producto">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="cart-foot">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span>Subtotal</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <small>Pagando por transferencia: </small>
            <strong className="transfer">{formatCurrency(transferTotal)}</strong>
          </div>
          {process.env.NEXT_PUBLIC_MERCADOPAGO_ENABLED === "true" ? <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span>Total con Mercado Pago</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <p style={{ fontSize: 13 }}>Te llevamos a Mercado Pago para elegir cómo pagar y completar la compra. Después podrás volver al sitio para consultar el resultado.</p>
            <p style={{ fontSize: 13 }}>Pago de prueba · Envío o retiro a coordinar, sin costo de envío incluido.</p>
            <button className="button" style={{ width: "100%", marginBottom: 10 }} disabled={paying || items.length === 0} aria-busy={paying} onClick={checkout}>
              {paying ? "Redirigiendo a Mercado Pago…" : "Ir a Mercado Pago (prueba)"}
            </button>
            {paymentError ? <p role="alert">{paymentError}</p> : null}
          </> : null}
          <a className={`button${items.length === 0 ? " disabled" : ""}`} style={{ width: "100%", marginBottom: 10 }}
            href={items.length > 0 ? checkoutUrl : undefined} target="_blank" rel="noreferrer" aria-disabled={items.length === 0}>
            Consultar pedido por WhatsApp
          </a>
          <button className="button-outline" style={{ width: "100%" }} onClick={clearCart}>
            Vaciar carrito
          </button>
        </div>
      </aside>
    </>
  );
}
