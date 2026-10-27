import { zipSync, strToU8 } from "fflate";

const xml = (value) => String(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
const column = (index) => String.fromCharCode(65 + index);
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export function workbookBytes(sheets) {
  const files = {};
  const add = (name, content) => { files[name] = strToU8(declaration + content); };
  add('[Content_Types].xml', `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  add('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  add('xl/workbook.xml', `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  add('xl/_rels/workbook.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  add('xl/styles.xml', '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.000"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF171717"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  sheets.forEach((sheet, i) => {
    const rows = [sheet.headers, ...sheet.rows];
    const data = rows.map((row, r) => `<row r="${r + 1}"${r === 0 ? ' ht="26" customHeight="1"' : ''}>${row.map((value, c) => {
      const position = `${column(c)}${r + 1}`;
      if (value === null || value === undefined) return `<c r="${position}"/>`;
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('El Excel contiene un número inválido.');
        return `<c r="${position}" s="${sheet.stockColumn === c ? 3 : 2}"><v>${value}</v></c>`;
      }
      return `<c r="${position}" s="${r === 0 ? 1 : c === 0 ? 4 : 0}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    }).join('')}</row>`).join('');
    add(`xl/worksheets/sheet${i + 1}.xml`, `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${column(sheet.headers.length - 1)}${rows.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${sheet.headers.map((_, c) => `<col min="${c + 1}" max="${c + 1}" width="${sheet.widths?.[c] || 20}" customWidth="1"/>`).join('')}</cols><sheetData>${data}</sheetData><autoFilter ref="A1:${column(sheet.headers.length - 1)}${rows.length}"/></worksheet>`);
  });
  return zipSync(files, { level: 6 });
}

export function priceCsv(headers, rows) {
  return '\uFEFF' + [headers, ...rows].map((row) => row.map((value) => {
    const text = value == null ? '' : typeof value === 'number' ? String(value).replace('.', ',') : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }).join(';')).join('\r\n');
}

export function consolidateInventory(rows) {
  const grouped = new Map();
  const review = [];
  for (const row of rows) {
    grouped.set(row.sku, [...(grouped.get(row.sku) || []), row]);
    if (row.issues.length) review.push([row.sku, String(row.page), row.issues.join('; ')]);
  }
  const output = [];
  for (const [sku, versions] of grouped) {
    const cells = [0, 1, 2, 3].map((index) => {
      const values = [...new Set(versions.map((row) => index === 3 ? row.stock : row.prices[index]).filter((value) => value !== null))];
      if (values.length > 1) review.push([sku, versions.map((row) => row.page).join(', '), `${index === 3 ? 'Stock actual' : `Lista ${index + 1}`}: valores distintos para el mismo código; celda vacía`]);
      return values.length === 1 ? values[0] : null;
    });
    output.push([sku, ...cells]);
  }
  return { rows: output, review };
}
