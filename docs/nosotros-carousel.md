# Fotos de Nosotros

Aplicar `supabase/migrations/202610270001_storefront_gallery.sql` en el editor SQL del proyecto Supabase antes de usar el editor. Requiere las migraciones de catálogo y administradores existentes y el bucket `product-images`.

Entrar a `/admin`, abrir **Fotos de Nosotros**. Subir imágenes JPG, PNG o WebP de hasta 12 MB; se optimizan a JPEG de hasta 1600 píxeles. Se pueden reemplazar, describir, ordenar y quitar; debe quedar al menos una foto y hay un máximo de 12. **Guardar y publicar** actualiza la lista completa. Hasta guardar, los cambios no afectan al carrusel público. Recargar el inicio para ver lo publicado.

Solo administradores pueden escribir la configuración y subir fotos. Los visitantes pueden leer la lista y las imágenes. Sin configuración, o ante un fallo de lectura, el inicio conserva la foto original. El editor muestra los fallos de conexión y no permite sobrescribir una lista que no pudo cargar.

Las fotos quitadas o reemplazadas se conservan en Storage para evitar romper versiones abiertas del sitio; no se eliminan automáticamente. Las cargas que no se publican también pueden dejar archivos sin uso en `product-images/storefront/`.

Comprobación manual: publicar dos fotos, recargar inicio, navegar con flechas e indicadores; comprobar avance cada cinco segundos y pausa al enfocar o pasar el mouse; comprobar que movimiento reducido desactiva el avance automático. Verificar orden y descripciones después de recargar el editor. Un usuario ajeno a administradores no debe poder acceder al editor ni escribir mediante la API.
