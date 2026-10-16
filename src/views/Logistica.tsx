import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bar as RBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, Flag, Gauge, MapPin, MessageSquareText, Package, Plus, Route, Truck } from "lucide-react";
import { Empty, Kpi, Page, PageHead, Paginacion, Seg, cx, rise, stagger, usePagina } from "../components/ui";
import ViajeSheet from "../components/ViajeSheet";
import MapaRecorridos from "../components/MapaRecorridos";
import { useRol, useStore, useYo } from "../store/useStore";
import { periodo } from "../lib/metrics";
import { addDays, fdate, fdateLong, money, monthKey, monthLabel, n0, n1, ordenLabel, today } from "../lib/format";
import { useColors } from "../lib/colors";
import { can } from "../lib/roles";
import { conciliacion, kmViaje, ordenesDe, statsViajes, unidadesMovidas } from "../lib/viajes";
import type { Viaje } from "../lib/types";

export default function Logistica() {
  const { viajes, talleres, ordenes, usuarios, config } = useStore();
  const rol = useRol();
  const yo = useYo();
  const C = useColors();
  const [sp, setSp] = useSearchParams();
  const [sheet, setSheet] = useState<{ open: boolean; viaje: Viaje | null }>({ open: sp.get("nuevo") === "1", viaje: null });
  useEffect(() => { if (sp.get("nuevo") === "1") { setSheet({ open: true, viaje: null }); setSp({}); } }, [sp]);
  const chofer = rol === "chofer";
  const verCostos = can(rol, "verCostos");
  const mes = monthKey(today());
  const [a, b] = periodo(mes);
  const S = useMemo(() => statsViajes(viajes, talleres, a, b, config.logistica?.costoKm || 0), [viajes, talleres, a, b, config.logistica?.costoKm]);
  const enCurso = viajes.filter((v) => v.estado === "en_curso" && (!chofer || v.choferId === yo?.id));
  const lista = useMemo(() => [...viajes].sort((x, y) => (y.fecha + (y.salida || "")).localeCompare(x.fecha + (x.salida || ""))), [viajes]);
  const pgV = usePagina(lista, 8);
  const [verTodo, setVerTodo] = useState(false);
  const conc = useMemo(() => conciliacion(ordenes.filter((o) => o.etapa < 7 || (o.fechaFin || "") >= addDays(today(), -30)), viajes, talleres), [ordenes, viajes, talleres]);
  const problemas = conc.filter((f) => f.estado !== "ok");
  const abrir = (v: Viaje | null) => setSheet({ open: true, viaje: v });

  const semanas = useMemo(() => {
    const out: { s: string; viajes: number; km: number }[] = [];
    for (let i = 9; i >= 0; i--) {
      const fin = addDays(today(), -7 * i), ini = addDays(fin, -6);
      const vs = viajes.filter((v) => v.fecha >= ini && v.fecha <= fin);
      out.push({ s: fdate(ini), viajes: vs.length, km: vs.reduce((x, v) => x + kmViaje(v), 0) });
    }
    return out;
  }, [viajes]);

  return (
    <Page>
      <PageHead eyebrow={chofer ? "Camioneta" : "Logística · " + monthLabel(mes)} title={chofer ? `Hola, ${yo?.nombre.split(" ")[0]}` : "La camioneta"}>
        {!chofer && <button className="btn-heat" onClick={() => abrir(null)}><Plus size={16} /> Registrar viaje</button>}
      </PageHead>

      {/* Viaje en curso / iniciar */}
      {(chofer || enCurso.length > 0) && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="mb-5 grid gap-3 sm:grid-cols-2">
          {enCurso.map((v) => (
            <motion.button variants={rise} key={v.id} whileTap={{ scale: 0.98 }} onClick={() => abrir(v)} className="relative overflow-hidden rounded-3xl border-2 border-heat bg-surface p-5 text-left shadow-glow">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-heat"><span className="h-2 w-2 animate-pulseheat rounded-full bg-heat" /> Viaje en curso · salió {v.salida}</div>
              <div className="mt-2 font-display text-[20px] font-black leading-tight">{v.paradas.map((p) => p.nombre).join(" → ")}</div>
              <div className="mt-1 text-[13px] text-muted">{v.paradas.length - 1} paradas · {n0(unidadesMovidas(v))} prendas dejadas · tocá para sumar paradas o terminarlo</div>
            </motion.button>
          ))}
          {chofer && enCurso.length === 0 && (
            <motion.button variants={rise} whileTap={{ scale: 0.98 }} onClick={() => abrir(null)} className="relative overflow-hidden rounded-3xl bg-heat p-6 text-left text-white shadow-glow">
              <Truck className="absolute -right-4 -top-4 h-28 w-28 opacity-15" />
              <div className="font-display text-[24px] font-black" style={{ fontStretch: "112%" }}>Iniciar viaje</div><div className="mt-1 text-[14px] text-white/85">Anotá los km y andá sumando cada parada.</div>
            </motion.button>
          )}
          {chofer && (
            <motion.button variants={rise} whileTap={{ scale: 0.98 }} onClick={() => useStore.getState().setChatAbierto(true)} className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 text-left">
              <MessageSquareText className="absolute -right-4 -top-4 h-28 w-28 text-ink opacity-[.06]" />
              <div className="font-display text-[24px] font-black" style={{ fontStretch: "112%" }}>Contárselo al asistente</div><div className="mt-1 text-[14px] text-muted">“Dejé 200 remeras de la orden 15 en Bordados Centro”</div>
            </motion.button>
          )}
        </motion.div>
      )}

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Viajes del mes" value={S.n} icon={<Truck size={14} />} sub={`${n1(S.paradasPorViaje)} paradas por viaje`} />
        <Kpi label="Kilómetros" value={S.km} icon={<Gauge size={14} />} sub="odómetro o estimado" />
        <Kpi label="Prendas trasladadas" value={S.unidades} icon={<Package size={14} />} sub="dejadas en algún lugar" />
        <Kpi label="Talleres visitados" value={S.visitasTaller.filter((t) => t.visitas).length} icon={<MapPin size={14} />} sub={S.visitasTaller[0]?.visitas ? `más visitado: ${S.visitasTaller[0].taller.nombre}` : "—"} />
        {chofer ? null : verCostos ? <Kpi label="Costo estimado" value={S.costo} icon={<Route size={14} />} sub={`${money(config.logistica?.costoKm || 0)} por km`} />
          : <Kpi label="Diferencias" value={problemas.length} alert={problemas.length > 0} icon={<AlertTriangle size={14} />} sub="entre taller y camioneta" />}
      </motion.div>

      {!chofer && (
        <section className="card mt-4 p-5">
          <div className="mb-3"><h2 className="font-display text-[18px] font-bold">Por dónde se mueve la mercadería</h2><p className="text-[12.5px] text-muted">Cada línea es un paso de la mercadería: dónde la retiró la camioneta y dónde la dejó.</p></div>
          <MapaRecorridos />
        </section>
      )}

      {!chofer && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="font-display text-[16px] font-bold">Talleres que más visita</h2>
            <p className="mb-3 text-[12px] text-muted">Este mes: visitas, prendas que dejó y que retiró.</p>
            <div className="space-y-2">
              {S.visitasTaller.map(({ taller: t, visitas, deja, retira }) => (
                <div key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-[12.5px]">
                  <div className="min-w-0"><div className="flex justify-between gap-2"><span className="truncate font-semibold">{t.nombre}</span><span className="tnum text-muted">{visitas} visitas</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface2"><motion.div className="h-full rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${(visitas / Math.max(1, S.visitasTaller[0]?.visitas || 1)) * 100}%` }} /></div></div>
                  <div className="flex gap-2 text-[11.5px] text-muted"><span className="flex items-center gap-0.5"><ArrowDown size={12} className="text-ok" />{n0(deja)}</span><span className="flex items-center gap-0.5"><ArrowUp size={12} />{n0(retira)}</span></div>
                </div>
              ))}
            </div>
          </section>
          <section className="card p-5">
            <h2 className="font-display text-[16px] font-bold">Viajes por orden</h2>
            <p className="mb-3 text-[12px] text-muted">Cuántas veces se movió cada orden este mes{verCostos ? " y su parte del costo de la camioneta" : ""}.</p>
            {S.porOrden.length ? (
              <table className="w-full text-[12.5px]"><thead><tr><th className="th !px-0">Orden</th><th className="th text-right">Viajes</th><th className="th text-right">Km</th>{verCostos && <th className="th !pr-0 text-right">Costo</th>}</tr></thead>
                <tbody>{S.porOrden.slice(0, 8).map((x) => { const o = ordenes.find((y) => y.numero === x.numero); return (
                  <tr key={x.numero} className="border-t border-line"><td className="py-1.5"><span className="font-mono text-muted">{ordenLabel(x.numero)}</span> <span className="font-semibold">{o?.cliente}</span></td><td className="tnum text-right">{x.viajes}</td><td className="tnum text-right text-muted">{x.km}</td>{verCostos && <td className="tnum text-right">{money(x.costo)}</td>}</tr>
                ); })}</tbody></table>
            ) : <Empty title="Sin viajes este mes" />}
          </section>
        </div>
      )}

      {!chofer && (
        <section className="card mt-4 p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><h2 className="font-display text-[16px] font-bold">Control cruzado: taller y camioneta</h2><p className="text-[12px] text-muted">Compara lo que la camioneta dejó en cada taller, lo que el taller informó como terminado y lo que la camioneta retiró.</p></div>
            <Seg value={verTodo ? "todo" : "dif"} onChange={(x) => setVerTodo(x === "todo")} options={[["dif", `Diferencias (${problemas.length})`], ["todo", "Todo"]]} />
          </div>
          {(verTodo ? conc : problemas).length ? (
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-[12.5px]">
              <thead><tr><th className="th !pl-0">Orden</th><th className="th">Taller</th><th className="th text-right">Dejó</th><th className="th text-right">Informó</th><th className="th text-right">Retiró</th><th className="th">Estado</th></tr></thead>
              <tbody>{(verTodo ? conc : problemas).slice(0, 14).map((f) => (
                <tr key={f.orden.id + f.taller.id} className="border-t border-line">
                  <td className="py-2"><span className="font-mono text-muted">{ordenLabel(f.orden.numero)}</span> {f.orden.cliente}</td><td>{f.taller.nombre}</td>
                  <td className="tnum text-right">{n0(f.dejado)}</td><td className="tnum text-right">{n0(f.informado)}</td><td className="tnum text-right">{n0(f.retirado)}</td>
                  <td>{f.estado === "ok" ? <span className="pill-ok"><CheckCircle2 size={12} /> Coincide</span> : f.estado === "diferencia" ? <span className="pill-heat">Retiró más de lo informado</span> : f.estado === "falta_retirar" ? <span className="pill">Falta retirar {n0(f.informado - f.retirado)}</span> : <span className="pill">El taller no informó</span>}</td>
                </tr>
              ))}</tbody></table></div>
          ) : <div className="mt-3 flex items-center gap-2 rounded-xl bg-ok/10 px-3 py-2.5 text-[13px] text-ok"><CheckCircle2 size={16} /> Todo coincide: lo que informaron los talleres es lo que retiró la camioneta.</div>}
        </section>
      )}

      {!chofer && (
        <section className="card mt-4 p-5">
          <h2 className="mb-3 font-display text-[16px] font-bold">Viajes por semana</h2>
          <div className="h-[220px]">
            <ResponsiveContainer>
              <BarChart data={semanas} margin={{ left: -24, right: 4, top: 8 }}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="s" tick={{ fontSize: 10.5, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: C.surface2 }} contentStyle={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, fontSize: 12 }} formatter={(val, k) => [k === "viajes" ? val + " viajes" : val + " km", k === "viajes" ? "Viajes" : "Km"]} />
                <RBar dataKey="viajes" fill={C.heat} radius={[8, 8, 0, 0]} animationDuration={1100} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="mt-4">
        <h2 className="mb-3 font-display text-[16px] font-bold">{chofer ? "Mis últimos viajes" : "Últimos viajes"}</h2>
        {lista.length ? (<>
          <motion.ol key={pgV.pagina} variants={stagger} initial="hidden" animate="show" className="space-y-2">
            {(chofer ? pgV.items.filter((v) => v.choferId === yo?.id) : pgV.items).map((v) => <FilaViaje key={v.id} v={v} chofer={usuarios.find((u) => u.id === v.choferId)?.nombre} onAbrir={() => abrir(v)} />)}
          </motion.ol>
          <Paginacion pg={pgV as never} nombre="viajes" />
        </>) : <Empty title="Todavía no hay viajes">Cada salida de la camioneta se registra con sus paradas: qué dejó y qué retiró en cada lugar.</Empty>}
      </section>
      <ViajeSheet open={sheet.open} viaje={sheet.viaje} onClose={() => setSheet({ open: false, viaje: null })} />
    </Page>
  );
}

function FilaViaje({ v, chofer, onAbrir }: { v: Viaje; chofer?: string; onAbrir: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.li variants={rise} className="card overflow-hidden">
      <button className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-[13px]" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="w-[96px] shrink-0 text-muted">{fdateLong(v.fecha)}</span>
        <span className="order-last min-w-0 basis-full truncate font-semibold sm:order-none sm:flex-1 sm:basis-auto">{v.paradas.map((p) => p.nombre).join(" → ")}</span>
        <span className="flex-1 sm:hidden" />
        {v.estado === "en_curso" && <span className="pill-heat">En curso</span>}
        <span className="text-muted">{v.paradas.length - 1} paradas</span>
        <span className="tnum text-muted">{n0(unidadesMovidas(v))} u</span>
        <span className="tnum w-14 text-right text-muted">{n0(kmViaje(v))} km</span>
        <ChevronDown size={15} className={cx("text-muted transition", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-line px-4 py-3">
              <ol className="relative ml-1 space-y-2 border-l-2 border-dashed border-line pl-4">
                {v.paradas.map((p, i) => (
                  <li key={p.id} className="relative text-[12.5px]">
                    <span className={cx("absolute -left-[23px] top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full ring-2 ring-surface", i === 0 ? "bg-ink" : "bg-heat")} />
                    <div className="flex gap-2"><span className="w-11 shrink-0 tnum text-muted">{p.hora}</span><b>{p.nombre}</b>{i === v.paradas.length - 1 && p.lugarId === v.paradas[0].lugarId && <Flag size={12} className="mt-0.5 text-muted" />}</div>
                    {p.movs.length > 0 && <div className="ml-[52px] mt-0.5 flex flex-wrap gap-1">{p.movs.map((m) => <span key={m.id} className={m.tipo === "deja" ? "pill-ok" : "pill"}>{m.tipo === "deja" ? "Dejó" : "Retiró"} {n0(m.unidades)} · {ordenLabel(m.numero)}</span>)}</div>}
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
                <span>{chofer ? chofer + " · " : ""}{v.kmInicio != null && v.kmFin != null ? `odómetro ${n0(v.kmInicio)} → ${n0(v.kmFin)}` : "km estimados"} · órdenes {ordenesDe(v).map(ordenLabel).join(", ") || "—"}{v.notas ? " · " + v.notas : ""}</span>
                <button className="btn-ghost !py-1 text-[12px]" onClick={onAbrir}>{v.estado === "en_curso" ? "Seguir viaje" : "Ver o corregir"}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
