"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Mail, MessageCircle } from "lucide-react";

const contactEmail = "bulonera@bagroindustrial.com";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function sendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setStatus("sending");
    setErrorMessage("");

    try {
      const response = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No pudimos enviar la consulta.");
      form.reset();
      setStatus("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos enviar la consulta.");
      setStatus("error");
    }
  }

  return <form className="card" onSubmit={sendEmail}>
    <h3>Enviar consulta</h3>
    <p><input className="form-field" name="name" required autoComplete="name" placeholder="Nombre" /></p>
    <p><input className="form-field" name="email" required autoComplete="email" type="email" placeholder="Correo electrónico" /></p>
    <p><input className="form-field" name="phone" required autoComplete="tel" type="tel" placeholder="Teléfono" /></p>
    <p><select className="form-select" name="category" required defaultValue="Bulonería"><option>Bulonería</option><option>Herramientas</option><option>Agro y campo</option><option>Compra mayorista / empresa</option></select></p>
    <p><textarea className="form-area" name="message" required minLength={5} maxLength={4000} rows={5} placeholder="Indicá medidas, cantidades, marca o aplicación." /></p>
    <input className="contact-honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    <div className="button-group-centered">
      <button className="button" type="submit" disabled={status === "sending"}><Mail size={18} /> {status === "sending" ? "Enviando…" : "Enviar consulta"}</button>
      <a className="button-muted" href="https://wa.me/5492634564130"><MessageCircle size={18} /> WhatsApp</a>
    </div>
    {status === "success" && <p className="contact-status success"><CheckCircle2 size={18} /> Consulta enviada. Te responderemos a la brevedad.</p>}
    {status === "error" && <p className="contact-status error" role="alert">{errorMessage}</p>}
    <small className="contact-destination">La consulta se enviará a {contactEmail}.</small>
  </form>;
}
