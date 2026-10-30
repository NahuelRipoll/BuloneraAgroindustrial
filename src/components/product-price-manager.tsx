"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalProductDraft } from "@/lib/local-products";
import { applyPriceChanges, buildPricePreview, percentageInputs, type PriceChange, type PriceInput, type PricePreview } from "@/lib/admin-price-preview";
import { downloadCatalogPriceTemplate, parsePricePasteText, readPriceRecordsFromFile } from "@/lib/admin-product-tools";
import { readPricePdf } from "@/lib/read-price-pdf";
import { formatCurrency } from "@/lib/format";

type Product = LocalProductDraft & { image: string };
const methods = [["pdf", "Listado PDF"], ["archivo", "Excel / CSV"], ["pegar", "Pegar precios"], ["porcentaje", "Porcentaje"], ["manual", "Grilla manual"]] as const;

export function ProductPriceManager({ products: allProducts, disabled, onSave, onBusyChange }: { products: Product[]; disabled: boolean; onSave: (products: Product[], progress: (message: string) => void, imported: boolean) => Promise<string[]>; onBusyChange: (busy: boolean) => void }) {
  const products = useMemo(() => allProducts.filter((product) => Boolean(product.remoteId)), [allProducts]);
  const [method, setMethod] = useState<string>("pdf");
  const [list, setList] = useState<1 | 2 | 3>(1);
  const [paste, setPaste] = useState("");
  const [percent, setPercent] = useState("10");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [manualPreview, setManualPreview] = useState(false);
  const [preview, setPreview] = useState<PricePreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => () => { abort.current?.abort(); }, []);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const brands = useMemo(() => [...new Set(products.map((item) => item.brand))].sort(), [products]);
  const categories = useMemo(() => [...new Set(products.map((item) => item.category))].sort(), [products]);
  const changes = preview?.changes || [];
  const filtered = changes.filter((item) => (!brand || item.brand === brand) && (!category || item.category === category) && (!search || `${item.sku} ${item.name}`.toLowerCase().includes(search.toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * 50, currentPage * 50 + 50);
  const chosen = changes.filter((item) => selected.has(item.key));
  function prepare(inputs: PriceInput[], label: string) {
    const result = buildPricePreview(products, inputs);
    setManualPreview(false); setPreview(result); setSelected(new Set(result.changes.map((item) => item.key))); setPage(0); setSource(label);
    setMessage(`${result.changes.length} precios diferentes para revisar. Todavía no se guardó ningún cambio.`);
  }
  async function run(action: () => Promise<void> | void) {
    if (lock.current || disabled) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo completar la operación."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function read(file?: File) {
    if (!file) return;
    await run(async () => {
      if (file.size > 30 * 1024 * 1024) throw new Error("El archivo puede pesar hasta 30 MB.");
      setMessage("Leyendo archivo…");
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const controller = new AbortController(); abort.current = controller;
        const parsed = await readPricePdf(file, list, setMessage, controller.signal).finally(() => { abort.current = null; });
        prepare(parsed.rows, `${file.name} · Lista ${list}`);
        setMessage(`${parsed.pages} páginas leídas. ${parsed.rows.length} precios extraídos; ${parsed.rejected} filas con precio cero o lectura dudosa excluidas.${parsed.undetected ? ` ${parsed.undetected} páginas sin columnas reconocibles.` : ""} Revisá las coincidencias antes de guardar.`);
      } else prepare(await readPriceRecordsFromFile(file, list), `${file.name} · Lista ${list} (si contiene varias listas)`);
    });
  }
  function manual() {
    const changes: PriceChange[] = products.flatMap((product) => (product.variants?.length ? product.variants.map((variant, index) => ({ ...variant, variantIndex: index })) : [{ ...product, variantIndex: null }]).map((row) => ({ key: `${product.id}:${row.variantIndex ?? "base"}`, productId: product.id, variantIndex: row.variantIndex, sku: row.sku, name: product.name, brand: product.brand, category: product.category, before: row.price, after: row.price })));
    setManualPreview(true); setPreview({ changes, unchanged: 0, invalid: 0, conflicts: [], unmatched: [] }); setSelected(new Set()); setPage(0); setSource("Edición manual"); setMessage("Editá los precios nuevos; las filas modificadas se seleccionan automáticamente.");
  }
  async function save() {
    await run(async () => {
      const next = applyPriceChanges(products, chosen, manualPreview).filter((product) => chosen.some((item) => item.productId === product.id)).map((product) => ({ ...product, image: product.image || "" }));
      const saved = await onSave(next, setMessage, !manualPreview);
      setPreview((current) => current ? { ...current, changes: current.changes.filter((item) => !saved.includes(item.productId)) } : current);
      setSelected((current) => new Set([...current].filter((key) => !chosen.some((item) => saved.includes(item.productId) && item.key === key))));
      const failed = next.length - saved.length;
      setMessage(`${saved.length} artículos guardados.${failed ? ` ${failed} no se guardaron y siguen seleccionados para reintentar. Revisá el aviso del panel.` : ""}`);
    });
  }
  return <section className="card admin-card price-manager">
    <div className="admin-heading"><div><span className="eyebrow">Actualizar sin transcribir</span><h2>Precios del catálogo</h2></div><button className="button-outline" disabled={disabled || busy} onClick={() => downloadCatalogPriceTemplate(products)}>Descargar listado de códigos</button></div>
    <p>Solo se actualizan códigos de artículos y medidas ya guardados en el catálogo. Los demás se omiten y no se crean artículos nuevos. Los precios protegidos se excluyen de importaciones y porcentajes; podés editarlos desde Catálogo o Grilla manual.</p>
    <div className="price-methods" role="group" aria-label="Forma de actualizar precios">{methods.map(([id, title]) => <button key={id} aria-pressed={method === id} disabled={busy} onClick={() => { setMethod(id); setError(""); }}>{title}</button>)}</div>
    <fieldset disabled={disabled || busy}>
      {(method === "pdf" || method === "archivo" || method === "pegar") && <p className="admin-notice"><strong>Si falta un precio o no se puede leer:</strong> las filas sin precio, con precio cero o con errores de lectura se excluyen de la revisión y conservan el precio actual del catálogo. Podés corregir el archivo y volver a importarlo, o cargar el precio desde Grilla manual. Si el artículo todavía no tiene precio y el archivo trae uno válido, aparecerá para aplicar.</p>}
      {method === "pdf" && <div className="price-input-panel"><h3>Leer precios del PDF del ERP</h3><p>Se leen los códigos y la lista elegida. El PDF se procesa en tu navegador. Los precios cero y las filas dudosas quedan excluidos.</p><div className="workspace-toolbar"><label>Lista a utilizar<select value={list} onChange={(event) => setList(Number(event.target.value) as 1 | 2 | 3)}><option value={1}>Lista 1</option><option value={2}>Lista 2</option><option value={3}>Lista 3</option></select></label><label className="button gallery-upload">Seleccionar PDF<input type="file" accept=".pdf,application/pdf" onChange={(event) => { void read(event.target.files?.[0]); event.target.value = ""; }} /></label></div></div>}
      {method === "archivo" && <div className="price-input-panel"><h3>Importar Excel o CSV</h3><p>Admite Código y un Precio, o Código y las tres listas. Conservá los códigos como texto. La columna Stock actual no modifica existencias al actualizar precios.</p><div className="workspace-toolbar"><label>Lista a utilizar<select value={list} onChange={(event) => setList(Number(event.target.value) as 1 | 2 | 3)}><option value={1}>Lista 1</option><option value={2}>Lista 2</option><option value={3}>Lista 3</option></select></label><label className="button gallery-upload">Seleccionar archivo<input type="file" accept=".xlsx,.csv" onChange={(event) => { void read(event.target.files?.[0]); event.target.value = ""; }} /></label></div></div>}
      {method === "pegar" && <div className="price-input-panel"><h3>Pegar códigos y precios</h3><textarea aria-label="Listado de códigos y precios" value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={'00123\t2500,50\n00124\t2800'} /><button className="button-outline" disabled={!paste.trim()} onClick={() => void run(() => prepare(parsePricePasteText(paste), "Precios pegados"))}>Revisar coincidencias</button></div>}
      <div className="workspace-toolbar"><label>Marca<select value={brand} onChange={(event) => { setBrand(event.target.value); setPage(0); }}><option value="">Todas las marcas</option>{brands.map((value) => <option key={value}>{value}</option>)}</select></label><label>Rubro<select value={category} onChange={(event) => { setCategory(event.target.value); setPage(0); }}><option value="">Todos los rubros</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>{method === "porcentaje" ? <><label>Ajuste porcentual<input type="number" min="-99.99" max="1000" step="0.01" value={percent} onChange={(event) => setPercent(event.target.value)} /></label><button className="button-outline" onClick={() => void run(() => { if (!percent.trim()) throw new Error("Ingresá un porcentaje."); prepare(percentageInputs(products, Number(percent), brand, category), `Ajuste ${percent}%`); })}>Revisar ajuste</button></> : <label>Buscar código o artículo<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></label>}{method === "manual" && <button className="button-outline" onClick={manual}>Abrir grilla de precios</button>}</div>
    </fieldset>
    <p role="status">{message || (disabled ? "Cargando catálogo…" : "Elegí cómo querés actualizar los precios.")}</p>{error && <p role="alert" className="admin-notice">{error}</p>}
    {preview && <>
      <div className="price-review-head"><div><span className="eyebrow">Revisión antes de guardar</span><h3>{source}</h3><p>{changes.length} precios del catálogo para revisar · {preview.unchanged} sin cambios · {preview.unmatched.length} códigos ajenos al catálogo omitidos · {preview.conflicts.length} códigos ambiguos · {preview.invalid} filas inválidas</p></div></div>
      {!changes.length && <p>No hay cambios de precio para aplicar a los artículos del catálogo con este listado.</p>}
      {Boolean(preview.protectedCodes?.length) && <details><summary>{preview.protectedCodes?.length} códigos protegidos omitidos</summary><p>{preview.protectedCodes?.join(", ")}</p></details>}
      {preview.conflicts.length > 0 && <details className="entry-paste"><summary>Ver códigos del catálogo que requieren revisión</summary><p>Repetidos con distintos precios o ambiguos: {preview.conflicts.join(", ")}</p></details>}
      <fieldset disabled={busy || disabled}>
        <div className="workspace-toolbar"><button className="button-outline" onClick={() => setSelected(new Set(filtered.filter((item) => item.after !== item.before).map((item) => item.key)))}>Seleccionar cambios filtrados</button><button className="button-muted" onClick={() => setSelected(new Set())}>Desmarcar todos</button><span>Transferencia: 10% de descuento sobre el nuevo precio.</span></div>
        <div className="admin-table-wrap"><table className="admin-table price-review-table"><thead><tr><th>Aplicar</th><th>Código</th><th>Artículo / medida</th><th>Actual</th><th>Nuevo</th><th>Diferencia</th><th>Página PDF</th></tr></thead><tbody>{visible.map((item) => <tr key={item.key} className={selected.has(item.key) ? "price-row-selected" : ""}>
          <td><input type="checkbox" aria-label={`Aplicar precio de ${item.sku}`} checked={selected.has(item.key)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(item.key); else next.delete(item.key); return next; })} /></td><td>{item.sku}</td><td>{item.name}</td><td>{formatCurrency(item.before)}</td><td><input aria-label={`Nuevo precio de ${item.sku}`} type="number" min="0.01" step="0.01" value={Number.isFinite(item.after) ? item.after : ""} onChange={(event) => { const after = Number(event.target.value); setPreview((current) => current ? { ...current, changes: current.changes.map((row) => row.key === item.key ? { ...row, after } : row) } : current); setSelected((current) => new Set([...current, item.key])); }} /></td><td>{item.before > 0 ? `${((item.after / item.before - 1) * 100).toFixed(1)}%` : "Sin precio previo"}</td><td>{item.page || "—"}</td>
        </tr>)}</tbody></table></div>
        <div className="workspace-pagination"><button className="button-outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>{filtered.length} filas · Página {currentPage + 1} de {pages}</span><button className="button-outline" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Siguiente</button></div>
        <div className="workspace-savebar"><span><strong>{chosen.length}</strong> precios seleccionados en {new Set(chosen.map((item) => item.productId)).size} artículos. Los filtros no desmarcan selecciones previas.</span><button className="button" disabled={!chosen.length || chosen.some((item) => !Number.isFinite(item.after) || item.after <= 0)} onClick={() => void save()}>Guardar precios seleccionados</button></div>
      </fieldset>
    </>}
    {busy && <p className="admin-notice">Esperá a que termine antes de cambiar de módulo.{abort.current && <button className="link-button" onClick={() => abort.current?.abort()}>Cancelar lectura del PDF</button>}</p>}
  </section>;
}
