import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Bar as RBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { ArrowRight, MessageSquareText, Plus, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Empty, Field, Kpi, Page, PageHead, Paginacion, Sheet, cx, rise, stagger, usePagina } from "../components/ui";
import { useRol, useStore, useYo } from "../store/useStore";
import { metricas, periodo } from "../lib/metrics";
import { addDays, fdate, fdateLong, monthKey, monthLabel, n0, n1, ordenLabel, today } from "../lib/format";
import { useColors } from "../lib/colors";
import MapaRecorridos from "../components/MapaRecorridos";

export default function Logistica() {
  const { ordenes, viajes, talleres } = useStore();
  const rol = useRol();
  const yo = useYo();
  const C = useColors();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [nuevo, setNuevo] = useState(sp.get("nuevo") === "1");
  useEffect(() => { if (sp.get("nuevo") === "1") { setNuevo(true); setSp({}); } }, [sp]);
  const mes = monthKey(today());
  const [a, b] = periodo(mes);
  const M = useMemo(() => metricas(ordenes, viajes, talleres, a, b), [ordenes, viajes, talleres, a, b]);
  const chofer = rol === "chofer";
  const lista = useMemo(() => [...viajes].sort((x, y) => y.fecha.localeCompare(x.fecha)), [viajes]);
  const pgV = usePagina(lista, 10);

  // Viajes por semana (últimas 10)
  const semanas = useMemo(() => {
    const out: { s: string; n: number }[] = [];
    for (let i = 9; i >= 0; i--) {
      const fin = addDays(today(), -7 * i), ini = addDays(fin, -6);
      out.push({ s: fdate(ini), n: viajes.filter((v) => v.fecha >= ini && v.fecha <= fin).length });
    }
    return out;
  }, [viajes]);

  return (
    <Page>
      <PageHead eyebrow={chofer ? "Camioneta" : "Logística · " + monthLabel(mes)} title={chofer ? `Hola, ${yo?.nombre.split(" ")[0]}` : "Viajes de la camioneta"}>
        <button className="btn-heat" onClick={() => setNuevo(true)}><Plus size={16} /> Registrar viaje</button>
      </PageHead>

      {chofer && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="mb-5 grid gap-3 sm:grid-cols-2">
          <motion.button variants={rise} whileTap={{ scale: 0.98 }} onClick={() => setNuevo(true)} className="relative overflow-hidden rounded-3xl bg-heat p-6 text-left text-white shadow-glow">
            <Truck className="absolute -right-4 -top-4 h-28 w-28 opacity-15" />
            <div className="wide font-display text-[24px] font-black">Registrar viaje</div><div className="mt-1 text-[14px] text-white/80">Origen, destino y qué llevaste. 10 segundos.</div>
          </motion.button>
          <motion.button variants={rise} whileTap={{ scale: 0.98 }} onClick={() => useStore.getState().setChatAbierto(true)} className="relative overflow-hidden rounded-3xl bg-night p-6 text-left text-white">
            <MessageSquareText className="absolute -right-4 -top-4 h-28 w-28 opacity-10" />
            <div className="wide font-display text-[24px] font-black">Contárselo al asistente</div><div className="mt-1 text-[14px] text-white/60">“Llevé 200 remeras de la fábrica a Bordados Centro”</div>
          </motion.button>
        </motion.div>
      )}

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Viajes del mes" value={M.viajes.length} />
        <Kpi label="Km aproximados" value={M.km} />
        <Kpi label="Promedio semanal" value={M.viajes.length / 4.3} decimals={1} />
        <Kpi label="Órdenes movidas" value={new Set(M.viajes.flatMap((v) => v.ordenes)).size} />
      </motion.div>

      <section className="card mt-4 p-5">
        <div className="mb-3"><h2 className="font-display text-[18px] font-bold">Recorridos de la camioneta</h2><p className="text-[12.5px] text-muted">Por dónde pasa la mercadería y cuántos viajes hace en cada tramo.</p></div>
        <MapaRecorridos />
      </section>
      <div className="mt-4 grid gap-4">
        <section className="card p-5">
          <h2 className="mb-3 font-display text-[16px] font-bold">Viajes por semana</h2>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={semanas} margin={{ left: -24, right: 4, top: 8 }}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="s" tick={{ fontSize: 10.5, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: C.surface2 }} contentStyle={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, fontSize: 12 }} formatter={(v) => [v + " viajes", "Semana"]} />
                <RBar dataKey="n" fill={C.heat} radius={[8, 8, 0, 0]} animationDuration={1100} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="mt-4">
        <h2 className="mb-3 font-display text-[16px] font-bold">Últimos viajes</h2>
        {lista.length ? (<>
          <motion.ol key={pgV.pagina} variants={stagger} initial="hidden" animate="show" className="card divide-y divide-line">
            {pgV.items.map((v) => (
              <motion.li variants={rise} key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[13px]">
                <span className="w-[92px] text-muted">{fdateLong(v.fecha)}</span>
                <span className="flex min-w-0 flex-1 items-center gap-2 font-semibold"><span className="truncate">{v.origen}</span><ArrowRight size={14} className="shrink-0 text-heat" /><span className="truncate">{v.destino}</span></span>
                <span className="text-muted">{v.carga}</span>
                <span className="flex gap-1">{v.ordenes.map((n) => <span key={n} className="pill font-mono !text-[11px]">{ordenLabel(n)}</span>)}</span>
                {v.km > 0 && <span className="tnum w-14 text-right text-muted">{v.km} km</span>}
              </motion.li>
            ))}
          </motion.ol>
          <Paginacion pg={pgV as never} nombre="viajes" />
        </>) : <Empty title="Sin viajes todavía">Cada viaje se registra con fecha, origen, destino y qué llevó.</Empty>}
      </section>
      <NuevoViaje open={nuevo} onClose={() => setNuevo(false)} />
    </Page>
  );
}

export function NuevoViaje({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { talleres, ordenes, agregarViaje, sesion, config } = useStore();
  const lugares = [...config.lugares.map((l) => l.nombre), ...talleres.map((t) => t.nombre)];
  const [fecha, setFecha] = useState(today());
  const [o, setO] = useState("Fábrica");
  const [d, setD] = useState(lugares[config.lugares.length] || lugares[1] || "Depósito");
  const [carga, setCarga] = useState("");
  const [km, setKm] = useState("");
  const [sel, setSel] = useState<number[]>([]);
  useEffect(() => { if (open) { setFecha(today()); setCarga(""); setKm(""); setSel([]); } }, [open]);
  const abiertas = ordenes.filter((x) => x.etapa < 7);
  return (
    <Sheet open={open} onClose={onClose} width={540}>
      <div className="eyebrow">Camioneta</div>
      <h2 className="wide mt-1.5 font-display text-[24px] font-extrabold">Registrar viaje</h2>
      <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); if (o === d) return toast.error("El origen y el destino son iguales."); const kmEst = +km || Math.abs((config.lugares.find((l) => l.nombre === d)?.kmDesdeFabrica || 0) - (config.lugares.find((l) => l.nombre === o)?.kmDesdeFabrica || 0));
          agregarViaje({ fecha, origen: o, destino: d, carga: carga.trim(), ordenes: sel, km: kmEst, choferId: sesion }); toast.success("Viaje registrado"); onClose(); }}>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Field label="Desde"><select className="input" value={o} onChange={(e) => setO(e.target.value)}>{lugares.map((l) => <option key={l}>{l}</option>)}</select></Field>
          <button type="button" className="btn-ghost mb-0.5 !px-2" onClick={() => { setO(d); setD(o); }} aria-label="Invertir"><ArrowRight size={18} className="text-heat" /></button>
          <Field label="Hasta"><select className="input" value={d} onChange={(e) => setD(e.target.value)}>{lugares.map((l) => <option key={l}>{l}</option>)}</select></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Qué llevó"><input className="input" value={carga} onChange={(e) => setCarga(e.target.value)} placeholder="200 remeras cortadas" /></Field>
          <Field label="Km (opcional)"><input className="input tnum" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} /></Field>
        </div>
        <Field label="Fecha"><input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
        <div>
          <div className="label mb-2">Órdenes que movió</div>
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto scroll-thin">
            {abiertas.map((x) => { const on = sel.includes(x.numero); return (
              <button type="button" key={x.id} onClick={() => setSel(on ? sel.filter((n) => n !== x.numero) : [...sel, x.numero])} className={cx("rounded-full border px-2.5 py-1 text-[12px] font-semibold transition", on ? "border-heat bg-heat text-white" : "border-line bg-surface hover:border-muted")}>
                {ordenLabel(x.numero)} <span className={on ? "text-white/80" : "text-muted"}>{x.cliente.slice(0, 16)}</span>
              </button>
            ); })}
            {!abiertas.length && <span className="text-[13px] text-muted">No hay órdenes abiertas.</span>}
          </div>
        </div>
        <div className="flex gap-2 pt-2"><button className="btn-heat" type="submit"><Truck size={15} /> Guardar viaje</button><button className="btn-ghost" type="button" onClick={onClose}>Cancelar</button></div>
      </form>
    </Sheet>
  );
}
