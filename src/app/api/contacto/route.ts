import { NextResponse } from "next/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] || character);
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Los datos enviados no son válidos." }, { status: 400 });
  }

  if (clean(payload.website, 100)) return NextResponse.json({ ok: true });

  const name = clean(payload.name, 100);
  const email = clean(payload.email, 160);
  const phone = clean(payload.phone, 60);
  const category = clean(payload.category, 100);
  const message = clean(payload.message, 4000);

  if (!name || !EMAIL_PATTERN.test(email) || !phone || !category || message.length < 5) {
    return NextResponse.json({ error: "Completá todos los campos con datos válidos." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const destination = process.env.CONTACT_EMAIL || "bulonera@bagroindustrial.com";
  const sender = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !sender) {
    console.error("Faltan RESEND_API_KEY o CONTACT_FROM_EMAIL para enviar el formulario.");
    return NextResponse.json({ error: "El envío de correo todavía no está configurado." }, { status: 503 });
  }

  const safe = { name: escapeHtml(name), email: escapeHtml(email), phone: escapeHtml(phone), category: escapeHtml(category), message: escapeHtml(message).replace(/\n/g, "<br />") };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: sender,
      to: [destination],
      reply_to: email,
      subject: `Consulta web - ${category} - ${name}`,
      html: `<h2>Nueva consulta desde la web</h2><p><strong>Nombre:</strong> ${safe.name}</p><p><strong>Email:</strong> ${safe.email}</p><p><strong>Teléfono:</strong> ${safe.phone}</p><p><strong>Tipo de consulta:</strong> ${safe.category}</p><hr /><p>${safe.message}</p>`,
    }),
  });

  if (!response.ok) {
    console.error("Resend rechazó el correo:", response.status, await response.text());
    return NextResponse.json({ error: "No pudimos enviar la consulta. Intentá nuevamente en unos minutos." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
