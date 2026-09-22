"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Truck } from "lucide-react";
import { draftImages, draftToProduct, readLocalDrafts } from "@/lib/local-products";
import { ProductPurchase } from "@/components/product-purchase";

export function LocalProductDetail({ id }: { id: string }) {
  const [ready, setReady] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const draft = ready ? readLocalDrafts().find((item) => item.id === id && item.published) : undefined;
  useEffect(() => setReady(true), []);
  if (!ready) return <div className="card empty-state"><p>Cargando producto…</p></div>;
  if (!draft) return <div className="card empty-state"><h1>Producto no disponible</h1><p>Puede estar todavía en borrador o haber sido eliminado.</p><Link className="button" href="/tienda">Volver a la tienda</Link></div>;
  const product = draftToProduct(draft);
  const images = draftImages(draft);
  return <>
    <p><Link className="link" href="/tienda"><ArrowLeft size={16} /> Volver a la tienda</Link></p>
    <section className="product-layout">
      <div><div className="product-main-image"><img src={images[selectedImage] || product.image} alt={product.name} /></div>{images.length > 1 ? <div className="product-thumbnails">{images.map((image, index) => <button className={selectedImage === index ? "active" : ""} onClick={() => setSelectedImage(index)} key={image}><img src={image} alt={`${product.name} ${index + 1}`} /></button>)}</div> : null}</div>
      <div><h1 style={{ fontSize: 38 }}>{product.name}</h1><p style={{ color: "#737373" }}>SKU: {product.sku} | Marca: {product.brand}</p><div className="buy-box"><ProductPurchase product={product} /></div><div className="card" style={{ marginTop: 18 }}><h3><Truck size={18} /> Calcular envío</h3><p>Ingresá tu código postal al finalizar la compra o consultá por WhatsApp.</p><a className="button-muted" href="https://wa.me/5492634564130"><MessageCircle size={18} /> Consultar disponibilidad</a></div></div>
    </section>
    {Object.keys(product.specs).length ? <section className="section"><div className="section-head"><div><span className="eyebrow">Ficha técnica</span><h2>Especificaciones</h2></div></div><table className="table"><tbody>{Object.entries(product.specs).map(([key, value]) => <tr key={key}><th>{key}</th><td>{value}</td></tr>)}</tbody></table></section> : null}
  </>;
}
