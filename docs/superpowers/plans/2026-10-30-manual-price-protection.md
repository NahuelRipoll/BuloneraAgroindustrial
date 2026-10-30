# Protección de precios manuales Implementation Plan

**Goal:** Excluir productos protegidos de cargas de precios y conservar la edición manual.

**Architecture:** Guardar `price_import_protected` dentro de `products.specs`, que ya persiste y forma parte de los respaldos. Mostrar un control por producto, excluir sus medidas de las vistas previas y validar nuevamente al aplicar. Un RPC de importación verifica la protección guardada bajo el mismo bloqueo transaccional que el guardado de catálogo y actualiza únicamente precios, conservando stock y metadatos.

**Tech Stack:** Next.js, React, TypeScript, Supabase/PostgreSQL, node:test y PGlite.

- [x] Agregar estado opcional `priceImportProtected` y conservar `specs` al cargar y guardar. Para registros sin decisión explícita, proteger SKU `2121032` y nombres con la palabra `FOLIAR` o `FOLIARES`; permitir desactivar explícitamente.
- [x] Añadir casilla «Excluir de importaciones de precios» en Catálogo y editor. Mostrar que incluye medidas y requiere guardar.
- [x] Excluir protegidos de PDF, Excel/CSV, pegado y porcentaje; informar códigos excluidos. Validar otra vez al aplicar y distinguir edición manual mediante un modo guardado con la vista previa.
- [x] Crear migración con RPC `import_catalog_product_prices` que toma el mismo bloqueo de escritura, rechaza protegidos según estado actual y guarda únicamente precios con comprobación de valores anteriores. Materializar excepciones iniciales sin tocar precios. No aplicar migración remota sin acceso disponible.
- [x] Probar exclusiones, desprotección explícita, medidas, vista previa antigua, edición manual y rechazo en servidor con PGlite. Ejecutar `npm test`, comprobación TypeScript y build; documentar activación.

Se ejecuta en esta sesión según autorización del usuario. No se incluyen cotizaciones ni automatización USD.

Activación en Supabase y publicación pendientes: no hay acceso administrativo remoto configurado. Las cuatro pruebas de navegador seleccionadas mostraron OK; se interrumpió el proceso cuando quedó esperando el cierre del servidor local en Windows.
