"use client";

import { useEffect, useRef, useState } from "react";
import type { LocalProductDraft } from "@/lib/local-products";
import { blankEntry, entryFields, entryUsed, parseEntryPaste, prepareEntryRows, type EntryRow } from "@/lib/quick-product-entry";
import { optimizeImage } from "@/lib/admin-product-tools";

const storageKey = "bulonera-quick-entry";
const labels = ["Código / SKU", "Artículo", "Marca", "Rubro", "Precio", "Stock", "Diámetro", "Largo"];

export function ProductQuickEntry({ products, disabled, onCreate }: { products: LocalProductDraft[]; disabled: boolean; onCreate: (products: (LocalProductDraft & { image: string })[]) => Promise<{ saved: number; total: number }> }) {
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [ready, setReady] = useState(false);
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [group, setGroup] = useState(true);
  const [paste, setPaste] = useState("");
  const [notice, setNotice] = useState("");
  const [processing, setProcessing] = useState(false);
  const imageLock = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Array.isArray(saved) && saved.every((row) => row && typeof row.id === "string" && entryFields.every((field) => typeof row[field] === "string") && typeof row.image === "string")) setRows(saved);
      else setRows(Array.from({ length: 5 }, () => blankEntry()));
    } catch { setRows(Array.from({ length: 5 }, () => blankEntry())); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify(rows)); } catch { setNotice("No queda espacio para guardar esta grilla en el navegador. Guardá el lote antes de salir."); }
  }, [rows, ready]);
  const prepared = prepareEntryRows(rows, products, group);
  const invalid = Object.keys(prepared.errors).length;
  const patch = (id: string, values: Partial<EntryRow>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...values } : row));
  function add(count: number) { setRows((current) => [...current, ...Array.from({ length: Math.min(count, 200 - current.length) }, () => blankEntry(brand, category))]); }
  function importPaste() {
    try {
      const added = parseEntryPaste(paste, brand, category);
      if (rows.filter(entryUsed).length + added.length > 200) throw new Error("El lote puede tener hasta 200 filas.");
      setRows((current) => [...current.filter(entryUsed), ...added]); setPaste(""); setNotice(`${added.length} filas agregadas. Revisalas antes de guardar.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudieron leer las filas."); }
  }
  async function create() {
    if (!prepared.used || invalid || disabled) return;
    setProcessing(true);
    try {
      const result = await onCreate(prepared.products);
      setRows(Array.from({ length: 5 }, () => blankEntry(brand, category)));
      setNotice(`${result.saved} artículos guardados como borradores.${result.saved < result.total ? ` ${result.total - result.saved} quedaron pendientes; podés reintentarlos con el botón del lote.` : ""}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar el lote."); }
    finally { setProcessing(false); }
  }
  async function photo(id: string, file?: File) {
    if (!file || imageLock.current) return;
    imageLock.current = true; setProcessing(true);
    try { patch(id, { image: await optimizeImage(file) }); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo cargar la foto."); }
    finally { imageLock.current = false; setProcessing(false); }
  }
  return <section className="card admin-card quick-entry">
    <div className="admin-heading"><div><span className="eyebrow">Varios artículos a la vez</span><h2>Carga rápida</h2></div><span className="product-count">{prepared.used} filas · {prepared.products.length} artículos{invalid ? ` · ${invalid} con errores` : ""}</span></div>
    <p>Completá la grilla o pegá columnas de Excel. Los artículos se crean como borradores; podés agregar fotos y publicarlos después desde Catálogo.</p>
    <fieldset disabled={disabled || processing || !ready}>
      <div className="workspace-toolbar"><label>Marca común<input value={brand} onChange={(event) => setBrand(event.target.value)} /></label><label>Rubro común<input value={category} onChange={(event) => setCategory(event.target.value)} /></label><button className="button-outline" onClick={() => setRows((current) => current.map((row) => ({ ...row, brand: brand || row.brand, category: category || row.category })))}>Aplicar a todas las filas</button></div>
      <details className="entry-paste"><summary>Pegar varios artículos desde Excel</summary><p>Orden: Código, Artículo, Marca, Rubro, Precio, Stock, Diámetro y Largo. Las dos primeras columnas son obligatorias.</p><textarea aria-label="Filas copiadas de Excel" value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={'00123\tBulón hexagonal\tMarca\tBulones\t1500\t20\tM8\t30'} /><button className="button-muted" disabled={!paste.trim()} onClick={importPaste}>Agregar filas pegadas</button></details>
      <label className="check-field"><input type="checkbox" checked={group} onChange={(event) => setGroup(event.target.checked)} /> Agrupar medidas con el mismo nombre, marca y rubro en un artículo</label>
      <div className="admin-table-wrap"><table className="admin-table entry-table"><thead><tr><th>#</th>{labels.map((label) => <th key={label}>{label}</th>)}<th>Foto</th><th>Acciones</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id} className={prepared.errors[row.id] ? "row-error" : ""}>
        <td>{index + 1}</td>{entryFields.map((field, column) => <td key={field}><input aria-label={`${labels[column]} fila ${index + 1}`} inputMode={field === "price" ? "decimal" : field === "stock" ? "numeric" : undefined} value={row[field]} onChange={(event) => patch(row.id, { [field]: event.target.value })} />{field === "name" && prepared.errors[row.id] && <small className="entry-errors">{prepared.errors[row.id].join(" · ")}</small>}</td>)}
        <td><label className="entry-photo">{row.image ? <img src={row.image} alt={`Foto fila ${index + 1}`} /> : "Agregar"}<input type="file" aria-label={`Foto fila ${index + 1}`} accept="image/jpeg,image/png,image/webp" onChange={(event) => { void photo(row.id, event.target.files?.[0]); event.target.value = ""; }} /></label></td>
        <td><div className="backups-actions"><button className="link-button" disabled={rows.length >= 200} onClick={() => setRows((current) => [...current.slice(0, index + 1), { ...row, id: crypto.randomUUID(), sku: "" }, ...current.slice(index + 1)])}>Duplicar</button><button className="link-button" aria-label={`Quitar fila ${index + 1}`} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>Quitar</button></div></td>
      </tr>)}</tbody></table></div>
      <div className="workspace-toolbar"><button className="button-outline" disabled={rows.length >= 200} onClick={() => add(1)}>+ Una fila</button><button className="button-outline" disabled={rows.length >= 200} onClick={() => add(10)}>+ Diez filas</button><button className="button" disabled={!prepared.used || invalid > 0} onClick={() => void create()}>Guardar {prepared.products.length} artículos como borradores</button></div>
    </fieldset>
    {notice && <p role="status" className="admin-notice">{notice}</p>}
  </section>;
}
