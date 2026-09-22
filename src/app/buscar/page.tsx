import Link from "next/link";
import { Search } from "lucide-react";
import { CartDrawer } from "@/components/cart-drawer";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { products } from "@/data/products";
import { getSupabaseProducts } from "@/lib/supabase-products";

export const dynamic = "force-dynamic";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = normalize(q.trim());
  const terms = term.split(/\s+/).filter(Boolean);
  const catalog = await getSupabaseProducts(products);
  const results = terms.length ? catalog.filter((product) => {
    const variants = product.variants?.flatMap((variant) => [variant.sku, ...Object.values(variant.options)]) ?? [];
    const searchable = normalize([product.name, product.sku, product.brand, product.category, ...Object.values(product.specs), ...variants].join(" "));
    return terms.every((word) => searchable.includes(word));
  }) : [];
  return <>
    <Header /><CartDrawer />
    <main className="section search-page"><div className="container">
      <span className="eyebrow">Catálogo</span>
      <h1><Search size={30} /> Resultados de búsqueda</h1>
      {q.trim() ? <p>{results.length} {results.length === 1 ? "resultado" : "resultados"} para <strong>“{q}”</strong>.</p>
        : <p>Ingresá un producto, código, marca, medida o aplicación en el buscador.</p>}
      {results.length > 0 ? <div className="grid grid-4 search-results">
        {results.map((product) => <ProductCard product={product} key={product.id} />)}
      </div> : q.trim() ? <div className="card empty-state">
        <h2>No encontramos coincidencias</h2><p>Probá con un término más general o consultanos para buscar una equivalencia.</p>
        <Link className="button" href="/#catalogo">Volver al catálogo</Link>
      </div> : null}
    </div></main><Footer />
  </>;
}
