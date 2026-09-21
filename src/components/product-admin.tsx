"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Download, FileUp, PackagePlus, Save, Trash2 } from "lucide-react";
import readXlsxFile from "read-excel-file/browser";

type DraftProduct = {
  id: string; slug: string; name: string; sku: string; brand: string; category: string;
  price: number; transferPrice: number; stock: number; image: string; badge: string;
  diameter: string; length: string; published: boolean;
};

const emptyProduct: Omit<DraftProduct, "id"> = {
  slug: "", name: "", sku: "", brand: "", category: "", price: 0, transferPrice: 0,
  stock: 0, image: "", badge: "", diameter: "", length: "", published: false,
};
const storageKey = "bulonera-product-drafts";

function rowToProduct(row: string[], columns: string[], rowNumber: number) {
  const value = (name: string) => row[columns.indexOf(name)] ?? "";
  const errors: string[] = [];
  ["slug", "nombre", "sku", "marca", "categoria"].forEach((name) => { if (!value(name)) errors.push(`Falta ${name}`); });
  const price = Number(value("precio")), transferPrice = Number(value("precio_transferencia")), stock = Number(value("stock"));
  if (!Number.isFinite(price) || price <= 0) errors.push("Precio inválido");
  if (!Number.isFinite(transferPrice) || transferPrice <= 0) errors.push("Precio de transferencia inválido");
  if (!Number.isInteger(stock) || stock < 0) errors.push("Stock inválido");
  const product: DraftProduct = { id: crypto.randomUUID(), slug: value("slug"), name: value("nombre"), sku: value("sku"), brand: value("marca"), category: value("categoria"),
    price, transferPrice, stock, diameter: value("diametro"), length: value("largo"), image: value("imagen_url"), badge: value("etiqueta"), published: ["si", "sí", "true", "1"].includes(value("publicado").toLowerCase()) };
  return { rowNumber, product, errors, warnings: [] as string[] };
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index], next = text[index + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = ""; }
    else field += char;
  }
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row); return rows;
}

function decimal(value: string) { return Number(value.replace(/\./g, "").replace(",", ".")); }
function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

export function ProductAdmin() {
  const [drafts, setDrafts] = useState<DraftProduct[]>([]);
  const [form, setForm] = useState(emptyProduct);
  const [preview, setPreview] = useState<ReturnType<typeof rowToProduct>[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("Todas");
  const [minimumStock, setMinimumStock] = useState(0);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => { const raw = localStorage.getItem(storageKey); if (raw) setDrafts(JSON.parse(raw)); }, []);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(drafts)); }, [drafts]);
  const categories = useMemo(() => [...new Set(preview.map((item) => item.product.category))].sort((a, b) => a.localeCompare(b)), [preview]);
  const brands = useMemo(() => ["Todas", ...new Set(preview.map((item) => item.product.brand))].sort((a, b) => a === "Todas" ? -1 : b === "Todas" ? 1 : a.localeCompare(b)), [preview]);
  const matchesExtraFilters = (item: ReturnType<typeof rowToProduct>) => (brandFilter === "Todas" || item.product.brand === brandFilter) && item.product.stock >= minimumStock;
  const categoryCounts = useMemo(() => new Map(categories.map((category) => [category, preview.filter((item) => item.product.category === category && matchesExtraFilters(item)).length])), [brandFilter, categories, minimumStock, preview]);
  const filteredCategories = useMemo(() => categories.filter((category) => category.toLowerCase().includes(categorySearch.trim().toLowerCase()) && (categoryCounts.get(category) ?? 0) > 0 && (!showSelectedOnly || selectedCategories.includes(category))), [categories, categoryCounts, categorySearch, selectedCategories, showSelectedOnly]);
  const validRows = useMemo(() => preview.filter((item) => item.errors.length === 0 && selectedCategories.includes(item.product.category) && matchesExtraFilters(item)), [brandFilter, minimumStock, preview, selectedCategories]);
  const visiblePreview = useMemo(() => preview.filter((item) => selectedCategories.includes(item.product.category) && matchesExtraFilters(item)), [brandFilter, minimumStock, preview, selectedCategories]);

  useEffect(() => { setSelectedCategories(categories); }, [categories]);

  function update(name: keyof typeof form, value: string | number | boolean) { setForm((current) => ({ ...current, [name]: value })); }
  function submit(event: FormEvent) {
    event.preventDefault();
    setDrafts((current) => [...current, { ...form, id: crypto.randomUUID() }]);
    setForm(emptyProduct); setNotice("Artículo guardado como borrador local.");
  }
  async function readCatalogFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = new TextDecoder("windows-1252").decode(await file.arrayBuffer());
        const rows = parseDelimited(text, ";");
        const erpColumns = ["Código", "Artículo", "Rubro", "Stock", "Marca"];
        const headerIndex = rows.findIndex((row) => erpColumns.every((column) => row.includes(column)));
        if (headerIndex < 0) throw new Error("No se encontró el encabezado esperado del listado de stock del ERP.");
        const columns = rows[headerIndex]; const get = (row: string[], name: string) => row[columns.indexOf(name)] ?? "";
        const productRows = rows.slice(headerIndex + 1).filter((row) => decimal(get(row, "Stock")) > 0);
        const parsed = productRows.map((row, index) => {
          const sku = get(row, "Código").trim();
          const name = get(row, "Artículo").trim();
          const product: DraftProduct = { id: crypto.randomUUID(), slug: `${slugify(name).slice(0, 55)}-${slugify(sku)}`, name, sku,
            brand: get(row, "Marca") || "Sin marca", category: get(row, "Rubro") || "Sin categoría", price: 0, transferPrice: 0,
            stock: Math.floor(decimal(get(row, "Stock"))), image: "", badge: "", diameter: "", length: "", published: false };
          return { rowNumber: headerIndex + index + 2, product, errors: [] as string[], warnings: ["Precio e imagen pendientes"] };
        });
        setPreview(parsed); setNotice(`${parsed.length} artículos con stock positivo detectados. Los precios y las imágenes quedan pendientes.`); return;
      }
      const workbook = await readXlsxFile(file);
      const articleRows = workbook.find((sheet) => sheet.sheet === "Articulos")?.data;
      const variantRows = workbook.find((sheet) => sheet.sheet === "Variantes")?.data;
      if (!articleRows || !variantRows) throw new Error("El archivo debe incluir las hojas Articulos y Variantes.");
      const articleHeaders = articleRows[2]?.map((cell) => String(cell ?? "").toLowerCase()) ?? [];
      const variantHeaders = variantRows[2]?.map((cell) => String(cell ?? "").toLowerCase()) ?? [];
      const requiredArticles = ["slug", "nombre", "marca", "categoria", "descripcion", "imagen_url", "etiqueta", "publicado"];
      const requiredVariants = ["slug_producto", "sku", "diametro", "largo", "precio", "precio_transferencia", "stock"];
      const missing = [...requiredArticles.filter((name) => !articleHeaders.includes(name)), ...requiredVariants.filter((name) => !variantHeaders.includes(name))];
      if (missing.length) throw new Error(`Faltan columnas: ${missing.join(", ")}`);
      const articleValue = (row: unknown[], name: string) => String(row[articleHeaders.indexOf(name)] ?? "").trim();
      const articles = new Map(articleRows.slice(3).filter((row) => row.some((cell) => cell !== null)).map((row) => [articleValue(row, "slug"), row]));
      const columns = ["slug", "nombre", "sku", "marca", "categoria", "precio", "precio_transferencia", "stock", "diametro", "largo", "imagen_url", "etiqueta", "publicado"];
      const value = (row: unknown[], name: string) => String(row[variantHeaders.indexOf(name)] ?? "").trim();
      const parsed = variantRows.slice(3).filter((row) => row.some((cell) => cell !== null)).map((row, index) => {
        const slug = value(row, "slug_producto"), article = articles.get(slug);
        if (!article) {
          const result = rowToProduct([slug, "", value(row, "sku")], columns, index + 4);
          result.errors.unshift(`No existe el slug ${slug} en Articulos`); return result;
        }
        return rowToProduct([slug, articleValue(article, "nombre"), value(row, "sku"), articleValue(article, "marca"), articleValue(article, "categoria"), value(row, "precio"), value(row, "precio_transferencia"), value(row, "stock"), value(row, "diametro"), value(row, "largo"), articleValue(article, "imagen_url"), articleValue(article, "etiqueta"), articleValue(article, "publicado")], columns, index + 4);
      });
      setPreview(parsed); setNotice("");
    } catch (error) {
      setPreview([]); setNotice(error instanceof Error ? error.message : "No se pudo leer el archivo Excel.");
    }
  }
  function importValid() {
    setDrafts((current) => [...current, ...validRows.map((item) => item.product)]); setPreview([]); setNotice(`${validRows.length} filas importadas como borradores locales.`);
  }
  function toggleCategory(category: string) {
    setSelectedCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  }
  function selectVisible(select: boolean) {
    setSelectedCategories((current) => select ? [...new Set([...current, ...filteredCategories])] : current.filter((category) => !filteredCategories.includes(category)));
  }
  function clearImportFilters() { setCategorySearch(""); setBrandFilter("Todas"); setMinimumStock(0); setShowSelectedOnly(false); }

  return <div className="admin-stack">
    <section className="admin-note"><strong>Preparación local</strong><span>Los datos quedan guardados en este navegador. La publicación real se habilitará al conectar la base de datos y el acceso de administradores.</span></section>
    <section className="card admin-card">
      <div className="admin-heading"><div><span className="eyebrow">Carga manual</span><h2><PackagePlus size={24} /> Nuevo artículo</h2></div></div>
      <form className="product-form" onSubmit={submit}>
        <label className="wide">Nombre<input required value={form.name} onChange={(e) => update("name", e.target.value)} /></label>
        <label>Slug<input required value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="bulon-hexagonal-g5" /></label>
        <label>SKU<input required value={form.sku} onChange={(e) => update("sku", e.target.value)} /></label>
        <label>Marca<input required value={form.brand} onChange={(e) => update("brand", e.target.value)} /></label>
        <label>Categoría<input required value={form.category} onChange={(e) => update("category", e.target.value)} /></label>
        <label>Precio<input required min="1" type="number" value={form.price || ""} onChange={(e) => update("price", Number(e.target.value))} /></label>
        <label>Transferencia<input required min="1" type="number" value={form.transferPrice || ""} onChange={(e) => update("transferPrice", Number(e.target.value))} /></label>
        <label>Stock<input required min="0" type="number" value={form.stock} onChange={(e) => update("stock", Number(e.target.value))} /></label>
        <label>Diámetro opcional<input value={form.diameter} onChange={(e) => update("diameter", e.target.value)} /></label>
        <label>Largo opcional<input value={form.length} onChange={(e) => update("length", e.target.value)} /></label>
        <label>Etiqueta<input value={form.badge} onChange={(e) => update("badge", e.target.value)} placeholder="Oferta" /></label>
        <label className="wide">URL de imagen<input value={form.image} onChange={(e) => update("image", e.target.value)} /></label>
        <label className="check-field wide"><input type="checkbox" checked={form.published} onChange={(e) => update("published", e.target.checked)} /> Marcar para publicar</label>
        <button className="button" type="submit"><Save size={18} /> Guardar borrador</button>
      </form>
    </section>

    <section className="card admin-card">
      <div className="admin-heading"><div><span className="eyebrow">Carga masiva</span><h2><FileUp size={24} /> Importar catálogo</h2></div><a className="button-outline" href="/plantillas/plantilla-articulos.xlsx" download><Download size={17} /> Descargar plantilla Excel</a></div>
      <p>Podés subir la plantilla Excel completa o el listado de stock CSV exportado directamente desde el ERP.</p>
      <p className="import-warning"><strong>Importante:</strong> subí el CSV original del ERP sin abrirlo ni volverlo a guardar con Excel. El panel lee la columna Código como texto y conserva los dígitos y ceros iniciales.</p>
      <label className="file-drop"><FileUp size={28} /><span>Seleccionar Excel o CSV del ERP</span><input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={readCatalogFile} /></label>
      {preview.length ? <>
        <div className="category-selector">
          <div className="category-selector-head"><div><strong>Seleccionar rubros</strong><span>{selectedCategories.length} de {categories.length} rubros seleccionados · {filteredCategories.length} visibles</span></div><div><button className="link-button" onClick={() => selectVisible(true)}>Marcar visibles</button><button className="link-button" onClick={() => selectVisible(false)}>Desmarcar visibles</button></div></div>
          <div className="import-filters">
            <label className="wide-filter"><span>Buscar rubro</span><input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Ej: bulones, herramientas, discos" /></label>
            <label><span>Marca</span><select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></label>
            <label><span>Stock mínimo</span><input type="number" min="0" value={minimumStock} onChange={(event) => setMinimumStock(Math.max(0, Number(event.target.value)))} /></label>
            <label className="selected-filter"><input type="checkbox" checked={showSelectedOnly} onChange={(event) => setShowSelectedOnly(event.target.checked)} /> Solo seleccionados</label>
            <button className="link-button clear-filter" onClick={clearImportFilters}>Limpiar filtros</button>
          </div>
          <div className="category-options">{filteredCategories.map((category) => <label key={category}><input type="checkbox" checked={selectedCategories.includes(category)} onChange={() => toggleCategory(category)} /><span title={category}>{category}</span><small>{categoryCounts.get(category)}</small></label>)}</div>
          {!filteredCategories.length ? <p className="no-filter-results">No hay rubros que coincidan con los filtros.</p> : null}
        </div>
        <div className="import-summary"><strong>{validRows.length} listas para importar</strong><span>{visiblePreview.filter((item) => item.errors.length > 0).length} con errores en los rubros seleccionados</span></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Fila</th><th>SKU</th><th>Artículo</th><th>Medida</th><th>Estado</th></tr></thead><tbody>
          {visiblePreview.slice(0, 250).map((item) => <tr key={item.rowNumber} className={item.errors.length ? "row-error" : ""}><td>{item.rowNumber}</td><td>{item.product.sku}</td><td>{item.product.name}</td><td>{[item.product.diameter, item.product.length].filter(Boolean).join(" × ") || "Simple"}</td><td>{item.errors.join(". ") || item.warnings.join(". ") || "Lista para importar"}</td></tr>)}
        </tbody></table></div><button className="button" disabled={!validRows.length} onClick={importValid}>Importar {validRows.length} filas válidas</button></> : null}
    </section>

    {notice ? <p className="admin-notice">{notice}</p> : null}
    <section className="card admin-card"><div className="admin-heading"><div><span className="eyebrow">Borradores</span><h2>{drafts.length} artículos cargados</h2></div></div>
      {drafts.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>SKU</th><th>Artículo</th><th>Marca</th><th>Medida</th><th>Stock</th><th>Estado</th><th></th></tr></thead><tbody>
        {drafts.map((item) => <tr key={item.id}><td>{item.sku}</td><td>{item.name}</td><td>{item.brand}</td><td>{[item.diameter, item.length].filter(Boolean).join(" × ") || "—"}</td><td>{item.stock}</td><td>{item.published ? "Para publicar" : "Borrador"}</td><td><button className="icon-button danger" onClick={() => setDrafts((current) => current.filter((draft) => draft.id !== item.id))} aria-label="Eliminar"><Trash2 size={17} /></button></td></tr>)}
      </tbody></table></div> : <p>Todavía no hay borradores.</p>}
    </section>
  </div>;
}
