import Link from "next/link";
import { AdminAuthGate } from "@/components/admin-auth-gate";
import { StorefrontAdmin } from "@/components/storefront-admin";

export const metadata = { title: "Fotos de Nosotros | Bulonera Agroindustrial" };

export default function AdminStorefrontPage() {
  return <main className="admin-page"><div className="container">
    <Link className="link admin-back" href="/admin">← Panel general</Link>
    <div className="admin-title"><span className="eyebrow">Administración</span><h1>Fotos de Nosotros</h1><p>Mostrá el local, el equipo y la variedad de productos.</p></div>
    <AdminAuthGate><StorefrontAdmin /></AdminAuthGate>
  </div></main>;
}
