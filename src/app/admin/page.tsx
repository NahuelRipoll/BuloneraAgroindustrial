import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, ChevronRight, CreditCard, MapPin, Package, Star, Store, TrendingUp } from "lucide-react";
import { AdminAuthGate } from "@/components/admin-auth-gate";

export const metadata: Metadata = { title: "Panel de administración | Bulonera Agroindustrial" };

export default function AdminPage() {
  return <main className="admin-page"><div className="container">
    <Link className="link admin-back" href="/"><ArrowLeft size={16} /> Volver al sitio</Link>
    <div className="admin-title"><span className="eyebrow">Administración</span><h1>Panel general</h1><p>Gestioná el catálogo y el contenido comercial de la tienda desde un solo lugar.</p></div>
    <AdminAuthGate>
      <section className="admin-dashboard-grid">
        <Link className="admin-module-card" href="/admin/productos">
          <div className="admin-module-icon"><Package size={30} /></div>
          <div><span className="eyebrow">Catálogo</span><h2>Productos</h2><p>Cargá artículos, actualizá precios y stock, administrá imágenes, variantes y publicaciones.</p><div className="admin-module-tags"><span><Store size={14} /> Tienda</span><span><Star size={14} /> Ofertas</span></div></div>
          <ChevronRight className="admin-module-arrow" />
        </Link>
        <Link className="admin-module-card" href="/admin/analiticas">
          <div className="admin-module-icon analytics"><BarChart3 size={30} /></div>
          <div><span className="eyebrow">Información comercial</span><h2>Analíticas</h2><p>Revisá ventas, productos más vendidos, alertas de stock, medios de pago y ubicación de clientes.</p><div className="admin-module-tags"><span><TrendingUp size={14} /> Ventas</span><span><CreditCard size={14} /> Pagos</span><span><MapPin size={14} /> Ubicación</span></div></div>
          <ChevronRight className="admin-module-arrow" />
        </Link>
      </section>
    </AdminAuthGate>
  </div></main>;
}
