import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  HardHat,
  Landmark,
  MapPin,
  MessageCircle,
  Nut,
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

export default function Home() {
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
              {products.map((product) => (
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
                ["Bulonería", "Hexagonales, allen, arandelas, tuercas y fijaciones especiales.", Nut],
                ["Herramientas", "Manuales, eléctricas, medición, abrasivos y accesorios.", Wrench],
                ["Agro y campo", "Repuestos, sujeción, acoples, cadenas y lubricantes.", Tractor],
                ["Industria y obra", "Anclajes, químicos, consumibles, EPP y mantenimiento.", HardHat],
              ].map(([title, text, Icon]) => (
                <article className="card" key={String(title)}>
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
            <div className="media-card">
              <img src="https://images.unsplash.com/photo-1581092162384-8987c1d64926?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" alt="Mostrador industrial" />
              <div className="stats">
                <div className="stat"><strong>15+</strong><span>años</span></div>
                <div className="stat"><strong>8k</strong><span>referencias</span></div>
                <div className="stat"><strong>24h</strong><span>respuesta</span></div>
              </div>
            </div>
            <div>
              <span className="eyebrow">Quiénes somos</span>
              <h2>Atención de mostrador con criterio técnico</h2>
              <p>Venta minorista, atención mayorista y asesoramiento de aplicación para compras donde importan resistencia, medida, norma, terminación y disponibilidad.</p>
              <p>La web queda preparada para crecer desde catálogo digital hacia e-commerce transaccional y portal B2B.</p>
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
                ["KLD", "/imagenes/marcas/kld.jpg"],
                ["Bosch", "/imagenes/marcas/bosch.svg"],
                ["Bahco", "/imagenes/marcas/bahco.svg"],
                ["Dogo", "/imagenes/marcas/dogo.png"],
                ["Stanley", "/imagenes/marcas/stanley.svg"],
                ["Bremen", "/imagenes/marcas/bremen.png"],
                ["Lusqtoff", "/imagenes/marcas/lusqtoff.png"],
                ["Gamma", "/imagenes/marcas/gamma.png"],
                ["BTA", "/imagenes/marcas/bta.jpg"],
              ].map(([brand, logo]) => (
                <div className={`brand-cell brand-${brand.toLowerCase()}`} key={brand}>
                  <img src={logo} alt={`Logo ${brand}`} />
                </div>
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

        <section id="asesoramiento" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Centro de asesoramiento</span>
                <h2>Guías rápidas para elegir sin fallar en la medida</h2>
              </div>
            </div>
            <div className="grid grid-3">
              <article className="card"><Ruler size={34} /><h3>Medidas y roscas</h3><p>M8 x 40 indica diámetro 8 mm y largo 40 mm. UNC y UNF corresponden a rosca unificada gruesa o fina.</p></article>
              <article className="card"><ShieldCheck size={34} /><h3>Resistencia</h3><p>8.8 para uso general, 10.9 o 12.9 para mayor exigencia, inoxidable para corrosión.</p></article>
              <article className="card"><FileSpreadsheet size={34} /><h3>Pedido por lista</h3><p>Enviá descripción, cantidad y observaciones. Cotizamos equivalencias si un ítem no está disponible.</p><a className="link" href="mailto:bulonera@bagroindustrial.com?subject=Solicitud%20de%20cotizaci%C3%B3n">Enviar lista</a></article>
            </div>
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
        <MessageCircle />
      </a>
      <Footer />
    </>
  );
}
