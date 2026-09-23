import Link from "next/link";
import { ProductGallery } from "@/components/product-gallery";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, Truck } from "lucide-react";
import { ProductPurchase } from "@/components/product-purchase";
import { CartDrawer } from "@/components/cart-drawer";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { products } from "@/data/products";
import { getSupabaseProducts } from "@/lib/supabase-products";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getSupabaseProducts(products);
  const product = catalog.find((item) => item.slug === slug);

  if (!product) {
    notFound();
  }

  const related = catalog.filter((item) => item.id !== product.id).slice(0, 3);

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
            <ProductGallery name={product.name} images={product.images?.length ? product.images : [product.image]} />

            <div>
              <h1 style={{ fontSize: 38 }}>{product.name}</h1>
              <p style={{ color: "#737373" }}>SKU: {product.sku} | Marca: {product.brand}</p>

              <div className="buy-box">
                <ProductPurchase product={product} />
              </div>

              <div className="card" style={{ marginTop: 18 }}>
                <h3><Truck size={18} /> Calcular envío</h3>
                <p>Ingresá tu código postal al finalizar la compra o consultá por WhatsApp.</p>
                <a className="button-muted" href="https://wa.me/5492634564130">
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
