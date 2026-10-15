import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Logo, rise, stagger } from "../components/ui";
import { useStore } from "../store/useStore";
import { ROLES } from "../lib/types";
import { remote } from "../lib/supabase";
import { homeFor } from "../components/Layout";

export default function Login() {
  const usuarios = useStore((s) => s.usuarios.filter((u) => u.activo));
  const login = useStore((s) => s.login);
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  const entrarSupabase = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { const u = await remote.signIn(email, pass); if (u) { login(u.id); nav("/"); } }
    catch { toast.error("Mail o contraseña incorrectos."); }
    setBusy(false);
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-night text-white">
      <video className="absolute inset-0 h-full w-full object-cover" poster="./media/poster.jpg" autoPlay muted loop playsInline><source src="./media/montana.webm" type="video/webm" /><source src="./media/montana.mp4" type="video/mp4" /></video>
      <div className="absolute inset-0 bg-gradient-to-r from-night via-night/80 to-night/10" />
      <div className="grain absolute inset-0" />
      <motion.div className="pointer-events-none absolute -right-40 bottom-[-200px] h-[520px] w-[520px] rounded-full bg-heat/30 blur-[120px]"
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} />

      <div className="relative mx-auto flex min-h-screen max-w-[1320px] flex-col px-5 py-8 sm:px-10 lg:py-12">
        <div className="flex items-center gap-3">
          <Logo className="w-12" animated />
          <span className="text-[11px] font-bold text-white/50">Sistema de producción</span>
        </div>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr] [&>*]:min-w-0">
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.div variants={rise} className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] text-white/70 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulseheat rounded-full bg-heat" /> Producción en tiempo real
            </motion.div>
            <motion.h1 variants={rise} className="wide max-w-[640px] text-balance font-display text-[36px] font-black leading-[0.98] tracking-tight sm:text-[52px] xl:text-[64px]">
              Cada prenda,<br />de la tela <span className="bg-gradient-to-r from-ember to-heat bg-clip-text text-transparent">al cliente.</span>
            </motion.h1>
            <motion.p variants={rise} className="mt-5 max-w-[520px] text-[16px] leading-relaxed text-white/65">
              Órdenes, talleres, calidad y camioneta en un solo lugar. Cargás desde el celular, con un mensaje o una foto, y el tablero se actualiza solo.
            </motion.p>
            <motion.div variants={rise} className="mt-8 hidden gap-8 text-[12px] text-white/55 sm:flex">
              {[["7", "etapas medidas"], ["6", "indicadores"], ["4", "roles"]].map(([n, l]) => (
                <div key={l}><div className="wide font-display text-[28px] font-extrabold text-white">{n}</div>{l}</div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.25, type: "spring", stiffness: 140, damping: 20 }}
            className="rounded-[28px] border border-white/10 bg-white/[.06] p-5 shadow-2xl backdrop-blur-xl sm:p-7">
            {remote.enabled ? (
              <form onSubmit={entrarSupabase} className="space-y-4">
                <div><div className="wide font-display text-[22px] font-extrabold">Ingresar</div><p className="text-[13px] text-white/55">Con el mail que te dio Dirección.</p></div>
                <input className="input !border-white/15 !bg-white/10 !text-white placeholder:text-white/40" type="email" placeholder="tu@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input className="input !border-white/15 !bg-white/10 !text-white placeholder:text-white/40" type="password" placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} required />
                <button className="btn-heat w-full !py-3" disabled={busy}><Lock size={16} /> Entrar</button>
              </form>
            ) : (
              <>
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div><div className="wide font-display text-[22px] font-extrabold">¿Quién sos?</div><p className="text-[13px] text-white/55">Modo demo: elegí un perfil para entrar.</p></div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">Demo</span>
                </div>
                <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-2">
                  {usuarios.map((u) => (
                    <motion.li key={u.id} variants={rise}>
                      <button onClick={() => { login(u.id); nav(homeFor(u.rol)); }}
                        className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-3 text-left transition hover:border-heat/60 hover:bg-white/[.08]">
                        <Avatar name={u.nombre} color={u.color} size={40} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-semibold">{u.nombre}</div>
                          <div className="truncate text-[12px] text-white/50">{ROLES[u.rol].nombre} · {ROLES[u.rol].desc}</div>
                        </div>
                        <ArrowRight size={18} className="text-white/30 transition group-hover:translate-x-1 group-hover:text-heat" />
                      </button>
                    </motion.li>
                  ))}
                </motion.ul>
              </>
            )}
          </motion.div>
        </div>
        <div className="text-[11px] text-white/35">Wanderwarm × Stoka Software</div>
      </div>
    </div>
  );
}
