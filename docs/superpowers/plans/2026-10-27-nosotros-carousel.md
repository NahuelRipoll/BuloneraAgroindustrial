# Carrusel de Nosotros

**Goal:** Administrar fotos del local y mostrarlas en un carrusel público.

**Architecture:** Configuración única en Supabase con una lista ordenada de imágenes. Storage conserva las fotos; RLS permite publicar únicamente a administradores existentes. La foto actual es el respaldo si no hay configuración.

**Tech Stack:** Next.js, React, Supabase.

- [ ] Crear migración `supabase/migrations/202610270001_storefront_gallery.sql` para configuración pública y escritura administrativa.
- [ ] Crear `src/lib/storefront-gallery.ts` con tipos, respaldo y lectura compartidos.
- [ ] Crear carrusel accesible en `src/components/storefront-carousel.tsx` con flechas, indicadores, pausa y respeto a movimiento reducido. Integrarlo en `src/app/page.tsx` conservando estadísticas.
- [ ] Crear editor protegido en `/admin/nosotros`, con carga, reemplazo, descripción, orden y eliminación; publicación atómica y errores visibles.
- [ ] Agregar acceso desde panel y estilos adaptables.
- [ ] Ejecutar TypeScript, pruebas existentes y revisión de diferencias. Documentar aplicación de la migración si no hay conexión administrativa disponible.
