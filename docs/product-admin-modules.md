# Administración de productos

Abrir `/admin/productos`. Cada tarea tiene su propia ruta y el layout mantiene el catálogo cargado al navegar entre módulos.

## Carga rápida

Completar hasta 200 filas, duplicar artículos similares o pegar columnas de Excel en este orden: Código/SKU, Artículo, Marca, Rubro, Precio, Stock, Diámetro y Largo. Se conservan ceros iniciales; los importes admiten formato argentino. Marca y rubro comunes se pueden aplicar al lote. El slug y el precio de transferencia se generan automáticamente.

Si está activa la agrupación, las filas con medida, nombre, marca y rubro iguales forman un producto con variantes y códigos propios. Agregar una foto por fila es opcional. Se guardan como borradores para completar y publicar desde Catálogo. Un código ya existente se bloquea: para actualizarlo usar Catálogo o Precios.

La grilla se conserva en este navegador. Al guardar, los productos se procesan individualmente mediante la función transaccional existente: si falla uno, los demás pueden guardarse y el fallido queda pendiente para reintentar. No es una transacción única de todo el lote.

## Importar archivo

Admite CSV del ERP en UTF-8 o Windows-1252 y la plantilla Excel con hojas Articulos y Variantes. Las variantes de un mismo slug se agrupan. Filtrar rubros, marcas y stock; revisar la vista previa, preparar los artículos y guardar el lote pendiente. Los códigos existentes se omiten para evitar duplicaciones. La importación no sobrescribe el catálogo existente.

## Precios

- **PDF:** lector local para el formato del ERP con columnas Código, Lista 1, Lista 2 y Lista 3. Elegir la lista antes de seleccionar el archivo. Se usa la posición de las columnas, no los números de la descripción ni el costo. Rechaza precios cero y lecturas ambiguas. Máximo 30 MB y 1500 páginas. No realiza OCR sobre documentos escaneados ni pretende admitir cualquier formato PDF.
- **Excel/CSV o pegado:** columnas de código y precio. Mantener los códigos como texto para conservar ceros iniciales.
- **Porcentaje:** aumentos o reducciones por marca/rubro, incluyendo las medidas.
- **Grilla manual:** edición directa de precios por SKU, sin abrir el editor completo de cada artículo.

La tabla muestra únicamente cambios para códigos de productos o medidas ya guardados en el catálogo, incluyendo artículos sin publicar o sin stock. Los borradores exclusivamente locales no participan y este módulo no crea artículos nuevos. Los códigos ajenos se omiten antes de detectar conflictos y se informa solo su cantidad. Los códigos del catálogo repetidos con precios distintos o ambiguos se detallan y quedan fuera de la actualización. Si aparecen Artículo y Código en la planilla, se utiliza Código como SKU.

La tabla muestra precio actual, nuevo, diferencia y página del PDF. Se pueden corregir valores y desmarcar filas antes de guardar. Los filtros no borran las selecciones previas; el resumen muestra el total real seleccionado. La comparación es exacta salvo espacios exteriores y mayúsculas: `00123` y `123` son códigos distintos.

Guardar afecta únicamente los productos seleccionados. Si una parte del lote falla, los artículos fallidos siguen seleccionados para reintentar. Transferencia se calcula con 10% de descuento. Una edición posterior incompatible con la vista previa bloquea el guardado y pide regenerarla.

## Fotos por código

Abrir `/admin/productos/fotos` y seleccionar varias imágenes JPG, PNG o WebP. Se admiten hasta 60 archivos por lote, 12 MB por foto y 120 MB en total. No se sube nada hasta presionar **Guardar fotos seleccionadas**.

- `001342-1.jpg`, `001342-2.jpg`: código y orden de la foto. Se conservan ceros iniciales y se ignoran mayúsculas/minúsculas al comparar códigos.
- `GRP-ABC123-1.jpg`: galería del producto agrupado. Un código de medida también apunta a la galería de su producto, compartida entre todas sus medidas; no crea fotografías exclusivas de una variante.
- `001342.jpg`: orden 1. Si el nombre sin extensión coincide exactamente con un SKU completo (por ejemplo `ABC-1`), se prioriza ese SKU; para su segunda foto usar `ABC-1-2.jpg`.

La revisión muestra archivo, miniatura, código destino, orden y artículo asociado. Los archivos sin coincidencia o inválidos quedan desmarcados; se puede corregir el código, seleccionar la fila o quitarla. Los códigos ambiguos, órdenes inválidos o repetidos para el mismo producto y galerías de más de seis fotos bloquean el guardado mientras estén seleccionados.

Las fotos nuevas se ordenan de menor a mayor y van antes de las existentes: la primera nueva será la portada. Las existentes se conservan después, sin borrar archivos. La vista previa muestra la galería resultante. Para quitar fotos existentes, usar el editor de Catálogo. Solo se usan artículos guardados, también sin publicar o sin stock; este módulo no crea productos ni los publica.

Se optimizan las imágenes y se utiliza el guardado transaccional existente por producto. Si falla un artículo, sus archivos siguen en revisión para reintentar y los ya guardados se quitan del lote. Una subida fallida puede dejar un archivo sin referencias en Storage, sin modificar la galería del producto. Los archivos seleccionados se conservan al navegar entre módulos; recargar la página requiere seleccionarlos nuevamente. Este paso admite selección múltiple de archivos, sin ZIP.

## Catálogo y ofertas

El catálogo carga todas las páginas de Supabase, no solo las primeras 1000 filas. La grilla tiene búsqueda por nombre/SKU/medida, filtros por marca/rubro/estado, páginas de 25/50/100, guardado individual y de pendientes. La selección persiste entre páginas: se pueden actualizar datos comunes, publicación, precios o eliminar en lote. El editor permite agregar, quitar y editar medidas, códigos, stock, precios y fotos.

Las ediciones pendientes se guardan en el navegador y se conservan al navegar y recargar. Para recuperar la versión guardada se puede **Descartar todos los pendientes**, con confirmación; también quita los borradores exclusivamente locales. Las copias locales de productos remotos ya eliminados no se vuelven a incorporar automáticamente. Las ofertas mantienen su pantalla propia.

## Validación

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:ui
node tools/check-price-pdf.mjs "data/Listado de precios.pdf"
```

Las pruebas de navegador requieren la URL pública de Supabase utilizada al compilar (desde `.env.local` o variable de entorno). Interceptan Auth, REST y Storage con cuentas y catálogo simulados: no escriben en Supabase. Los casos de fotos comprueban corrección de coincidencias, galerías compartidas, portada, conservación de fotos existentes, bloqueo de órdenes repetidos, reintento del artículo fallido e imágenes ilegibles sin guardado parcial. El caso PDF usa el archivo comercial local cuando está disponible; no se incorpora ese PDF al repositorio. El worker de PDF.js se copia automáticamente en postinstall, predev y prebuild para mantener la versión sincronizada y no depender de un CDN.

No hay una migración SQL nueva en esta reorganización. Se requiere la migración de permisos y respaldos ya instalada, que proporciona `save_catalog_product`.
