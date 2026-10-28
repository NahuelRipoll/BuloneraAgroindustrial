# Pendientes para la próxima sesión

## Importación de precios por artículos existentes — implementado el 28/10/2026

Pedido del usuario al cerrar la sesión del 27/10/2026: al cargar un PDF o Excel de precios, trabajar únicamente con los artículos que ya existen en el catálogo.

- Revisar y ajustar el filtrado y la vista previa para limitar el trabajo a esas coincidencias.
- Usar la columna **Código** como SKU, tanto para productos simples como para medidas/variantes, conservando ceros iniciales.
- Mantener la elección de Lista 1, 2 o 3 y la revisión antes de guardar.
- La importación de precios no debe crear artículos nuevos.

Implementado: la revisión incluye únicamente coincidencias con productos o variantes guardados en el catálogo. Los códigos ajenos se omiten y solo se informa su cantidad; no generan conflictos. Código tiene prioridad sobre Artículo en Excel/CSV. Se conservan los ceros iniciales, la elección de lista y la confirmación antes de guardar. Los borradores exclusivamente locales quedan excluidos para evitar altas desde Precios.
