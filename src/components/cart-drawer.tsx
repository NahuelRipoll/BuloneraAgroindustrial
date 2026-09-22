"use client";

import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { formatCurrency } from "@/lib/format";

export function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeItem, subtotal, transferTotal, clearCart } = useCart();

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
          <a className={`button${items.length === 0 ? " disabled" : ""}`} style={{ width: "100%", marginBottom: 10 }}
            href={items.length > 0 ? checkoutUrl : undefined} target="_blank" rel="noreferrer" aria-disabled={items.length === 0}>
            Iniciar compra
          </a>
          <button className="button-outline" style={{ width: "100%" }} onClick={clearCart}>
            Vaciar carrito
          </button>
        </div>
      </aside>
    </>
  );
}
