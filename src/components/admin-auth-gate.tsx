"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { LogIn, LogOut, Mail } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const supabase = createSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setLoading(false); });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function login(event: FormEvent) {
    event.preventDefault(); setMessage("Enviando enlace…");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: `${window.location.origin}/admin/productos` } });
    setMessage(error ? error.message : "Revisá tu correo: te enviamos un enlace para entrar.");
  }

  if (loading) return <section className="card admin-login"><p>Verificando sesión…</p></section>;
  if (!session) return <section className="card admin-login"><Mail size={32} /><span className="eyebrow">Acceso privado</span><h2>Administración del catálogo</h2><p>Ingresá con uno de los correos autorizados. No necesitás contraseña.</p><form onSubmit={login}><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@empresa.com" /><button className="button" type="submit"><LogIn size={18} /> Enviar enlace de acceso</button></form>{message ? <p className="admin-notice">{message}</p> : null}</section>;
  return <><div className="admin-session"><span>Sesión: {session.user.email}</span><button className="button-outline" onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Salir</button></div>{children}</>;
}
