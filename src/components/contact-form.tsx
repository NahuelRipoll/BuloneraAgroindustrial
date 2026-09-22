"use client";

import { FormEvent } from "react";
import { Mail, MessageCircle } from "lucide-react";

const contactEmail = "bulonera@bagroindustrial.com";

export function ContactForm() {
  function sendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const category = String(data.get("category") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    const subject = `Consulta web - ${category} - ${name}`;
    const body = [`Nombre: ${name}`, `Teléfono: ${phone}`, `Tipo de consulta: ${category}`, "", "Consulta:", message].join("\n");

    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return <form className="card" onSubmit={sendEmail}>
    <h3>Enviar consulta</h3>
    <p><input className="form-field" name="name" required autoComplete="name" placeholder="Nombre" /></p>
    <p><input className="form-field" name="phone" required autoComplete="tel" type="tel" placeholder="Teléfono" /></p>
    <p><select className="form-select" name="category" required defaultValue="Bulonería"><option>Bulonería</option><option>Herramientas</option><option>Agro y campo</option><option>Compra mayorista / empresa</option></select></p>
    <p><textarea className="form-area" name="message" required rows={5} placeholder="Indicá medidas, cantidades, marca o aplicación." /></p>
    <div className="button-group-centered">
      <button className="button" type="submit"><Mail size={18} /> Enviar por mail</button>
      <a className="button-muted" href="https://wa.me/5492634564130"><MessageCircle size={18} /> WhatsApp</a>
    </div>
    <small className="contact-destination">La consulta se enviará a {contactEmail}.</small>
  </form>;
}
