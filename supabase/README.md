# Configuración de Supabase

1. Abrir **SQL Editor** en el proyecto de Supabase.
2. Crear una consulta nueva y ejecutar `migrations/202609210001_catalog.sql`.
3. En **Project Settings → API**, copiar la URL y la clave pública `anon` a `.env.local`.
4. Reiniciar el servidor de Next.js.

La migración crea el catálogo, las variantes, la galería y el bucket público
`product-images`. Por seguridad solo habilita lectura pública de productos publicados.
Las operaciones administrativas se habilitarán junto con Supabase Auth; no se usa la
clave `service_role` en el navegador.
