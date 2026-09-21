import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, Truck } from "lucide-react";
import { ProductPurchase } from "@/components/product-purchase";
import { CartDrawer } from "@/components/cart-drawer";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { getProductBySlug, products } from "@/data/products";
import { formatCurrency } from "@/lib/format";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const related = products.filter((item) => item.id !== product.id).slice(0, 3);

  return (
    <>
      <Header />
      <CartDrawer />
      <main className="product-page">
        <div className="container">
          <p>
            <Link className="link" href="/#catalogo">
              <ArrowLeft size={16} /> Volver al catálogo
            </Link>
          </p>

          <section className="product-layout">
            <div>
              <div className="product-main-image">
                <img src={product.image} alt={product.name} />
              </div>
            </div>

            <div>
              <h1 style={{ fontSize: 38 }}>{product.name}</h1>
              <p style={{ color: "#737373" }}>SKU: {product.sku} | Marca: {product.brand}</p>

              <div className="buy-box">
                {product.listPrice ? (
                  <div style={{ color: "#737373", textDecoration: "line-through" }}>
                    Precio de lista: {formatCurrency(product.listPrice)}
                  </div>
                ) : null}
                <ProductPurchase product={product} />
              </div>

              <div className="card" style={{ marginTop: 18 }}>
                <h3><Truck size={18} /> Calcular envío</h3>
                <p>Ingresá tu código postal al finalizar la compra o consultá por WhatsApp.</p>
                <a className="button-muted" href="https://wa.me/5492490000000">
                  <MessageCircle size={18} /> Consultar disponibilidad
                </a>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <div>
                <span className="eyebrow">Ficha técnica</span>
                <h2>Especificaciones</h2>
              </div>
            </div>
            <table className="table">
              <tbody>
                {Object.entries(product.specs).map(([key, value]) => (
                  <tr key={key}>
                    <th>{key}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="section">
            <div className="section-head">
              <div>
                <span className="eyebrow">También puede servirte</span>
                <h2>Productos relacionados</h2>
              </div>
            </div>
            <div className="grid grid-3">
              {related.map((item) => (
                <ProductCard product={item} key={item.id} />
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
