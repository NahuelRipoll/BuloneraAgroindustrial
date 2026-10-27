# Convertir el listado PDF del ERP

## Paso a paso de uso habitual

1. Copiá el PDF actualizado a la carpeta `data` del proyecto, con el nombre **Listado de precios.pdf**.

2. Abrí una terminal y entrá a la carpeta del proyecto:

   ```powershell
   cd "C:\Users\Jony\Desktop\BuloneraAgroindustrial"
   ```

3. Cerrá el Excel generado si lo tenés abierto. Ejecutá la conversión:

   ```powershell
   npm run convertir:precios -- "data/Listado de precios.pdf"
   ```

   Si ya existen los archivos de una conversión anterior, este comando los reemplaza por los del PDF actualizado:

   ```powershell
   npm run convertir:precios -- "data/Listado de precios.pdf" --force
   ```

4. Esperá el resumen de la terminal. Abrí `data/convertidos/Listado de precios.xlsx`. La hoja **Precios** tiene cinco columnas: **Código, Lista 1, Lista 2, Lista 3 y Stock actual**. Consultá la hoja **Revisión** para identificar las celdas que quedaron vacías por una lectura dudosa.

5. Entrá al sitio con tu cuenta administrativa y abrí **Admin → Productos → Precios → Excel / CSV**.

6. Elegí la **Lista 1, 2 o 3** que querés usar y seleccioná el Excel generado. Revisá las coincidencias por código, los precios actuales y los nuevos. Podés corregir valores y desmarcar las filas que no quieras aplicar.

7. Presioná **Guardar precios seleccionados** y esperá el resultado. Si algún artículo falla, quedará seleccionado para reintentar.

**Stock actual queda como referencia en el archivo. Este procedimiento actualiza precios, no existencias.** Los precios cero y las celdas vacías se excluyen de la actualización.

## Requisitos y archivos generados

El comando requiere Node.js 22.13+ o 24+ y las dependencias del proyecto instaladas. En una instalación nueva, ejecutar primero desde la carpeta del proyecto:

```powershell
npm ci
```

Se generan archivos en `data/convertidos/`:

- `Listado de precios.xlsx`: hoja **Precios** con Código, Lista 1, Lista 2, Lista 3 y Stock actual; hoja **Revisión** con códigos, páginas del PDF y detalles de lecturas dudosas.
- `Listado de precios.csv`: las mismas cinco columnas, separadas por punto y coma, con coma decimal y codificación UTF-8.
- `Listado de precios-revision.csv`: las observaciones para revisión.

Código se guarda como texto en Excel para conservar sus ceros iniciales. Precios y stock son números; se conservan precios cero y existencias negativas o fraccionarias tal como aparecen en el PDF. Las celdas no confiables quedan vacías. Si un código aparece repetido con valores distintos, la celda conflictiva queda vacía y se informa en Revisión.

El script admite el formato de texto del ERP con encabezados Código, Lista 1/2/3 y Stock actual. No hace OCR ni adivina valores. Las columnas de descripción, costo, oferta y márgenes no se exportan. El reporte no modifica el PDF original ni se conecta a Supabase.

## Elegir otra ubicación de salida

Para guardar una conversión con otro nombre y conservar las anteriores:

```powershell
npm run convertir:precios -- "data/Listado de precios.pdf" "data/convertidos/precios-octubre.xlsx"
```

El Excel es el formato recomendado para abrir y editar. Si se abre el CSV directamente en Excel, este puede convertir los códigos a números; no volver a guardarlo sin definir Código como texto. Los archivos generados contienen información comercial y quedan excluidos de Git en la carpeta predeterminada.
