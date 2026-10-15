import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Area, AreaChart, Bar as RBar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowUpRight, CalendarRange, Clock, Filter, Gauge, PackageCheck, Plus, RotateCcw, ShieldAlert, Shirt, Timer, Truck, X, Tag, Factory } from "lucide-react";
import Select from "../components/Select";
import { Bar, Empty, Kpi, cx, rise, stagger } from "../components/ui";
import { useStore, useYo } from "../store/useStore";
import { metricas, unidades } from "../lib/metrics";
import type { Orden } from "../lib/types";
import { ETAPAS, TIPOS_TALLER } from "../lib/types";
import { addDays, days, fdate, isoDate, monthLabel, n0, n1, ordenLabel, today } from "../lib/format";
import { useColors } from "../lib/colors";

type Per = "7" | "30" | "mes" | "90" | "custom";
type Serie = "corte" | "confeccion" | "personalizacion";
const SERIES: [Serie, string][] = [["corte", "Corte"], ["confeccion", "Confección"], ["personalizacion", "Personalización"]];

function rango(p: Per, d: string, h: string): [string, string] {
  const t = today();
  if (p === "7") return [addDays(t, -6), t];
  if (p === "30") return [addDays(t, -29), t];
  if (p === "90") return [addDays(t, -89), t];
  if (p === "mes") return [t.slice(0, 8) + "01", t];
  return [d || addDays(t, -29), h || t];
}

function serie(ordenes: Orden[], desde: string, hasta: string, tallerId: string) {
  const n = days(desde, hasta) + 1;
  const sem = n > 45;
  const out: { k: string; corte: number; confeccion: number; personalizacion: number }[] = [];
  if (sem) { for (let f = desde; f <= hasta; f = addDays(f, 7)) out.push({ k: f, corte: 0, confeccion: 0, personalizacion: 0 }); }
  else for (let i = 0; i < n; i++) out.push({ k: addDays(desde, i), corte: 0, confeccion: 0, personalizacion: 0 });
  for (const o of ordenes) for (const h of o.historial) if (h.tipo === "entrega" && h.fecha >= desde && h.fecha <= hasta && (!tallerId || h.tallerId === tallerId)) {
    const i = sem ? Math.floor(days(desde, h.fecha) / 7) : days(desde, h.fecha); const r = out[i]; if (!r) continue;
    if (h.etapa === 2) r.corte += h.unidades; else if (h.etapa === 3) r.confeccion += h.unidades; else if (h.etapa === 4) r.personalizacion += h.unidades;
  }
  return { data: out, sem };
}

export default function Tablero() {
  const { ordenes, viajes, talleres, productos, config } = useStore();
  const yo = useYo();
  const nav = useNavigate();
  const C = useColors();
  const meta = config.produccion.metaFallas;
  // Filtros
  const [per, setPer] = useState<Per>("mes");
  const [cd, setCd] = useState(addDays(today(), -29));
  const [ch, setCh] = useState(today());
  const [tipo, setTipo] = useState<"" | "venta" | "stock">("");
  const [prod, setProd] = useState("");
  const [taller, setTaller] = useState("");
  const [series, setSeries] = useState<Serie[]>(["confeccion", "personalizacion"]);
  const [motivoSel, setMotivoSel] = useState<string | null>(null);
  const [a, b] = rango(per, cd, ch);
  const activos = [tipo, prod, taller].filter(Boolean).length + (per !== "mes" ? 1 : 0);
  const limpiar = () => { setPer("mes"); setTipo(""); setProd(""); setTaller(""); };

  const ords = useMemo(() => ordenes.filter((o) => (!tipo || o.tipo === tipo) && (!prod || o.lineas.some((l) => l.productoId === prod)) && (!taller || o.historial.some((h) => h.tipo === "entrega" && h.tallerId === taller) || o.calidad.some((c) => c.tallerId === taller))), [ordenes, tipo, prod, taller]);
  const vjs = useMemo(() => { const t = talleres.find((x) => x.id === taller)?.nombre; return viajes.filter((v) => !t || v.origen === t || v.destino === t); }, [viajes, taller, talleres]);
  const M = useMemo(() => metricas(ords, vjs, talleres, a, b), [ords, vjs, talleres, a, b]);
  const S = useMemo(() => serie(ords, a, b, taller), [ords, a, b, taller]);
  const T = taller ? M.porTaller[taller] : null;
  const kConf = T ? T.unidades : M.confeccionadas;
  const kRev = T ? T.revisadas : M.revisadas, kFal = T ? T.fallas : M.fallas;
  const kTasa = kRev ? (kFal / kRev) * 100 : null;
  const filas = Object.entries(M.porTaller).filter(([id]) => !taller || id === taller).map(([id, v]) => ({ id, ...v, nombre: talleres.find((t) => t.id === id)?.nombre || "—", tasa: v.revisadas ? (v.fallas / v.revisadas) * 100 : null })).sort((x, y) => y.unidades - x.unidades);
  const maxU = Math.max(1, ...filas.map((f) => f.unidades));
  const maxEt = Math.max(...M.porEtapa.map((e) => e.n));
  const motivos = Object.entries(M.motivos).map(([k, v]) => ({ name: k, value: v })).sort((x, y) => y.value - x.value);
  const viajesPorDestino = Object.entries(M.viajes.reduce<Record<string, number>>((acc, v) => ((acc[v.destino] = (acc[v.destino] || 0) + 1), acc), {})).map(([d, n]) => ({ d, n })).sort((x, y) => y.n - x.n);
  const lento = [...M.tEtapa].sort((x, y) => y.dias - x.dias)[0];
  const hora = new Date().getHours();
  const saludo = hora < 13 ? "Buen día" : hora < 20 ? "Buenas tardes" : "Buenas noches";
  const pieColors = [C.heat, C.ember, C.ink, C.muted, "#C9C2B8", "#6B5BD2", "#2B6CB0"];
  const tituloPer = per === "mes" ? monthLabel(today().slice(0, 7)) : per === "custom" ? `${fdate(a)} al ${fdate(b)}` : `últimos ${per} días`;
  const tooltip = { contentStyle: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, fontSize: 12 } };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <section className="relative overflow-hidden border-b border-line bg-surface2 text-ink">
        <video className="absolute inset-0 h-full w-full object-cover opacity-50 invert grayscale dark:opacity-80 dark:invert-0 dark:grayscale-0" poster="./media/poster.jpg" autoPlay muted loop playsInline><source src="./media/montana.webm" type="video/webm" /><source src="./media/montana.mp4" type="video/mp4" /></video>
        <div className="absolute inset-0 bg-gradient-to-r from-surface2 via-surface2/90 to-surface2/20" />
        <div className="grain absolute inset-0" />
        <div className="relative mx-auto flex max-w-[1320px] flex-wrap items-end justify-between gap-6 px-4 pb-8 pt-8 sm:px-6 lg:px-8 lg:pt-10">
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.div variants={rise} className="eyebrow">{saludo}, {yo?.nombre.split(" ")[0]}</motion.div>
            <motion.h1 variants={rise} className="wide mt-2 font-display text-[30px] font-black leading-[1.02] sm:text-[42px]">
              {M.atrasadas.length ? <>Hay <span className="text-heat">{M.atrasadas.length} {M.atrasadas.length === 1 ? "orden atrasada" : "órdenes atrasadas"}</span>.</> : <>Todo <span className="text-ember">en fecha</span>.</>}
            </motion.h1>
            <motion.p variants={rise} className="mt-2 max-w-xl text-[14px] text-ink2">
              {M.abiertas.length} órdenes en curso, {n0(M.abiertas.reduce((s, o) => s + unidades(o), 0))} prendas en proceso.
              {lento && lento.dias > 0 && <> La etapa más lenta es <b className="text-ink">{ETAPAS[lento.etapa].toLowerCase()}</b> ({n1(lento.dias)} días promedio).</>}
            </motion.p>
          </motion.div>
          <button className="btn-heat" onClick={() => nav("/ordenes?nueva=1")}><Plus size={16} /> Nueva orden</button>
        </div>
      </section>

      {/* Barra de filtros */}
      <div className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-muted"><Filter size={14} /> Filtrar</span>
          <div className="flex rounded-xl border border-line bg-surface p-0.5">
            {([["7", "7 d"], ["30", "30 d"], ["mes", "Este mes"], ["90", "90 d"], ["custom", "Fechas"]] as [Per, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setPer(k)} className={cx("relative rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors", per === k ? "text-bg" : "text-muted hover:text-ink")}>
                {per === k && <motion.span layoutId="per" className="absolute inset-0 rounded-lg bg-ink" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}<span className="relative">{l}</span>
              </button>
            ))}
          </div>
          <AnimatePresence>{per === "custom" && (
            <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="flex items-center gap-1 overflow-hidden">
              <CalendarRange size={14} className="text-muted" /><input type="date" className="input !w-auto !py-1.5 text-[12px]" value={cd} max={ch} onChange={(e) => setCd(e.target.value)} aria-label="Desde" /><span className="text-muted">→</span><input type="date" className="input !w-auto !py-1.5 text-[12px]" value={ch} min={cd} onChange={(e) => setCh(e.target.value)} aria-label="Hasta" />
            </motion.div>
          )}</AnimatePresence>
          <Select width={210} className="w-[170px]" activo={!!tipo} icon={<Tag size={14} />} label="Tipo" value={tipo} onChange={(v) => setTipo(v as typeof tipo)} options={[{ value: "", label: "Ventas y stock", desc: "Todas las órdenes" }, { value: "venta", label: "Solo ventas", desc: "Pedidos de clientes" }, { value: "stock", label: "Solo stock", desc: "Reposición propia" }]} />
          <Select width={260} className="w-[200px]" activo={!!prod} icon={<Shirt size={14} />} label="Producto" value={prod} onChange={setProd} options={[{ value: "", label: "Todos los productos" }, ...productos.map((p) => ({ value: p.id, label: p.nombre, desc: p.categoria }))]} />
          <Select width={260} className="w-[190px]" activo={!!taller} icon={<Factory size={14} />} label="Taller" value={taller} onChange={setTaller} options={[{ value: "", label: "Todos los talleres" }, ...talleres.map((t) => ({ value: t.id, label: t.nombre, desc: TIPOS_TALLER[t.tipo] }))]} />
          <AnimatePresence>{activos > 0 && <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="btn-ghost !py-1.5 text-[12px]" onClick={limpiar}><RotateCcw size={13} /> Limpiar ({activos})</motion.button>}</AnimatePresence>
          <span className="ml-auto hidden text-[12px] text-muted md:block">Mostrando: <b className="text-ink">{tituloPer}</b></span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-28">
        <motion.div key={a + b + tipo + prod + taller} variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={<Shirt size={14} />} label={taller ? "Entregadas" : "Confeccionadas"} value={kConf} sub={taller ? "por este taller" : "prendas entregadas"} />
          <Kpi icon={<ShieldAlert size={14} />} label="Tasa de fallas" value={kTasa} decimals={1} suffix="%" alert={(kTasa ?? 0) > meta} sub={`${n0(kFal)} de ${n0(kRev)} · meta ${meta}%`} />
          <Kpi icon={<Truck size={14} />} label="Viajes" value={M.viajes.length} sub={`${n0(M.km)} km aprox.`} />
          <Kpi icon={<PackageCheck size={14} />} label="A tiempo" value={M.cumplimiento} suffix="%" sub={`${M.aTiempo} de ${M.fin.length} finalizadas`} />
          <Kpi icon={<Timer size={14} />} label="Tiempo de ciclo" value={M.ciclo} decimals={1} suffix="días" sub="de la orden a la entrega" />
          <Kpi icon={<Gauge size={14} />} label="Abiertas" value={M.abiertas.length} alert={M.atrasadas.length > 0} sub={M.atrasadas.length ? <span className="font-semibold text-heat">{M.atrasadas.length} atrasadas</span> : "ninguna atrasada"} />
        </motion.div>

        <section className="card mt-4 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-[16px] font-bold">Órdenes por etapa</h2><span className="text-[12px] text-muted">Tocá una etapa para verla · en rojo, donde se acumula</span></div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {M.porEtapa.map((e, i) => {
              const hot = e.n > 0 && e.n === maxEt;
              return (
                <Link to="/ordenes" key={e.etapa} className={cx("group relative overflow-hidden rounded-xl border p-3 transition hover:-translate-y-0.5", hot ? "border-transparent bg-heat/10" : "border-line bg-surface2")}>
                  <motion.div className={cx("absolute inset-x-0 bottom-0", hot ? "bg-heat/15" : "bg-ink/5")} initial={{ height: 0 }} animate={{ height: `${maxEt ? (e.n / maxEt) * 100 : 0}%` }} transition={{ delay: i * 0.06, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                  <div className={cx("wide relative font-display text-[28px] font-extrabold tnum", hot && "text-heat")}>{e.n}</div>
                  <div className="relative text-[12px] font-semibold text-ink2">{ETAPAS[e.etapa]}</div>
                  <div className="relative text-[11px] text-muted">{n0(e.u)} prendas</div>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <section className="card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-display text-[16px] font-bold">Prendas entregadas por {S.sem ? "semana" : "día"}</h2><div className="text-[12px] text-muted">{tituloPer}{taller && " · " + talleres.find((t) => t.id === taller)?.nombre}{series.length > 1 && " · las franjas se suman, arriba ves el total"}</div></div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex rounded-xl border border-line bg-surface p-0.5" role="group" aria-label="Qué mostrar">
                  {([["ambas", "Ambas", ["confeccion", "personalizacion"]], ["confeccion", "Confección", ["confeccion"]], ["personalizacion", "Personalización", ["personalizacion"]], ["todas", "+ Corte", ["corte", "confeccion", "personalizacion"]]] as [string, string, Serie[]][]).map(([k, l, v]) => {
                    const on = v.length === series.length && v.every((x) => series.includes(x));
                    return (
                      <button key={k} onClick={() => setSeries(v)} className={cx("relative rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors", on ? "text-bg" : "text-muted hover:text-ink")}>
                        {on && <motion.span layoutId="serie-sel" className="absolute inset-0 rounded-lg bg-ink" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}<span className="relative">{l}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3 text-[11.5px] text-muted">
                  {SERIES.map(([k, l], i) => { const on = series.includes(k); const col = [C.sCorte, C.sConf, C.sPers][i]; return (
                    <button key={k} onClick={() => { const nx = on ? series.filter((x) => x !== k) : [...series, k]; if (nx.length) setSeries(nx); }} className={cx("flex items-center gap-1.5 transition", on ? "text-ink" : "opacity-50 line-through hover:opacity-100")} title={on ? "Ocultar " + l : "Mostrar " + l}>
                      <i className="h-2 w-3 rounded-full" style={{ background: on ? col : C.line }} />{l}
                    </button>
                  ); })}
                </div>
              </div>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer>
                <AreaChart data={S.data} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>{SERIES.map(([k], i) => { const col = [C.sCorte, C.sConf, C.sPers][i]; return <linearGradient key={k} id={"g-" + k} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity={0.55} /><stop offset="100%" stopColor={col} stopOpacity={0.12} /></linearGradient>; })}</defs>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="k" tickFormatter={fdate} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltip} labelFormatter={(l) => (S.sem ? "Semana del " : "") + fdate(String(l))} formatter={(v, n) => [n0(Number(v)) + " u", n]} />
                  {SERIES.filter(([k]) => series.includes(k)).map(([k, l]) => { const col = [C.sCorte, C.sConf, C.sPers][SERIES.findIndex((x) => x[0] === k)]; return <Area key={k} type="monotone" dataKey={k} name={l} stackId="prendas" stroke={col} strokeWidth={2.5} fill={`url(#g-${k})`} fillOpacity={1} animationDuration={900} />; })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-display text-[16px] font-bold">Atención</h2>
            <Atencion M={M} />
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="font-display text-[16px] font-bold">Producción y fallas por taller</h2><div className="text-[12px] text-muted">Tocá un taller para filtrar todo el tablero</div></div><Link to="/talleres" className="btn-ghost !px-2 !py-1 text-[12px]">Talleres <ArrowUpRight size={14} /></Link></div>
            {filas.length ? (
              <div className="space-y-1">
                {filas.map((f, i) => (
                  <button key={f.id} onClick={() => setTaller(taller === f.id ? "" : f.id)} className={cx("grid w-full grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 rounded-xl px-2 py-2 text-left text-[13px] transition", taller === f.id ? "bg-heat/10 ring-1 ring-heat" : "hover:bg-surface2")}>
                    <span className="truncate font-medium">{f.nombre}</span>
                    <Bar pct={(f.unidades / maxU) * 100} heat={(f.tasa ?? 0) > meta} delay={i * 0.07} />
                    <span className="tnum w-[112px] text-right text-ink2">{n0(f.unidades)} u · <span className={cx((f.tasa ?? 0) > meta && "font-semibold text-heat")}>{f.tasa == null ? "—" : n1(f.tasa) + "%"}</span></span>
                  </button>
                ))}
                {taller && <button className="btn-ghost mt-1 !py-1 text-[12px]" onClick={() => setTaller("")}><X size={13} /> Quitar filtro de taller</button>}
              </div>
            ) : <Empty title="Sin entregas en este período" />}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-1 font-display text-[16px] font-bold">Motivos de falla</h2>
              {motivos.length ? (<>
                <div className="relative h-[170px]">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={motivos} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={3} stroke="none" animationDuration={900} onClick={(d) => setMotivoSel(motivoSel === d.name ? null : d.name)} cursor="pointer">
                        {motivos.map((m, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} opacity={!motivoSel || motivoSel === m.name ? 1 : 0.25} />)}
                      </Pie>
                      <Tooltip {...tooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="wide font-display text-[22px] font-extrabold tnum">{n0(motivoSel ? M.motivos[motivoSel] : M.fallas)}</div><div className="max-w-[90px] truncate text-[11px] text-muted">{motivoSel || "fallas"}</div></div></div>
                </div>
                <ul className="space-y-0.5 text-[12px]">{motivos.slice(0, 5).map((m, i) => <li key={m.name}><button onClick={() => setMotivoSel(motivoSel === m.name ? null : m.name)} className={cx("flex w-full items-center gap-2 rounded-lg px-1.5 py-0.5 text-left transition", motivoSel === m.name ? "bg-surface2 font-semibold" : "hover:bg-surface2")}><i className="h-2 w-2 rounded-full" style={{ background: pieColors[i % pieColors.length] }} /><span className="flex-1 truncate">{m.name}</span><span className="tnum text-muted">{m.value}</span></button></li>)}</ul>
              </>) : <Empty title="Sin fallas registradas" />}
            </section>
            <section className="card p-5">
              <h2 className="mb-3 font-display text-[16px] font-bold">Viajes por destino</h2>
              {viajesPorDestino.length ? (
                <div className="h-[220px]">
                  <ResponsiveContainer>
                    <BarChart data={viajesPorDestino} layout="vertical" margin={{ left: 0, right: 10 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="d" width={110} tick={{ fontSize: 11, fill: C.ink2 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: C.surface2 }} {...tooltip} formatter={(v) => [v + " viajes", ""]} />
                      <RBar dataKey="n" radius={[0, 8, 8, 0]} fill={C.ink} animationDuration={900} barSize={14} onClick={(d) => { const t = talleres.find((x) => x.nombre === (d as unknown as { d: string }).d); if (t) setTaller(t.id); }} cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <Empty title="Sin viajes en este período" />}
            </section>
          </div>
        </div>

        <section className="card mt-4 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-[16px] font-bold">Días promedio en cada etapa</h2><span className="text-[12px] text-muted">Órdenes que salieron de cada etapa en el período</span></div>
          <div className="grid gap-3 md:grid-cols-6">
            {M.tEtapa.map((e, i) => {
              const max = Math.max(1, ...M.tEtapa.map((x) => x.dias));
              const isMax = e.dias === max && e.dias > 0;
              return (
                <Link to={`/procesos?etapa=${e.etapa}`} key={e.etapa} className="rounded-xl p-1 transition hover:bg-surface2">
                  <div className="mb-1.5 flex items-baseline justify-between"><span className="text-[12px] font-semibold text-ink2">{ETAPAS[e.etapa]}</span><span className={cx("tnum text-[13px] font-bold", isMax && "text-heat")}>{e.dias ? n1(e.dias) : "—"}</span></div>
                  <Bar pct={(e.dias / max) * 100} heat={isMax} delay={i * 0.05} />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </motion.div>
  );
}

function Atencion({ M }: { M: ReturnType<typeof metricas> }) {
  const { talleres, config } = useStore();
  const meta = config.produccion.metaFallas / 100;
  const items: { k: string; pill: JSX.Element; title: string; sub: string; to?: string }[] = [];
  M.atrasadas.slice(0, 4).forEach((o) => items.push({ k: o.id, pill: <span className="pill-heat"><AlertTriangle size={12} /> Atrasada</span>, title: `${ordenLabel(o.numero)} ${o.cliente}`, sub: `${ETAPAS[o.etapa]} · vencía ${fdate(o.fechaEntrega)}`, to: `/ordenes?o=${o.id}` }));
  Object.entries(M.porTaller).forEach(([id, v]) => { if (v.revisadas && v.fallas / v.revisadas > meta) items.push({ k: id, pill: <span className="pill-warn"><ShieldAlert size={12} /> Calidad</span>, title: talleres.find((t) => t.id === id)?.nombre || id, sub: `${n1((v.fallas / v.revisadas) * 100)}% de fallas (meta ${config.produccion.metaFallas}%)`, to: "/calidad" }); });
  const lim = addDays(today(), config.produccion.diasAlerta);
  M.abiertas.filter((o) => o.fechaEntrega >= today() && o.fechaEntrega <= lim).sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega)).slice(0, 3).forEach((o) => items.push({ k: "v" + o.id, pill: <span className="pill"><Clock size={12} /> Vence</span>, title: `${ordenLabel(o.numero)} ${o.cliente}`, sub: `${ETAPAS[o.etapa]} · entrega ${fdate(o.fechaEntrega)}`, to: `/ordenes?o=${o.id}` }));
  if (!items.length) return <Empty title="Nada urgente">Todo está en fecha.</Empty>;
  return (
    <motion.ul variants={stagger} initial="hidden" animate="show" className="divide-y divide-line">
      {items.slice(0, 7).map((i) => (
        <motion.li variants={rise} key={i.k}>
          <Link to={i.to || "#"} className="flex items-center gap-3 py-2.5 transition hover:translate-x-1">
            <span className="w-[96px] shrink-0">{i.pill}</span>
            <div className="min-w-0"><div className="truncate text-[13px] font-semibold">{i.title}</div><div className="truncate text-[12px] text-muted">{i.sub}</div></div>
          </Link>
        </motion.li>
      ))}
    </motion.ul>
  );
}

export { isoDate };
