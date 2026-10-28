# Fotos de Nosotros

Aplicar `supabase/migrations/202610270001_storefront_gallery.sql` en el editor SQL del proyecto Supabase antes de usar el editor. Requiere las migraciones de catálogo y administradores existentes y el bucket `product-images`.

Entrar a `/admin`, abrir **Fotos de Nosotros**. Subir imágenes JPG, PNG o WebP de hasta 12 MB; se optimizan a JPEG de hasta 1600 píxeles. Se pueden reemplazar, describir, ordenar y quitar; debe quedar al menos una foto y hay un máximo de 12. **Guardar y publicar** actualiza la lista completa. Hasta guardar, los cambios no afectan al carrusel público. Recargar el inicio para ver lo publicado.

Para ajustar el encuadre, arrastrar la foto con el mouse o el dedo dentro de su marco. También se puede enfocar el marco y usar las flechas del teclado (Mayús mueve en pasos mayores), o ajustar los controles Horizontal, Vertical y Zoom (100–300%). Solo se puede arrastrar donde haya imagen sobrante fuera del marco; aumentar el zoom permite desplazarla en ambos ejes. No se modifican los archivos originales.

Los botones **Escritorio** y **Celular** muestran proporciones de recorte aproximadas; el carrusel público adapta el encuadre al tamaño real de la pantalla. **Restablecer encuadre** devuelve la foto al centro horizontal, borde superior y zoom 100%. Las fotos anteriores mantienen ese comportamiento mientras no se ajusten. Reemplazar una foto reinicia su encuadre; cambiar la descripción o el orden lo conserva.

La posición y el zoom se publican con **Guardar y publicar**, junto con la lista y las descripciones. Se guardan como campos opcionales en el JSON existente de `storefront_gallery`, sin una nueva migración. Los respaldos de la galería incluyen estos campos. Si falla la publicación, los ajustes permanecen en el editor para reintentar.

Solo administradores pueden escribir la configuración y subir fotos. Los visitantes pueden leer la lista y las imágenes. Sin configuración, o ante un fallo de lectura, el inicio conserva la foto original. El editor muestra los fallos de conexión y no permite sobrescribir una lista que no pudo cargar.

Las fotos quitadas o reemplazadas se conservan en Storage para evitar romper versiones abiertas del sitio; no se eliminan automáticamente. Las cargas que no se publican también pueden dejar archivos sin uso en `product-images/storefront/`.

Comprobación manual: publicar dos fotos, recargar inicio, navegar con flechas e indicadores; comprobar avance cada cinco segundos y pausa al enfocar o pasar el mouse; comprobar que movimiento reducido desactiva el avance automático. Verificar orden y descripciones después de recargar el editor. Un usuario ajeno a administradores no debe poder acceder al editor ni escribir mediante la API.
