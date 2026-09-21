import type { Metadata } from "next";
import { CartDrawer } from "@/components/cart-drawer";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ShopCatalog } from "@/components/shop-catalog";
import { products } from "@/data/products";
import { getSupabaseProducts } from "@/lib/supabase-products";

export const metadata: Metadata = { title: "Tienda | Bulonera Agroindustrial", description: "Productos de bulonería, herramientas y suministros agroindustriales." };
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const catalog = await getSupabaseProducts(products);
  return <><Header /><CartDrawer /><main>
    <section className="shop-hero"><div className="container"><span className="eyebrow">Tienda online</span><h1>Catálogo de productos</h1><p>Buscá por producto, código o medida y filtrá por categoría, marca y disponibilidad.</p></div></section>
    <section className="section"><div className="container"><ShopCatalog products={catalog} /></div></section>
  </main><Footer /></>;
}
