# Integración en dominio principal

**Objetivo:** Integrar feature/mercado-pago en master conservando las mejoras del administrador y dejando pagos deshabilitados en producción.

**Implementación:** Next.js fuerza la bandera pública de pagos a false al compilar para Vercel Production o master. El servidor también rechaza los pagos en esos entornos independientemente del valor de la bandera.

- [x] Verificar ambos bloqueos con pruebas de configuración y pagos, incluyendo una bandera habilitada por error.
- [x] Ejecutar pruebas y build con entorno Production simulado; comprobar carrito sin botón y checkout bloqueado. Evidencia: 63 pruebas, build correcto, comprobación en navegador con cero botones de Mercado Pago y HTTP 503 del checkout.
- [ ] Guardar cambios específicos, integrar master actualizado mediante fast-forward y subir master. Conservar archivos de datos locales sin incluirlos.
- [ ] Verificar publicación en bagroindustrial.com: versión actualizada y Mercado Pago deshabilitado. Informar cualquier limitación de verificación.

No se cambian secretos ni se habilitan cobros. La migración más reciente fue ejecutada por el usuario. Las migraciones anteriores ya se utilizaron en el mismo proyecto Supabase durante las pruebas del administrador.
