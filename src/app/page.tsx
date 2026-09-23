import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  HardHat,
  Landmark,
  MapPin,
  MessageCircle,
  Ruler,
  ShieldCheck,
  Tractor,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";
import { CartDrawer } from "@/components/cart-drawer";
import { ContactForm } from "@/components/contact-form";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { products } from "@/data/products";
import { getFeaturedProducts } from "@/lib/supabase-products";

function BoltIcon({ size = 34 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="M8 22 18 12h12l10 10v20L30 52H18L8 42V22Z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
    <path d="M40 27h16v10H40M46 27v10M52 27v10" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="24" cy="32" r="7" stroke="currentColor" strokeWidth="4" />
  </svg>;
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const featuredProducts = await getFeaturedProducts(products);
  return (
    <>
      <Header />
      <CartDrawer />

      <main>
        <section className="hero">
          <img src="https://images.unsplash.com/photo-1530124566582-a618bc2615dc?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" alt="Depósito industrial" />
          <div className="container hero-content">
            <span className="eyebrow">Bulonera Agroindustrial</span>
            <h1>Expertos en fijación</h1>
            <p>Suministros agroindustriales, herramientas y bulonería de alta resistencia para campo, taller e industria.</p>
            <Link className="button" href="/tienda">
              Ver catálogo
            </Link>
          </div>
        </section>

        <section className="service-strip">
          <div className="container grid grid-3">
            <div className="service-item">
              <Truck />
              <div>
                <h3>Envíos a todo el país</h3>
                <p>Despachos por correo y transporte local.</p>
              </div>
            </div>
            <div className="service-item">
              <Landmark />
              <div>
                <h3>10% por transferencia</h3>
                <p>Precio destacado en productos seleccionados.</p>
              </div>
            </div>
            <div className="service-item">
              <ShieldCheck />
              <div>
                <h3>Asesoramiento técnico</h3>
                <p>Elegimos medida, resistencia y terminación.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="ofertas" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Ofertas</span>
                <h2><Zap size={26} /> Ofertas destacadas</h2>
              </div>
              <Link className="link" href="/tienda">Ver catálogo completo</Link>
            </div>
            <div className="grid grid-4">
              {featuredProducts.map((product) => (
                <ProductCard product={product} key={product.id} />
              ))}
            </div>
          </div>
        </section>

        <section id="catalogo" className="section alt">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Catálogo técnico</span>
                <h2>Comprá por familia, medida o aplicación</h2>
              </div>
            </div>
            <div className="grid grid-4">
              {[
                ["Bulonería", "Hexagonales, allen, arandelas, tuercas y fijaciones especiales.", BoltIcon],
                ["Herramientas", "Manuales, eléctricas, medición, abrasivos y accesorios.", Wrench],
                ["Agro y campo", "Repuestos, sujeción, acoples, cadenas y lubricantes.", Tractor],
                ["Industria y obra", "Anclajes, químicos, consumibles, EPP y mantenimiento.", HardHat],
              ].map(([title, text, Icon]) => (
                <article className="card catalog-family-card" key={String(title)}>
                  <Icon size={34} />
                  <h3 style={{ marginTop: 16 }}>{String(title)}</h3>
                  <p>{String(text)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="rubros" className="section">
          <div className="container grid grid-2">
            <Link href="#catalogo" className="banner">
              <img src="https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" alt="Herramientas" />
              <h3>Profesión y oficio</h3>
            </Link>
            <Link href="#catalogo" className="banner">
              <img src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" alt="Agroindustria" />
              <h3>Agroindustria</h3>
            </Link>
          </div>
        </section>

        <section id="nosotros" className="section alt">
          <div className="container grid grid-2" style={{ alignItems: "center" }}>
            <div className="media-card storefront-card">
              <img className="storefront-photo" src="/imagenes/portada-local.jpeg" alt="Frente del local de Bulonera Agroindustrial" />
              <div className="stats">
                <div className="stat"><strong>3+</strong><span>años</span></div>
                <div className="stat"><strong>Gran</strong><span>variedad de stock</span></div>
                <div className="stat schedule-stat"><strong>HORARIO</strong><span>8:00–13:00<br />15:00–19:30</span></div>
              </div>
            </div>
            <div>
              <span className="eyebrow">Quiénes somos</span>
              <h2>Atención de mostrador con criterio técnico</h2>
              <p>Venta minorista, atención mayorista y asesoramiento de aplicación para compras donde importan resistencia, medida, norma, terminación y disponibilidad.</p>
              <p><CheckCircle2 size={18} /> Pedido por norma, medida, material o aplicación.</p>
              <p><CheckCircle2 size={18} /> Retiro por mostrador, transporte local o correo.</p>
            </div>
          </div>
        </section>

        <section id="marcas" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Marcas y proveedores</span>
                <h2>Líneas para trabajo profesional y reposición constante</h2>
              </div>
            </div>
            <div className="grid brand-grid">
              {[
                ["Bosch", "/imagenes/marcas/bosch.svg"],
                ["Bahco", "/imagenes/marcas/bahco.svg"],
                ["Dogo", "/imagenes/marcas/dogo.png"],
                ["Stanley", "/imagenes/marcas/stanley.svg"],
                ["Bremen", "/imagenes/marcas/bremen.png"],
                ["Lusqtoff", "/imagenes/marcas/lusqtoff.png"],
                ["Gamma", "/imagenes/marcas/gamma.png"],
                ["BTA", "/imagenes/marcas/bta.jpg"],
                ["Dowen Pagio", "/imagenes/marcas/dowen-pagio.png"],
                ["Workpro", "/imagenes/marcas/workpro.png"],
              ].map(([brand, logo]) => (
                <Link href={`/tienda?marca=${encodeURIComponent(brand)}`} className={`brand-cell brand-${brand.toLowerCase()}`} key={brand} aria-label={`Ver productos ${brand}`}>
                  <img src={logo} alt={`Logo ${brand}`} />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="empresas" className="section alt">
          <div className="container grid grid-2">
            <article className="card">
              <ClipboardList size={34} />
              <h2>Cotización para empresas</h2>
              <p>Armá pedidos por caja cerrada, cantidad mayorista o lista de materiales. Respondemos con disponibilidad, precio por volumen y despacho.</p>
              <a className="button" href="https://wa.me/5492634564130">
                <MessageCircle size={18} /> Solicitar cotización
              </a>
            </article>
            <article className="card">
              <Ruler size={34} />
              <h2>Referencia técnica rápida</h2>
              <table className="table">
                <tbody>
                  <tr><td>Acero 8.8</td><td>Maquinaria y montaje general</td></tr>
                  <tr><td>Inox A2/A4</td><td>Exterior, humedad, alimentos</td></tr>
                  <tr><td>Galvanizado</td><td>Obra y agro a la intemperie</td></tr>
                </tbody>
              </table>
            </article>
          </div>
        </section>

        <section id="contacto" className="section alt">
          <div className="container grid grid-2">
            <div>
              <span className="eyebrow">Sucursal y contacto</span>
              <h2>Atención comercial para mostrador, campo y empresas</h2>
              <div className="card">
                <h3><MapPin size={20} /> Casa central</h3>
                <p>Ruta Provincial 22 (Acceso Este), KM 1023, sobre lateral norte, Rodeo del Medio, Maipú, Mendoza. Retiro por mostrador, coordinación de transporte y atención a cuentas comerciales.</p>
                <p><Truck size={18} /> Envíos por transporte local, Andreani o Correo Argentino.</p>
              </div>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>

      <a className="floating-whatsapp" href="https://wa.me/5492634564130" aria-label="Contactar por WhatsApp">
        <svg className="whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2a9.84 9.84 0 0 0-8.51 14.76L2 22l5.38-1.41A9.99 9.99 0 0 0 12.04 22 10 10 0 0 0 12.04 2Zm0 18.18a8.12 8.12 0 0 1-4.14-1.13l-.3-.18-3.19.84.85-3.1-.2-.32a8.15 8.15 0 1 1 6.98 3.89Zm4.47-6.1c-.24-.12-1.45-.71-1.67-.79-.23-.08-.39-.12-.55.12-.16.25-.63.79-.77.95-.14.17-.28.19-.53.07-.24-.12-1.03-.38-1.96-1.21a7.38 7.38 0 0 1-1.36-1.69c-.14-.24-.02-.37.1-.49.11-.11.25-.28.37-.42.12-.14.16-.25.24-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.75-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.31-.23.24-.86.84-.86 2.05 0 1.21.88 2.38 1 2.54.13.16 1.74 2.65 4.21 3.72.59.25 1.05.41 1.4.52.6.19 1.13.16 1.56.1.47-.07 1.45-.6 1.65-1.17.21-.57.21-1.06.15-1.17-.06-.1-.22-.16-.47-.28Z" /></svg>
      </a>
      <Footer />
    </>
  );
}
