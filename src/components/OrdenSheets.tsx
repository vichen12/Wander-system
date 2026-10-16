import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, BookOpen, Bot, Check, Flame, Minus, Plus, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Field, Seg, Sheet, Stepper, cx, rise, stagger, EstadoOrden } from "./ui";
import { useRol, useStore } from "../store/useStore";
import { can } from "../lib/roles";
import { necesidades, unidades } from "../lib/metrics";
import { ETAPAS, ETAPA_DESC, ETAPA_DE_TALLER, type Linea, type Orden } from "../lib/types";
import { addDays, fdate, fdateY, money, n0, n2, ordenLabel, today } from "../lib/format";
import { movimientosOrden, ubicacionOrden } from "../lib/viajes";
import { MapPin, Truck } from "lucide-react";
import { festejar } from "../views/Ordenes";

export function DetalleOrden({ id, onClose, onEditar }: { id: string | null; onClose: () => void; onEditar: (id: string) => void }) {
  const s = useStore();
  const rol = useRol();
  const o = s.ordenes.find((x) => x.id === id);
  const [uni, setUni] = useState("");
  const [tal, setTal] = useState("");
  const [obs, setObs] = useState("");
  const [rev, setRev] = useState("");
  const [fal, setFal] = useState("0");
  const [mot, setMot] = useState("");
  const [borrar, setBorrar] = useState(false);
  useEffect(() => { if (o) { setUni(String(unidades(o))); setRev(String(unidades(o))); setFal("0"); setMot(""); setObs(""); setBorrar(false); } }, [o?.id, o?.etapa]);
  const cand = useMemo(() => {
    if (!o) return [];
    const tipos = o.etapa === 2 ? ["corte"] : o.etapa === 3 ? ["confeccion"] : o.etapa === 4 ? ["bordado", "estampado", "sublimado"] : [];
    return s.talleres.filter((t) => tipos.includes(t.tipo));
  }, [o?.etapa, s.talleres]);
  useEffect(() => {
    const resp = o ? [...o.historial].reverse().find((h) => h.tipo === "entrega" && h.etapa === 3 && h.tallerId) : undefined;
    const asig = o?.asignacion?.[String(o.etapa)];
    setTal((asig && cand.some((t) => t.id === asig) ? asig : "") || cand[0]?.id || (resp?.tipo === "entrega" && resp.tallerId) || s.talleres[0]?.id || "");
  }, [cand, o?.id]);
  if (!o) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const nd = necesidades(o.lineas, s.productos, s.materiales);
  const verCostos = can(rol, "verCostos");
  const hist = [...o.historial].sort((a, b) => b.ts - a.ts);
  const entregado = (e: number) => o.historial.filter((h) => h.tipo === "entrega" && h.etapa === e).reduce((a, h) => a + (h.tipo === "entrega" ? h.unidades : 0), 0);
  const total = unidades(o);
  const prog = Math.min(100, (entregado(o.etapa) / Math.max(1, total)) * 100);
  const respCalidad = [...o.historial].reverse().find((h) => h.tipo === "entrega" && h.etapa === 3 && h.tallerId);

  const avanzar = () => {
    s.moverEtapa(o.id, o.etapa + 1);
    if (o.etapa + 1 === 7) { festejar(); toast.success(`${ordenLabel(o.numero)} finalizada`); } else toast.success(`Pasó a ${ETAPAS[o.etapa + 1]}`);
  };

  return (
    <Sheet open={!!o} onClose={onClose} width={640}>
      <div className="pr-10">
        <div className="eyebrow">{o.tipo === "stock" ? "Producción para stock" : "Venta"} · creada {fdateY(o.creada)}</div>
        <h2 className="wide mt-1.5 font-display text-[26px] font-extrabold leading-tight"><span className="mr-2 font-mono text-[18px] text-muted">{ordenLabel(o.numero)}</span>{o.cliente}</h2>
        <div className="mt-2 flex flex-wrap gap-1.5"><EstadoOrden o={o} />{o.prioridad === "alta" && <span className="pill-heat"><Flame size={12} /> Prioridad alta</span>}{o.factura && <span className="pill">Factura {o.factura}</span>}</div>
      </div>

      {/* Recorrido */}
      <div className="mt-6">
        <Stepper etapa={o.etapa} />
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] leading-tight text-muted">
          {ETAPAS.slice(1).map((e, i) => <span key={e} className={cx(i + 1 === o.etapa && "font-bold text-heat", i + 1 < o.etapa && "text-ink2")}>{e}</span>)}
        </div>
      </div>

      {o.etapa < 7 && can(rol, "moverOrdenes") && (
        <motion.section layout className="card mt-5 overflow-hidden">
          <div className="border-b border-line bg-surface2 px-4 py-3">
            <div className="text-[13px] font-bold">Ahora: {ETAPAS[o.etapa]}</div>
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[12px] text-muted">{ETAPA_DESC[o.etapa]}</div><Link to={`/procesos?etapa=${o.etapa}`} className="flex items-center gap-1 text-[12px] font-semibold text-heat hover:underline"><BookOpen size={13} /> Ver cómo se hace</Link></div>
          </div>
          <div className="space-y-3 p-4">
            {o.etapa === 5 ? (<>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Taller responsable"><select className="input" value={tal} onChange={(e) => setTal(e.target.value)}>{s.talleres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></Field>
                <Field label="Revisadas"><input className="input tnum" inputMode="numeric" value={rev} onChange={(e) => setRev(e.target.value.replace(/\D/g, ""))} /></Field>
                <Field label="Con falla"><input className="input tnum" inputMode="numeric" value={fal} onChange={(e) => setFal(e.target.value.replace(/\D/g, ""))} /></Field>
              </div>
              <Field label="Motivo"><input className="input" placeholder="Costura torcida, estampa corrida…" value={mot} onChange={(e) => setMot(e.target.value)} /></Field>
              <button className="btn-ink" onClick={() => { const r = +rev, f = +fal; if (!r) return toast.error("Poné cuántas se revisaron."); if (f > r) return toast.error("Las fallas superan a las revisadas."); s.registrarCalidad(o.id, { tallerId: tal || s.talleres[0].id, revisadas: r, fallas: f, motivo: mot }); toast.success("Control de calidad guardado"); }}><Check size={15} /> Guardar control</button>
            </>) : (<>
              <div className="flex items-center justify-between text-[12px]"><span className="text-muted">Entregado en esta etapa</span><span className="tnum font-semibold">{n0(entregado(o.etapa))} / {n0(total)}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-surface2"><motion.div className="h-full rounded-full bg-gradient-to-r from-ember to-heat" animate={{ width: `${prog}%` }} /></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
                <Field label={o.etapa === 1 ? "Prendas cubiertas" : "Unidades"}><input className="input tnum" inputMode="numeric" value={uni} onChange={(e) => setUni(e.target.value.replace(/\D/g, ""))} /></Field>
                {cand.length > 0 ? <Field label="Taller"><select className="input" value={tal} onChange={(e) => setTal(e.target.value)}>{cand.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></Field>
                  : <Field label="Observaciones"><input className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" /></Field>}
              </div>
              <button className="btn-ink" onClick={() => { const u = +uni; if (!u) return toast.error("Poné las unidades."); s.registrarEntrega(o.id, { unidades: u, tallerId: cand.length ? tal : null, obs }); toast.success(`${n0(u)} u registradas`); }}><Check size={15} /> Registrar {o.etapa === 1 ? "tela recibida" : "entrega"}</button>
            </>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
            <span className="text-[12px] text-muted">{o.etapa === 6 ? "Al pasar, la orden queda finalizada." : "Cuando la etapa esté completa:"}</span>
            <motion.button whileTap={{ scale: 0.96 }} className="btn-heat" onClick={avanzar}>{o.etapa === 6 ? "Finalizar orden" : `Pasar a ${ETAPAS[o.etapa + 1]}`} <ArrowRight size={15} /></motion.button>
          </div>
        </motion.section>
      )}

      <TalleresYCamioneta o={o} editable={can(rol, "editarOrdenes")} />

      <section className="mt-6">
        <h3 className="eyebrow mb-2">Prendas</h3>
        <div className="card divide-y divide-line">
          {o.lineas.map((l, i) => { const p = s.productos.find((x) => x.id === l.productoId); return (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><i className="h-2.5 w-2.5 rounded-full" style={{ background: p?.color }} /><span className="flex-1 font-medium">{p?.nombre || "Producto"}</span><span className="pill">{l.talle}</span><span className="tnum w-14 text-right font-semibold">{n0(l.cantidad)}</span></div>
          ); })}
          <div className="flex justify-between px-4 py-2.5 text-[13px] font-bold"><span>Total</span><span className="tnum">{n0(total)}</span></div>
        </div>
      </section>

      <section className="mt-5">
        <h3 className="eyebrow mb-2">Materiales según BOM (con merma)</h3>
        <div className="card p-4">
          {nd.mats.length ? (
            <table className="w-full text-[13px]"><tbody>
              {nd.mats.map((x) => <tr key={x.m.id}><td className="py-1.5">{x.m.nombre}</td><td className="tnum py-1.5 text-right font-semibold">{n2(x.q)} {x.m.unidad}</td>{verCostos && <td className="tnum py-1.5 pl-4 text-right text-muted">{money(x.q * x.m.costo)}</td>}</tr>)}
            </tbody></table>
          ) : <span className="text-[13px] text-muted">Los productos no tienen receta cargada.</span>}
          {verCostos && (
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
              <div><div className="text-[11px] text-muted">Costo estimado</div><div className="tnum font-display text-[16px] font-extrabold">{money(nd.costo)}</div></div>
              <div><div className="text-[11px] text-muted">Venta estimada</div><div className="tnum font-display text-[16px] font-extrabold">{money(nd.venta)}</div></div>
              <div><div className="text-[11px] text-muted">Margen</div><div className={cx("tnum font-display text-[16px] font-extrabold", (nd.margen ?? 0) < 0.3 && "text-heat")}>{nd.margen == null ? "—" : Math.round(nd.margen * 100) + "%"}</div></div>
            </div>
          )}
        </div>
      </section>

      {o.calidad.length > 0 && (
        <section className="mt-5">
          <h3 className="eyebrow mb-2">Control de calidad</h3>
          <div className="card divide-y divide-line">{o.calidad.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="tnum text-muted">{fdateY(c.fecha)}</span><span className="flex-1">{s.talleres.find((t) => t.id === c.tallerId)?.nombre}</span><span className={c.fallas / c.revisadas > 0.03 ? "pill-heat" : "pill-ok"}>{c.fallas}/{c.revisadas}</span><span className="hidden w-32 truncate text-muted sm:block">{c.motivo}</span></div>
          ))}</div>
        </section>
      )}

      <section className="mt-5">
        <h3 className="eyebrow mb-3">Historial</h3>
        <motion.ol variants={stagger} initial="hidden" animate="show" className="relative ml-2 space-y-3 border-l-2 border-line pl-5">
          {hist.map((h) => (
            <motion.li variants={rise} key={h.id} className="relative text-[13px]">
              <span className={cx("absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2", h.tipo === "avance" ? "border-heat bg-heat" : "border-muted bg-surface")} />
              {h.tipo === "avance" ? <>Pasó a <b>{ETAPAS[h.etapa]}</b></> : <><b className="tnum">{n0(h.unidades)} u</b> en {ETAPAS[h.etapa].toLowerCase()}{h.tallerId && <> · {s.talleres.find((t) => t.id === h.tallerId)?.nombre}</>}{h.obs && <span className="text-muted"> · {h.obs}</span>}</>}
              <div className="flex items-center gap-1.5 text-[11.5px] text-muted">{fdateY(h.fecha)}{h.via === "asistente" && <span className="inline-flex items-center gap-1"><Bot size={11} /> por el asistente</span>}</div>
            </motion.li>
          ))}
        </motion.ol>
      </section>

      {can(rol, "editarOrdenes") && (
        <div className="mt-8 flex flex-wrap gap-2 border-t border-line pt-5">
          <button className="btn" onClick={() => onEditar(o.id)}>Editar orden</button>
          {o.etapa > 1 && <button className="btn-ghost" onClick={() => { s.moverEtapa(o.id, o.etapa - 1); toast("Volvió a " + ETAPAS[o.etapa - 1]); }}>Volver una etapa</button>}
          {can(rol, "eliminar") && (borrar
            ? <><button className="btn !border-heat !text-heat" onClick={() => { s.eliminarOrden(o.id); toast.success("Orden eliminada"); onClose(); }}><Trash2 size={15} /> Sí, eliminar {ordenLabel(o.numero)}</button><button className="btn-ghost" onClick={() => setBorrar(false)}>Cancelar</button></>
            : <button className="btn-ghost ml-auto" onClick={() => setBorrar(true)}><Trash2 size={15} /> Eliminar</button>)}
        </div>
      )}
    </Sheet>
  );
}

export function NuevaOrden({ open, editarId, onClose, onCreada }: { open: boolean; editarId: string | null; onClose: () => void; onCreada: (id: string) => void }) {
  const s = useStore();
  const rol = useRol();
  const ed = s.ordenes.find((o) => o.id === editarId);
  const [paso, setPaso] = useState(0);
  const [tipo, setTipo] = useState<"venta" | "stock">("venta");
  const [cliente, setCliente] = useState("");
  const [factura, setFactura] = useState("");
  const [fecha, setFecha] = useState(addDays(today(), 21));
  const [prio, setPrio] = useState<"normal" | "alta">("normal");
  const [lineas, setLineas] = useState<Linea[]>([]);
  useEffect(() => {
    if (!open) return;
    setPaso(0);
    if (ed) { setTipo(ed.tipo); setCliente(ed.cliente); setFactura(ed.factura); setFecha(ed.fechaEntrega); setPrio(ed.prioridad); setLineas(ed.lineas.map((l) => ({ ...l }))); }
    else { setTipo("venta"); setCliente(""); setFactura(""); setFecha(addDays(today(), 21)); setPrio("normal"); setLineas([]); }
  }, [open, editarId]);
  const nd = necesidades(lineas, s.productos, s.materiales);
  const tot = lineas.reduce((a, l) => a + l.cantidad, 0);
  const verCostos = can(rol, "verCostos");
  const setQty = (pid: string, talle: string, q: number) => setLineas((ls) => { const i = ls.findIndex((l) => l.productoId === pid && l.talle === talle); if (q <= 0) return ls.filter((_, j) => j !== i); if (i < 0) return [...ls, { productoId: pid, talle, cantidad: q }]; return ls.map((l, j) => (j === i ? { ...l, cantidad: q } : l)); });
  const qty = (pid: string, talle: string) => lineas.find((l) => l.productoId === pid && l.talle === talle)?.cantidad || 0;

  const guardar = () => {
    if (!lineas.length) return toast.error("Agregá al menos una prenda.");
    if (tipo === "venta" && !cliente.trim()) return toast.error("Poné el cliente.");
    const base = { tipo, cliente: cliente.trim() || "Stock temporada " + (new Date().getFullYear() + 1), factura: factura.trim(), fechaEntrega: fecha, prioridad: prio, lineas, notas: "" };
    if (ed) { s.editarOrden(ed.id, base); toast.success("Orden actualizada"); onCreada(ed.id); }
    else { const o = s.crearOrden(base); toast.success(`Orden ${ordenLabel(o.numero)} creada`); onCreada(o.id); }
  };
  const pasos = ["Datos", "Prendas", "Revisar"];

  return (
    <Sheet open={open} onClose={onClose} width={680}>
      <div className="eyebrow">{ed ? `Editar ${ordenLabel(ed.numero)}` : "Nueva orden de producción"}</div>
      <h2 className="wide mt-1.5 font-display text-[26px] font-extrabold">{["¿Para quién es?", "¿Qué hay que producir?", "Revisá y creá"][paso]}</h2>
      <div className="mt-4 flex gap-2">
        {pasos.map((p, i) => (
          <button key={p} onClick={() => setPaso(i)} className={cx("flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition", i === paso ? "border-ink bg-ink text-bg" : i < paso ? "border-line bg-surface text-ink" : "border-line text-muted")}>
            <span className={cx("grid h-5 w-5 place-items-center rounded-full text-[10px]", i < paso ? "bg-heat text-white" : "bg-white/15")}>{i < paso ? <Check size={11} /> : i + 1}</span>{p}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={paso} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }} className="mt-5">
          {paso === 0 && (
            <div className="space-y-4">
              <Seg value={tipo} onChange={setTipo} options={[["venta", "Venta a un cliente"], ["stock", "Producción para stock"]]} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={tipo === "venta" ? "Cliente" : "Temporada o destino"}><input className="input" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder={tipo === "venta" ? "Nombre del cliente" : "Stock temporada 2027"} autoFocus /></Field>
                <Field label="N.º de factura" hint="Si es una venta, se vincula la factura."><input className="input" value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="A-0003-00001234" /></Field>
                <Field label="Fecha de entrega"><input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
                <Field label="Prioridad"><Seg value={prio} onChange={setPrio} options={[["normal", "Normal"], ["alta", "Alta"]]} /></Field>
              </div>
            </div>
          )}
          {paso === 1 && (
            <div className="space-y-3">
              {s.productos.map((p) => (
                <div key={p.id} className="card p-4">
                  <div className="mb-3 flex items-center gap-2"><i className="h-3 w-3 rounded-full" style={{ background: p.color }} /><span className="font-bold">{p.nombre}</span><span className="pill">{p.categoria}</span><span className="ml-auto tnum text-[12px] text-muted">{n0(p.talles.reduce((a, t) => a + qty(p.id, t), 0))} u</span></div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {p.talles.map((t) => { const q = qty(p.id, t); return (
                      <div key={t} className={cx("rounded-xl border p-2 transition", q ? "border-heat/60 bg-heat/5" : "border-line")}>
                        <div className="mb-1 text-center text-[11px] font-bold text-muted">{t}</div>
                        <div className="flex items-center gap-1">
                          <button type="button" className="grid h-7 w-7 place-items-center rounded-lg bg-surface2 hover:bg-line" onClick={() => setQty(p.id, t, Math.max(0, q - 10))} aria-label={`Menos ${t}`}><Minus size={13} /></button>
                          <input className="w-full min-w-0 bg-transparent text-center text-[14px] font-bold tnum outline-none" inputMode="numeric" value={q || ""} placeholder="0" onChange={(e) => setQty(p.id, t, +e.target.value.replace(/\D/g, "") || 0)} aria-label={`Cantidad ${p.nombre} ${t}`} />
                          <button type="button" className="grid h-7 w-7 place-items-center rounded-lg bg-surface2 hover:bg-line" onClick={() => setQty(p.id, t, q + 10)} aria-label={`Más ${t}`}><Plus size={13} /></button>
                        </div>
                      </div>
                    ); })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {paso === 2 && (
            <div className="space-y-4">
              <div className="card grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
                <div><div className="text-[11px] text-muted">Tipo</div><div className="font-semibold">{tipo === "venta" ? "Venta" : "Stock"}</div></div>
                <div className="col-span-1 min-w-0"><div className="text-[11px] text-muted">Cliente</div><div className="truncate font-semibold">{cliente || "Stock"}</div></div>
                <div><div className="text-[11px] text-muted">Entrega</div><div className="font-semibold">{fdateY(fecha)}</div></div>
                <div><div className="text-[11px] text-muted">Prendas</div><div className="tnum font-semibold">{n0(tot)}</div></div>
              </div>
              <div className="card p-4">
                <div className="eyebrow mb-2">Calculado con el BOM (incluye merma)</div>
                {nd.mats.length ? <table className="w-full text-[13px]"><tbody>{nd.mats.map((x) => <tr key={x.m.id}><td className="py-1.5">{x.m.nombre}</td><td className="tnum py-1.5 text-right font-bold">{n2(x.q)} {x.m.unidad}</td>{verCostos && <td className="tnum py-1.5 pl-4 text-right text-muted">{money(x.q * x.m.costo)}</td>}</tr>)}</tbody></table> : <span className="text-[13px] text-muted">Elegí prendas en el paso anterior.</span>}
                {verCostos && nd.costo > 0 && <div className="mt-3 flex justify-between border-t border-line pt-3 font-bold"><span>Costo estimado</span><span className="tnum">{money(nd.costo)}</span></div>}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between gap-2 border-t border-line pt-4">
        <span className="tnum text-[13px] text-muted">{n0(tot)} prendas{verCostos && nd.costo > 0 && <> · {money(nd.costo)}</>}</span>
        <div className="flex gap-2">
          {paso > 0 && <button className="btn" onClick={() => setPaso(paso - 1)}>Atrás</button>}
          {paso < 2 ? <button className="btn-ink" onClick={() => setPaso(paso + 1)}>Siguiente <ArrowRight size={15} /></button>
            : <button className="btn-heat" onClick={guardar}><Check size={15} /> {ed ? "Guardar cambios" : "Crear orden"}</button>}
        </div>
      </div>
    </Sheet>
  );
}

const ETAPAS_TALLER: { key: string; nombre: string; tipos: string[] }[] = [
  { key: "2", nombre: "Corte", tipos: ["corte"] },
  { key: "3", nombre: "Confección", tipos: ["confeccion"] },
  { key: "4", nombre: "Personalización", tipos: ["bordado", "estampado", "sublimado"] },
];

/** Qué taller hace cada etapa de la orden, dónde está la mercadería y qué movió la camioneta. */
function TalleresYCamioneta({ o, editable }: { o: Orden; editable: boolean }) {
  const s = useStore();
  const ubic = ubicacionOrden(o, s.viajes);
  const movs = movimientosOrden(o, s.viajes);
  const asignar = (k: string, tid: string) => {
    const asignacion = { ...(o.asignacion || {}) };
    if (tid) asignacion[k] = tid; else delete asignacion[k];
    s.editarOrden(o.id, { asignacion });
    toast.success(tid ? "Taller asignado" : "Asignación quitada");
  };
  return (
    <section className="mt-6 grid gap-3 sm:grid-cols-2">
      <div className="card p-4">
        <h3 className="mb-2 text-[13px] font-bold">Talleres de esta orden</h3>
        <div className="space-y-2">
          {ETAPAS_TALLER.map((e) => {
            const opciones = s.talleres.filter((t) => e.tipos.includes(t.tipo));
            const actual = o.asignacion?.[e.key] || "";
            return (
              <label key={e.key} className="flex items-center gap-2 text-[12.5px]">
                <span className={cx("w-[104px] shrink-0", String(o.etapa) === e.key ? "font-bold text-heat" : "text-muted")}>{e.nombre}</span>
                {editable ? (
                  <select className="input !py-1.5 text-[12.5px]" value={actual} onChange={(ev) => asignar(e.key, ev.target.value)} aria-label={"Taller de " + e.nombre}>
                    <option value="">Sin asignar</option>
                    {opciones.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                ) : <span className="font-semibold">{s.talleres.find((t) => t.id === actual)?.nombre || "Sin asignar"}</span>}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-[11.5px] text-muted">El taller asignado ve la orden en su pantalla y es el único que puede informar entregas. Si la camioneta deja la orden en un taller, queda asignado solo.</p>
      </div>
      <div className="card p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold"><Truck size={14} className="text-heat" /> Camioneta</h3>
        {ubic ? (
          <div className="mb-2 flex items-start gap-2 rounded-xl bg-surface2 px-3 py-2 text-[12.5px]">
            <MapPin size={15} className="mt-0.5 shrink-0 text-heat" />
            <span>Último movimiento: <b>{ubic.tipo === "deja" ? "dejó" : "retiró"} {n0(ubic.unidades)} u</b> {ubic.tipo === "deja" ? "en" : "de"} <b>{ubic.lugar}</b>, {fdate(ubic.fecha)}{ubic.hora ? " " + ubic.hora : ""}.</span>
          </div>
        ) : <p className="text-[12.5px] text-muted">La camioneta todavía no movió mercadería de esta orden.</p>}
        {movs.length > 0 && (
          <ol className="max-h-40 space-y-1 overflow-y-auto text-[12px] scroll-thin">
            {movs.map(({ viaje, parada, mov }) => (
              <li key={mov.id} className="flex items-center gap-2"><span className="w-12 shrink-0 tnum text-muted">{fdate(viaje.fecha)}</span><span className={mov.tipo === "deja" ? "pill-ok" : "pill"}>{mov.tipo === "deja" ? "Dejó" : "Retiró"}</span><span className="tnum font-semibold">{n0(mov.unidades)}</span><span className="truncate text-ink2">{parada.nombre}</span></li>
            ))}
          </ol>
        )}
        {movs.length > 0 && <div className="mt-2 text-[11.5px] text-muted">{new Set(movs.map((m) => m.viaje.id)).size} viajes con mercadería de esta orden.</div>}
      </div>
    </section>
  );
}
