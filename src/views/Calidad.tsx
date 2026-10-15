import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Bar, Empty, Field, Kpi, Page, PageHead, cx, rise, stagger, Paginacion, usePagina } from "../components/ui";
import { useStore } from "../store/useStore";
import { metricas, periodo, unidades } from "../lib/metrics";
import { fdateY, monthKey, monthLabel, n0, n1, ordenLabel, today } from "../lib/format";
import { useColors } from "../lib/colors";

export default function Calidad() {
  const { ordenes, viajes, talleres, registrarCalidad, moverEtapa, config } = useStore();
  const meta = config.produccion.metaFallas;
  const C = useColors();
  const mes = monthKey(today());
  const [a, b] = periodo(mes);
  const M = useMemo(() => metricas(ordenes, viajes, talleres, a, b), [ordenes, viajes, talleres, a, b]);

  // Tasa de fallas de los últimos 6 meses, por taller y total
  const serie = useMemo(() => {
    const out: Record<string, string | number | null>[] = [];
    const d = new Date(); d.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const k = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
      const [p, q] = periodo(k);
      const m = metricas(ordenes, viajes, talleres, p, q);
      const row: Record<string, string | number | null> = { mes: x.toLocaleDateString("es-AR", { month: "short" }), total: m.tasa == null ? null : +m.tasa.toFixed(2) };
      out.push(row);
    }
    return out;
  }, [ordenes, viajes, talleres]);

  const ranking = Object.entries(M.porTaller).filter(([, v]) => v.revisadas).map(([id, v]) => ({ id, nombre: talleres.find((t) => t.id === id)?.nombre || id, tasa: (v.fallas / v.revisadas) * 100, ...v })).sort((x, y) => y.tasa - x.tasa);
  const pendientes = ordenes.filter((o) => o.etapa === 5);
  const recientes = ordenes.flatMap((o) => o.calidad.map((c) => ({ ...c, o }))).sort((x, y) => y.fecha.localeCompare(x.fecha));
  const pgC = usePagina(recientes, 10);

  return (
    <Page>
      <PageHead eyebrow={"Calidad · " + monthLabel(mes)} title="Control de calidad" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Tasa de fallas" value={M.tasa} decimals={1} suffix="%" alert={(M.tasa ?? 0) > meta} sub={`meta: menos de ${meta}%`} />
        <Kpi label="Revisadas" value={M.revisadas} sub="prendas en el mes" />
        <Kpi label="Con falla" value={M.fallas} sub="prendas rechazadas" />
        <Kpi label="Esperando control" value={pendientes.length} sub={`${n0(pendientes.reduce((s, o) => s + unidades(o), 0))} prendas`} />
      </motion.div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5">
          <h2 className="mb-3 font-display text-[16px] font-bold">Tasa de fallas, últimos 6 meses</h2>
          <div className="h-[240px]">
            <ResponsiveContainer>
              <LineChart data={serie} margin={{ left: -18, right: 12, top: 10 }}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} unit="%" />
                <ReferenceLine y={meta} stroke={C.heat} strokeDasharray="4 4" label={{ value: `meta ${meta}%`, fill: C.heat, fontSize: 11, position: "insideTopRight" }} />
                <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, fontSize: 12 }} formatter={(v) => [v + "%", "Fallas"]} />
                <Line type="monotone" dataKey="total" stroke={C.ink} strokeWidth={3} dot={{ r: 4, fill: C.surface, stroke: C.ink, strokeWidth: 2 }} activeDot={{ r: 6, fill: C.heat }} animationDuration={1300} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-display text-[16px] font-bold">Ranking de talleres</h2>
          {ranking.length ? (
            <div className="space-y-4">{ranking.map((r, i) => (
              <div key={r.id}>
                <div className="mb-1.5 flex items-baseline justify-between text-[13px]"><span className="font-semibold">{r.nombre}</span><span className={cx("tnum font-bold", r.tasa > meta ? "text-heat" : "text-ok")}>{n1(r.tasa)}%</span></div>
                <Bar pct={(r.tasa / Math.max(6, ranking[0].tasa)) * 100} heat={r.tasa > meta} delay={i * 0.08} />
                <div className="mt-1 text-[11.5px] text-muted">{r.fallas} con falla de {n0(r.revisadas)} revisadas</div>
              </div>
            ))}</div>
          ) : <Empty title="Sin controles este mes" />}
        </section>
      </div>

      <section className="mt-4">
        <h2 className="mb-3 font-display text-[16px] font-bold">Órdenes esperando control</h2>
        {pendientes.length ? (
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pendientes.map((o) => <ControlRapido key={o.id} o={o} onGuardar={(t, r, f, m) => { registrarCalidad(o.id, { tallerId: t, revisadas: r, fallas: f, motivo: m }); toast.success("Control guardado"); }} onPasar={() => { moverEtapa(o.id, 6); toast.success(`${ordenLabel(o.numero)} pasó a Empaquetado`); }} />)}
          </motion.div>
        ) : <Empty title="No hay órdenes en control de calidad" />}
      </section>

      <section className="card mt-4 overflow-x-auto scroll-thin">
        <table className="w-full min-w-[640px]">
          <thead><tr className="[&>th]:pt-4"><th className="th">Fecha</th><th className="th">Orden</th><th className="th">Taller</th><th className="th text-right">Revisadas</th><th className="th text-right">Fallas</th><th className="th">Motivo</th></tr></thead>
          <tbody>{pgC.items.map((c) => (
            <tr key={c.id}><td className="td tnum">{fdateY(c.fecha)}</td><td className="td font-mono text-[12px]">{ordenLabel(c.o.numero)}</td><td className="td">{talleres.find((t) => t.id === c.tallerId)?.nombre}</td><td className="td text-right tnum">{n0(c.revisadas)}</td><td className="td text-right"><span className={c.fallas / c.revisadas > 0.03 ? "pill-heat" : "pill-ok"}>{c.fallas}</span></td><td className="td text-muted">{c.motivo || "—"}</td></tr>
          ))}</tbody>
        </table>
        <div className="px-4 pb-4"><Paginacion pg={pgC as never} nombre="controles" /></div>
      </section>
    </Page>
  );
}

function ControlRapido({ o, onGuardar, onPasar }: { o: ReturnType<typeof useStore.getState>["ordenes"][number]; onGuardar: (t: string, r: number, f: number, m: string) => void; onPasar: () => void }) {
  const talleres = useStore((s) => s.talleres);
  const def = [...o.historial].reverse().find((h) => h.tipo === "entrega" && h.etapa === 3 && h.tallerId);
  const [t, setT] = useState((def?.tipo === "entrega" && def.tallerId) || talleres[0]?.id || "");
  const [r, setR] = useState(String(unidades(o)));
  const [f, setF] = useState("0");
  const [m, setM] = useState("");
  const hecho = o.calidad.length > 0;
  return (
    <motion.div variants={rise} className="card p-4">
      <div className="flex items-center justify-between"><span className="font-mono text-[12px] font-semibold text-muted">{ordenLabel(o.numero)}</span>{hecho ? <span className="pill-ok"><ShieldCheck size={12} /> Controlada</span> : <span className="pill-warn">Pendiente</span>}</div>
      <div className="mt-1 font-bold">{o.cliente}</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Field label="Taller"><select className="input !px-2 !py-2 text-[12px]" value={t} onChange={(e) => setT(e.target.value)}>{talleres.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></Field>
        <Field label="Revisadas"><input className="input !py-2 tnum" inputMode="numeric" value={r} onChange={(e) => setR(e.target.value.replace(/\D/g, ""))} /></Field>
        <Field label="Fallas"><input className="input !py-2 tnum" inputMode="numeric" value={f} onChange={(e) => setF(e.target.value.replace(/\D/g, ""))} /></Field>
      </div>
      <input className="input mt-2 !py-2" list="motivos-falla" placeholder="Motivo (opcional)" value={m} onChange={(e) => setM(e.target.value)} />
      <datalist id="motivos-falla">{useStore.getState().config.motivosFalla.map((x) => <option key={x} value={x} />)}</datalist>
      <div className="mt-3 flex gap-2">
        <button className="btn-ink flex-1" onClick={() => { if (!+r) return toast.error("Poné cuántas revisaste."); if (+f > +r) return toast.error("Las fallas superan a las revisadas."); onGuardar(t, +r, +f, m); }}>Guardar</button>
        <button className="btn flex-1" onClick={onPasar} disabled={!hecho}>Pasar a empaque</button>
      </div>
    </motion.div>
  );
}
