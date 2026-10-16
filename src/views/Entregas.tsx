import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Camera, CheckCircle2, MessageSquareText, PackageCheck } from "lucide-react";
import { Empty, Field, Page, PageHead, Sheet, cx, rise, stagger, Paginacion, usePagina } from "../components/ui";
import { useMiTaller, useStore } from "../store/useStore";
import { unidades } from "../lib/metrics";
import { ETAPAS, ETAPA_DE_TALLER, TIPOS_TALLER, type Orden } from "../lib/types";
import { fdate, fdateLong, n0, ordenLabel } from "../lib/format";
import { festejar } from "./Ordenes";

export default function Entregas() {
  const t = useMiTaller();
  const { ordenes, productos } = useStore();
  const nav = useNavigate();
  const [sel, setSel] = useState<Orden | null>(null);
  const hist = t ? ordenes.flatMap((o) => o.historial.filter((h) => h.tipo === "entrega" && h.tallerId === t.id).map((h) => ({ h, o }))).sort((a, b) => b.h.ts - a.h.ts) : [];
  const pgH = usePagina(hist, 8);
  if (!t) return <Page><Empty title="No tenés un taller asignado">Pedile a Dirección que te vincule con tu taller desde Equipo.</Empty></Page>;
  const et = ETAPA_DE_TALLER[t.tipo];
  // Solo las órdenes asignadas a este taller que están en su etapa
  const mias = ordenes.filter((o) => o.etapa === et && o.asignacion?.[String(et)] === t.id);
  const proximas = ordenes.filter((o) => o.etapa < et && o.asignacion?.[String(et)] === t.id);
  const ent = (o: Orden) => o.historial.filter((h) => h.tipo === "entrega" && h.etapa === et && h.tallerId === t.id).reduce((a, h) => a + (h.tipo === "entrega" ? h.unidades : 0), 0);
  const semana = hist.filter((x) => Date.now() - x.h.ts < 7 * 864e5).reduce((a, x) => a + (x.h.tipo === "entrega" ? x.h.unidades : 0), 0);

  return (
    <Page>
      <PageHead eyebrow={`${TIPOS_TALLER[t.tipo]} · ${t.zona}`} title={t.nombre} />
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-3">
        <motion.button variants={rise} whileTap={{ scale: 0.98 }} onClick={() => mias[0] ? setSel(mias[0]) : toast("No hay órdenes en tu etapa ahora.")} className="relative overflow-hidden rounded-3xl bg-heat p-6 text-left text-white shadow-glow sm:col-span-2">
          <PackageCheck className="absolute -right-6 -top-6 h-32 w-32 opacity-15" />
          <div className="wide font-display text-[26px] font-black">Informar entrega</div>
          <div className="mt-1 max-w-sm text-[14px] text-white/80">Elegí la orden y cuántas prendas entregaste. Producción lo ve al instante.</div>
        </motion.button>
        <motion.button variants={rise} whileTap={{ scale: 0.98 }} onClick={() => useStore.getState().setChatAbierto(true)} className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 text-left">
          <Camera className="absolute -right-4 -top-4 h-24 w-24 text-ink opacity-[.06]" />
          <div className="wide font-display text-[20px] font-black">Mandar mensaje o foto</div>
          <div className="mt-1 text-[13px] text-muted">El asistente lo lee y lo carga.</div>
        </motion.button>
      </motion.div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="eyebrow">Esta semana</div><div className="wide mt-2 font-display text-[30px] font-extrabold tnum">{n0(semana)}</div><div className="text-[12px] text-muted">prendas entregadas</div></div>
        <div className="card p-4"><div className="eyebrow">Pendientes</div><div className="wide mt-2 font-display text-[30px] font-extrabold tnum">{mias.length}</div><div className="text-[12px] text-muted">órdenes en {ETAPAS[et].toLowerCase()}</div></div>
        <div className="card p-4"><div className="eyebrow">Capacidad</div><div className="wide mt-2 font-display text-[30px] font-extrabold tnum">{n0(t.capacidadSemanal)}</div><div className="text-[12px] text-muted">prendas por semana</div></div>
      </div>

      <h2 className="mb-3 mt-6 font-display text-[16px] font-bold">Órdenes para entregar</h2>
      {mias.length ? (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2">
          {mias.map((o) => { const e = ent(o), tot = unidades(o), pct = Math.min(100, (e / tot) * 100); return (
            <motion.div variants={rise} key={o.id} className="card p-4">
              <div className="flex items-center justify-between"><span className="font-mono text-[13px] font-bold">{ordenLabel(o.numero)}</span><span className="pill">Entrega {fdate(o.fechaEntrega)}</span></div>
              <div className="mt-2 text-[13px] text-ink2">{o.lineas.map((l) => `${l.cantidad} ${productos.find((p) => p.id === l.productoId)?.nombre || ""} ${l.talle}`).join(" · ")}</div>
              <div className="mt-3 flex items-center justify-between text-[12px]"><span className="text-muted">Entregado</span><span className="tnum font-bold">{n0(e)} / {n0(tot)}</span></div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface2"><motion.div className="h-full rounded-full bg-gradient-to-r from-ember to-heat" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9 }} /></div>
              <button className="btn-ink mt-3 w-full" onClick={() => setSel(o)}>{e >= tot ? <><CheckCircle2 size={15} /> Completa · cargar más</> : "Informar entrega"}</button>
            </motion.div>
          ); })}
        </motion.div>
      ) : <Empty title="No tenés órdenes pendientes">Cuando producción te asigne una orden y llegue a {ETAPAS[et].toLowerCase()}, aparece acá.</Empty>}

      {proximas.length > 0 && (<>
        <h2 className="mb-3 mt-6 font-display text-[16px] font-bold">Próximas para tu taller</h2>
        <div className="card divide-y divide-line">{proximas.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]"><span className="font-mono text-[12px] font-semibold">{ordenLabel(o.numero)}</span><span className="flex-1 truncate">{o.lineas.map((l) => `${l.cantidad} ${productos.find((p) => p.id === l.productoId)?.nombre || ""} ${l.talle}`).join(" · ")}</span><span className="pill">Ahora en {ETAPAS[o.etapa].toLowerCase()}</span><span className="tnum text-muted">entrega {fdate(o.fechaEntrega)}</span></div>
        ))}</div>
      </>)}

      <h2 className="mb-3 mt-6 font-display text-[16px] font-bold">Tus entregas</h2>
      {hist.length ? (
        <div className="card divide-y divide-line">{pgH.items.map(({ h, o }) => (
          <div key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="w-[92px] text-muted">{fdateLong(h.fecha)}</span><span className="font-mono text-[12px] font-semibold">{ordenLabel(o.numero)}</span><span className="flex-1" /><span className="tnum font-bold">{n0(h.tipo === "entrega" ? h.unidades : 0)} u</span></div>
        ))}</div>
      ) : null}
      {hist.length ? (
        <Paginacion pg={pgH as never} nombre="entregas" />
      ) : <Empty title="Todavía no informaste entregas" />}

      <InformarEntrega o={sel} pendientes={mias} onClose={() => setSel(null)} />
    </Page>
  );
}

function InformarEntrega({ o, pendientes, onClose }: { o: Orden | null; pendientes: Orden[]; onClose: () => void }) {
  const t = useMiTaller();
  const registrar = useStore((s) => s.registrarEntrega);
  const [id, setId] = useState("");
  const [u, setU] = useState("");
  const [obs, setObs] = useState("");
  const [ok, setOk] = useState(false);
  useEffect(() => { if (o) { setId(o.id); setU(""); setObs(""); setOk(false); } }, [o]);
  return (
    <Sheet open={!!o} onClose={onClose} width={480}>
      {ok ? (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid place-items-center py-16 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="grid h-20 w-20 place-items-center rounded-full bg-ok/15 text-ok"><CheckCircle2 size={44} /></motion.div>
          <div className="wide mt-5 font-display text-[24px] font-extrabold">¡Entrega registrada!</div>
          <p className="mt-1 text-[14px] text-muted">Producción ya la ve en el sistema.</p>
          <button className="btn mt-6" onClick={onClose}>Listo</button>
        </motion.div>
      ) : (<>
        <div className="eyebrow">{t?.nombre}</div>
        <h2 className="wide mt-1.5 font-display text-[24px] font-extrabold">Informar entrega</h2>
        <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); if (!+u) return toast.error("Poné cuántas prendas entregaste."); registrar(id, { unidades: +u, tallerId: t?.id || null, obs }); festejar(); setOk(true); }}>
          <Field label="Orden"><select className="input" value={id} onChange={(e) => setId(e.target.value)}>{pendientes.map((x) => <option key={x.id} value={x.id}>{ordenLabel(x.numero)} · {n0(unidades(x))} prendas</option>)}</select></Field>
          <Field label="Prendas entregadas"><input className="input !py-4 text-center font-display text-[28px] font-extrabold tnum" inputMode="numeric" placeholder="0" value={u} onChange={(e) => setU(e.target.value.replace(/\D/g, ""))} autoFocus /></Field>
          <Field label="Comentario"><input className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" /></Field>
          <button className="btn-heat w-full !py-3.5 text-[15px]" type="submit"><PackageCheck size={18} /> Informar entrega</button>
        </form>
      </>)}
    </Sheet>
  );
}
