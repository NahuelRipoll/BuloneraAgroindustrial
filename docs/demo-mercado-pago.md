# Demo de Mercado Pago — punto de control

Estado guardado el 23 de octubre de 2026 en la rama `feature/mercado-pago`.
Implementación validada: commit `0952ddc`.

## Enlace para mostrar al cliente

[Abrir tienda de demostración](https://bulonera-agroindustrial-git-feature-929f71-nripoll02s-projects.vercel.app/tienda)

El preview es público y utiliza cuentas de prueba de Mercado Pago. Los cobros reales no están habilitados. La web productiva continúa en https://www.bagroindustrial.com/, desde la rama `master`.

## Recorrido de la demostración

1. Abrir el preview, preferentemente en incógnito, y agregar un producto publicado con stock al carrito.
2. Mostrar el total y seleccionar **Ir a Mercado Pago (prueba)**.
3. Completar el pago en Mercado Pago utilizando la cuenta compradora de prueba guardada en el panel de Developers. No usar la cuenta vendedora ni una cuenta real.
4. Para simular un pago aprobado, elegir tarjeta de crédito e ingresar Mastercard `5031 7557 3453 0604`, vencimiento `11/30`, código `123`, titular `APRO`, DNI `12345678`.
5. Volver al sitio y mostrar **Pago de prueba confirmado. Tu pedido quedó registrado.** Si fuera necesario, seleccionar **Consultar estado**.

Las credenciales del comprador se consultan en Mercado Pago Developers → aplicación Bulonera Agroindustrial → Cuentas de prueba. No están incluidas en este documento.

## Qué quedó comprobado

- Creación de la preferencia y redirección externa a Checkout Pro.
- Pago aprobado con las cuentas de prueba configuradas.
- Retorno al sitio con confirmación del pedido, visible en la prueba realizada por el usuario.
- Webhook firmado del pago aprobado: HTTP 200 y notificación aceptada después del último redeploy.
- Compilación de Next.js y 14 pruebas automatizadas satisfactorias en el commit de implementación.

No se comprobó manualmente todo el circuito de pagos pendientes y rechazados; queda como validación adicional antes de producción.

## Dónde quedan los movimientos

Se utiliza el proyecto Supabase actual. La migración `202610230001_mercadopago_test.sql` ya fue aplicada y se verificó el acceso a sus tres tablas:

- `mercadopago_checkouts`: pedidos iniciados, importe, estado e identificador de pago.
- `mercadopago_test_orders`: pedidos de prueba confirmados.
- `mercadopago_test_order_items`: detalle de productos de esos pedidos.

La confirmación no escribe en las tablas reales `orders` y `order_items` ni modifica el stock. No volver a ejecutar la migración ya aplicada.

## Configuración conservada

Las variables de Mercado Pago están configuradas en Vercel para Preview. La URL de rama tiene una excepción de Deployment Protection para permitir el acceso del comprador y del webhook. El archivo local `.env.local` conserva las credenciales y está excluido de Git.

El webhook configurado es la URL base del preview más `/api/mercadopago/webhook`.
`APP_URL` debe seguir apuntando al dominio de rama, sin barra final. No apuntarlo al dominio productivo para esta demo.

Para la particularidad observada de `live_mode=true` con cuentas de prueba, el servidor exige un vendedor identificado como `test_user`, el mismo receptor del pago y el comprador configurado mediante `MERCADOPAGO_TEST_BUYER_ID`.

## Trabajo pendiente para cobros reales

Completar reservas y descuento de stock, datos del comprador, entrega y costos de envío, conciliación, recuperación de pagos sin retorno, control de solicitudes y manejo de duplicados, reintegros y contracargos. Preparar un flujo de producción específico; esta rama no se convierte en productiva cambiando un token.

Guía técnica: [mercado-pago-pruebas.md](mercado-pago-pruebas.md).
Tarjetas de prueba: [documentación oficial de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases).
