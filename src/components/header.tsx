"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { formatCurrency } from "@/lib/format";

const nav = [
  ["Tienda", "/tienda"], ["Categorías", "/#catalogo"], ["Ofertas", "/#ofertas"], ["Rubros", "/#rubros"],
  ["Nosotros", "/#nosotros"], ["Marcas", "/#marcas"], ["Asesoramiento", "/asesoramiento"],
  ["Contacto", "/#contacto"],
];

export function Header() {
  const { openCart, itemCount, subtotal } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <div className="topbar">-10% de descuento pagando por transferencia bancaria</div>
      <header className="header">
        <div className="container header-main">
          <button className="mobile-button" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}><Menu /></button>
          <Link href="/" className="logo-link"><img src="/imagenes/logo-principal.png" alt="Bulonera Agroindustrial" className="logo" /></Link>
          <form className="search" action="/buscar">
            <input name="q" aria-label="Buscar productos" placeholder="¿Qué estás buscando? Ej: bulón 8.8, discos, bocallaves" />
            <button type="submit" aria-label="Buscar"><Search size={20} /></button>
          </form>
          <div className="header-actions">
            <div className="account-link"><User size={24} color="#a3a3a3" /><span>Entrá / Registrate</span></div>
            <button className="cart-button" onClick={openCart}>
              <ShoppingBag size={28} />
              <span>Carrito <span className="cart-count">({itemCount})</span><br /><small>{formatCurrency(subtotal)}</small></span>
            </button>
          </div>
        </div>
        <nav className="nav"><div className="container nav-inner">
          {nav.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
        </div></nav>
      </header>
      {menuOpen ? <>
        <button className="menu-overlay" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />
        <aside className="mobile-menu" aria-label="Menú principal">
          <div className="cart-head"><h3><Menu size={20} /> Menú</h3><button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X /></button></div>
          <nav>{nav.map(([label, href]) => <Link href={href} key={href} onClick={() => setMenuOpen(false)}>{label}</Link>)}</nav>
        </aside>
      </> : null}
    </>
  );
}
