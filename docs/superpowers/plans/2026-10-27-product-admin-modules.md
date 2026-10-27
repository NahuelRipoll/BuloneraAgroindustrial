# Administración de productos por tareas

**Goal:** Separar catálogo, carga rápida, importación, precios y ofertas; reducir la carga manual y admitir el PDF real del ERP.

**Architecture:** Rutas independientes con un controlador persistente en el layout de Productos para conservar borradores al cambiar de tarea. Componentes nuevos para la grilla de carga y la revisión de precios. Lectura PDF local mediante PDF.js y geometría de las columnas Código/Lista 1/Lista 2/Lista 3; cambios de precio revisables y guardados mediante el RPC transaccional existente.

**Tech Stack:** Next.js App Router, React, Supabase, PDF.js, pruebas Node.

- [x] Crear menú de Productos y navegación de cinco tareas con rutas propias, preservando el editor existente de variantes e imágenes.
- [x] Crear grilla de carga rápida: múltiples filas, duplicación, valores comunes, pegar columnas de Excel, SKU único, slug automático y guardado por lote como borradores.
- [x] Mantener importación ERP y agregar guardado del lote completo, con errores y pendientes visibles.
- [x] Crear módulo de precios con PDF/Excel/CSV/pegado y porcentaje, filtros, correspondencias exactas de SKU, vista previa anterior/nuevo, exclusión por fila y guardado de los productos afectados.
- [x] Comprobar el PDF de 581 páginas del proyecto mediante coordenadas, conservando ceros iniciales y sin confundir Lista 1/2/3 con costo u oferta. Rechazar filas dudosas y mostrar códigos sin coincidencia.
- [x] Mejorar Catálogo: filtros por marca/rubro/estado, paginación, edición por lote, guardado de pendientes y acceso claro al editor y eliminación.
- [x] Verificar parser con el PDF real, pruebas de precios/grilla, pruebas existentes, TypeScript y compilación. No cambiar pagos ni aplicar modificaciones al catálogo remoto durante las pruebas.
