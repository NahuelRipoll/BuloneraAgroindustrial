# Pendientes para la próxima sesión

## Precios manuales y foliares en USD — definición del 30/10/2026

Actualización: el usuario confirmó que ejecutó la migración de protección en Supabase. Confirmación recibida en esta sesión; no verificada con acceso administrativo remoto.

La Lista 1 del ERP no es la fuente correcta para todos los precios. El usuario confirmó estas excepciones, que deben conservar su precio actual:

- Sierra ingletadora SKIL 1800W 220V, código `2121032`: precio manual por el momento.
- Todos los artículos foliares: precio manual por el momento, no solamente los que aparecen entre los cambios de la revisión. Ejemplos identificados: `00015`, `00018` y `00023`; esta lista no es exhaustiva.

Implementado localmente el 30/10: casilla de precio manual por producto (incluye medidas), persistencia en `specs`, exclusión de importaciones/porcentajes y validación de la protección actual en Supabase. Pendiente de activación remota: aplicar `supabase/migrations/202610300001_manual_price_protection.sql` y publicar el código. La migración protege la sierra y nombres con la palabra FOLIAR/FOLIARES sin cambiar precios; respeta decisiones explícitas previas. No se aplicó en Supabase durante esta sesión por falta de acceso administrativo a la base.

Uso: en Admin → Catálogo, marcar «Precio manual» en la tabla o «Excluir de importaciones de precios» en el editor y guardar el artículo. Las importaciones informan los códigos protegidos omitidos. La edición manual sigue disponible. Para volver a importar un protegido, desmarcar y guardar antes de preparar la revisión. La protección es por producto y abarca todas sus medidas.

Activación: ejecutar solamente la nueva migración en SQL Editor del proyecto existente, una vez, sin repetir las anteriores; luego publicar el código. El nuevo importador falla con un aviso si falta la función de Supabase: no utiliza el guardado anterior como alternativa. La importación escribe solo precios y transferencia, conserva stock/fotos/datos y rechaza una revisión si el precio o código cambió desde su preparación. Validación con pruebas automatizadas y base PostgreSQL local; no se actualizaron precios ni stock remotos.

Para un futuro cercano, el usuario solicita actualizar los precios de todos los foliares según la cotización diaria del dólar, porque sus precios base están en USD. Fuente confirmada: [Banco Nación — Personas](https://www.bna.com.ar/Personas), dólar U.S.A., columna Venta. Se toma como referencia la sección Cotización Billetes; explicitar esta selección al implementar. Fórmula propuesta: precio en ARS = precio base en USD × cotización de venta. Conservar la fecha publicada de la cotización y la fecha de consulta. Antes de implementarlo, definir con el usuario:

- Precio base en USD de cada artículo o medida; no inferirlo del precio en pesos ni de Lista 1.
- Momento y frecuencia de actualización desde la fuente confirmada.
- Regla de conversión, redondeo y tratamiento del descuento por transferencia.
- Qué hacer si falta la cotización o está desactualizada, conservando el último precio válido.

La futura actualización por dólar debe mantener estos artículos excluidos de la importación de precios del ERP. La automatización por cotización todavía no está implementada.

## Importación de precios por artículos existentes — implementado el 28/10/2026

Pedido del usuario al cerrar la sesión del 27/10/2026: al cargar un PDF o Excel de precios, trabajar únicamente con los artículos que ya existen en el catálogo.

- Revisar y ajustar el filtrado y la vista previa para limitar el trabajo a esas coincidencias.
- Usar la columna **Código** como SKU, tanto para productos simples como para medidas/variantes, conservando ceros iniciales.
- Mantener la elección de Lista 1, 2 o 3 y la revisión antes de guardar.
- La importación de precios no debe crear artículos nuevos.

Implementado: la revisión incluye únicamente coincidencias con productos o variantes guardados en el catálogo. Los códigos ajenos se omiten y solo se informa su cantidad; no generan conflictos. Código tiene prioridad sobre Artículo en Excel/CSV. Se conservan los ceros iniciales, la elección de lista y la confirmación antes de guardar. Los borradores exclusivamente locales quedan excluidos para evitar altas desde Precios.
