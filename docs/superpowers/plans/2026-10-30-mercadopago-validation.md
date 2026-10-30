# Validación completa de Mercado Pago de pruebas

**Objetivo:** Comprobar checkout, confirmación, notificaciones, base de datos y retorno sin habilitar pagos productivos.

**Arquitectura:** Ejecutar los módulos reales con HTTP y Supabase simulados para entradas adversas; ejecutar la migración de pagos en PGlite para probar restricciones, permisos y transacciones reales; probar las pantallas reales con Playwright y respuestas controladas. Verificar además el dominio productivo y el preview con solicitudes acotadas. Separar simulaciones locales de compras efectivas de Mercado Pago.

**Tecnologías:** node:test, PGlite, Playwright, API de Mercado Pago y preview de Vercel.

- [x] Ampliar `tests/mercadopago.test.cjs`: rechazado/cancelado/en proceso, cantidades inválidas, variantes y ofertas, fallos de API/DB, webhook firmado y consulta de estado con token/origen incorrectos.
- [x] Agregar `tests/mercadopago-db.test.cjs`: migración real; idempotencia, duplicados, importes/moneda/vendedor incorrectos, rollback y permisos. Verificar aislamiento de stock y ventas reales. Casos nulos deben rechazarse.
- [x] Agregar pruebas de navegador y configuración independiente para resultado aprobado, pendiente, rechazado/cancelado, reconsulta, errores, carrito conservado, URL manipulada y bloqueo productivo. No incluir valores secretos en artefactos.
- [x] Ejecutar el checkout de prueba remoto solo si el preview habilitado y vendedor de prueba pueden verificarse. No ingresar ni usar cuentas o tarjetas reales; documentar restricciones si se requiere sesión del comprador.
- [x] Corregir fallos demostrados, repetir comprobaciones afectadas y ejecutar regresión/build. Guardar informe con resultados reproducibles y pendientes de acceso o funcionalidad.

Evidencia: `docs/mercado-pago-validacion-2026-10-30.md`. Pasaron 85 pruebas, 12 pruebas de navegador y 29 comprobaciones remotas. Pendientes externos: aplicar migración correctiva en Supabase y completar pagos efectivos en Checkout Pro; la página externa dio error con la preferencia vigente. No se habilitaron pagos productivos.

Los cambios se desarrollan sobre feature/mercado-pago. No se publican cambios de pagos en master como parte de esta validación.
