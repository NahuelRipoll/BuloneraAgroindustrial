# Validación de Mercado Pago — 30/10/2026

Se ejecutaron 85 pruebas automáticas del proyecto (38 específicas de pagos), 12 pruebas de navegador y 29 comprobaciones contra el preview. Todas pasaron. Compilaron correctamente las configuraciones de Preview y Production. Esto valida el circuito implementado de pruebas; no acredita que esté listo para cobros reales.

## Alcance comprobado

| Área | Evidencia | Resultado |
| --- | --- | --- |
| Importes y ofertas | Handler real con catálogo controlado; preferencias reales del preview | El servidor ignora el precio enviado por el navegador y usa el catálogo; no aplica descuento por transferencia |
| Productos simples y medidas | Checkout local y dos preferencias distintas por ejecución remota | Código, importe, moneda y receptor correctos |
| Cantidades, stock y SKU | Entradas inválidas locales y remotas | Cantidad cero, duplicados, stock insuficiente y SKU cambiado rechazados |
| Acceso al estado | Ruta real y preview | Exige origen y token; un token ajeno no permite consultar |
| Estados y retorno | Rutas reales con respuesta de API controlada y navegador | Aprobado, pendiente, en proceso, rechazado y cancelado; la URL no decide la aprobación |
| Reconsulta y carrito | Navegador con respuestas controladas | Permite reintentar y conserva los productos; el botón se bloquea mientras inicia el checkout |
| Firmas | HMAC real, rutas y preview | Firma incorrecta rechazada; tipo ajeno firmado ignorado; errores recuperables devuelven 503 |
| Confirmación completa local | Webhook/retorno reales, respuesta HTTP de MP simulada y migración ejecutada en PGlite | Registro atómico, recuperación por retorno sin webhook y una sola compra ante reintentos |
| Permisos SQL | Roles anon/authenticated/service_role en PGlite | Los visitantes y usuarios comunes no leen ni confirman compras de prueba |
| Validación SQL | Migraciones reales en PGlite | Rechaza importe, moneda y vendedor distintos; pago reutilizado, pedido ya pagado con otro pago y filas inválidas |
| Aislamiento | PGlite y comparación del catálogo público antes/después en preview | Las confirmaciones de prueba no modifican stock/ventas reales; los checkouts remotos no cambian el catálogo |
| Dominio principal | Navegador y solicitudes reales | Cero botones de Mercado Pago; checkout, consulta de estado y webhook devuelven 503 |

En PGlite, las llamadas de reintento simultáneas se ejecutan sobre una sola conexión. Se comprobó idempotencia; no se realizó una prueba de carga o concurrencia con múltiples conexiones independientes al Supabase remoto.

## Problemas encontrados y corregidos en la rama de pruebas

1. La función SQL original aceptaba algunos parámetros nulos porque las comparaciones con NULL no daban verdadero. La nueva migración `202610300002_mercadopago_confirmation_validation.sql` usa comparaciones que rechazan nulos y valida el identificador del pago. La prueba falló antes de la corrección y pasó después.
2. `confirmPayment()` ahora comprueba ID, referencia, importe positivo y finito, moneda ARS y receptor antes de invocar la base. Esto agrega una defensa aunque la nueva migración todavía no esté aplicada.
3. El resultado y el carrito mostraban errores técnicos de JSON ante respuestas vacías. Ahora presentan mensajes comprensibles y permiten reintentar. La prueba de navegador del resultado falló antes del arreglo y pasó después.

La migración nueva **no fue aplicada al Supabase remoto**: falta acceso administrativo en esta sesión. Ejecutar solamente ese archivo en SQL Editor; no repetir la migración inicial de pagos. Reemplaza la función y sus permisos, sin modificar stock ni precios. Mantener Mercado Pago deshabilitado en producción.

## Compras efectivas en Mercado Pago: pendientes

Las comprobaciones remotas crearon cuatro checkouts simulados en total (dos ejecuciones, cada una con un producto simple y una medida). Se verificaron sus preferencias mediante la API del vendedor de prueba y quedaron pendientes; no se ingresaron tarjetas ni se pagaron.

Con una preferencia recién creada y válida, la página externa de Mercado Pago mostró «Hubo un error accediendo a esta pagina...» en el navegador automatizado. En una comprobación posterior de una preferencia anterior se verificó además la pantalla de expiración, consistente con su vencimiento a los 30 minutos. No se concluye que el error externo sea del código del sitio ni se lo considera resuelto.

Por lo tanto, **no se completaron hoy pagos efectivos de prueba aprobados, rechazados o pendientes en Checkout Pro**, ni sus notificaciones efectivas. El aprobado documentado el 23/10 es una comprobación histórica y no sustituye esta validación. Falta reproducir el checkout en un navegador habitual, iniciar sesión con el comprador de prueba y completar estos escenarios. No están disponibles en esta sesión las credenciales/sesión de ese comprador. Tampoco hay clave administrativa local para inspeccionar directamente las tablas remotas.

Según la [guía oficial de compras de prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases), usar la cuenta compradora de prueba y los titulares de prueba correspondientes (`APRO`, `OTHE`, `CONT`). Los resultados controlados en las pruebas de navegador son simulaciones y no sustituyen esos pagos externos. Consultar también la [documentación oficial de notificaciones](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/additional-settings/optional-notifications).

## Trabajo funcional antes de habilitar cobros reales

- Reserva y descuento de stock, incluidos cambios de disponibilidad entre inicio y aprobación.
- Datos del comprador, entrega y costo de envío.
- Recuperación automática si faltan retorno y webhook.
- Conciliación de múltiples pagos para una preferencia, reintegros y contracargos. La prueba de esos estados verifica que no creen una venta nueva; **no** implementa reversión ni conciliación de una venta previamente aprobada.
- Límites de solicitudes, seguimiento operativo y pruebas de concurrencia con múltiples conexiones.

## Repetir la validación

- `npm run test:payments`: 38 pruebas de pagos (incluye SQL y rutas).
- `npm test`: 85 pruebas del proyecto.
- Compilar en modo Preview con pagos de prueba habilitados y ejecutar `npm run test:payments:ui`: 12 pruebas del navegador con respuestas controladas.
- En Windows, si el proceso queda esperando al cerrar el servidor automático, iniciar el servidor en otra terminal en el puerto 3102 y establecer `PLAYWRIGHT_REUSE_SERVER=true` antes de ejecutar la batería de navegador. La ejecución final se hizo así y terminó con código 0.
- `node tools/check-mercadopago-preview.mjs`: validaciones remotas sin crear preferencias. Requiere las variables locales del vendedor de prueba y la URL del preview.
- `node tools/check-mercadopago-preview.mjs --create-checkout`: crea hasta dos checkouts de prueba sin pagarlos. `--inspect-checkout` también intenta abrir el checkout externo. No admite el dominio productivo.

Los recibos con URL de retorno/token, las capturas externas y el informe JSON se guardaron en `backups/`, excluido de Git. No se publican esos tokens en este informe.
