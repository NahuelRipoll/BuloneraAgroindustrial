import Link from "next/link";
import { AdminAuthGate } from "@/components/admin-auth-gate";
import { CatalogBackupsAdmin } from "@/components/catalog-backups-admin";

export const metadata = { title: "Respaldos del catálogo | Bulonera Agroindustrial" };

export default function AdminBackupsPage() {
  return <main className="admin-page"><div className="container">
    <Link href="/admin" className="link admin-back">← Panel general</Link>
    <div className="admin-title"><span className="eyebrow">Administración</span><h1>Respaldos del catálogo</h1><p>Guardá copias y recuperá versiones anteriores de tus productos.</p></div>
    <AdminAuthGate><CatalogBackupsAdmin /></AdminAuthGate>
  </div></main>;
}
