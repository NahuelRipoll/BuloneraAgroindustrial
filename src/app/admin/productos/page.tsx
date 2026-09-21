import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductAdmin } from "@/components/product-admin";

export const metadata: Metadata = { title: "Administrar productos | Bulonera Agroindustrial" };

export default function AdminProductsPage() {
  return <main className="admin-page"><div className="container">
    <Link className="link admin-back" href="/"><ArrowLeft size={16} /> Volver al sitio</Link>
    <div className="admin-title"><span className="eyebrow">Administración</span><h1>Productos</h1><p>Carga manual y masiva del catálogo.</p></div>
    <ProductAdmin />
  </div></main>;
}
