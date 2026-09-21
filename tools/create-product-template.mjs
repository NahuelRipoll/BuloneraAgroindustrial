import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "file:///C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const outputDir = new URL("../public/plantillas/", import.meta.url);
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const orange = "#E75A24";
const dark = "#171717";
const pale = "#FFF1EB";
const font = "Arial";

function styleTable(sheet, range, widths) {
  sheet.showGridlines = false;
  const header = sheet.getRange(range.split(":")[0].replace(/\d+$/, "3") + ":" + range.split(":")[1].replace(/\d+$/, "3"));
  header.format = { fill: dark, font: { name: font, bold: true, color: "#FFFFFF" }, verticalAlignment: "center", horizontalAlignment: "center" };
  header.format.rowHeight = 30;
  widths.forEach(([column, width]) => { sheet.getRange(`${column}:${column}`).format.columnWidth = width; });
  sheet.getRange(range).format.font = { name: font, size: 10 };
  sheet.freezePanes.freezeRows(3);
}

const articles = workbook.worksheets.add("Articulos");
articles.getRange("A1:H1").merge();
articles.getRange("A1").values = [["Artículos del catálogo"]];
articles.getRange("A1").format = { font: { name: font, size: 15, bold: true, color: dark }, rowHeight: 26 };
articles.getRange("A2:H2").merge();
articles.getRange("A2").values = [["Una fila por producto. El slug vincula este artículo con sus precios y variantes."]];
articles.getRange("A2").format = { font: { name: font, size: 10, italic: true, color: "#666666" } };
articles.getRange("A3:H5").values = [
  ["slug", "nombre", "marca", "categoria", "descripcion", "imagen_url", "etiqueta", "publicado"],
  ["bulon-hexagonal-g5", "Bulón hexagonal G5 zincado", "Genérica", "Bulonería", "Bulón grado 5 para uso industrial.", "https://ejemplo.com/bulon.jpg", "", "NO"],
  ["taladro-12v", "Taladro atornillador inalámbrico 12V", "Bosch", "Herramientas", "Incluye maletín.", "https://ejemplo.com/taladro.jpg", "Oferta", "NO"],
];
styleTable(articles, "A3:H200", [["A", 25], ["B", 38], ["C", 18], ["D", 20], ["E", 48], ["F", 42], ["G", 16], ["H", 14]]);
articles.getRange("A4:H5").format.fill = pale;

const variants = workbook.worksheets.add("Variantes");
variants.getRange("A1:G1").merge();
variants.getRange("A1").values = [["Variantes, precios y stock"]];
variants.getRange("A1").format = { font: { name: font, size: 15, bold: true, color: dark }, rowHeight: 26 };
variants.getRange("A2:G2").merge();
variants.getRange("A2").values = [["Repetí el slug para cada medida. En productos simples dejá diámetro y largo vacíos."]];
variants.getRange("A2").format = { font: { name: font, size: 10, italic: true, color: "#666666" } };
variants.getRange("A3:G7").values = [
  ["slug_producto", "sku", "diametro", "largo", "precio", "precio_transferencia", "stock"],
  ["bulon-hexagonal-g5", "X.13.50", "1/2 x 13", "2", 25500, 22950, 32],
  ["bulon-hexagonal-g5", "X.13.63", "1/2 x 13", "2 1/2", 26900, 24210, 20],
  ["bulon-hexagonal-g5", "X.16.50", "5/8", "2", 33700, 30330, 6],
  ["taladro-12v", "TAL-12V", "", "", 89999, 80999, 5],
];
styleTable(variants, "A3:G500", [["A", 27], ["B", 20], ["C", 18], ["D", 16], ["E", 16], ["F", 23], ["G", 12]]);
variants.getRange("E4:F500").format.numberFormat = "$#,##0";
variants.getRange("G4:G500").format.numberFormat = "#,##0";
variants.getRange("A4:G7").format.fill = pale;

const lists = workbook.worksheets.add("Listas");
lists.getRange("A1:B1").merge();
lists.getRange("A1").values = [["Valores sugeridos"]];
lists.getRange("A1").format = { font: { name: font, size: 15, bold: true, color: dark } };
lists.getRange("A3:B12").values = [
  ["Categorias", "Marcas"], ["Bulonería", "KLD"], ["Herramientas", "Bosch"], ["Abrasivos", "Bahco"],
  ["Agro y campo", "Dogo"], ["Industria y obra", "Stanley"], ["Seguridad", "Bremen"], ["", "Lusqtoff"],
  ["", "Gamma"], ["", "BTA"],
];
styleTable(lists, "A3:B30", [["A", 25], ["B", 22]]);

const instructions = workbook.worksheets.add("Instrucciones");
instructions.showGridlines = false;
instructions.getRange("A1:F1").merge();
instructions.getRange("A1").values = [["Cómo cargar el catálogo"]];
instructions.getRange("A1").format = { font: { name: font, size: 16, bold: true, color: orange }, rowHeight: 28 };
instructions.getRange("A3:F8").values = [
  ["Paso", "Acción", "Detalle", "", "", ""],
  [1, "Completar Articulos", "Crear una sola fila por producto. No repetir el slug en esta hoja.", "", "", ""],
  [2, "Completar Variantes", "Agregar una fila por cada combinación de medida, precio y stock.", "", "", ""],
  [3, "Productos simples", "Crear una variante con diámetro y largo vacíos.", "", "", ""],
  [4, "Revisar códigos", "El SKU debe ser único. El slug debe coincidir exactamente entre ambas hojas.", "", "", ""],
  [5, "Publicar", "Usar SI solamente cuando el artículo esté revisado y listo para la tienda.", "", "", ""],
];
instructions.getRange("A3:C3").format = { fill: dark, font: { name: font, bold: true, color: "#FFFFFF" } };
instructions.getRange("A3:C8").format.font = { name: font, size: 11 };
instructions.getRange("A:A").format.columnWidth = 10;
instructions.getRange("B:B").format.columnWidth = 27;
instructions.getRange("C:C").format.columnWidth = 70;
instructions.getRange("C4:C8").format.wrapText = true;
instructions.getRange("A4:A8").format = { fill: pale, font: { name: font, bold: true, color: orange }, horizontalAlignment: "center" };

workbook.recalculate();
for (const sheetName of ["Articulos", "Variantes", "Listas", "Instrucciones"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(new URL(`../../.template-${sheetName}.png`, import.meta.url), new Uint8Array(await preview.arrayBuffer()));
}
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(fileURLToPath(new URL("plantilla-articulos.xlsx", outputDir)));
