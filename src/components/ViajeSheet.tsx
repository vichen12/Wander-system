import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Flag, MapPin, Package, Plus, Sparkles, Trash2, Truck, X } from "lucide-react";
import { Field, Sheet, cx } from "./ui";
import Select from "./Select";
import { useRol, useStore, useYo } from "../store/useStore";
import type { Movimiento, Orden, Parada, Viaje } from "../lib/types";
import { ETAPA_KEY } from "../lib/types";
import { fdateLong, n0, ordenLabel, today, uid } from "../lib/format";
import { unidades } from "../lib/metrics";
import { FABRICA, kmEstimado, lugaresDe, nuevaParada, nuevoMov, type Lugar } from "../lib/viajes";

const ahora = () => new Date().toTimeString().slice(0, 5);

/** Carga o edición de un viaje. El chofer lo va armando parada por parada; producción lo puede cargar entero después. */
export default function ViajeSheet({ open, onClose, viaje }: { open: boolean; onClose: () => void; viaje?: Viaje | null }) {
  const s = useStore();
  const rol = useRol();
  const yo = useYo();
  const chofer = rol === "chofer";
  const lugares = useMemo(() => lugaresDe(s.config, s.talleres), [s.config, s.talleres]);
  const choferes = s.usuarios.filter((u) => u.rol === "chofer" && u.activo);
  const [v, setV] = useState<Viaje>(() => vacio());
  const [abierta, setAbierta] = useState<string | null>(null);
  const [nuevoLugar, setNuevoLugar] = useState<string>("");

  function vacio(): Viaje {
    const ult = [...s.viajes].filter((x) => x.kmFin != null).sort((a, b) => (b.fecha + (b.regreso || "")).localeCompare(a.fecha + (a.regreso || "")))[0];
    const fab = lugares.find((l) => l.id === FABRICA) || lugares[0];
    return { id: uid("v"), fecha: today(), choferId: chofer ? yo?.id : choferes[0]?.id || null, estado: "en_curso", salida: ahora(), kmInicio: ult?.kmFin ?? s.config.logistica?.kmInicial, km: 0, paradas: fab ? [nuevaParada(fab, ahora())] : [] };
  }
  useEffect(() => { if (open) { setV(viaje ? structuredClone(viaje) : vacio()); setAbierta(null); setNuevoLugar(""); } }, [open, viaje?.id]);

  const L = (id: string) => lugares.find((l) => l.id === id);
  const abiertas = s.ordenes.filter((o) => o.etapa < 7 || o.historial.some((h) => h.fecha >= today().slice(0, 7)));

  /** Qué lleva la camioneta después de cada parada: retiró − dejó, por orden. */
  const carga = useMemo(() => {
    const acc: Record<string, number> = {};
    return v.paradas.map((p) => {
      for (const m of p.movs) acc[m.ordenId] = (acc[m.ordenId] || 0) + (m.tipo === "retira" ? m.unidades : -m.unidades);
      return Object.entries(acc).filter(([, u]) => u > 0).map(([id, u]) => ({ o: s.ordenes.find((x) => x.id === id), u }));
    });
  }, [v.paradas, s.ordenes]);

  /** Sugerencias para una parada en un taller: retirar lo que el taller terminó y dejar lo que va a ese taller. */
  const sugerencias = (i: number) => {
    const p = v.paradas[i]; const lug = L(p.lugarId); const out: { tipo: Movimiento["tipo"]; o: Orden; u: number; motivo: string }[] = [];
    const yaEn = (oid: string, tipo: string) => p.movs.some((m) => m.ordenId === oid && m.tipo === tipo);
    if (lug?.tipo === "taller" && lug.tallerTipo) {
      const etapa = +ETAPA_KEY[lug.tallerTipo];
      for (const o of s.ordenes) {
        if (o.asignacion?.[String(etapa)] !== lug.id || o.etapa > etapa + 1) continue;
        const informado = o.historial.reduce((a, h) => a + (h.tipo === "entrega" && h.tallerId === lug.id && h.etapa === etapa ? h.unidades : 0), 0);
        const retirado = s.viajes.filter((x) => x.id !== v.id).flatMap((x) => x.paradas).filter((pp) => pp.lugarId === lug.id).flatMap((pp) => pp.movs).filter((m) => m.ordenId === o.id && m.tipo === "retira").reduce((a, m) => a + m.unidades, 0);
        if (informado - retirado > 0 && !yaEn(o.id, "retira")) out.push({ tipo: "retira", o, u: informado - retirado, motivo: "el taller informó que están listas" });
      }
    }
    const antes = i > 0 ? carga[i - 1] : [];
    for (const c of antes) if (c.o && !yaEn(c.o.id, "deja")) {
      const va = lug?.tipo === "taller" && lug.tallerTipo ? c.o.asignacion?.[ETAPA_KEY[lug.tallerTipo]] === lug.id : lug?.tipo !== "taller";
      if (va) out.push({ tipo: "deja", o: c.o, u: c.u, motivo: "las llevás en la camioneta" });
    }
    return out.slice(0, 6);
  };

  const upd = (patch: Partial<Viaje>) => setV((x) => ({ ...x, ...patch }));
  const updParada = (i: number, patch: Partial<Parada>) => setV((x) => ({ ...x, paradas: x.paradas.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const agregarParada = (id: string) => {
    const l = L(id); if (!l) return;
    const p = nuevaParada(l, ahora());
    setV((x) => ({ ...x, paradas: [...x.paradas, p] })); setAbierta(p.id); setNuevoLugar("");
  };
  const quitarParada = (i: number) => setV((x) => ({ ...x, paradas: x.paradas.filter((_, j) => j !== i) }));
  const mover = (i: number, d: -1 | 1) => setV((x) => { const ps = [...x.paradas]; const j = i + d; if (j < 1 || j >= ps.length) return x; [ps[i], ps[j]] = [ps[j], ps[i]]; return { ...x, paradas: ps }; });
  const addMov = (i: number, m: Movimiento) => updParada(i, { movs: [...v.paradas[i].movs, m] });
  const updMov = (i: number, k: number, patch: Partial<Movimiento>) => updParada(i, { movs: v.paradas[i].movs.map((m, j) => (j === k ? { ...m, ...patch } : m)) });
  const delMov = (i: number, k: number) => updParada(i, { movs: v.paradas[i].movs.filter((_, j) => j !== k) });

  const kmEst = kmEstimado(v.paradas, lugares);
  const kmOdo = v.kmInicio != null && v.kmFin != null ? v.kmFin - v.kmInicio : null;
  const totalDeja = v.paradas.flatMap((p) => p.movs).filter((m) => m.tipo === "deja").reduce((a, m) => a + m.unidades, 0);
  const pendienteEnCamioneta = carga[carga.length - 1] || [];

  const validar = (cerrar: boolean) => {
    if (!v.fecha) return "Poné la fecha.";
    if (v.fecha > today()) return "La fecha no puede ser futura.";
    if (!v.paradas.length) return "Agregá al menos el punto de salida.";
    for (const [i, p] of v.paradas.entries()) for (const m of p.movs) {
      if (!m.ordenId) return `En ${p.nombre} falta elegir la orden.`;
      if (!(m.unidades > 0)) return `En ${p.nombre}: las unidades de ${ordenLabel(m.numero)} tienen que ser mayores a cero.`;
      const o = s.ordenes.find((x) => x.id === m.ordenId);
      if (o && m.unidades > unidades(o)) return `En ${p.nombre}: ${n0(m.unidades)} u supera las ${n0(unidades(o))} de la ${ordenLabel(o.numero)}.`;
      if (m.tipo === "deja") { const lleva = i > 0 ? carga[i - 1].find((c) => c.o?.id === m.ordenId)?.u || 0 : 0; const retiraAca = p.movs.filter((x) => x.ordenId === m.ordenId && x.tipo === "retira").reduce((a, x) => a + x.unidades, 0); if (m.unidades > lleva + retiraAca) return `En ${p.nombre} dejás ${n0(m.unidades)} u de ${ordenLabel(m.numero)}, pero la camioneta lleva ${n0(lleva)}. Agregá antes dónde las retiraste.`; }
    }
    if (cerrar) {
      if (v.paradas.length < 2) return "Un viaje terminado tiene que tener al menos una parada además de la salida.";
      if (v.kmInicio != null && v.kmFin != null && v.kmFin < v.kmInicio) return "Los km de llegada no pueden ser menores a los de salida.";
      if (v.kmFin != null && v.kmInicio != null && v.kmFin - v.kmInicio > 800) return "Más de 800 km en un viaje: revisá los km del tablero.";
    }
    return null;
  };

  const guardar = (cerrar: boolean) => {
    const err = validar(cerrar); if (err) return toast.error(err);
    let paradas = v.paradas;
    if (cerrar && paradas[paradas.length - 1]?.lugarId !== FABRICA && chofer) {
      const fab = L(FABRICA); if (fab) paradas = [...paradas, nuevaParada(fab, v.regreso || ahora())];
    }
    const final: Viaje = { ...v, paradas, estado: cerrar ? "cerrado" : "en_curso", km: kmEstimado(paradas, lugares), regreso: cerrar ? v.regreso || ahora() : v.regreso };
    s.guardar("viajes", final);
    toast.success(cerrar ? "Viaje terminado y guardado" : "Viaje guardado. Podés seguir sumando paradas.");
    onClose();
  };

  const opcionesOrden = abiertas.map((o) => ({ value: o.id, label: `${ordenLabel(o.numero)} · ${o.cliente}`, desc: `${n0(unidades(o))} u · ${o.etapa < 7 ? "en curso" : "finalizada"}` }));
  const opcionesLugar = lugares.map((l) => ({ value: l.id, label: l.nombre, desc: l.tipo === "taller" ? "Taller" : l.tipo === "propio" ? "Propio" : "Otro" }));

  return (
    <Sheet open={open} onClose={onClose} width={680}>
      <div className="pr-10">
        <div className="eyebrow">{viaje ? (viaje.estado === "en_curso" ? "Viaje en curso" : "Viaje") : chofer ? "Nuevo viaje" : "Registrar un viaje"}</div>
        <h2 className="mt-1.5 font-display text-[26px] font-black leading-tight" style={{ fontStretch: "112%" }}>{viaje ? fdateLong(v.fecha) : chofer ? "Salgo con la camioneta" : "Viaje de la camioneta"}</h2>
        <p className="mt-1 text-[13px] text-muted">Agregá cada lugar donde paraste y qué dejaste o retiraste de cada orden. Así sabemos dónde está la mercadería y cuánto se mueve cada taller.</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Fecha"><input className="input" type="date" max={today()} value={v.fecha} onChange={(e) => upd({ fecha: e.target.value })} /></Field>
        <Field label="Salida"><input className="input" type="time" value={v.salida || ""} onChange={(e) => upd({ salida: e.target.value })} /></Field>
        <Field label="Km al salir" hint="Del tablero"><input className="input tnum" inputMode="numeric" value={v.kmInicio ?? ""} onChange={(e) => upd({ kmInicio: e.target.value === "" ? undefined : +e.target.value.replace(/\D/g, "") })} /></Field>
        {!chofer ? (
          <Field label="Chofer"><select className="input" value={v.choferId || ""} onChange={(e) => upd({ choferId: e.target.value || null })}><option value="">Sin asignar</option>{choferes.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></Field>
        ) : <Field label="Chofer"><div className="input truncate !bg-surface2">{yo?.nombre}</div></Field>}
      </div>

      {/* Recorrido */}
      <ol className="relative mt-6 space-y-3">
        <span className="absolute bottom-6 left-[19px] top-6 w-0.5 bg-[repeating-linear-gradient(180deg,rgb(var(--line))_0_6px,transparent_6px_11px)]" aria-hidden />
        {v.paradas.map((p, i) => {
          const lug = L(p.lugarId); const open = abierta === p.id || (abierta == null && i === v.paradas.length - 1 && i > 0);
          const sug = open ? sugerencias(i) : [];
          return (
            <motion.li layout key={p.id} className="relative pl-12">
              <span className={cx("absolute left-1.5 top-3 grid h-[27px] w-[27px] place-items-center rounded-full ring-4 ring-surface", i === 0 ? "bg-ink text-bg" : lug?.tipo === "taller" ? "bg-heat text-white" : "bg-surface2 text-ink ring-line")}>
                {i === 0 ? <Truck size={13} /> : lug?.id === FABRICA ? <Flag size={12} /> : <MapPin size={13} />}
              </span>
              <div className={cx("rounded-2xl border bg-surface transition", open ? "border-ink/30 shadow-[0_10px_30px_-18px_rgb(0_0_0/.35)]" : "border-line")}>
                <button type="button" onClick={() => setAbierta(open ? "__none" : p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold">{i === 0 ? "Salida · " : ""}{p.nombre}</div>
                    <div className="text-[12px] text-muted">{p.hora || "—"} · {p.movs.length ? p.movs.map((m) => `${m.tipo === "deja" ? "dejó" : "retiró"} ${n0(m.unidades)} de ${ordenLabel(m.numero)}`).join(", ") : i === 0 ? "Cargá lo que sale de acá" : "Sin movimientos todavía"}</div>
                  </div>
                  {i > 0 && <span className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-surface2" onClick={() => mover(i, -1)} aria-label="Subir parada"><ArrowUp size={14} /></button>
                    <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-surface2" onClick={() => mover(i, 1)} aria-label="Bajar parada"><ArrowDown size={14} /></button>
                    <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-heat/10 hover:text-heat" onClick={() => quitarParada(i)} aria-label="Quitar parada"><Trash2 size={14} /></button>
                  </span>}
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="space-y-3 border-t border-line px-4 pb-4 pt-3">
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <Select value={p.lugarId} onChange={(id) => { const l = L(id); if (l) updParada(i, { lugarId: l.id, nombre: l.nombre }); }} options={opcionesLugar} label="Lugar" icon={<MapPin size={14} />} width={300} />
                          <input className="input !w-[132px] !px-2 text-[13px]" type="time" value={p.hora || ""} onChange={(e) => updParada(i, { hora: e.target.value })} aria-label="Hora" />
                        </div>
                        {sug.length > 0 && (
                          <div className="rounded-xl bg-heat/[.06] p-2.5">
                            <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-heat"><Sparkles size={13} /> Sugerencias para esta parada</div>
                            <div className="flex flex-wrap gap-1.5">
                              {sug.map((x) => (
                                <button type="button" key={x.tipo + x.o.id} onClick={() => addMov(i, nuevoMov(x.tipo, x.o, x.u))} className="rounded-full border border-heat/30 bg-surface px-2.5 py-1 text-[12px] font-semibold transition hover:border-heat" title={x.motivo}>
                                  {x.tipo === "deja" ? "Dejar" : "Retirar"} {n0(x.u)} de {ordenLabel(x.o.numero)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {p.movs.map((m, k) => (
                          <div key={m.id} className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl bg-surface2 p-2 sm:grid-cols-[auto_1fr_96px_auto]">
                            <div className="flex rounded-lg bg-surface p-0.5 ring-1 ring-line">
                              {(["retira", "deja"] as const).map((t) => (
                                <button type="button" key={t} onClick={() => updMov(i, k, { tipo: t })} className={cx("rounded-md px-2.5 py-1 text-[12px] font-semibold transition", m.tipo === t ? (t === "deja" ? "bg-ok text-white" : "bg-ink text-bg") : "text-muted")}>{t === "deja" ? "Dejé" : "Retiré"}</button>
                              ))}
                            </div>
                            <Select value={m.ordenId} onChange={(id) => { const o = s.ordenes.find((x) => x.id === id); if (o) updMov(i, k, { ordenId: o.id, numero: o.numero }); }} options={opcionesOrden} label="Orden" icon={<Package size={14} />} width={320} />
                            <input className="input tnum" inputMode="numeric" placeholder="Prendas" value={m.unidades || ""} onChange={(e) => updMov(i, k, { unidades: +e.target.value.replace(/\D/g, "") })} aria-label="Unidades" />
                            <button type="button" className="justify-self-end rounded-lg p-1.5 text-muted hover:text-heat" onClick={() => delMov(i, k)} aria-label="Quitar"><X size={15} /></button>
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn-ghost !py-1.5 text-[12.5px]" onClick={() => { const o = abiertas[0]; if (!o) return toast.error("No hay órdenes abiertas."); addMov(i, nuevoMov("retira", o, 0)); }}><ArrowUp size={14} /> Retiré mercadería</button>
                          <button type="button" className="btn-ghost !py-1.5 text-[12.5px]" onClick={() => { const c = (i > 0 ? carga[i - 1] : [])[0]; const o = c?.o || abiertas[0]; if (!o) return toast.error("No hay órdenes abiertas."); addMov(i, nuevoMov("deja", o, c?.u || 0)); }}><ArrowDown size={14} /> Dejé mercadería</button>
                        </div>
                        {carga[i]?.length > 0 && <div className="text-[11.5px] text-muted">Al salir de acá la camioneta lleva: {carga[i].map((c) => `${n0(c.u)} de ${c.o ? ordenLabel(c.o.numero) : "?"}`).join(", ")}</div>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.li>
          );
        })}
        <li className="relative pl-12">
          <span className="absolute left-1.5 top-2 grid h-[27px] w-[27px] place-items-center rounded-full border-2 border-dashed border-muted/50 bg-surface text-muted"><Plus size={13} /></span>
          <Select<string> value={nuevoLugar} onChange={agregarParada} options={[{ value: "", label: "Agregar parada…" }, ...opcionesLugar]} label="Agregar parada" icon={<Plus size={14} />} width={300} />
        </li>
      </ol>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Regreso"><input className="input" type="time" value={v.regreso || ""} onChange={(e) => upd({ regreso: e.target.value })} /></Field>
        <Field label="Km al volver" hint="Del tablero"><input className="input tnum" inputMode="numeric" value={v.kmFin ?? ""} onChange={(e) => upd({ kmFin: e.target.value === "" ? undefined : +e.target.value.replace(/\D/g, "") })} /></Field>
        <div className="col-span-2 grid grid-cols-3 gap-2 rounded-2xl bg-surface2 p-3 text-center">
          <div><div className="tnum font-display text-[20px] font-black">{kmOdo ?? kmEst}</div><div className="text-[11px] text-muted">{kmOdo != null ? "km reales" : "km estimados"}</div></div>
          <div><div className="tnum font-display text-[20px] font-black">{Math.max(0, v.paradas.length - 1)}</div><div className="text-[11px] text-muted">paradas</div></div>
          <div><div className="tnum font-display text-[20px] font-black">{n0(totalDeja)}</div><div className="text-[11px] text-muted">prendas dejadas</div></div>
        </div>
      </div>
      <Field label="Notas"><input className="input mt-3" value={v.notas || ""} onChange={(e) => upd({ notas: e.target.value })} placeholder="Opcional: demoras, faltantes, remitos…" /></Field>
      {pendienteEnCamioneta.length > 0 && <p className="mt-3 rounded-xl bg-ember/10 px-3 py-2 text-[12.5px] text-ink2">Todavía quedan en la camioneta: {pendienteEnCamioneta.map((c) => `${n0(c.u)} de ${c.o ? ordenLabel(c.o.numero) : "?"}`).join(", ")}. Si las dejaste en algún lado, agregá esa parada.</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="btn-heat" onClick={() => guardar(true)}><Flag size={15} /> {chofer ? "Terminar viaje" : "Guardar viaje"}</button>
        <button type="button" className="btn-ghost" onClick={() => guardar(false)}>{chofer ? "Guardar y seguir después" : "Guardar como en curso"}</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </Sheet>
  );
}

export type { Lugar };
