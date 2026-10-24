# Mercado Pago: entorno de pruebas

La rama `feature/mercado-pago` implementa Checkout Pro mediante la API de preferencias. Los pagos están deshabilitados por defecto. Habilitarlos solamente en el preview de Vercel de esta rama. Se puede utilizar el Supabase actual: el checkout lee el catálogo y guarda las compras simuladas en tablas separadas de las ventas reales. Se comparte infraestructura y credenciales; no es un entorno completamente independiente.

## Preparar el entorno

1. En el Supabase actual con catálogo instalado, ejecutar solamente `202610230001_mercadopago_test.sql` desde SQL Editor. No repetir las migraciones anteriores. Si la migración de pagos ya se había aplicado, preparar una actualización específica antes de continuar. Para un proyecto nuevo, ejecutar todas las migraciones en orden. Los productos estáticos de demostración y borradores del navegador no son cobrables.
2. Crear una aplicación de Mercado Pago y las cuentas de prueba vendedora y compradora de Argentina. Obtener el Access Token correspondiente al vendedor de prueba. El servidor consulta `/users/me` y exige la etiqueta `test_user`; una credencial de un vendedor real se rechaza antes de crear el checkout. Usar el `init_point` de la preferencia con esta cuenta de prueba.
3. Crear un preview de **esta rama** en el proveedor de hosting. Mantener `master` como rama productiva. Si el preview requiere autenticación del proveedor, permitir el acceso de Mercado Pago al webhook y al retorno.
4. Configurar las variables de pago solamente en ese preview, preferentemente restringidas a `feature/mercado-pago`. Usar `.env.local` para ejecución local; `env.local` no es el nombre que Next.js carga automáticamente. Usar credenciales del vendedor de prueba de Mercado Pago. Las credenciales de Supabase deben pertenecer al proyecto donde se aplicó la migración.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=CLAVE_PUBLICA_DEL_PROYECTO
SUPABASE_SERVICE_ROLE_KEY=CLAVE_PRIVADA_DEL_PROYECTO
NEXT_PUBLIC_MERCADOPAGO_ENABLED=true
MERCADOPAGO_ACCESS_TOKEN=TOKEN_DEL_VENDEDOR_DE_PRUEBA
MERCADOPAGO_WEBHOOK_SECRET=SECRETO_DE_LA_APLICACION
MERCADOPAGO_TEST_BUYER_ID=USER_ID_DEL_COMPRADOR_DE_PRUEBA
APP_URL=https://URL-DEL-PREVIEW
```

`SUPABASE_SERVICE_ROLE_KEY`, el token y el secreto se usan exclusivamente en el servidor. No agregarles el prefijo `NEXT_PUBLIC_`. La variable pública que habilita el botón requiere reconstruir el sitio cuando cambia.

5. Configurar notificaciones de tipo `payment` a `https://URL-DEL-PREVIEW/api/mercadopago/webhook` en Mercado Pago y copiar el secreto de firma a la variable correspondiente. La URL debe ser estable y coincidir con `APP_URL`. Para desarrollo local se necesita una URL HTTPS pública (por ejemplo, un túnel) que permita llegar al servidor.

## Comprobar el circuito

- En el carrito, **Ir a Mercado Pago (prueba)** muestra el total sin descuento por transferencia y abre el checkout externo de Mercado Pago en la misma pestaña. El comprador elige el medio de pago allí; el sitio no solicita datos de tarjeta. Las URLs de retorno llevan a `/compra/resultado`, donde se verifica el estado con el servidor.
- Agregar un producto publicado, incluyendo variantes y ofertas. Pagar con la cuenta compradora y tarjetas de prueba oficiales. No usar tarjetas ni cuentas reales.
- Verificar pago aprobado, pendiente y rechazado. La pantalla no confía en `status` de la URL: consulta el pago en la API y exige coincidencia de referencia, importe, moneda y vendedor.
- Revisar `mercadopago_checkouts`, `mercadopago_test_orders` y `mercadopago_test_order_items`. Solo un pago aprobado crea una venta. Volver a consultar o reenviar la notificación no debe duplicarla.
- Intentar alterar cantidades, SKU o precio desde el navegador; el servidor rechaza cantidades inválidas y productos sin stock, y calcula precios desde Supabase. El descuento por transferencia no se aplica al pago de Mercado Pago.
- Simular las notificaciones desde el panel. Una firma incorrecta devuelve 401. Si Mercado Pago simula un ID que no corresponde a un pago consultable, se devuelve 503: no se registra una venta ficticia.
- Algunos pagos de prueba no envían webhooks. Al regresar al sitio, la pantalla verifica el `payment_id` en la API; si el comprador no regresa y no hay webhook, el pedido queda pendiente. Se puede volver a consultar desde la misma URL de retorno.

## Alcance y pendientes antes de producción

Esta entrega es exclusivamente para pruebas. En este flujo se observó que Checkout Pro devuelve `live_mode=true` también para las cuentas de prueba. Para aceptar ese caso se exige verificar el vendedor como `test_user`, su coincidencia con el receptor del pago y que el comprador coincida con `MERCADOPAGO_TEST_BUYER_ID`, copiado desde Cuentas de prueba. No configurar un comprador real en esa variable. No se habilita producción cambiando una variable.

No reserva ni descuenta stock; comprueba disponibilidad al iniciar el pago. Antes de admitir cobros reales hay que implementar reservas y conciliación, resolver pagos duplicados de una preferencia, reintegros y contracargos, datos del comprador, condiciones de entrega y costos de envío, límites de solicitudes y recuperación automática de pagos sin retorno/webhook. Las compras de prueba no se escriben en `orders` ni `order_items` y no aparecen en las analíticas de ventas reales.

El carrito se conserva al volver para evitar borrar productos agregados en otra pestaña. Aplicar la migración una sola vez. Publicar la rama genera un preview; no fusionarla con `master` para probar la integración.

Documentación oficial:

- [API de preferencias](https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro-preferences/overview)
- [Compras de prueba](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/integration-test/test-purchases)
- [Notificaciones y firma](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/payment-notifications)
