import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Bot, Camera, Check, Minus, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { Logo, cx } from "./ui";
import { useMiTaller, useRol, useStore } from "../store/useStore";
import { responder } from "../lib/assistant";
import { remote } from "../lib/supabase";
import { ROLES, type AccionPropuesta, type Mensaje } from "../lib/types";
import { festejar } from "../views/Ordenes";
import { aplicarMovChat, lugaresDe } from "../lib/viajes";

const SUG: Record<string, string[]> = {
  superadmin: ["¿Cómo venimos este mes?", "¿Qué está atrasado?", "¿Qué taller tiene más fallas?", "¿Cuántos viajes hizo la camioneta?"],
  direccion: ["¿Cómo venimos este mes?", "¿Qué está atrasado?", "¿Qué taller tiene más fallas?", "¿Cuánta tela necesito comprar?"],
  produccion: ["¿Qué órdenes hay en confección?", "¿Qué vence esta semana?", "Entregaron 80 buzos de la orden 24", "Pasá la orden 27 a confección"],
  taller: ["Entregué 50 prendas de la orden 24", "¿Qué tengo pendiente?"],
  chofer: ["Retiré 50 de la orden 24 de Confección Las Heras", "Dejé 50 de la orden 24 en Bordados Centro", "¿Cuántos viajes hice este mes?"],
};

export default function ChatWidget() {
  const s = useStore();
  const rol = useRol()!;
  const miTaller = useMiTaller();
  const abierto = s.chatAbierto;
  const setAbierto = s.setChatAbierto;
  const [txt, setTxt] = useState("");
  const [foto, setFoto] = useState<{ file: File; url: string } | null>(null);
  const [pensando, setPensando] = useState(false);
  const [vistos, setVistos] = useState(0);
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => { if (abierto) { setVistos(s.chat.length); setTimeout(() => fin.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 60); } }, [s.chat.length, pensando, abierto]);
  const sinLeer = abierto ? 0 : Math.max(0, s.chat.filter((m) => m.de === "bot").length - s.chat.slice(0, vistos).filter((m) => m.de === "bot").length);

  const enviar = async (texto = txt) => {
    const t = texto.trim();
    if ((!t && !foto) || pensando) return;
    s.pushMsg({ de: "yo", texto: t || "(foto)", img: foto?.url });
    setTxt(""); const f = foto; setFoto(null); setPensando(true);
    try {
      let r: { texto: string; accion?: AccionPropuesta };
      if (remote.enabled) {
        const b64 = f ? await toB64(f.file) : undefined;
        const out = await remote.asistente({ mensaje: t, rol, historial: s.chat.slice(-10).map((m) => ({ de: m.de, texto: m.texto })) }, b64).catch(() => null);
        if (!out || (out as { sinClave?: boolean }).sinClave) {
          // Sin IA disponible: responde el asistente local con los mismos datos.
          r = f && !t ? { texto: "Para leer fotos hace falta que el super admin cargue la clave de IA. Mientras tanto, escribime qué entregaste y lo cargo." }
            : responder(t, { rol, ordenes: s.ordenes, talleres: s.talleres, productos: s.productos, materiales: s.materiales, viajes: s.viajes, miTaller });
        } else r = { texto: out.texto || "No pude responder.", accion: (out.acciones?.[0] as AccionPropuesta) || undefined };
      } else {
        await new Promise((ok) => setTimeout(ok, 550 + Math.random() * 500));
        r = f && !t ? { texto: "Para leer fotos de remitos hace falta conectar el sistema a Supabase (ver Ajustes). Mientras tanto, escribime qué entregaste y lo cargo." }
          : responder(t, { rol, ordenes: s.ordenes, talleres: s.talleres, productos: s.productos, materiales: s.materiales, viajes: s.viajes, miTaller });
      }
      s.pushMsg({ de: "bot", texto: r.texto, accion: r.accion });
    } catch { s.pushMsg({ de: "bot", texto: "No pude responder. Probá de nuevo en un momento." }); }
    setPensando(false);
  };

  const confirmar = (m: Mensaje) => {
    const a = m.accion!; const st = useStore.getState();
    if (a.tipo === "entrega") st.registrarEntrega(a.ordenId, { unidades: a.unidades, tallerId: a.tallerId, via: "asistente" });
    if (a.tipo === "avance") { const o = st.ordenes.find((x) => x.id === a.ordenId); if (o) { st.moverEtapa(o.id, o.etapa + 1, "asistente"); if (o.etapa + 1 === 7) festejar(); } }
    if (a.tipo === "calidad") st.registrarCalidad(a.ordenId, { tallerId: a.tallerId, revisadas: a.revisadas, fallas: a.fallas, motivo: a.motivo });
    if (a.tipo === "viaje") { const v = aplicarMovChat(a.mov, st.viajes, st.ordenes, lugaresDe(st.config, st.talleres), st.sesion); if (!v) return toast.error("No pude armar el viaje: revisá la orden y el lugar."); st.guardar("viajes", v); }
    st.updMsg(m.id, { accion: { ...a, estado: "hecha" } as AccionPropuesta });
    toast.success("Guardado");
  };

  return (
    <>
      {/* Botón flotante */}
      <AnimatePresence>
        {!abierto && (
          <motion.button key="fab" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 40 }} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => setAbierto(true)} aria-label="Abrir asistente"
            className="fixed z-[55] grid h-[60px] w-[60px] place-items-center rounded-full bg-heat text-white shadow-[0_10px_30px_-6px_rgba(226,65,42,.7)] right-[max(18px,env(safe-area-inset-right))] bottom-[calc(84px+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6">
            <span className="absolute inset-0 animate-ping rounded-full bg-heat/40 [animation-duration:2.6s]" />
            <svg viewBox="0 0 32 32" className="relative h-7 w-7" fill="currentColor"><path d="M16 3C8.8 3 3 8.5 3 15.3c0 2.4.7 4.7 2 6.6L3.6 28l6.4-1.7c1.8.9 3.8 1.4 6 1.4 7.2 0 13-5.5 13-12.4S23.2 3 16 3Zm-6.3 14.4a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Zm6.3 0a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Zm6.3 0a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Z" /></svg>
            {sinLeer > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-bg bg-ink px-1 text-[10px] font-bold">{sinLeer}</span>}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel desplegable */}
      <AnimatePresence>
        {abierto && (
          <motion.div key="panel" initial={{ opacity: 0, y: 30, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.92 }} transition={{ type: "spring", stiffness: 340, damping: 30 }} style={{ originX: 1, originY: 1 }}
            className="fixed inset-x-0 bottom-0 z-[58] flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(640px,calc(100dvh-48px))] sm:w-[400px] sm:rounded-3xl">
            {/* Encabezado estilo WhatsApp */}
            <div className="flex items-center gap-3 bg-night px-4 py-3 text-white">
              <div className="relative grid h-10 w-10 place-items-center rounded-full bg-white/10"><Logo className="w-6" /><span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-night bg-[#25D366]" /></div>
              <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-bold">Asistente Wanderwarm</div><div className="truncate text-[11.5px] text-white/60">{pensando ? "escribiendo…" : `en línea · ${ROLES[rol].nombre}`}</div></div>
              {s.chat.length > 0 && <button className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" onClick={s.limpiarChat} aria-label="Nueva charla" title="Nueva charla"><RotateCcw size={16} /></button>}
              <button className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setAbierto(false)} aria-label="Minimizar"><Minus size={18} /></button>
            </div>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[#EFEAE2] p-3 scroll-thin dark:bg-[#0F0E0D]" style={{ backgroundImage: "radial-gradient(rgb(var(--line)) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
              {!s.chat.length && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-6 max-w-[290px] rounded-2xl bg-surface p-4 text-center shadow-card">
                  <motion.div animate={{ rotate: [0, 10, -8, 0] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }} className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-heat/10 text-heat"><Sparkles size={22} /></motion.div>
                  <div className="mt-2 font-display text-[16px] font-extrabold">¡Hola! ¿Qué necesitás?</div>
                  <p className="mt-1 text-[12.5px] text-muted">Preguntame o contame algo para cargar. Antes de guardar te pido que confirmes.</p>
                </motion.div>
              )}
              <AnimatePresence initial={false}>
                {s.chat.map((m) => (
                  <motion.div key={m.id} layout initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className={cx("flex", m.de === "yo" ? "justify-end" : "justify-start")}>
                    <div className="max-w-[85%] space-y-1.5">
                      <div className={cx("relative whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13.5px] leading-relaxed shadow-sm", m.de === "yo" ? "rounded-tr-sm bg-[#D9FDD3] text-[#111] dark:bg-[#1F4B33] dark:text-white" : "rounded-tl-sm bg-surface")}>
                        {m.img && <img src={m.img} alt="Foto enviada" className="mb-1.5 max-h-44 rounded-xl" />}
                        {m.texto}
                        <span className="ml-2 inline-flex translate-y-1 items-center gap-0.5 text-[10px] text-black/40 dark:text-white/40">{new Date(m.ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}{m.de === "yo" && <Check size={11} className="text-[#53BDEB]" />}</span>
                      </div>
                      {m.accion && <AccionCard m={m} onOk={() => confirmar(m)} onNo={() => s.updMsg(m.id, { accion: { ...m.accion!, estado: "descartada" } as AccionPropuesta })} />}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {pensando && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex">
                  <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-surface px-4 py-3 shadow-sm">{[0, 1, 2].map((i) => <motion.span key={i} className="h-2 w-2 rounded-full bg-muted" animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />)}</div>
                </motion.div>
              )}
              <div ref={fin} />
            </div>

            <div className="border-t border-line bg-surface2 p-2.5" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
              <div className="mb-2 flex gap-1.5 overflow-x-auto scroll-thin">
                {(SUG[rol] || []).map((q) => <button key={q} onClick={() => enviar(q)} className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink2 transition hover:border-heat hover:text-heat">{q}</button>)}
              </div>
              {foto && <div className="mb-2 flex items-center gap-2 text-[12px] text-muted"><img src={foto.url} alt="" className="h-10 rounded-lg" /> Foto adjunta <button onClick={() => setFoto(null)} className="btn-ghost !p-1" aria-label="Quitar foto"><X size={14} /></button></div>}
              <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex items-end gap-2">
                <div className="flex min-w-0 flex-1 items-end rounded-3xl border border-line bg-surface pl-1">
                  <label className="cursor-pointer rounded-full p-2.5 text-muted hover:text-ink" title="Adjuntar foto de remito o planilla"><Camera size={19} /><input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setFoto({ file: f, url: URL.createObjectURL(f) }); e.target.value = ""; }} /></label>
                  <textarea value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} rows={1} placeholder="Escribí un mensaje" className="max-h-28 min-h-[42px] flex-1 resize-none bg-transparent py-2.5 pr-3 text-[14px] outline-none focus-visible:outline-none" aria-label="Mensaje" />
                </div>
                <motion.button whileTap={{ scale: 0.9 }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-heat text-white disabled:opacity-50" disabled={pensando || (!txt.trim() && !foto)} aria-label="Enviar"><Send size={18} /></motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function AccionCard({ m, onOk, onNo }: { m: Mensaje; onOk: () => void; onNo: () => void }) {
  const a = m.accion!;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cx("rounded-2xl border bg-surface p-3.5", a.estado === "pendiente" ? "border-heat shadow-glow" : "border-line")}>
      <div className="eyebrow mb-1">{a.estado === "pendiente" ? "Para confirmar" : a.estado === "hecha" ? "Guardado" : "Descartado"}</div>
      <div className="text-[14px] font-semibold">{a.desc}</div>
      {a.estado === "pendiente" ? (
        <div className="mt-3 flex gap-2"><button className="btn-heat !py-1.5" onClick={onOk}><Check size={15} /> Confirmar y guardar</button><button className="btn-ghost !py-1.5" onClick={onNo}>Descartar</button></div>
      ) : a.estado === "hecha" ? <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ok"><Check size={14} /> Quedó registrado en el sistema</div> : null}
    </motion.div>
  );
}

const toB64 = (f: File) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(f); });
