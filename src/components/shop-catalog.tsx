"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/data/products";
import { draftToProduct, readLocalDrafts } from "@/lib/local-products";
import { hasSupabaseConfig } from "@/lib/supabase";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function ShopCatalog({ products }: { products: Product[] }) {
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [brand, setBrand] = useState("Todas");
  const [stockOnly, setStockOnly] = useState(false);
  const [sort, setSort] = useState("featured");
  useEffect(() => {
    const refresh = () => setLocalProducts(hasSupabaseConfig() ? [] : readLocalDrafts().filter((draft) => draft.published).map(draftToProduct));
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  const catalog = useMemo(() => [...products, ...localProducts], [localProducts, products]);
  const categories = ["Todas", ...new Set(catalog.map((product) => product.category))];
  const brands = ["Todas", ...new Set(catalog.map((product) => product.brand))];

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    const result = catalog.filter((product) => {
      const searchable = normalize([product.name, product.sku, product.brand, product.category, ...Object.values(product.specs)].join(" "));
      const hasStock = product.variants ? product.variants.some((variant) => variant.stock > 0) : product.stock > 0;
      return (!term || searchable.includes(term)) && (category === "Todas" || product.category === category)
        && (brand === "Todas" || product.brand === brand) && (!stockOnly || hasStock);
    });
    return [...result].sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : 0);
  }, [brand, catalog, category, query, sort, stockOnly]);

  const reset = () => { setQuery(""); setCategory("Todas"); setBrand("Todas"); setStockOnly(false); setSort("featured"); };

  return <div className="shop-layout">
    <aside className="shop-filters card">
      <div className="filter-title"><h2><SlidersHorizontal size={20} /> Filtros</h2><button className="link-button" onClick={reset}>Limpiar</button></div>
      <label className="filter-field"><span>Buscar</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Producto, SKU o medida" /></label>
      <label className="filter-field"><span>Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="filter-field"><span>Marca</span><select value={brand} onChange={(event) => setBrand(event.target.value)}>{brands.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="check-field"><input type="checkbox" checked={stockOnly} onChange={(event) => setStockOnly(event.target.checked)} /> Solo con stock</label>
    </aside>
    <section>
      <div className="shop-toolbar">
        <p><strong>{filtered.length}</strong> productos</p>
        <label>Ordenar por <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="featured">Destacados</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option><option value="name">Nombre</option>
        </select></label>
      </div>
      {filtered.length ? <div className="grid shop-grid">{filtered.map((product) => <ProductCard product={product} key={product.id} />)}</div>
        : <div className="card empty-state"><X size={30} /><h2>Sin resultados</h2><p>Probá quitando algún filtro o usando otra búsqueda.</p><button className="button" onClick={reset}>Limpiar filtros</button></div>}
    </section>
  </div>;
}
