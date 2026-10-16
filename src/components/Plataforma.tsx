import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck, Sparkles, Trash2, XCircle } from "lucide-react";
import { Field, cx } from "./ui";
import { useStore } from "../store/useStore";
import { remote } from "../lib/supabase";

const MODELOS = [
  { id: "claude-sonnet-5-5", nombre: "Claude Sonnet 5.5", desc: "Recomendado: rápido y preciso para el día a día." },
  { id: "claude-opus-5-5", nombre: "Claude Opus 5.5", desc: "Más capaz, más caro. Para fotos difíciles o consultas largas." },
  { id: "claude-haiku-5-5", nombre: "Claude Haiku 5.5", desc: "El más económico. Respuestas simples." },
];

/** Panel exclusivo del super admin (Stoka): clave de la API, modelo, prueba y auditoría. */
export default function Plataforma() {
  const s = useStore();
  const [estado, setEstado] = useState<{ nombre: string; final: string; actualizado: string } | null | undefined>(undefined);
  const [clave, setClave] = useState("");
  const [busy, setBusy] = useState(false);
  const [prueba, setPrueba] = useState<{ ok: boolean; texto: string } | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof remote.auditoria>>>([]);
  const modelo = s.config.plataforma?.modelo || "claude-sonnet-5-5";

  const refrescar = async () => {
    if (!remote.enabled) return setEstado(null);
    try { const r = await remote.estadoSecretos(); setEstado(r.find((x) => x.nombre === "anthropic_api_key") || null); } catch (e) { toast.error((e as Error).message); setEstado(null); }
    try { setAudit(await remote.auditoria(40)); } catch { /* sin permisos */ }
  };
  useEffect(() => { refrescar(); }, []);

  const guardar = async () => {
    const v = clave.trim();
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(v)) return toast.error("La clave de Anthropic empieza con sk-ant- y es larga. Revisá que esté completa.");
    setBusy(true);
    try { await remote.guardarSecreto("anthropic_api_key", v); setClave(""); toast.success("Clave guardada y cifrada"); await refrescar(); } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  const quitar = async () => {
    setBusy(true);
    try { await remote.guardarSecreto("anthropic_api_key", ""); toast.success("Clave quitada"); await refrescar(); } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  const probar = async () => {
    setBusy(true); setPrueba(null);
    try {
      const r = await remote.asistente({ mensaje: "Respondé solo: OK", rol: "superadmin", historial: [], prueba: true });
      const ok = !!r && !/^No pude|sin clave|no hay clave/i.test(r.texto);
      setPrueba({ ok, texto: r?.texto || "Sin respuesta" });
    } catch (e) { setPrueba({ ok: false, texto: (e as Error).message }); }
    setBusy(false);
  };
  const nombre = (id: string | null) => s.usuarios.find((u) => u.id === id)?.nombre || (id ? "Usuario" : "Sistema");

  if (!remote.enabled) return <section className="card p-5 text-[13px] text-muted">El panel de plataforma funciona con Supabase conectado.</section>;

  return (<>
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-heat text-white"><KeyRound size={18} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[16px] font-bold">Clave de la API de Anthropic</h3>
          <p className="text-[12.5px] text-muted">La usa el asistente para entender mensajes y leer fotos. Se guarda cifrada en la base (Vault) y nunca vuelve a mostrarse: solo el servidor la lee.</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-surface2 px-4 py-3 text-[13px]">
        {estado === undefined ? <span className="flex items-center gap-2 text-muted"><Loader2 size={14} className="animate-spin" /> Consultando…</span>
          : estado ? <span className="flex flex-wrap items-center gap-2"><CheckCircle2 size={16} className="text-ok" /> <b>Cargada</b> · termina en <span className="font-mono">••••{estado.final}</span> · actualizada {new Date(estado.actualizado).toLocaleString("es-AR")}</span>
          : <span className="flex items-center gap-2"><XCircle size={16} className="text-heat" /> <b>Sin clave.</b> El asistente funciona en modo básico (frases comunes).</span>}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input className="input font-mono" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-api03-…" value={clave} onChange={(e) => setClave(e.target.value)} aria-label="Clave de la API" />
        <button className="btn-heat shrink-0" onClick={guardar} disabled={busy || !clave}>{estado ? "Reemplazar clave" : "Guardar clave"}</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn" onClick={probar} disabled={busy || !estado}><Sparkles size={15} /> Probar el asistente</button>
        {estado && <button className="btn-ghost text-heat" onClick={quitar} disabled={busy}><Trash2 size={15} /> Quitar clave</button>}
      </div>
      {prueba && <div className={cx("mt-3 rounded-xl px-3 py-2 text-[13px]", prueba.ok ? "bg-ok/10 text-ok" : "bg-heat/10 text-heat")}>{prueba.ok ? "Funciona. Respuesta: " : "Falló: "}{prueba.texto}</div>}
    </section>

    <section className="card p-5">
      <h3 className="font-display text-[15px] font-bold">Modelo del asistente</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {MODELOS.map((m) => (
          <button key={m.id} onClick={() => { s.setConfig("plataforma", { ...s.config.plataforma, modelo: m.id }); toast.success("Modelo actualizado"); }} className={cx("rounded-xl border p-3 text-left transition", modelo === m.id ? "border-heat bg-heat/5 ring-2 ring-heat/20" : "border-line hover:border-muted")}>
            <div className="text-[13.5px] font-bold">{m.nombre}</div><div className="text-[11.5px] text-muted">{m.desc}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 max-w-sm"><Field label="Otro modelo (id exacto)"><input className="input font-mono !py-2" value={modelo} onChange={(e) => s.setConfig("plataforma", { ...s.config.plataforma, modelo: e.target.value.trim() })} /></Field></div>
    </section>

    <section className="card p-5">
      <h3 className="flex items-center gap-2 font-display text-[15px] font-bold"><ShieldCheck size={16} className="text-ok" /> Seguridad y auditoría</h3>
      <ul className="mt-2 space-y-1 text-[12.5px] text-ink2">
        <li>· Cada tabla tiene permisos por rol en la base (RLS): un taller solo ve sus órdenes asignadas; el chofer solo carga viajes.</li>
        <li>· Las cuentas nuevas nacen sin acceso hasta que un admin les da un rol.</li>
        <li>· Los datos se validan en la base: órdenes sin prendas, unidades negativas o km inválidos se rechazan.</li>
        <li>· Cada cambio queda registrado abajo.</li>
      </ul>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-[12.5px]">
        <thead><tr><th className="th !pl-0">Cuándo</th><th className="th">Quién</th><th className="th">Qué</th><th className="th">Registro</th></tr></thead>
        <tbody>{audit.map((a) => (
          <tr key={a.id} className="border-t border-line"><td className="py-1.5 tnum text-muted">{new Date(a.cuando).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td>{nombre(a.usuario)}</td><td>{{ insert: "Creó", update: "Modificó", delete: "Borró" }[a.accion] || a.accion} {a.tabla}</td><td className="font-mono text-muted">{a.registro.slice(0, 14)}</td></tr>
        ))}</tbody>
      </table>{!audit.length && <p className="py-3 text-[12.5px] text-muted">Sin movimientos todavía.</p>}</div>
    </section>
  </>);
}
