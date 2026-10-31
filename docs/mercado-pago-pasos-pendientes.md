# Mercado Pago: pasos para retomar más tarde

Fecha de referencia: 30/10/2026.

La web principal ya tiene las mejoras del catálogo. **Mercado Pago sigue deshabilitado en producción y debe continuar así.** Los siguientes pasos se hacen en el entorno de pruebas.

## Qué ya está hecho

- Pasaron 85 pruebas automáticas del proyecto, incluidas 38 de Mercado Pago.
- Pasaron 12 pruebas de navegador y 29 comprobaciones contra el preview.
- Se probaron importes, medidas, ofertas, stock insuficiente, firmas, tokens, reintentos y duplicados.
- Las correcciones están subidas a `feature/mercado-pago`; no se pasaron a `master`.
- Falta aplicar una corrección de Supabase y completar las compras dentro de Mercado Pago. Las pantallas simuladas no sustituyen estas compras.

Informe técnico: [validación del 30/10](mercado-pago-validacion-2026-10-30.md).

## 1. Aplicar la corrección en Supabase

- [ ] Entrar al proyecto de Supabase que usa la tienda.
- [ ] Abrir **SQL Editor** y crear una consulta nueva.
- [ ] Abrir este archivo del proyecto: [202610300002_mercadopago_confirmation_validation.sql](../supabase/migrations/202610300002_mercadopago_confirmation_validation.sql).
- [ ] Copiar todo su contenido en SQL Editor y ejecutarlo.
- [ ] Comprobar que termina sin errores y anotar la fecha de ejecución al final de este documento.

**Es un archivo nuevo, distinto del que ejecutaste para proteger precios manuales.** Ejecutar solamente esta corrección; no repetir la migración inicial de Mercado Pago ni el resto de las migraciones anteriores.

Este SQL reemplaza la función que confirma las compras de prueba para que rechace datos incompletos. No cambia productos, precios ni stock y no habilita los pagos en la web principal.

Si aparece un error, conservar el mensaje y revisarlo antes de seguir.

## 2. Abrir la tienda de pruebas

- [ ] Abrir una ventana de incógnito.
- [ ] Entrar a la [tienda de pruebas](https://bulonera-agroindustrial-git-feature-929f71-nripoll02s-projects.vercel.app/tienda).
- [ ] Elegir un producto publicado que tenga stock y agregar una unidad al carrito.
- [ ] Comprobar que aparece **Ir a Mercado Pago (prueba)**.
- [ ] Comprobar el total: Mercado Pago usa el precio normal o la oferta vigente; no aplica el descuento por transferencia.
- [ ] Pulsar el botón y verificar que abre el checkout de Mercado Pago.

Si el botón no aparece, revisar el despliegue de `feature/mercado-pago`. No habilitarlo en Production ni intentar estas pruebas en `www.bagroindustrial.com`.

**Generar un checkout nuevo para cada prueba.** Los enlaces que creamos vencen a los 30 minutos; no reutilizar los guardados de otra sesión.

## 3. Comprobar el acceso a Mercado Pago

- [ ] Usar la cuenta **compradora de prueba**, diferente de la vendedora.
- [ ] Consultar esa cuenta en Mercado Pago Developers → aplicación → Cuentas de prueba.
- [ ] Consultar las tarjetas y datos vigentes en la [guía oficial de compras de prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases).

No usar una cuenta ni una tarjeta real.

Durante la automatización apareció **«Hubo un error accediendo a esta pagina...»** con una preferencia vigente. Todavía falta verificarlo en un navegador habitual.

Si vuelve a ocurrir:

1. Generar otro checkout desde el carrito y abrirlo inmediatamente.
2. Confirmar que se está usando el comprador de prueba.
3. Guardar una captura del mensaje y anotar la hora y el navegador.
4. Retomar la revisión de ese error antes de dar por probado el pago. No intentar solucionarlo usando credenciales reales.

## 4. Completar los tres resultados principales

Hacer una compra nueva para cada caso, siguiendo los datos de la guía oficial. Los nombres de titular de prueba indicados abajo sirven para simular los resultados.

| Caso | Titular de prueba | Qué comprobar al volver al sitio |
| --- | --- | --- |
| Aprobado | `APRO` | Muestra **«Pago de prueba confirmado. Tu pedido quedó registrado.»** |
| Rechazado | `OTHE` | Informa que el pago no se completó y permite volver a intentarlo |
| Pendiente | `CONT` | Informa que el pago sigue pendiente; no lo presenta como aprobado |

- [ ] Compra aprobada completada y retorno comprobado.
- [ ] Compra rechazada completada y retorno comprobado.
- [ ] Compra pendiente completada y retorno comprobado.
- [ ] Si algún resultado no puede generarse con los medios disponibles, anotarlo como pendiente; no marcarlo aprobado por haber visto la simulación local.

En Supabase → **Table Editor**, revisar las tablas de prueba usando el número de pedido que muestra el sitio:

| Tabla | Qué contiene |
| --- | --- |
| `mercadopago_checkouts` | Pedidos iniciados; el aprobado pasa de `pending` a `paid` |
| `mercadopago_test_orders` | Solo compras de prueba confirmadas |
| `mercadopago_test_order_items` | Productos de esas compras confirmadas |

- [ ] El aprobado crea una sola compra en `mercadopago_test_orders`, con el importe correcto y sus productos.
- [ ] El rechazado y el pendiente no crean una compra confirmada.

Nota: la tabla `mercadopago_checkouts` actualmente guarda solo `pending` o `paid`. Un intento rechazado puede seguir figurando como `pending` allí; el mensaje de rechazo se obtiene consultando el pago en Mercado Pago.

## 5. Probar reintentos y el carrito

- [ ] En el resultado aprobado, pulsar **Consultar estado** varias veces y recargar la página. Debe seguir existiendo una sola compra de prueba.
- [ ] En el resultado pendiente, pulsar **Consultar estado**. Solo debe cambiar a confirmado si Mercado Pago efectivamente aprueba ese pago.
- [ ] Volver a la tienda después de un rechazo o de salir del checkout. Los productos del carrito deben conservarse.
- [ ] Comprobar también que el carrito se conserva al volver de un pago aprobado. Es el comportamiento previsto actualmente; no se vacía automáticamente.
- [ ] Repetir una compra con una medida/variante y otra con una oferta, si hay artículos disponibles. Revisar código, medida, cantidad e importe.

Estas pruebas no reservan ni descuentan stock: esa funcionalidad todavía no está implementada.

## 6. Comprobar el webhook

El webhook es la notificación que Mercado Pago envía al sitio sin depender de que el comprador vuelva.

- [ ] En Mercado Pago Developers, revisar las notificaciones de la aplicación después del pago aprobado.
- [ ] Si aparece la notificación efectiva del pago, comprobar que el sitio respondió **HTTP 200**.
- [ ] Si el panel permite reenviarla, hacerlo y verificar que no se duplica la compra en Supabase.
- [ ] Si no llega ninguna notificación de prueba, dejarlo anotado. No marcar el webhook como validado solo porque el retorno confirmó la compra.

Algunos pagos de prueba pueden no enviar webhook. El retorno al sitio consulta el pago como alternativa. **La recuperación automática cuando faltan tanto el retorno como el webhook sigue pendiente de desarrollo.**

## 7. Registrar los resultados y avisar

Completar esta tabla sin guardar contraseñas, tokens ni datos de tarjetas:

| Prueba | Fecha y hora | Número de pedido | Resultado / mensaje |
| --- | --- | --- | --- |
| SQL correctivo | | No corresponde | |
| Acceso al checkout externo | | | |
| Aprobado | | | |
| Rechazado | | | |
| Pendiente | | | |
| Reconsulta sin duplicados | | | |
| Variante | | | |
| Oferta | | | |
| Webhook y reenvío | | | |

Cuando retomes conmigo, podés decir: **«Retomemos Mercado Pago desde docs/mercado-pago-pasos-pendientes.md»** y contar qué casillas completaste o qué error apareció.

## Qué queda para desarrollo, antes de cobrar de verdad

No hace falta resolver estos puntos para hacer las pruebas anteriores. Siguen pendientes antes de habilitar producción:

- Reserva y descuento de stock.
- Datos del comprador, entrega y costo de envío.
- Recuperación de pagos sin retorno ni webhook.
- Conciliación de pagos duplicados, reintegros y contracargos.
- Límites de solicitudes y pruebas de concurrencia con múltiples conexiones.

**Terminar las pruebas no habilita automáticamente los cobros reales.** Mercado Pago debe seguir apagado en el dominio principal hasta completar y revisar ese trabajo.
