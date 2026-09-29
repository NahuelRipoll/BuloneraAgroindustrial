"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { KeyRound, LogIn, LogOut, Mail } from "lucide-react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type View = "login" | "forgot" | "set-password";

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function handleSession(nextSession: Session | null, event?: AuthChangeEvent) {
      setSession(nextSession);
      setAuthorized(null);
      if (event === "PASSWORD_RECOVERY" || window.location.hash.includes("type=invite") || window.location.hash.includes("type=recovery")) setView("set-password");
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => handleSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => handleSession(nextSession, event));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session || view === "set-password") return;
    let active = true;
    supabase.from("admin_members").select("email").eq("email", session.user.email?.toLowerCase() ?? "").maybeSingle().then(({ data, error }) => {
      if (active) setAuthorized(Boolean(data) && !error);
    });
    return () => { active = false; };
  }, [session, supabase, view]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setMessage(error ? "El correo o la contraseña no son correctos." : "");
    setSubmitting(false);
  }

  async function requestPasswordReset(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/admin` });
    setMessage(error ? error.message : "Si el correo está habilitado, recibirá un enlace para crear una nueva contraseña.");
    setSubmitting(false);
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setMessage("La contraseña debe tener al menos 8 caracteres.");
    if (password !== passwordConfirmation) return setMessage("Las contraseñas no coinciden.");
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMessage(error.message);
    else {
      window.history.replaceState({}, "", "/admin");
      setMessage("");
      setPassword("");
      setPasswordConfirmation("");
      setView("login");
      setAuthorized(null);
    }
    setSubmitting(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setAuthorized(null);
    setView("login");
  }

  if (loading) return <section className="card admin-login"><p>Verificando sesión…</p></section>;

  if (view === "set-password" && session) return <section className="card admin-login">
    <KeyRound size={32} /><span className="eyebrow">Acceso privado</span><h2>Crear una contraseña</h2>
    <p>Elegí una contraseña de al menos 8 caracteres para {session.user.email}.</p>
    <form className="admin-login-form" onSubmit={savePassword}>
      <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nueva contraseña" />
      <input type="password" required minLength={8} autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="Repetir contraseña" />
      <button className="button" type="submit" disabled={submitting}>Guardar contraseña</button>
    </form>{message ? <p className="admin-notice">{message}</p> : null}
  </section>;

  if (!session) return <section className="card admin-login">
    <Mail size={32} /><span className="eyebrow">Acceso privado</span><h2>{view === "forgot" ? "Recuperar contraseña" : "Administración"}</h2>
    <p>{view === "forgot" ? "Te enviaremos un enlace para crear una nueva contraseña." : "Ingresá con el correo y la contraseña asignados por un administrador."}</p>
    <form className="admin-login-form" onSubmit={view === "forgot" ? requestPasswordReset : login}>
      <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@empresa.com" />
      {view === "login" ? <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña" /> : null}
      <button className="button" type="submit" disabled={submitting}><LogIn size={18} /> {submitting ? "Procesando…" : view === "forgot" ? "Enviar enlace" : "Ingresar"}</button>
    </form>
    <button className="admin-login-link" type="button" onClick={() => { setView(view === "forgot" ? "login" : "forgot"); setMessage(""); }}>{view === "forgot" ? "Volver al inicio de sesión" : "Olvidé mi contraseña"}</button>
    {message ? <p className="admin-notice">{message}</p> : null}
  </section>;

  if (authorized === null) return <section className="card admin-login"><p>Comprobando permisos…</p></section>;
  if (!authorized) return <section className="card admin-login">
    <KeyRound size={32} /><span className="eyebrow">Acceso denegado</span><h2>Usuario no autorizado</h2>
    <p>La cuenta {session.user.email} existe, pero no está habilitada como administradora.</p>
    <button className="button-outline" onClick={logout}><LogOut size={16} /> Cerrar sesión</button>
  </section>;

  return <><div className="admin-session"><span>Sesión: {session.user.email}</span><button className="button-outline" onClick={logout}><LogOut size={16} /> Salir</button></div>{children}</>;
}
