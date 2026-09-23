"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Download, FileUp, ImagePlus, PackagePlus, Pencil, Save, Star, Trash2, X } from "lucide-react";
import readXlsxFile from "read-excel-file/browser";
import { productStorageKey, type LocalProductDraft, type LocalProductVariant } from "@/lib/local-products";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type DraftProduct = LocalProductDraft & { image: string };

const emptyProduct: Omit<DraftProduct, "id"> = {
  slug: "", name: "", sku: "", brand: "", category: "", price: 0, transferPrice: 0,
  stock: 0, image: "", badge: "", diameter: "", length: "", published: false, featured: false, offerPrice: 0,
};
const storageKey = productStorageKey;

async function optimizeImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} no es una imagen.`);
  if (file.size > 12 * 1024 * 1024) throw new Error(`${file.name} supera el máximo de 12 MB.`);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", .72);
}

function rowToProduct(row: string[], columns: string[], rowNumber: number) {
  const value = (name: string) => row[columns.indexOf(name)] ?? "";
  const errors: string[] = [];
  ["slug", "nombre", "sku", "marca", "categoria"].forEach((name) => { if (!value(name)) errors.push(`Falta ${name}`); });
  const price = Number(value("precio")), transferPrice = Number(value("precio_transferencia")), stock = Number(value("stock"));
  if (!Number.isFinite(price) || price <= 0) errors.push("Precio inválido");
  if (!Number.isFinite(transferPrice) || transferPrice <= 0) errors.push("Precio de transferencia inválido");
  if (!Number.isInteger(stock) || stock < 0) errors.push("Stock inválido");
  const product: DraftProduct = { id: crypto.randomUUID(), slug: value("slug"), name: value("nombre"), sku: value("sku"), brand: value("marca"), category: value("categoria"),
    price, transferPrice, stock, diameter: value("diametro"), length: value("largo"), image: value("imagen_url"), badge: value("etiqueta"), published: ["si", "sí", "true", "1"].includes(value("publicado").toLowerCase()), featured: false };
  return { rowNumber, product, errors, warnings: [] as string[] };
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  const clean = (value: string) => value.trim().replace(/^=/, "").replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index], next = text[index + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(clean(field)); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(clean(field)); if (row.some(Boolean)) rows.push(row); row = []; field = ""; }
    else field += char;
  }
  row.push(clean(field)); if (row.some(Boolean)) rows.push(row); return rows;
}

function decimal(value: string) { return Number(value.replace(/\./g, "").replace(",", ".")); }
function transferFromPrice(price: number) { return Math.round(price * .9); }
function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function stableCode(value: string) { let hash = 5381; for (const char of value) hash = ((hash << 5) + hash) ^ char.charCodeAt(0); return (hash >>> 0).toString(36).toUpperCase(); }
function normalizeBoltBaseName(value: string) {
  return value
    .replace(/\bCALSE\b/gi, "CLASE")
    .replace(/\s+/g, " ")
    .replace(/\s+(?:-\s*)+$/, "")
    .trim();
}
function boltMeasure(name: string, category: string) {
  const normalizedCategory = category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const isNut = /TUERCA/.test(normalizedCategory);
  const result = (baseName: string, diameter: string, length = "", pitch = "") => ({
    baseName: normalizeBoltBaseName(isNut ? baseName.replace(/\bM[AB]\b/gi, "") : baseName),
    diameter,
    length,
    pitch,
  });
  const isFastenerCategory = /BULON|TORNILLO|TUERCA|ARANDELA|TIRAFONDO|VARILLA\s+ROSCADA/.test(normalizedCategory)
    || (/ALLEN/.test(normalizedCategory) && !/LLAVE|JUEGO|SET/.test(normalizedCategory));
  if (!isFastenerCategory) return null;
  const cleanName = name
    .trim()
    .replace(/^(?=\S*\d)\S+\s+/, "")
    .replace(/\[?\d{1,3}\]\s*/g, "")
    .replace(/\s*\(\d+(?:-\d+)?\)\s*$/, "")
    .replace(/[`”"]+/g, "")
    .trim();
  const value = "M?(?:\\d+(?:[.,]\\d+)?(?:[ .-]\\d+\\/\\d+)?|\\d+\\/\\d+)";
  const suffix = "(?:\\s+(.+?))?";
  const classLeading = cleanName.match(new RegExp(`^(.*?CLASE\\s+${value})\\s+[X×]\\s*(${value})\\s*[X×]\\s*(${value})\\s*$`, "i"));
  if (classLeading) return result(classLeading[1], classLeading[2], classLeading[3]);
  const threePart = cleanName.match(new RegExp(`^(.*?)\\s+-?\\s*(${value})\\s*[X×]\\s*(${value})\\s*[X×]\\s*(${value})${suffix}$`, "i"));
  if (threePart) return result([threePart[1], threePart[5]].filter(Boolean).join(" "), isNut ? threePart[2] : `${threePart[2]} × ${threePart[3]}`, isNut ? "" : threePart[4], isNut ? threePart[3] : "");
  const match = cleanName.match(new RegExp(`^(.*?)\\s+-?\\s*(?:[X×]\\s*)?(${value})\\s*[X×]\\s*(${value})${suffix}$`, "i"));
  if (match) return result([match[1], match[4]].filter(Boolean).join(" "), match[2], isNut ? "" : match[3], isNut ? match[3] : "");
  const threadedRod = cleanName.match(new RegExp(`^(.*?VARILLA\\s+ROSCADA.*?)\\s+-?\\s*(${value})(?:\\s+P\\s+(${value}))?\\s*$`, "i"));
  if (threadedRod) return result(threadedRod[1], threadedRod[2], "", threadedRod[3] ?? "");
  const single = cleanName.match(new RegExp(`^(.*?)\\s+-?\\s*(${value})(?:\\s*(MM))?${suffix}$`, "i"));
  if (single) return result([single[1], single[4]].filter(Boolean).join(" "), `${single[2]}${single[3] ? " MM" : ""}`);
  return null;
}
function groupErpVariants(rows: ReturnType<typeof rowToProduct>[]) {
  const output: ReturnType<typeof rowToProduct>[] = [], groups = new Map<string, ReturnType<typeof rowToProduct>>();
  for (const item of rows) {
    const measure = boltMeasure(item.product.name, item.product.category);
    if (!measure) { output.push(item); continue; }
    const groupedCategory = /TUERCA/i.test(item.product.category) ? item.product.category.replace(/\bM[AB]\b/gi, "").replace(/\s+/g, " ").trim() : item.product.category;
    const key = `${measure.baseName}|${item.product.brand}|${groupedCategory}`.toLowerCase();
    const variant: LocalProductVariant = { sku: item.product.sku, diameter: measure.diameter, length: measure.length, pitch: measure.pitch, price: 0, transferPrice: 0, stock: item.product.stock };
    const existing = groups.get(key);
    if (existing) {
      existing.product.variants = [...(existing.product.variants ?? []), variant];
      existing.product.stock += item.product.stock;
      existing.warnings = [`${existing.product.variants.length} medidas agrupadas · precios e imagen pendientes`];
    } else {
      const code = stableCode(key);
      const grouped = { ...item, product: { ...item.product, id: crypto.randomUUID(), name: measure.baseName, slug: `${slugify(measure.baseName).slice(0, 55)}-${code.toLowerCase()}`, sku: `GRP-${code}`, diameter: "", length: "", variants: [variant] }, warnings: ["1 medida agrupada · precios e imagen pendientes"] };
      groups.set(key, grouped); output.push(grouped);
    }
  }
  return output;
}

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [savingOffers, setSavingOffers] = useState(false);
  const [offerSearch, setOfferSearch] = useState("");
  const [offerCategory, setOfferCategory] = useState("Todas");
  const [offerBrand, setOfferBrand] = useState("Todas");
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogStatus, setCatalogStatus] = useState("Todos");
  const [quickPriceSearch, setQuickPriceSearch] = useState("");
  const [pricePaste, setPricePaste] = useState("");
  const [bulkPercent, setBulkPercent] = useState(10);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const local = (() => { try { return JSON.parse(localStorage.getItem(storageKey) ?? "[]") as DraftProduct[]; } catch { return []; } })();
    setDrafts(local); setHydrated(true);
    const supabase = createSupabaseBrowserClient(); const db: any = supabase;
    db.from("products").select("id,slug,name,sku,brand,category,price,transfer_price,stock,badge,published,featured,offer_price,specs,product_images(storage_path,external_url,position),product_variants(id,sku,options,price,transfer_price,stock)").order("name").then(({ data, error }: { data: any[] | null; error: { message: string } | null }) => {
      if (error) { setNotice(`No se pudieron cargar los productos existentes: ${error.message}`); setLoadingCloud(false); return; }
      const cloud: DraftProduct[] = (data ?? []).map((row) => {
        const images = [...(row.product_images ?? [])].sort((a, b) => a.position - b.position).map((image) => image.external_url || (image.storage_path ? supabase.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl : "")).filter(Boolean);
        const variants: LocalProductVariant[] = (row.product_variants ?? []).map((variant: any) => ({ id: variant.id, sku: variant.sku, diameter: variant.options?.["Diámetro"] ?? "", length: variant.options?.Largo ?? "", pitch: variant.options?.Paso ?? "", price: Number(variant.price), transferPrice: Number(variant.transfer_price), stock: variant.stock }));
        return { id: row.id, remoteId: row.id, savedPublished: row.published, savedFeatured: row.featured, slug: row.slug, name: row.name, sku: row.sku, brand: row.brand, category: row.category, price: Number(row.price), transferPrice: Number(row.transfer_price), stock: row.stock, image: images[0] ?? "", images, imageStoragePaths: (row.product_images ?? []).map((image: any) => image.storage_path).filter(Boolean), badge: row.badge ?? "", diameter: row.specs?.["Diámetro"] ?? "", length: row.specs?.Largo ?? "", variants: variants.length ? variants : undefined, published: row.published, featured: row.featured, offerPrice: row.offer_price == null ? 0 : Number(row.offer_price) };
      });
      const cloudSkus = new Set(cloud.map((item) => item.sku));
      setDrafts([...cloud, ...local.filter((item) => !cloudSkus.has(item.sku))]); setLoadingCloud(false);
    });
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(storageKey, JSON.stringify(drafts)); }
    catch { setNotice("No queda espacio en el navegador para más fotos. Usá URLs o quitá alguna imagen cargada."); }
  }, [drafts, hydrated]);
  useEffect(() => {
    if (!editingId) return;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setEditingId(null); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [editingId]);
  const categories = useMemo(() => [...new Set(preview.map((item) => item.product.category))].sort((a, b) => a.localeCompare(b)), [preview]);
  const brands = useMemo(() => ["Todas", ...new Set(preview.map((item) => item.product.brand))].sort((a, b) => a === "Todas" ? -1 : b === "Todas" ? 1 : a.localeCompare(b)), [preview]);
  const matchesExtraFilters = (item: ReturnType<typeof rowToProduct>) => (brandFilter === "Todas" || item.product.brand === brandFilter) && item.product.stock >= minimumStock;
  const categoryCounts = useMemo(() => new Map(categories.map((category) => [category, preview.filter((item) => item.product.category === category && matchesExtraFilters(item)).length])), [brandFilter, categories, minimumStock, preview]);
  const filteredCategories = useMemo(() => categories.filter((category) => category.toLowerCase().includes(categorySearch.trim().toLowerCase()) && (categoryCounts.get(category) ?? 0) > 0 && (!showSelectedOnly || selectedCategories.includes(category))), [categories, categoryCounts, categorySearch, selectedCategories, showSelectedOnly]);
  const validRows = useMemo(() => preview.filter((item) => item.errors.length === 0 && selectedCategories.includes(item.product.category) && matchesExtraFilters(item)), [brandFilter, minimumStock, preview, selectedCategories]);
  const visiblePreview = useMemo(() => preview.filter((item) => selectedCategories.includes(item.product.category) && matchesExtraFilters(item)), [brandFilter, minimumStock, preview, selectedCategories]);
  const offerProducts = useMemo(() => drafts.filter((item) => item.published && item.remoteId), [drafts]);
  const offerCategories = useMemo(() => ["Todas", ...new Set(offerProducts.map((item) => item.category))].sort((a, b) => a === "Todas" ? -1 : b === "Todas" ? 1 : a.localeCompare(b)), [offerProducts]);
  const offerBrands = useMemo(() => ["Todas", ...new Set(offerProducts.map((item) => item.brand))].sort((a, b) => a === "Todas" ? -1 : b === "Todas" ? 1 : a.localeCompare(b)), [offerProducts]);
  const filteredOfferProducts = useMemo(() => {
    const term = offerSearch.trim().toLocaleLowerCase("es");
    return offerProducts.filter((item) => (!term || `${item.name} ${item.sku}`.toLocaleLowerCase("es").includes(term))
      && (offerCategory === "Todas" || item.category === offerCategory)
      && (offerBrand === "Todas" || item.brand === offerBrand)
      && (!showFeaturedOnly || item.featured));
  }, [offerBrand, offerCategory, offerProducts, offerSearch, showFeaturedOnly]);
  const filteredDrafts = useMemo(() => {
    const term = catalogSearch.trim().toLocaleLowerCase("es");
    return drafts.filter((item) => {
      const images = [...(item.images ?? []), item.image].filter(Boolean);
      const matchesStatus = catalogStatus === "Todos"
        || (catalogStatus === "Sin precio" && item.price <= 0)
        || (catalogStatus === "Sin imagen" && images.length === 0)
        || (catalogStatus === "Sin publicar" && !item.published)
        || (catalogStatus === "Sin stock" && item.stock <= 0)
        || (catalogStatus === "Listos" && item.price > 0 && images.length > 0 && item.stock > 0);
      return matchesStatus && (!term || `${item.name} ${item.sku} ${item.brand} ${item.category}`.toLocaleLowerCase("es").includes(term));
    });
  }, [catalogSearch, catalogStatus, drafts]);
  const quickPriceProducts = useMemo(() => {
    const term = quickPriceSearch.trim().toLocaleLowerCase("es");
    return drafts.filter((item) => !item.remoteId && (!term || `${item.name} ${item.sku} ${item.category}`.toLocaleLowerCase("es").includes(term)));
  }, [drafts, quickPriceSearch]);

  useEffect(() => { setSelectedCategories(categories); }, [categories]);

  function update(name: keyof typeof form, value: string | number | boolean) { setForm((current) => ({ ...current, [name]: value })); }
  function submit(event: FormEvent) {
    event.preventDefault();
    setDrafts((current) => [...current, { ...form, id: crypto.randomUUID(), images: form.image ? [form.image] : [], published: form.published && Boolean(form.image && form.price && form.transferPrice) }]);
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
        const productRows = rows.slice(headerIndex + 1).filter((row) => get(row, "Código").trim() && get(row, "Artículo").trim());
        const parsed = productRows.map((row, index) => {
          const sku = get(row, "Código").trim();
          const name = get(row, "Artículo").trim();
          const product: DraftProduct = { id: crypto.randomUUID(), slug: `${slugify(name).slice(0, 55)}-${slugify(sku)}`, name, sku,
            brand: get(row, "Marca") || "Sin marca", category: get(row, "Rubro") || "Sin categoría", price: 0, transferPrice: 0,
            stock: Math.max(0, Math.floor(decimal(get(row, "Stock")))), image: "", badge: "", diameter: "", length: "", published: false, featured: false };
          return { rowNumber: headerIndex + index + 2, product, errors: [] as string[], warnings: ["Precio e imagen pendientes"] };
        });
        const grouped = groupErpVariants(parsed).filter((item) => item.product.variants?.length || item.product.stock > 0);
        const variantCount = grouped.reduce((total, item) => total + (item.product.variants?.length ?? 0), 0);
        setPreview(grouped); setNotice(`${grouped.length} artículos detectados con stock positivo.${variantCount ? ` ${variantCount} medidas de bulonería quedaron agrupadas como variantes.` : ""} Los precios y las imágenes quedan pendientes.`); return;
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
    const existingSkus = new Set(drafts.map((draft) => draft.sku));
    const newProducts = validRows.map((item) => item.product).filter((product) => !existingSkus.has(product.sku));
    const skipped = validRows.length - newProducts.length;
    setDrafts((current) => [...current, ...newProducts]); setPreview([]); setNotice(`${newProducts.length} artículos importados como borradores.${skipped ? ` ${skipped} ya existían y no se duplicaron.` : ""}`);
  }
  function toggleCategory(category: string) {
    setSelectedCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  }
  function selectVisible(select: boolean) {
    setSelectedCategories((current) => select ? [...new Set([...current, ...filteredCategories])] : current.filter((category) => !filteredCategories.includes(category)));
  }
  function clearImportFilters() { setCategorySearch(""); setBrandFilter("Todas"); setMinimumStock(0); setShowSelectedOnly(false); }
  function patchDraft(id: string, patch: Partial<DraftProduct>) {
    setNotice("");
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...patch } : draft));
  }
  function addImageUrl(draft: DraftProduct) {
    const url = imageUrl.trim(); if (!url) return;
    patchDraft(draft.id, { images: [...new Set([...(draft.images ?? []), draft.image, url].filter(Boolean))], image: draft.image || url });
    setImageUrl("");
  }
  async function addImageFiles(draft: DraftProduct, files: FileList | null) {
    if (!files?.length) return;
    try {
      const available = Math.max(0, 6 - (draft.images?.length ?? (draft.image ? 1 : 0)));
      const added = await Promise.all([...files].slice(0, available).map(optimizeImage));
      const images = [...new Set([...(draft.images ?? []), draft.image, ...added].filter(Boolean))];
      patchDraft(draft.id, { images, image: images[0] ?? "" });
      setNotice(`${added.length} foto${added.length === 1 ? "" : "s"} agregada${added.length === 1 ? "" : "s"}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudieron cargar las fotos."); }
  }
  function removeImage(draft: DraftProduct, url: string) {
    if (url === imageUrl.trim()) setImageUrl("");
    const images = [...new Set([...(draft.images ?? []), draft.image].filter(Boolean))].filter((item) => item !== url);
    patchDraft(draft.id, { images, image: images[0] ?? "", published: images.length ? draft.published : false });
  }
  function updateVariant(draft: DraftProduct, index: number, patch: Partial<LocalProductVariant>) {
    const variants = (draft.variants ?? []).map((variant, variantIndex) => variantIndex === index ? { ...variant, ...patch } : variant);
    patchDraft(draft.id, { variants, stock: variants.reduce((total, variant) => total + variant.stock, 0) });
  }
  async function saveToSupabase(draft: DraftProduct) {
    const pendingUrl = imageUrl.trim();
    const images = [...new Set([...(draft.images ?? []), draft.image, pendingUrl].filter(Boolean))];
    if (pendingUrl) { patchDraft(draft.id, { images, image: images[0] ?? "" }); setImageUrl(""); }
    const variantPricesComplete = Boolean(draft.variants?.length && draft.variants.every((variant) => variant.price > 0));
    const effectivePrice = draft.price || (variantPricesComplete ? Math.min(...draft.variants!.map((variant) => variant.price)) : 0);
    if (draft.published && (!effectivePrice || !images.length)) { setNotice(`Para publicar, ${draft.variants?.length ? "completá el precio de todas las medidas" : "completá el precio"} y agregá al menos una foto. También podés desmarcar la publicación y guardarlo como borrador.`); return; }
    setSavingIds((current) => [...current, draft.id]); setNotice("Guardando producto y fotos en Supabase…");
    try {
      const supabase = createSupabaseBrowserClient();
      // The generated database types will replace this narrow bridge once the remote schema is linked to the CLI.
      const db: any = supabase;
      const effectiveTransferPrice = draft.transferPrice || transferFromPrice(effectivePrice);
      const { data: product, error } = await db.from("products").upsert({ slug: draft.slug, name: draft.name, sku: draft.sku, brand: draft.brand, category: draft.category, price: effectivePrice, transfer_price: effectiveTransferPrice, stock: draft.stock, badge: draft.badge || null, specs: { ...(draft.diameter ? { "Diámetro": draft.diameter } : {}), ...(draft.length ? { Largo: draft.length } : {}) }, published: draft.published, featured: draft.featured, offer_price: draft.offerPrice || null }, { onConflict: "sku" }).select("id").single();
      if (error) throw error;
      if (draft.variants?.length) {
        const { error: clearVariantsError } = await db.from("product_variants").delete().eq("product_id", product.id);
        if (clearVariantsError) throw clearVariantsError;
        const { error: variantsError } = await db.from("product_variants").insert(draft.variants.map((variant) => ({ product_id: product.id, sku: variant.sku, options: { ...(variant.diameter ? { Diámetro: variant.diameter } : {}), ...(variant.pitch ? { Paso: variant.pitch } : {}), ...(variant.length ? { Largo: variant.length } : {}) }, price: variant.price || draft.price, transfer_price: variant.transferPrice || effectiveTransferPrice, stock: variant.stock })));
        if (variantsError) throw variantsError;
      }
      const { error: clearError } = await db.from("product_images").delete().eq("product_id", product.id);
      if (clearError) throw clearError;
      const rows = [];
      for (let index = 0; index < images.length; index += 1) {
        const source = images[index];
        if (source.startsWith("data:")) {
          const blob = await (await fetch(source)).blob();
          const path = `${product.id}/${index}-${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/jpeg", upsert: true });
          if (uploadError) throw uploadError;
          rows.push({ product_id: product.id, storage_path: path, external_url: null, alt_text: draft.name, position: index });
        } else rows.push({ product_id: product.id, storage_path: null, external_url: source, alt_text: draft.name, position: index });
      }
      if (rows.length) {
        const { error: imageError } = await db.from("product_images").insert(rows);
        if (imageError) throw imageError;
      }
      patchDraft(draft.id, { remoteId: product.id, savedPublished: draft.published, savedFeatured: draft.featured, price: effectivePrice, transferPrice: effectiveTransferPrice, imageStoragePaths: rows.map((row) => row.storage_path).filter((path): path is string => Boolean(path)) });
      setNotice(`${draft.name} quedó guardado en Supabase${draft.published ? " y publicado en la tienda" : " como borrador"}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar el producto en Supabase."); }
    finally { setSavingIds((current) => current.filter((id) => id !== draft.id)); }
  }
  async function removeProduct(draft: DraftProduct) {
    if (!draft.remoteId) return;
    const supabase = createSupabaseBrowserClient(); const db: any = supabase;
    const paths = draft.imageStoragePaths ?? [];
    if (paths.length) { const { error: storageError } = await supabase.storage.from("product-images").remove(paths); if (storageError) throw storageError; }
    const { error } = await db.from("products").delete().eq("id", draft.remoteId);
    if (error) throw error;
  }
  async function deleteProducts(items: DraftProduct[]) {
    if (!items.length) return;
    const label = items.length === 1 ? `“${items[0].name}”` : `${items.length} artículos`;
    const hasRemoteProducts = items.some((item) => item.remoteId);
    if (!window.confirm(`¿Eliminar ${label}?${hasRemoteProducts ? " También se quitarán de la tienda y de Supabase." : ""}`)) return;
    const ids = items.map((item) => item.id);
    setDeletingIds((current) => [...new Set([...current, ...ids])]);
    const removedIds: string[] = [], errors: string[] = [];
    try {
      for (const item of items) {
        try { await removeProduct(item); removedIds.push(item.id); }
        catch (error) { errors.push(`${item.name}: ${error instanceof Error ? error.message : "error desconocido"}`); }
      }
      setDrafts((current) => current.filter((item) => !removedIds.includes(item.id)));
      setSelectedProductIds((current) => current.filter((id) => !removedIds.includes(id)));
      if (editingId && removedIds.includes(editingId)) setEditingId(null);
      setNotice(errors.length ? `${removedIds.length} artículos eliminados. No se pudieron eliminar ${errors.length}: ${errors.join(" · ")}` : `${removedIds.length} artículo${removedIds.length === 1 ? "" : "s"} eliminado${removedIds.length === 1 ? "" : "s"}.`);
    } finally { setDeletingIds((current) => current.filter((id) => !ids.includes(id))); }
  }
  function deleteProduct(draft: DraftProduct) { return deleteProducts([draft]); }
  function toggleProductSelection(id: string) {
    setSelectedProductIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function patchSelected(patch: Partial<DraftProduct>) {
    setDrafts((current) => current.map((item) => selectedProductIds.includes(item.id) ? { ...item, ...patch } : item));
  }

  function adjustSelectedPrices() {
    const factor = 1 + bulkPercent / 100;
    setDrafts((current) => current.map((item) => selectedProductIds.includes(item.id) ? (() => {
      const price = Math.round(item.price * factor);
      return { ...item, price, transferPrice: transferFromPrice(price) };
    })() : item));
    setNotice(`Se aplicó ${bulkPercent}% a ${selectedProductIds.length} productos. Revisá los valores y guardá los cambios.`);
  }

  function applyPastedPrices() {
    const entries = pricePaste.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.includes("\t") ? line.split("\t") : line.includes(";") ? line.split(";") : line.split(/\s+/);
      return [parts[0]?.trim(), decimal(parts.slice(1).join(" ").trim())] as const;
    }).filter(([sku, price]) => sku && Number.isFinite(price) && price > 0);
    const prices = new Map(entries);
    let matches = 0;
    setDrafts((current) => current.map((item) => {
      const directPrice = prices.get(item.sku);
      if (directPrice) { matches += 1; return { ...item, price: directPrice, transferPrice: transferFromPrice(directPrice) }; }
      if (!item.variants?.length) return item;
      let changed = false;
      const variants = item.variants.map((variant) => {
        const price = prices.get(variant.sku);
        if (!price) return variant;
        matches += 1; changed = true;
        return { ...variant, price, transferPrice: transferFromPrice(price) };
      });
      if (!changed) return item;
      const completedPrices = variants.map((variant) => variant.price).filter((price) => price > 0);
      return { ...item, variants, price: completedPrices.length ? Math.min(...completedPrices) : item.price, transferPrice: completedPrices.length ? transferFromPrice(Math.min(...completedPrices)) : item.transferPrice };
    }));
    setPricePaste("");
    setNotice(`${matches} precio${matches === 1 ? "" : "s"} aplicado${matches === 1 ? "" : "s"} por SKU.`);
  }

  async function saveSelectedProducts() {
    const selected = drafts.filter((item) => selectedProductIds.includes(item.id));
    if (!selected.length) return;
    setBulkSaving(true);
    for (const item of selected) await saveToSupabase(item);
    setBulkSaving(false);
    setNotice(`${selected.length} producto${selected.length === 1 ? "" : "s"} procesado${selected.length === 1 ? "" : "s"}.`);
  }

  function toggleFeatured(id: string) {
    const selectedCount = drafts.filter((item) => item.featured).length;
    const item = drafts.find((draft) => draft.id === id);
    if (!item?.featured && selectedCount >= 4) { setNotice("Podés mostrar hasta 4 productos en Ofertas."); return; }
    patchDraft(id, { featured: !item?.featured, ...(!item?.featured && !item?.offerPrice ? { offerPrice: transferFromPrice(item?.price ?? 0) } : {}) });
  }

  async function saveOffers() {
    const remoteProducts = drafts.filter((item) => item.remoteId);
    const selected = remoteProducts.filter((item) => item.published && item.featured);
    const invalid = selected.find((item) => !item.offerPrice || item.offerPrice >= item.price);
    if (invalid) { setNotice(`Ingresá para ${invalid.name} un precio de oferta menor que el precio base.`); return; }
    setSavingOffers(true); setNotice("Guardando la selección de ofertas…");
    try {
      if (remoteProducts.length) {
        const db: any = createSupabaseBrowserClient();
        const remoteIds = remoteProducts.map((item) => item.remoteId!);
        const { error: clearError } = await db.from("products").update({ featured: false }).in("id", remoteIds);
        if (clearError) throw clearError;
        for (const item of selected) {
          const { error } = await db.from("products").update({ featured: true, offer_price: item.offerPrice }).eq("id", item.remoteId!);
          if (error) throw error;
        }
      }
      setDrafts((current) => current.map((item) => ({ ...item, featured: item.published ? item.featured : false, savedFeatured: item.published ? item.featured : false })));
      setNotice(`${selected.length} producto${selected.length === 1 ? "" : "s"} seleccionado${selected.length === 1 ? "" : "s"} para Ofertas.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar la selección de ofertas."); }
    finally { setSavingOffers(false); }
  }

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
        <label>Precio<input required min="1" type="number" value={form.price || ""} onChange={(e) => { const price = Number(e.target.value); setForm((current) => ({ ...current, price, transferPrice: transferFromPrice(price) })); }} /></label>
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
          {visiblePreview.slice(0, 250).map((item) => <tr key={item.rowNumber} className={item.errors.length ? "row-error" : ""}><td>{item.rowNumber}</td><td>{item.product.sku}</td><td>{item.product.name}</td><td>{item.product.variants?.length ? `${item.product.variants.length} medidas` : [item.product.diameter, item.product.length].filter(Boolean).join(" × ") || "Simple"}</td><td>{item.errors.join(". ") || item.warnings.join(". ") || "Lista para importar"}</td></tr>)}
        </tbody></table></div><button className="button" disabled={!validRows.length} onClick={importValid}>Importar {validRows.length} filas válidas</button></> : null}
    </section>

    {quickPriceProducts.length ? <section className="card admin-card quick-pricing">
      <div className="admin-heading"><div><span className="eyebrow">Después de importar</span><h2>Carga rápida de precios</h2></div><strong>{quickPriceProducts.filter((item) => item.price > 0).length} de {quickPriceProducts.length} completos</strong></div>
      <p>Cargá el precio base directamente en la tabla. El precio por transferencia se calcula automáticamente con 10% de descuento.</p>
      <div className="price-paste"><div><strong>Pegar precios desde Excel</strong><small>Copiá dos columnas sin encabezado: SKU y precio. También reconoce los SKU de las variantes.</small></div><textarea value={pricePaste} onChange={(event) => setPricePaste(event.target.value)} placeholder={'SKU-001\t12500\nSKU-002\t18900'} /><button className="button-muted" disabled={!pricePaste.trim()} onClick={applyPastedPrices}>Aplicar precios por SKU</button></div>
      <div className="catalog-filters"><label><span>Buscar</span><input value={quickPriceSearch} onChange={(event) => setQuickPriceSearch(event.target.value)} placeholder="Nombre, SKU o categoría" /></label></div>
      <div className="admin-table-wrap"><table className="admin-table editable-table"><thead><tr><th>SKU</th><th>Artículo</th><th>Categoría</th><th>Precio base</th><th>Transferencia</th><th>Estado</th></tr></thead><tbody>
        {quickPriceProducts.map((item) => <tr key={item.id} className={item.price <= 0 ? "row-error" : ""}><td>{item.sku}</td><td>{item.name}</td><td>{item.category}</td><td><input className="price-input" type="number" min="0" value={item.price || ""} placeholder="0" onChange={(event) => { const price = Number(event.target.value); patchDraft(item.id, { price, transferPrice: transferFromPrice(price) }); }} /></td><td><input className="price-input" type="number" min="0" value={item.transferPrice || ""} onChange={(event) => patchDraft(item.id, { transferPrice: Number(event.target.value) })} /></td><td>{item.price > 0 ? <span className="status-published">Completo</span> : <span className="status-pending">Falta precio</span>}</td></tr>)}
      </tbody></table></div>
    </section> : null}

    {notice ? <p className="admin-notice">{notice}</p> : null}
    <section className="card admin-card">
      <div className="admin-heading"><div><span className="eyebrow">Portada</span><h2><Star size={24} /> Ofertas destacadas</h2></div><button className="button" disabled={savingOffers || loadingCloud} onClick={saveOffers}><Save size={17} /> {savingOffers ? "Guardando…" : "Guardar ofertas"}</button></div>
      <p>Elegí hasta 4 productos publicados y definí su precio promocional. <strong>{offerProducts.filter((item) => item.featured).length} de 4 seleccionados.</strong></p>
      <div className="offer-filters">
        <label className="wide-filter"><span>Buscar producto</span><input value={offerSearch} onChange={(event) => setOfferSearch(event.target.value)} placeholder="Nombre o SKU" /></label>
        <label><span>Categoría</span><select value={offerCategory} onChange={(event) => setOfferCategory(event.target.value)}>{offerCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label><span>Marca</span><select value={offerBrand} onChange={(event) => setOfferBrand(event.target.value)}>{offerBrands.map((brand) => <option key={brand}>{brand}</option>)}</select></label>
        <label className="selected-filter"><input type="checkbox" checked={showFeaturedOnly} onChange={(event) => setShowFeaturedOnly(event.target.checked)} /> Solo seleccionados</label>
        <button className="link-button clear-filter" onClick={() => { setOfferSearch(""); setOfferCategory("Todas"); setOfferBrand("Todas"); setShowFeaturedOnly(false); }}>Limpiar</button>
      </div>
      <p className="offer-results-count">{filteredOfferProducts.length} producto{filteredOfferProducts.length === 1 ? "" : "s"} encontrados</p>
      <div className="offer-selector">
        {filteredOfferProducts.map((item) => <div className={`offer-option${item.featured ? " selected" : ""}`} key={item.id}><input type="checkbox" aria-label={`Mostrar ${item.name} en Ofertas`} checked={item.featured} onChange={() => toggleFeatured(item.id)} /><img src={item.image || "/imagenes/producto-sin-foto.svg"} alt="" /><span><strong title={item.name}>{item.name}</strong><small>{item.sku} · {item.category} · {item.brand}</small><small>Precio base: $ {item.price.toLocaleString("es-AR")}</small>{item.featured ? <label className="offer-price-field">Precio oferta<input type="number" min="1" max={Math.max(1, item.price - 1)} value={item.offerPrice || ""} onChange={(event) => patchDraft(item.id, { offerPrice: Number(event.target.value) })} /></label> : null}</span></div>)}
        {!loadingCloud && offerProducts.length > 0 && filteredOfferProducts.length === 0 ? <p className="no-filter-results">No hay productos que coincidan con los filtros.</p> : null}
        {!loadingCloud && !drafts.some((item) => item.published && item.remoteId) ? <p className="no-filter-results">Publicá al menos un producto para poder destacarlo.</p> : null}
      </div>
    </section>
    <section className="card admin-card"><div className="admin-heading"><div><span className="eyebrow">Catálogo</span><h2>{drafts.length} artículos cargados</h2></div>{selectedProductIds.length ? <button className="button-outline bulk-delete" disabled={deletingIds.length > 0} onClick={() => deleteProducts(drafts.filter((item) => selectedProductIds.includes(item.id)))}><Trash2 size={17} /> Eliminar ({selectedProductIds.length})</button> : null}</div>
      <p>{loadingCloud ? "Cargando artículos de Supabase…" : "Acá aparecen tanto los productos guardados en Supabase como los recién importados."}</p>
      <div className="catalog-filters"><label><span>Buscar</span><input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Nombre, SKU, marca o categoría" /></label><label><span>Estado</span><select value={catalogStatus} onChange={(event) => setCatalogStatus(event.target.value)}>{["Todos", "Sin precio", "Sin imagen", "Sin publicar", "Sin stock", "Listos"].map((value) => <option key={value}>{value}</option>)}</select></label><button className="link-button clear-filter" onClick={() => { setCatalogSearch(""); setCatalogStatus("Todos"); }}>Limpiar</button></div>
      {selectedProductIds.length ? <div className="bulk-toolbar"><strong>{selectedProductIds.length} seleccionados</strong><button className="button-muted" onClick={() => patchSelected({ published: true })}>Publicar</button><button className="button-muted" onClick={() => patchSelected({ published: false, featured: false })}>Despublicar</button><label>Ajustar <input type="number" value={bulkPercent} onChange={(event) => setBulkPercent(Number(event.target.value))} /> %</label><button className="button-muted" onClick={adjustSelectedPrices}>Aplicar</button><button className="button" disabled={bulkSaving} onClick={saveSelectedProducts}><Save size={16} /> {bulkSaving ? "Guardando…" : "Guardar seleccionados"}</button></div> : null}
      <p className="offer-results-count">{filteredDrafts.length} resultados</p>
      {drafts.length ? <div className="admin-table-wrap"><table className="admin-table editable-table"><thead><tr><th><input type="checkbox" aria-label="Seleccionar resultados" checked={filteredDrafts.length > 0 && filteredDrafts.every((item) => selectedProductIds.includes(item.id))} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...new Set([...current, ...filteredDrafts.map((item) => item.id)])] : current.filter((id) => !filteredDrafts.some((item) => item.id === id)))} /></th><th>Foto</th><th>SKU</th><th>Artículo</th><th>Marca</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Publicar</th><th></th></tr></thead><tbody>
        {filteredDrafts.map((item) => { const images = [...new Set([...(item.images ?? []), item.image].filter(Boolean))]; return <tr key={item.id}><td><input type="checkbox" aria-label={`Seleccionar ${item.name}`} checked={selectedProductIds.includes(item.id)} onChange={() => toggleProductSelection(item.id)} /></td><td><img className="admin-product-thumb" src={images[0] || "/imagenes/producto-sin-foto.svg"} alt="" /></td><td>{item.sku}</td><td className="editable-name"><input className="title-input" value={item.name} aria-label={`Título de ${item.sku}`} onChange={(event) => patchDraft(item.id, { name: event.target.value })} /></td><td><input value={item.brand} onChange={(event) => patchDraft(item.id, { brand: event.target.value })} /></td><td><input value={item.category} onChange={(event) => patchDraft(item.id, { category: event.target.value })} /></td><td><input className="price-input" type="number" min="0" value={item.price || ""} onChange={(event) => { const price = Number(event.target.value); patchDraft(item.id, { price, transferPrice: transferFromPrice(price) }); }} /></td><td><input className="stock-input" type="number" min="0" value={item.stock} disabled={Boolean(item.variants?.length)} onChange={(event) => patchDraft(item.id, { stock: Number(event.target.value) })} /></td><td><input type="checkbox" checked={item.published} onChange={(event) => patchDraft(item.id, { published: event.target.checked })} /></td><td><div className="table-actions"><button className="icon-button" onClick={() => setEditingId(editingId === item.id ? null : item.id)} aria-label="Editar"><Pencil size={17} /></button><button className="icon-button danger" disabled={deletingIds.includes(item.id)} onClick={() => deleteProduct(item)} aria-label="Eliminar producto"><Trash2 size={17} /></button></div></td></tr>})}
      </tbody></table></div> : <p>Todavía no hay borradores.</p>}
      {editingId && drafts.find((draft) => draft.id === editingId) ? (() => { const item = drafts.find((draft) => draft.id === editingId)!; const images = [...new Set([...(item.images ?? []), item.image, imageUrl.trim()].filter(Boolean))]; const publishPriceReady = item.variants?.length ? item.variants.every((variant) => variant.price > 0) : item.price > 0; const hasPitch = Boolean(item.variants?.some((variant) => variant.pitch)); return <div className="product-editor-backdrop" onMouseDown={() => setEditingId(null)}><div className="product-editor" role="dialog" aria-modal="true" aria-label={`Editar ${item.name}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="editor-head"><div><span className="eyebrow">Editar producto</span><h3>{item.name}</h3></div><button className="icon-button" onClick={() => setEditingId(null)} aria-label="Cerrar"><X size={18} /></button></div>
        <div className="product-form compact-form"><label className="wide">Título del artículo<input required value={item.name} onChange={(event) => patchDraft(item.id, { name: event.target.value })} /></label><label>Precio base {item.variants?.length ? "(opcional)" : ""}<input min="1" type="number" value={item.price || ""} onChange={(event) => { const price = Number(event.target.value); patchDraft(item.id, { price, transferPrice: transferFromPrice(price) }); }} /></label><label>Transferencia base<input min="1" type="number" value={item.transferPrice || ""} onChange={(event) => patchDraft(item.id, { transferPrice: Number(event.target.value) })} /></label><label>Stock total<input min="0" type="number" disabled={Boolean(item.variants?.length)} value={item.stock} onChange={(event) => patchDraft(item.id, { stock: Number(event.target.value) })} /></label><label>Etiqueta<input value={item.badge} onChange={(event) => patchDraft(item.id, { badge: event.target.value })} /></label></div>
        {item.variants?.length ? <div className="variant-editor"><div><h4>Medidas y stock</h4><p>Si una medida no tiene precio propio, se usa el precio base.</p></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Diámetro</th><th>{hasPitch ? "Paso" : "Largo"}</th><th>SKU</th><th>Stock</th><th>Precio</th><th>Transferencia</th></tr></thead><tbody>{item.variants.map((variant, index) => <tr key={variant.sku}><td>{variant.diameter}</td><td>{hasPitch ? variant.pitch : variant.length}</td><td>{variant.sku}</td><td><input type="number" min="0" value={variant.stock} onChange={(event) => updateVariant(item, index, { stock: Number(event.target.value) })} /></td><td><input type="number" min="0" value={variant.price || ""} placeholder={String(item.price || "Base")} onChange={(event) => { const price = Number(event.target.value); updateVariant(item, index, { price, transferPrice: transferFromPrice(price) }); }} /></td><td><input type="number" min="0" value={variant.transferPrice || ""} placeholder={String(item.transferPrice || "Base")} onChange={(event) => updateVariant(item, index, { transferPrice: Number(event.target.value) })} /></td></tr>)}</tbody></table></div></div> : null}
        <div className="photo-manager"><div className="photo-manager-title"><div><h4>Fotos del producto</h4><p>La primera es la portada. Podés guardar hasta 6.</p></div><label className="button-outline photo-upload"><ImagePlus size={17} /> Subir fotos<input type="file" accept="image/*" multiple onChange={(event) => addImageFiles(item, event.target.files)} /></label></div><div className="image-url-row"><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addImageUrl(item); } }} placeholder="https://... URL de una imagen" /><button className="button-muted" onClick={() => addImageUrl(item)}>Agregar URL</button></div>
          {images.length ? <div className="photo-grid">{images.map((url, index) => <div className="photo-item" key={url}><img src={url} alt={`${item.name} ${index + 1}`} /><span>{index === 0 ? "Portada" : `Foto ${index + 1}`}</span><button onClick={() => removeImage(item, url)} aria-label="Quitar foto"><X size={15} /></button></div>)}</div> : <div className="empty-photos">Todavía no hay fotos. El producto no se podrá publicar hasta agregar una.</div>}
        </div>
        {notice ? <p className="editor-result">{notice}</p> : null}
        <div className="editor-save"><div><label className="check-field"><input type="checkbox" checked={item.published} onChange={(event) => patchDraft(item.id, { published: event.target.checked })} /> Publicar en la tienda al guardar</label>{item.published && (!publishPriceReady || !images.length) ? <small>Antes de guardar para publicación, {item.variants?.length ? "completá el precio de todas las medidas" : "completá el precio"} y agregá una foto.</small> : null}</div><button className="button" disabled={savingIds.includes(item.id)} onClick={() => saveToSupabase(item)}><Save size={18} /> {savingIds.includes(item.id) ? "Guardando…" : "Guardar producto"}</button></div>
      </div></div>; })() : null}
    </section>
  </div>;
}
