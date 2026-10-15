import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AlertTriangle, BookOpen, CheckCircle2, Circle, Clock, Pencil, Plus, Printer, Search, ShieldCheck, Trash2, User } from "lucide-react";
import { Empty, Field, Page, PageHead, Sheet, cx, rise, stagger } from "../components/ui";
import { useRol, useStore } from "../store/useStore";
import { can } from "../lib/roles";
import { ETAPAS, type Proceso } from "../lib/types";
import { fdateY, today, uid } from "../lib/format";

const nombreEtapa = (e: number) => (e === 0 ? "General" : e === 7 ? "Logística" : ETAPAS[e]);

export default function Procesos() {
  const procesos = useStore((s) => s.procesos);
  const rol = useRol();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Proceso | null>(null);
  const [edit, setEdit] = useState(false);
  const editar = can(rol, "editarCatalogo");
  useEffect(() => { const e = sp.get("etapa"); if (e != null) { const p = procesos.find((x) => x.etapa === +e); if (p) setSel(p); setSp({}); } }, [sp]);
  const lista = useMemo(() => [...procesos].sort((a, b) => a.etapa - b.etapa).filter((p) => !q || JSON.stringify(p).toLowerCase().includes(q.toLowerCase())), [procesos, q]);

  return (
    <Page>
      <PageHead eyebrow="Estándares de trabajo" title="Cómo hacemos cada cosa">
        <div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !w-[220px] !py-2 !pl-9" placeholder="Buscar en los procesos" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /></div>
        {editar && <button className="btn-heat" onClick={() => { setSel({ id: "", etapa: 0, titulo: "", objetivo: "", responsable: "", tiempo: "", pasos: [], checklist: [], criterios: [], errores: [], actualizado: today(), version: 0 }); setEdit(true); }}><Plus size={16} /> Nuevo proceso</button>}
      </PageHead>

      {/* Mapa del proceso */}
      <section className="card mb-5 overflow-x-auto p-5 scroll-thin">
        <div className="eyebrow mb-4">El recorrido de una prenda</div>
        <div className="flex min-w-[760px] items-start">
          {[1, 2, 3, 4, 5, 6, 7].map((e, i) => {
            const p = procesos.find((x) => x.etapa === e);
            return (
              <div key={e} className="flex flex-1 items-start">
                <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} onClick={() => p && setSel(p)} className="group flex flex-1 flex-col items-center text-center" disabled={!p}>
                  <span className={cx("grid h-12 w-12 place-items-center rounded-2xl font-display text-[16px] font-extrabold transition group-hover:scale-110", p ? "bg-ink text-bg group-hover:bg-heat group-hover:text-white" : "bg-surface2 text-muted")}>{e}</span>
                  <span className="mt-2 text-[12px] font-bold">{nombreEtapa(e)}</span>
                  <span className="text-[11px] text-muted">{p?.tiempo || "Sin estándar"}</span>
                </motion.button>
                {i < 6 && <motion.div className="mt-6 h-0.5 w-6 shrink-0 bg-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3 + i * 0.06 }} />}
              </div>
            );
          })}
        </div>
      </section>

      {!lista.length ? <Empty title="No hay procesos que coincidan" /> : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => (
            <motion.button variants={rise} whileHover={{ y: -4 }} key={p.id} onClick={() => { setSel(p); setEdit(false); }} className="card group flex flex-col p-5 text-left">
              <div className="flex items-center justify-between"><span className="pill">{p.etapa ? `Etapa ${p.etapa} · ${nombreEtapa(p.etapa)}` : "General"}</span><span className="text-[11px] text-muted">v{p.version}</span></div>
              <div className="wide mt-3 font-display text-[18px] font-extrabold leading-tight">{p.titulo}</div>
              <p className="mt-1 line-clamp-2 text-[13px] text-muted">{p.objetivo}</p>
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-[12px] text-ink2"><span className="flex items-center gap-1"><User size={13} />{p.responsable}</span><span className="flex items-center gap-1"><Clock size={13} />{p.tiempo}</span><span className="flex items-center gap-1"><CheckCircle2 size={13} />{p.pasos.length} pasos</span></div>
            </motion.button>
          ))}
        </motion.div>
      )}
      <Lector p={sel} edit={edit} setEdit={setEdit} onClose={() => { setSel(null); setEdit(false); }} />
    </Page>
  );
}

function Lector({ p, edit, setEdit, onClose }: { p: Proceso | null; edit: boolean; setEdit: (v: boolean) => void; onClose: () => void }) {
  const { guardar, eliminar } = useStore();
  const rol = useRol();
  const [hechos, setHechos] = useState<number[]>([]);
  const [f, setF] = useState<Proceso | null>(null);
  const [borrar, setBorrar] = useState(false);
  useEffect(() => { setF(p ? JSON.parse(JSON.stringify(p)) : null); setHechos([]); setBorrar(false); }, [p]);
  if (!p || !f) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

  if (edit) return (
    <Sheet open onClose={onClose} width={720}>
      <div className="eyebrow">{f.id ? "Editar proceso" : "Nuevo proceso"}</div>
      <h2 className="wide mt-1.5 font-display text-[24px] font-extrabold">{f.titulo || "Sin título"}</h2>
      <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); if (!f.titulo.trim()) return toast.error("Falta el título."); guardar("procesos", { ...f, id: f.id || uid("sop-"), actualizado: today(), version: (f.version || 0) + 1 }); toast.success("Proceso guardado"); onClose(); }}>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="Título"><input className="input" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} autoFocus /></Field>
          <Field label="Etapa"><select className="input" value={f.etapa} onChange={(e) => setF({ ...f, etapa: +e.target.value })}>{[0, 1, 2, 3, 4, 5, 6, 7].map((e) => <option key={e} value={e}>{e} · {nombreEtapa(e)}</option>)}</select></Field>
        </div>
        <Field label="Objetivo"><input className="input" value={f.objetivo} onChange={(e) => setF({ ...f, objetivo: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Responsable"><input className="input" value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })} /></Field>
          <Field label="Tiempo estándar"><input className="input" value={f.tiempo} onChange={(e) => setF({ ...f, tiempo: e.target.value })} /></Field>
        </div>
        {([["pasos", "Pasos (uno por línea)"], ["checklist", "Checklist"], ["criterios", "Criterios de aceptación"], ["errores", "Errores comunes"]] as const).map(([k, l]) => (
          <Field key={k} label={l}><textarea className="input min-h-[96px]" value={f[k].join("\n")} onChange={(e) => setF({ ...f, [k]: lines(e.target.value) })} /></Field>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <button className="btn-heat" type="submit">Guardar (versión {(f.version || 0) + 1})</button><button className="btn-ghost" type="button" onClick={() => (f.id ? setEdit(false) : onClose())}>Cancelar</button>
          {f.id && can(rol, "eliminar") && (borrar ? <button type="button" className="btn ml-auto !border-heat !text-heat" onClick={() => { eliminar("procesos", f.id); toast.success("Proceso eliminado"); onClose(); }}>Sí, eliminar</button> : <button type="button" className="btn-ghost ml-auto" onClick={() => setBorrar(true)}><Trash2 size={15} /> Eliminar</button>)}
        </div>
      </form>
    </Sheet>
  );

  const pct = p.checklist.length ? (hechos.length / p.checklist.length) * 100 : 0;
  return (
    <Sheet open onClose={onClose} width={720}>
      <div className="flex flex-wrap items-center gap-2 pr-10"><span className="pill-ink">{p.etapa ? `Etapa ${p.etapa} · ${nombreEtapa(p.etapa)}` : "General"}</span><span className="text-[12px] text-muted">Versión {p.version} · actualizado {fdateY(p.actualizado)}</span></div>
      <h2 className="wide mt-3 font-display text-[28px] font-black leading-tight">{p.titulo}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink2">{p.objetivo}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="card flex items-center gap-3 p-3"><User size={18} className="text-heat" /><div><div className="text-[11px] text-muted">Responsable</div><div className="text-[13px] font-semibold">{p.responsable}</div></div></div>
        <div className="card flex items-center gap-3 p-3"><Clock size={18} className="text-heat" /><div><div className="text-[11px] text-muted">Tiempo estándar</div><div className="text-[13px] font-semibold">{p.tiempo}</div></div></div>
      </div>

      <section className="mt-6">
        <h3 className="eyebrow mb-3 flex items-center gap-1.5"><BookOpen size={13} /> Paso a paso</h3>
        <ol className="space-y-2">{p.pasos.map((x, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-bold text-bg">{i + 1}</span><span className="pt-1 text-[14px] leading-relaxed">{x}</span></motion.li>
        ))}</ol>
      </section>

      {p.checklist.length > 0 && (
        <section className="card mt-6 p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="eyebrow flex items-center gap-1.5"><CheckCircle2 size={13} /> Checklist antes de pasar de etapa</h3><span className="tnum text-[12px] font-semibold">{hechos.length}/{p.checklist.length}</span></div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface2"><motion.div className="h-full bg-ok" animate={{ width: `${pct}%` }} /></div>
          <ul className="space-y-1">{p.checklist.map((x, i) => { const on = hechos.includes(i); return (
            <li key={i}><button onClick={() => setHechos(on ? hechos.filter((y) => y !== i) : [...hechos, i])} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[14px] transition hover:bg-surface2">{on ? <CheckCircle2 size={18} className="text-ok" /> : <Circle size={18} className="text-muted" />}<span className={cx(on && "text-muted line-through")}>{x}</span></button></li>
          ); })}</ul>
        </section>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {p.criterios.length > 0 && <section className="rounded-2xl bg-ok/10 p-4"><h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-ok"><ShieldCheck size={14} /> Criterios</h3><ul className="space-y-1.5 text-[13.5px]">{p.criterios.map((x, i) => <li key={i}>· {x}</li>)}</ul></section>}
        {p.errores.length > 0 && <section className="rounded-2xl bg-heat/10 p-4"><h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-heat"><AlertTriangle size={14} /> Errores comunes</h3><ul className="space-y-1.5 text-[13.5px]">{p.errores.map((x, i) => <li key={i}>· {x}</li>)}</ul></section>}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
        <button className="btn" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
        {can(rol, "editarCatalogo") && <button className="btn" onClick={() => setEdit(true)}><Pencil size={15} /> Editar</button>}
      </div>
    </Sheet>
  );
}
