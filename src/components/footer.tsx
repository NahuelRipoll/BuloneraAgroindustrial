import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container grid grid-3">
        <div>
          <h3 style={{ marginBottom: 16, color: "var(--brand)" }}>Contacto</h3>
          <p>
            <MapPin size={16} /> Ruta Provincial 22 (Acceso Este), KM 1023, sobre lateral norte, Rodeo del Medio, Maipú, Mendoza
          </p>
          <p>
            <Phone size={16} /> <a href="https://wa.me/5492634564130">+54 9 263 456-4130</a>
          </p>
          <p>
            <Mail size={16} /> <a href="mailto:bulonera@bagroindustrial.com">bulonera@bagroindustrial.com</a>
          </p>
        </div>
        <div>
          <h3 style={{ marginBottom: 16, color: "var(--brand)" }}>Navegación</h3>
          <p><Link href="/tienda">Tienda y catálogo</Link></p>
          <p><Link href="/#ofertas">Ofertas destacadas</Link></p>
          <p><Link href="/#nosotros">Quiénes somos</Link></p>
          <p><Link href="/asesoramiento">Asesoramiento</Link></p>
          <p><Link href="/#contacto">Contacto</Link></p>
        </div>
        <div className="footer-payment-column">
          <h3 style={{ marginBottom: 16, color: "var(--brand)" }}>Medios de pago y envío</h3>
          <p>Aceptamos Mercado Pago, tarjetas y transferencia con descuento especial.</p>
          <div className="footer-payment-tags">
            <span className="payment-logo visa-logo" aria-label="Visa"><img src="/imagenes/visa.png" alt="Visa" /></span>
            <span className="payment-logo mastercard-logo" aria-label="Mastercard"><img src="/imagenes/mastercard.png" alt="Mastercard" /></span>
            <span className="payment-logo mercadopago-logo" aria-label="Mercado Pago"><img src="/imagenes/mercado-pago.png" alt="Mercado Pago" /></span>
            <span className="payment-logo transfer-logo"><img src="/imagenes/transferencia-bancaria.png" alt="Transferencia bancaria" /><b>Transferencia</b></span>
            <span className="payment-logo andreani-logo"><img src="/imagenes/andreani.png" alt="Andreani" /></span>
            <span className="payment-logo correo-argentino-logo"><img src="/imagenes/correo-argentino.png" alt="Correo Argentino" /></span>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <div>
          <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor">Defensa del consumidor</a>
          {" | "}
          <a href="mailto:bulonera@bagroindustrial.com?subject=Bot%C3%B3n%20de%20arrepentimiento">Botón de arrepentimiento</a>
        </div>
        <div>© 2026 Bulonera Agroindustrial. Todos los derechos reservados.</div>
      </div>
    </footer>
  );
}
