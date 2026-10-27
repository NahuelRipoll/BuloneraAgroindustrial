# Permisos y respaldos del catálogo

**Goal:** Restringir las modificaciones a administradores y permitir recuperar productos, variantes y fotos.

**Architecture:** RLS restrictiva adicional, historial automático por producto y snapshots completos mediante funciones SQL autorizadas. Guardado y restauración transaccionales; Storage conserva archivos referenciados por respaldos. El panel permite descargar el catálogo con copias de las fotos del bucket y restaurar sin borrar artículos ajenos al respaldo.

**Tech Stack:** Next.js, Supabase, PostgreSQL, Node test runner.

- [x] Crear migración de permisos: revocar escrituras anónimas, restringir escrituras autenticadas y proteger membresías administrativas.
- [x] Crear historial privado y funciones de snapshot, guardado atómico y restauración. Antes de restaurar, crear un respaldo de seguridad dentro de la misma transacción.
- [x] Reemplazar el guardado secuencial del panel por la función atómica. Subir fotos antes de modificar registros; conservar archivos al eliminar productos.
- [x] Agregar `/admin/respaldos`: crear, listar, descargar con imágenes del bucket, importar y restaurar. Mostrar alcance, confirmación, progreso y errores.
- [x] Agregar pruebas PostgreSQL locales para permisos, historial, restauración, rollback y guardado atómico; validar el formato de archivos.
- [x] Ejecutar pruebas y TypeScript, revisar diff y documentar migraciones pendientes. No aplicar cambios remotos sin acceso administrativo.

Validación local: 28 pruebas, TypeScript y build correctos. Auditoría npm sin vulnerabilidades conocidas después de actualizar Next.js a 16.4.3 y las dependencias transitivas afectadas. Pendiente aplicar la migración y comprobar el panel en el proyecto remoto.
