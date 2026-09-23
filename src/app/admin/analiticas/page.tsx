import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { AdminAuthGate } from "@/components/admin-auth-gate";
import { AnalyticsAdmin } from "@/components/analytics-admin";

export const metadata: Metadata = { title: "Analíticas | Bulonera Agroindustrial" };

export default function AnalyticsPage() {
  return <main className="admin-page"><div className="container">
    <div className="admin-top-links"><Link className="link admin-back" href="/admin"><LayoutDashboard size={16} /> Panel general</Link><Link className="link admin-back" href="/"><ArrowLeft size={16} /> Volver al sitio</Link></div>
    <div className="admin-title"><span className="eyebrow">Administración</span><h1>Analíticas</h1><p>Ventas, inventario y comportamiento comercial.</p></div>
    <AdminAuthGate><AnalyticsAdmin /></AdminAuthGate>
  </div></main>;
}
