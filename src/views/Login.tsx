import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Logo, rise, stagger } from "../components/ui";
import { HeatButton, Topo } from "../components/Brand";
import { useStore } from "../store/useStore";
import { ROLES } from "../lib/types";
import { mensajeError, remote } from "../lib/supabase";
import { homeFor } from "../components/Layout";

function Fondo({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-full overflow-hidden bg-surface2 text-ink">
      <video className="absolute inset-0 h-full w-full object-cover opacity-40 grayscale invert" poster="./media/poster.jpg" autoPlay muted loop playsInline aria-hidden><source src="./media/montana.webm" type="video/webm" /><source src="./media/montana.mp4" type="video/mp4" /></video>
      <div className="absolute inset-0 bg-gradient-to-r from-surface2 via-surface2/85 to-surface2/30" />
      <Topo fade className="inset-0 bg-ink/[.06]" size={560} />
      <div className="relative mx-auto flex min-h-screen max-w-[1240px] flex-col px-5 py-8 sm:px-10 lg:py-12">{children}</div>
    </div>
  );
}

export default function Login() {
  const usuarios = useStore((s) => s.usuarios.filter((u) => u.activo));
  const login = useStore((s) => s.login);
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [ver, setVer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modo, setModo] = useState<"entrar" | "recuperar" | "enviado">("entrar");

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { const u = await remote.signIn(email, pass); if (u) { login(u.id); nav("/"); } }
    catch (err) {
      const m = (err as Error).message;
      toast.error(m === "inactivo" ? "Tu usuario todavía no está habilitado. Pedile a Dirección que lo active." : /invalid|credentials/i.test(m) ? "Mail o contraseña incorrectos." : mensajeError(err));
    }
    setBusy(false);
  };
  const recuperar = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await remote.recuperar(email); setModo("enviado"); } catch (err) { toast.error(mensajeError(err)); }
    setBusy(false);
  };

  return (
    <Fondo>
      <div className="flex items-center gap-3">
        <Logo className="w-12 text-ink" animated />
        <div className="leading-none"><div className="font-display text-[15px] font-black uppercase tracking-[0.08em]" style={{ fontStretch: "125%" }}>Wander</div><div className="mt-1 text-[12px] text-muted">Sistema de producción</div></div>
      </div>

      <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr] [&>*]:min-w-0">
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.div variants={rise} className="eyebrow mb-4">Producción en tiempo real</motion.div>
          <motion.h1 variants={rise} className="max-w-[620px] text-balance font-display text-[38px] font-black leading-[0.98] sm:text-[54px] xl:text-[64px]" style={{ fontStretch: "118%" }}>
            Cada prenda, de la tela al cliente.
          </motion.h1>
          <motion.p variants={rise} className="mt-5 max-w-[500px] text-[16px] leading-relaxed text-ink2">
            Órdenes, talleres, calidad y camioneta en un solo lugar. Se carga desde el celular, con un mensaje o una foto.
          </motion.p>
          <motion.div variants={rise} className="mt-8 flex items-center gap-2 text-[13px] text-muted"><HeatButton size={18} animado /> Te acompaña todo el año</motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 140, damping: 20 }}
          className="rounded-[28px] border border-line bg-surface p-6 shadow-[0_30px_80px_-40px_rgb(0_0_0/.35)] sm:p-8">
          {remote.enabled ? (
            modo === "entrar" ? (
              <form onSubmit={entrar} className="space-y-4">
                <div><div className="font-display text-[24px] font-black" style={{ fontStretch: "112%" }}>Ingresar</div><p className="text-[13px] text-muted">Con el mail y la contraseña que te dio Dirección.</p></div>
                <label className="block"><span className="label mb-1.5 block">Mail</span>
                  <div className="relative"><Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !pl-9" type="email" autoComplete="username" placeholder="tu@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div></label>
                <label className="block"><span className="label mb-1.5 block">Contraseña</span>
                  <div className="relative"><Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !pl-9 !pr-10" type={ver ? "text" : "password"} autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} required minLength={6} />
                    <button type="button" onClick={() => setVer(!ver)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-ink" aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}>{ver ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
                <button className="btn-heat w-full !py-3" disabled={busy}>{busy ? "Entrando…" : <>Entrar <ArrowRight size={16} /></>}</button>
                <button type="button" className="w-full text-center text-[13px] font-semibold text-muted hover:text-ink" onClick={() => setModo("recuperar")}>Me olvidé la contraseña</button>
              </form>
            ) : modo === "recuperar" ? (
              <form onSubmit={recuperar} className="space-y-4">
                <button type="button" className="flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink" onClick={() => setModo("entrar")}><ArrowLeft size={14} /> Volver</button>
                <div><div className="font-display text-[24px] font-black" style={{ fontStretch: "112%" }}>Recuperar contraseña</div><p className="text-[13px] text-muted">Te mandamos un link para elegir una nueva.</p></div>
                <input className="input" type="email" placeholder="tu@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <button className="btn-heat w-full !py-3" disabled={busy}>Mandar link</button>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="font-display text-[24px] font-black" style={{ fontStretch: "112%" }}>Revisá tu mail</div>
                <p className="text-[14px] text-ink2">Si <b>{email}</b> tiene usuario, le llega un link para elegir una contraseña nueva. Puede tardar unos minutos.</p>
                <button className="btn-ghost" onClick={() => setModo("entrar")}><ArrowLeft size={14} /> Volver a ingresar</button>
              </div>
            )
          ) : (
            <>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div><div className="font-display text-[24px] font-black" style={{ fontStretch: "112%" }}>¿Quién sos?</div><p className="text-[13px] text-muted">Modo demo: elegí un perfil para entrar.</p></div>
                <span className="pill">Demo</span>
              </div>
              <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-2">
                {usuarios.map((u) => (
                  <motion.li key={u.id} variants={rise}>
                    <button onClick={() => { login(u.id); nav(homeFor(u.rol)); }} className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-heat/60 hover:bg-surface2">
                      <Avatar name={u.nombre} color={u.color} size={40} />
                      <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold">{u.nombre}</div><div className="truncate text-[12px] text-muted">{ROLES[u.rol].nombre} · {ROLES[u.rol].desc}</div></div>
                      <ArrowRight size={18} className="text-muted transition group-hover:translate-x-1 group-hover:text-heat" />
                    </button>
                  </motion.li>
                ))}
              </motion.ul>
            </>
          )}
        </motion.div>
      </div>
      <div className="text-[12px] text-muted">Wanderwarm × Stoka Software</div>
    </Fondo>
  );
}

/** Pantalla para elegir contraseña nueva (link de recuperación o primer ingreso). */
export function NuevaClave({ onListo }: { onListo: () => void }) {
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [busy, setBusy] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (a.length < 8) return toast.error("Usá al menos 8 caracteres.");
    if (a !== b) return toast.error("Las contraseñas no coinciden.");
    setBusy(true);
    try { await remote.nuevaClave(a); toast.success("Listo, ya podés usar tu contraseña nueva."); onListo(); } catch (err) { toast.error(mensajeError(err)); }
    setBusy(false);
  };
  return (
    <Fondo>
      <div className="grid flex-1 place-items-center">
        <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-[28px] border border-line bg-surface p-7 shadow-xl">
          <KeyRound className="text-heat" />
          <div><div className="font-display text-[24px] font-black">Elegí tu contraseña</div><p className="text-[13px] text-muted">Mínimo 8 caracteres.</p></div>
          <input className="input" type="password" autoComplete="new-password" placeholder="Contraseña nueva" value={a} onChange={(e) => setA(e.target.value)} required />
          <input className="input" type="password" autoComplete="new-password" placeholder="Repetila" value={b} onChange={(e) => setB(e.target.value)} required />
          <button className="btn-heat w-full !py-3" disabled={busy}>Guardar</button>
        </form>
      </div>
    </Fondo>
  );
}
