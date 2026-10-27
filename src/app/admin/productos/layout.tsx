import Link from "next/link";
import { AdminAuthGate } from "@/components/admin-auth-gate";
import { ProductAdmin } from "@/components/product-admin";

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <main className="admin-page"><div className="container products-workspace">
    <div className="admin-top-links"><Link className="link admin-back" href="/admin">← Panel general</Link><Link className="link admin-back" href="/admin/respaldos">Respaldos</Link><Link className="link admin-back" href="/">Volver al sitio</Link></div>
    <AdminAuthGate><ProductAdmin />{children}</AdminAuthGate>
  </div></main>;
}
