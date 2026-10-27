# Permisos y respaldos del catálogo

## Activación

1. Aplicar en Supabase SQL Editor `supabase/migrations/202610270002_catalog_protection.sql`. Requiere todas las migraciones previas de catálogo, administradores y galería de Nosotros. Ejecutar el archivo completo una sola vez; la transacción revierte si hay un error.
2. Reiniciar el servidor local porque se actualizó Next.js. Abrir `/admin/respaldos` con una cuenta administrativa y crear el primer respaldo.
3. Guardar el JSON descargado fuera de esta computadora. Contiene el catálogo privado; compartirlo solo con personas autorizadas.
4. Aplicar la migración antes de desplegar el código nuevo: el guardado de productos ahora requiere `save_catalog_product`. No hay una alternativa que vuelva al guardado anterior sin transacción.

La migración no edita productos, membresías, pedidos ni credenciales existentes. Crea políticas restrictivas, funciones, tablas de respaldos y una primera copia del catálogo actual. La protección efectiva del proyecto remoto debe comprobarse después de aplicarla; las pruebas automatizadas usan PostgreSQL local y las migraciones reales del repositorio.

## Qué se guarda y cómo se recupera

- Cada modificación o eliminación de un producto conserva su versión previa con variantes e imágenes. Los cambios directos a variantes y fotos también generan historial; se conserva una copia por producto y transacción.
- Modificar o eliminar la galería de Nosotros conserva un respaldo completo previo.
- Los respaldos manuales incluyen todos los productos de Supabase, publicados y borradores, con sus variantes, fotos y la galería de Nosotros. No incluyen borradores que solo existen en el navegador, pedidos, usuarios, contraseñas ni secretos.
- La descarga incorpora los archivos del bucket `product-images` referenciados por la copia. Las fotos externas y las rutas locales `/imagenes/` quedan como enlaces: dependen de sus respectivos servidores y del repositorio. Si falta una foto del bucket, la descarga se interrumpe en vez de emitir una copia incompleta.
- El archivo se puede importar en el mismo proyecto Supabase. Se validan versión, proyecto, relaciones y rutas antes de subir imágenes. Importación y descarga admiten hasta 200 MB; para catálogos mayores se necesita exportar PostgreSQL y Storage por separado.
- Al restaurar se reemplazan los productos incluidos en la copia y sus variantes e imágenes; los productos agregados posteriormente se conservan. El estado de publicación y los precios vuelven a los de la copia. Un respaldo completo también restaura la galería de Nosotros.
- El servidor crea una copia completa previa y restaura los registros dentro de una transacción. Cualquier error revierte todos los cambios de la base. Los archivos faltantes se suben antes; una subida fallida no modifica el catálogo y puede dejar archivos sin referencias.
- Eliminar un producto desde el panel conserva sus archivos de Storage para que funcionen las recuperaciones. No eliminar archivos manualmente sin comprobar las referencias de los respaldos. No hay limpieza automática ni vencimiento del historial; revisar uso de almacenamiento periódicamente.
- El respaldo completo previo a una restauración permite recuperar valores anteriores de los productos que existían. No elimina productos que se hayan recuperado después: para quitarlos hay que hacerlo explícitamente.

Los snapshots almacenados en la misma base ayudan frente a errores de edición, pero no sustituyen una copia independiente de Supabase. La descarga contiene fotos y datos para recuperar el catálogo en el mismo proyecto; una recuperación de todo el proyecto necesita además las políticas, las migraciones y la configuración de Auth/Storage.

## Guardado seguro

Las imágenes se suben con nombres únicos antes de cambiar registros. Producto, variantes y referencias de fotos se guardan juntos mediante una función SQL. Si falla una variante o foto, el producto publicado conserva su versión anterior. Las variantes conservan sus IDs al editarse y se eliminan al convertir el producto en simple.

Las políticas restringen escritura de catálogo, galería y archivos a `is_catalog_admin()`, incluso ante otra política permisiva accidental. Usuarios autenticados no tienen permisos de TRUNCATE ni pueden editar `admin_members`. Los respaldos solo son legibles por administradores; las funciones públicas comprueban autorización y las auxiliares no son invocables desde la API.

## Verificación

```powershell
npm ci
npm test
npx tsc --noEmit
npm run build
npm audit
```

Las pruebas SQL corren con PGlite sobre PostgreSQL local, con roles anon/authenticated y funciones de Auth simuladas. Comprueban rechazo a usuarios no administradores, políticas restrictivas, Storage, historial, guardado y restauración atómicos, recuperación de eliminaciones, preservación de productos nuevos y copias previas.

Después de aplicar la migración en Supabase, comprobar con un producto de prueba: guardar, crear respaldo, modificar, restaurar y eliminar/restaurar. Verificar desde otra cuenta no administradora y sin sesión que la API no permite escribir ni leer respaldos. También revisar en el dashboard de Auth que el registro público siga deshabilitado; esta configuración y MFA no se cambian mediante la migración.
