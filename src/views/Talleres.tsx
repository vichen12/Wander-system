import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Factory, MapPin, Phone, Plus, Trash2 } from "lucide-react";
import { Empty, Field, Page, PageHead, Sheet, cx, rise, stagger } from "../components/ui";
import { useRol, useStore } from "../store/useStore";
import { can } from "../lib/roles";
import { metricas, periodo } from "../lib/metrics";
import { ETAPA_DE_TALLER, TIPOS_TALLER, type Taller, type TipoTaller } from "../lib/types";
import { addDays, monthKey, monthLabel, n0, n1, today, uid } from "../lib/format";

function Gauge({ pct, heat }: { pct: number; heat?: boolean }) {
  const r = 34, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, pct / 100));
  return (
    <svg viewBox="0 0 84 84" className="h-[84px] w-[84px] -rotate-90">
      <circle cx="42" cy="42" r={r} fill="none" className="stroke-surface2" strokeWidth="9" />
      <motion.circle cx="42" cy="42" r={r} fill="none" strokeLinecap="round" strokeWidth="9" className={heat ? "stroke-heat" : "stroke-ink"}
        strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - v) }} viewport={{ once: true }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />
    </svg>
  );
}

export default function Talleres() {
  const { ordenes, viajes, talleres } = useStore();
  const rol = useRol();
  const [edit, setEdit] = useState<Taller | null>(null);
  const mes = monthKey(today());
  const [a, b] = periodo(mes);
  const M = useMemo(() => metricas(ordenes, viajes, talleres, a, b), [ordenes, viajes, talleres, a, b]);
  const sem = useMemo(() => metricas(ordenes, viajes, talleres, addDays(today(), -6), today()), [ordenes, viajes, talleres]);

  return (
    <Page>
      <PageHead eyebrow={"Talleres · " + monthLabel(mes)} title="Quién produce, y con qué calidad">
        {can(rol, "editarCatalogo") && <button className="btn-heat" onClick={() => setEdit({ id: "", nombre: "", tipo: "confeccion", contacto: "", telefono: "", zona: "", capacidadSemanal: 400, km: 8 })}><Plus size={16} /> Nuevo taller</button>}
      </PageHead>
      {!talleres.length ? <Empty title="Sin talleres cargados">Sumá los talleres de corte, confección, bordado y estampado con los que trabajan.</Empty> : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {talleres.map((t) => {
            const v = M.porTaller[t.id] || { unidades: 0, revisadas: 0, fallas: 0, viajes: 0, entregas: 0 };
            const w = sem.porTaller[t.id]?.unidades || 0;
            const uso = t.capacidadSemanal ? (w / t.capacidadSemanal) * 100 : 0;
            const tasa = v.revisadas ? (v.fallas / v.revisadas) * 100 : null;
            const activas = ordenes.filter((o) => o.etapa === ETAPA_DE_TALLER[t.tipo] && o.historial.some((h) => h.tipo === "entrega" && h.tallerId === t.id)).length;
            const enEtapa = ordenes.filter((o) => o.etapa === ETAPA_DE_TALLER[t.tipo]).length;
            return (
              <motion.button variants={rise} whileHover={{ y: -4 }} key={t.id} onClick={() => can(rol, "editarCatalogo") && setEdit(t)} className="card group relative overflow-hidden p-5 text-left">
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-heat/0 blur-2xl transition group-hover:bg-heat/15" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="pill">{TIPOS_TALLER[t.tipo]}</span>{t.ejemplo && <span className="pill ml-1">ejemplo</span>}
                    <div className="mt-2 truncate font-display text-[18px] font-extrabold">{t.nombre}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted"><span className="flex items-center gap-1"><MapPin size={12} />{t.zona || "—"}</span><span className="flex items-center gap-1"><Phone size={12} />{t.telefono || "—"}</span></div>
                  </div>
                  <div className="relative shrink-0"><Gauge pct={uso} heat={uso > 90} /><div className="absolute inset-0 grid place-items-center text-center"><div><div className="tnum text-[15px] font-extrabold">{Math.round(uso)}%</div><div className="text-[9px] text-muted">capacidad</div></div></div></div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                  <div><div className="tnum font-display text-[20px] font-extrabold">{n0(v.unidades)}</div><div className="text-[11px] text-muted">u en el mes</div></div>
                  <div><div className={cx("tnum font-display text-[20px] font-extrabold", (tasa ?? 0) > 3 && "text-heat")}>{tasa == null ? "—" : n1(tasa) + "%"}</div><div className="text-[11px] text-muted">fallas</div></div>
                  <div><div className="tnum font-display text-[20px] font-extrabold">{activas}<span className="text-[13px] text-muted">/{enEtapa}</span></div><div className="text-[11px] text-muted">órdenes activas</div></div>
                </div>
                <div className="mt-3 text-[11.5px] text-muted">{n0(w)} u en los últimos 7 días · capacidad {n0(t.capacidadSemanal)} u/semana</div>
              </motion.button>
            );
          })}
        </motion.div>
      )}
      <EditarTaller t={edit} onClose={() => setEdit(null)} />
    </Page>
  );
}

function EditarTaller({ t, onClose }: { t: Taller | null; onClose: () => void }) {
  const { guardar, eliminar } = useStore();
  const rol = useRol();
  const [f, setF] = useState<Taller | null>(null);
  const [borrar, setBorrar] = useState(false);
  useEffect(() => { setF(t ? { ...t } : null); setBorrar(false); }, [t]);
  const x = f;
  return (
    <Sheet open={!!t} onClose={onClose} width={520}>
      {x && (<>
        <div className="eyebrow"><Factory size={12} className="mr-1 inline" />Talleres</div>
        <h2 className="wide mt-1.5 font-display text-[24px] font-extrabold">{x.id ? "Editar taller" : "Nuevo taller"}</h2>
        <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); if (!x.nombre.trim()) return toast.error("Falta el nombre."); guardar("talleres", { ...x, id: x.id || uid("t-"), nombre: x.nombre.trim() }); toast.success("Taller guardado"); onClose(); }}>
          <Field label="Nombre"><input className="input" value={x.nombre} onChange={(e) => setF({ ...x, nombre: e.target.value })} autoFocus /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo"><select className="input" value={x.tipo} onChange={(e) => setF({ ...x, tipo: e.target.value as TipoTaller })}>{Object.entries(TIPOS_TALLER).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Capacidad semanal (prendas)"><input className="input tnum" inputMode="numeric" value={x.capacidadSemanal} onChange={(e) => setF({ ...x, capacidadSemanal: +e.target.value.replace(/\D/g, "") || 0 })} /></Field>
            <Field label="Km desde la fábrica" hint="Para estimar los km de la camioneta"><input className="input tnum" inputMode="numeric" value={x.km ?? ""} onChange={(e) => setF({ ...x, km: e.target.value === "" ? undefined : +e.target.value.replace(/\D/g, "") })} /></Field>
            <Field label="Contacto"><input className="input" value={x.contacto} onChange={(e) => setF({ ...x, contacto: e.target.value })} /></Field>
            <Field label="Teléfono"><input className="input" value={x.telefono} onChange={(e) => setF({ ...x, telefono: e.target.value })} /></Field>
            <Field label="Zona"><input className="input" value={x.zona} onChange={(e) => setF({ ...x, zona: e.target.value })} /></Field>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button className="btn-heat" type="submit">Guardar</button><button className="btn-ghost" type="button" onClick={onClose}>Cancelar</button>
            {x.id && can(rol, "eliminar") && (borrar ? <button type="button" className="btn ml-auto !border-heat !text-heat" onClick={() => { eliminar("talleres", x.id); toast.success("Taller eliminado"); onClose(); }}>Sí, eliminar</button> : <button type="button" className="btn-ghost ml-auto" onClick={() => setBorrar(true)}><Trash2 size={15} /> Eliminar</button>)}
          </div>
        </form>
      </>)}
    </Sheet>
  );
}
