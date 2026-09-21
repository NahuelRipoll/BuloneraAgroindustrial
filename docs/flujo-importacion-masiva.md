# Flujo propuesto para la carga masiva del catálogo

## Objetivo

Actualizar productos, variantes, precios, stock y fotografías de manera masiva,
evitando duplicados y revisando los cambios antes de publicarlos en la tienda.

## 1. Productos y stock desde el ERP

El CSV original del ERP será la fuente principal para:

- SKU.
- Nombre del artículo.
- Categoría o rubro.
- Marca.
- Stock.
- Variantes y medidas.

Cada nueva importación deberá actualizar el stock de los SKU existentes en lugar de
crear productos duplicados.

Los artículos de bulonería con nombres que terminen en `diámetro X largo` se
agruparán bajo un solo producto padre. Cada fila del ERP conservará su SKU y stock
como una variante independiente.

## 2. Precios mediante una planilla complementaria

Se podrá importar un archivo Excel o CSV con esta estructura mínima:

| SKU | Precio | Transferencia |
| --- | ---: | ---: |
| 001342 | 2500 | 2250 |
| 001343 | 2800 | 2520 |

Para los productos con variantes, cada SKU actualizará el precio de su medida.

También se consideran las siguientes herramientas:

- Aplicar un mismo precio a todas las variantes de un producto.
- Aumentar precios mediante un porcentaje.
- Calcular automáticamente el precio de transferencia aplicando un descuento.
- Aplicar reglas de precios por rubro o marca.

### Decisión pendiente

Confirmar si el ERP puede exportar otra planilla que incluya precios. Si existe,
conviene adaptar el importador directamente a ese archivo. En caso contrario, se
creará una plantilla propia de actualización por SKU.

## 3. Fotografías mediante carpeta o ZIP

Las imágenes podrán relacionarse automáticamente mediante el nombre del archivo.

Para artículos simples o variantes específicas:

```text
001342-1.jpg
001342-2.jpg
001342-3.jpg
```

Para compartir imágenes entre todas las variantes de un producto agrupado:

```text
GRP-ABC123-1.jpg
GRP-ABC123-2.jpg
```

Reglas propuestas:

- El prefijo corresponde al SKU.
- El número final determina el orden.
- La imagen terminada en `-1` será la portada.
- Se admitirán varias imágenes por producto.
- Los archivos sin coincidencia se mostrarán antes de realizar la carga.
- Se podrá corregir manualmente una coincidencia antes de guardar.

## 4. Pantalla de revisión

Antes de modificar Supabase, el sistema mostrará un resumen con:

- Productos nuevos.
- Productos que serán actualizados.
- Variantes agrupadas.
- Cambios de stock.
- Cambios de precio.
- Productos sin precio.
- Productos sin fotografías.
- Fotografías sin coincidencia.
- Posibles duplicados.
- Errores que impidan guardar una fila.

Ningún cambio de la vista previa deberá publicarse automáticamente.

## 5. Confirmación única

Después de revisar la importación habrá un único botón:

**Aplicar cambios al catálogo**

Ese botón realizará las altas y actualizaciones en Supabase utilizando el SKU como
clave única. Los productos no se publicarán salvo que la importación o el usuario
lo indiquen expresamente.

## Flujo completo

1. Subir el catálogo o listado de stock del ERP.
2. Agrupar automáticamente productos y variantes.
3. Subir la planilla de precios.
4. Subir una carpeta de fotografías o un archivo ZIP.
5. Relacionar datos e imágenes mediante SKU.
6. Revisar cambios, advertencias y errores.
7. Elegir qué productos quedarán publicados.
8. Presionar **Aplicar cambios al catálogo**.
9. Actualizar productos, variantes e imágenes en Supabase sin duplicar SKU.

## Orden de implementación sugerido

1. Importación masiva de precios por SKU.
2. Reglas de actualización porcentual y precio de transferencia.
3. Selección múltiple de imágenes por nombre de archivo.
4. Soporte para ZIP.
5. Pantalla unificada de revisión y confirmación.
6. Registro de cada importación para poder auditar los cambios.
