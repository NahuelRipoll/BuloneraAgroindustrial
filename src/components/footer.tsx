import Link from "next/link";
import { Camera, Mail, MapPin, MessagesSquare, Phone } from "lucide-react";

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
          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            <a className="button-outline" href="#" aria-label="Instagram">
              <Camera size={18} />
            </a>
            <a className="button-outline" href="#" aria-label="Facebook">
              <MessagesSquare size={18} />
            </a>
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: 16, color: "var(--brand)" }}>Navegación</h3>
          <p><Link href="/tienda">Tienda y catálogo</Link></p>
          <p><Link href="/#ofertas">Ofertas destacadas</Link></p>
          <p><Link href="/#nosotros">Quiénes somos</Link></p>
          <p><Link href="/#asesoramiento">Asesoramiento</Link></p>
          <p><Link href="/#contacto">Contacto</Link></p>
        </div>
        <div>
          <h3 style={{ marginBottom: 16, color: "var(--brand)" }}>Medios de pago y envío</h3>
          <p>Aceptamos Mercado Pago, tarjetas y transferencia con descuento especial.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Visa", "Mastercard", "Mercado Pago", "Transferencia", "Andreani"].map((item) => (
              <span className="button-outline" key={item} style={{ minHeight: 34 }}>
                {item}
              </span>
            ))}
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
