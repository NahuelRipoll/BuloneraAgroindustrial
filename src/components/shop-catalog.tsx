"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/data/products";
import { draftToProduct, readLocalDrafts } from "@/lib/local-products";
import { hasSupabaseConfig } from "@/lib/supabase";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const rubroGroups: Record<string, string[]> = {
  "Bulonería y fijaciones": ["bulon", "tornillo", "tuerca", "arandela", "remache", "abrazadera", "fijacion"],
  "Llaves y herramientas manuales": ["llave", "bocallave", "destornillador", "pinza", "alicate", "martillo"],
  "Mechas y perforación": ["mecha", "broca", "macho", "terraja", "taladro", "perforacion"],
  "Corte y abrasivos": ["disco", "sierra", "hoja", "lija", "abrasivo", "corte", "desbaste"],
  "Electricidad y taller": ["cable", "ficha", "electric", "caja", "iluminacion", "soldadura", "adhesivo", "pox"],
  "Agro, obra y mantenimiento": ["agro", "cadena", "lubric", "obra", "anclaje", "tractor", "mantenimiento"],
};

export function ShopCatalog({ products, initialBrand = "Todas", initialRubro = "Todos" }: { products: Product[]; initialBrand?: string; initialRubro?: string }) {
  const searchParams = useSearchParams();
  const brandFromUrl = searchParams.get("marca")?.trim() || initialBrand;
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [rubro, setRubro] = useState(initialRubro);
  const [category, setCategory] = useState("Todas");
  const [brand, setBrand] = useState(brandFromUrl);
  const [stockOnly, setStockOnly] = useState(false);
  const [sort, setSort] = useState("featured");
  useEffect(() => setBrand(brandFromUrl || "Todas"), [brandFromUrl]);
  useEffect(() => setRubro(initialRubro || "Todos"), [initialRubro]);
  useEffect(() => {
    const refresh = () => setLocalProducts(hasSupabaseConfig() ? [] : readLocalDrafts().filter((draft) => draft.published).map(draftToProduct));
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  const catalog = useMemo(() => [...products, ...localProducts], [localProducts, products]);
  const rubros = ["Todos", ...Object.keys(rubroGroups)];
  const categories = ["Todas", ...new Set(catalog.map((product) => product.category))];
  const catalogBrands = [...new Set(catalog.map((product) => product.brand))];
  const matchedCatalogBrand = catalogBrands.find((value) => normalize(value) === normalize(brand));
  const activeBrand = brand === "Todas" ? "Todas" : matchedCatalogBrand ?? brand;
  const brands = ["Todas", ...new Set([...(initialBrand !== "Todas" ? [activeBrand] : []), ...catalogBrands])];

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    const terms = term.split(/\s+/).filter(Boolean);
    const result = catalog.filter((product) => {
      const variants = product.variants?.flatMap((variant) => [variant.sku, ...Object.values(variant.options)]) ?? [];
      const searchable = normalize([product.name, product.sku, product.brand, product.category, ...Object.values(product.specs), ...variants].join(" "));
      const hasStock = product.variants ? product.variants.some((variant) => variant.stock > 0) : product.stock > 0;
      const groupTerms = rubroGroups[rubro];
      const matchesRubro = rubro === "Todos" || (groupTerms && groupTerms.some((word) => searchable.includes(normalize(word))));
      const matchesCategory = category === "Todas" || product.category === category;
      return (!terms.length || terms.every((word) => searchable.includes(word))) && matchesRubro && matchesCategory
        && (activeBrand === "Todas" || normalize(product.brand) === normalize(activeBrand)) && (!stockOnly || hasStock);
    });
    return [...result].sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : 0);
  }, [activeBrand, catalog, category, query, rubro, sort, stockOnly]);

  const reset = () => { setQuery(""); setRubro("Todos"); setCategory("Todas"); setBrand("Todas"); setStockOnly(false); setSort("featured"); };

  return <div className="shop-layout">
    <aside className="shop-filters card">
      <div className="filter-title"><h2><SlidersHorizontal size={20} /> Filtros</h2><button className="link-button" onClick={reset}>Limpiar</button></div>
      <label className="filter-field"><span>Buscar</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Producto, SKU o medida" /></label>
      <label className="filter-field"><span>Rubro</span><select value={rubro} onChange={(event) => setRubro(event.target.value)}>{rubros.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="filter-field"><span>Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="filter-field"><span>Marca</span><select value={activeBrand} onChange={(event) => setBrand(event.target.value)}>{brands.map((value) => <option key={value}>{value}</option>)}</select></label>
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
