import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Info, MapPin, Route, Truck, X } from "lucide-react";
import { Seg, cx } from "./ui";
import { useStore } from "../store/useStore";
import { useColors } from "../lib/colors";
import { addDays, fdate, n0, ordenLabel, today } from "../lib/format";
import { TIPOS_TALLER, type TipoTaller } from "../lib/types";

type Periodo = "7" | "30" | "90";
const COLS = ["Sale de", "Corte", "Confección", "Personalización", "Llega a"];
const colDe = (t?: TipoTaller) => (t === "corte" ? 1 : t === "confeccion" ? 2 : t ? 3 : 0);

/** Diagrama de flujo de la camioneta: de izquierda a derecha, en el orden en que viaja la mercadería. */
export default function MapaRecorridos() {
  const { viajes, talleres, config } = useStore();
  const C = useColors();
  const [per, setPer] = useState<Periodo>("30");
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const desde = addDays(today(), -Number(per) + 1);
  const vs = useMemo(() => viajes.filter((v) => v.fecha >= desde && v.fecha <= today()), [viajes, desde]);

  // Nodos: Fábrica sale (izq), talleres por columna, Fábrica/Depósito llega (der)
  const W = 900, H = 400, padX = 90, top = 64, bottom = 30;
  const colX = (c: number) => padX + (c * (W - padX * 2)) / 4;
  const propios = config.lugares.map((l) => l.nombre);
  const nodos = useMemo(() => {
    const out: { id: string; nombre: string; col: number; sub: string }[] = [];
    out.push({ id: "out:Fábrica", nombre: "Fábrica", col: 0, sub: "Salida" });
    talleres.forEach((t) => out.push({ id: "t:" + t.nombre, nombre: t.nombre, col: colDe(t.tipo), sub: TIPOS_TALLER[t.tipo] + (t.zona ? " · " + t.zona : "") }));
    propios.forEach((p) => out.push({ id: "in:" + p, nombre: p, col: 4, sub: p === "Fábrica" ? "Vuelve terminado" : "Ingreso a stock" }));
    const byCol: Record<number, typeof out> = {};
    out.forEach((n) => (byCol[n.col] ||= []).push(n));
    return out.map((n) => { const arr = byCol[n.col]; const i = arr.indexOf(n); const h = H - top - bottom; return { ...n, x: colX(n.col), y: top + ((i + 1) * h) / (arr.length + 1) }; });
  }, [talleres, propios.join()]);
  const nodoOrigen = (nombre: string) => nodos.find((n) => n.nombre === nombre && n.id.startsWith("t:")) || nodos.find((n) => n.id === "out:" + nombre) || nodos.find((n) => n.id === "in:" + nombre);
  const nodoDestino = (nombre: string) => nodos.find((n) => n.nombre === nombre && n.id.startsWith("t:")) || nodos.find((n) => n.id === "in:" + nombre) || nodos.find((n) => n.id === "out:" + nombre);

  const rutas = useMemo(() => {
    const m = new Map<string, { a: (typeof nodos)[number]; b: (typeof nodos)[number]; n: number; km: number; ords: Set<number>; ultimo: string }>();
    for (const v of vs) {
      const a = nodoOrigen(v.origen), b = nodoDestino(v.destino);
      if (!a || !b || a === b) continue;
      const k = a.id + ">" + b.id;
      const r = m.get(k) || { a, b, n: 0, km: 0, ords: new Set<number>(), ultimo: "" };
      r.n++; r.km += v.km || 0; v.ordenes.forEach((o) => r.ords.add(o)); if (v.fecha > r.ultimo) r.ultimo = v.fecha;
      m.set(k, r);
    }
    return [...m.entries()].map(([k, r]) => ({ k, ...r })).sort((x, y) => y.n - x.n);
  }, [vs, nodos]);
  const max = Math.max(1, ...rutas.map((r) => r.n));
  const foco = hover || sel;
  const activo = (r: (typeof rutas)[number]) => !foco || r.a.id === foco || r.b.id === foco || r.k === foco;
  const curva = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    if (b.x > a.x) { const dx = (b.x - a.x) * 0.5; return `M${a.x + 14},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x - 14},${b.y}`; }
    const dip = H - 6; return `M${a.x},${a.y + 14} C${a.x},${dip} ${b.x},${dip} ${b.x},${b.y + 14}`; // vuelta hacia atrás por abajo
  };
  const selNodo = nodos.find((n) => n.id === sel);
  const selRutas = sel ? rutas.filter((r) => r.a.id === sel || r.b.id === sel || r.k === sel) : [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Seg value={per} onChange={(v) => { setPer(v); setSel(null); }} options={[["7", "7 días"], ["30", "30 días"], ["90", "3 meses"]]} />
        <div className="flex items-center gap-3 text-[11.5px] text-muted">
          <span className="flex items-center gap-1.5"><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke={C.ink} strokeWidth="5" strokeLinecap="round" opacity=".6" /></svg> más viajes</span>
          <span className="flex items-center gap-1.5"><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke={C.ink} strokeWidth="1.5" strokeLinecap="round" opacity=".35" /></svg> menos</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-heat" /> la camioneta</span>
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface2/50 scroll-thin">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[720px]" onClick={() => setSel(null)}>
          {/* columnas */}
          {COLS.map((c, i) => (
            <g key={c}>
              <rect x={colX(i) - 72} y={14} width={144} height={H - 22} rx={16} fill={i === 0 || i === 4 ? C.surface : "transparent"} stroke={C.line} strokeDasharray={i === 0 || i === 4 ? "0" : "4 6"} opacity={0.9} />
              <text x={colX(i)} y={38} textAnchor="middle" fontSize="11" fontWeight={800} letterSpacing="1.5" fill={C.muted}>{c.toUpperCase()}</text>
              {i < 4 && <path d={`M${colX(i) + 78},30 l8,4 l-8,4`} fill="none" stroke={C.muted} strokeWidth={1.5} />}
            </g>
          ))}
          {/* rutas */}
          {rutas.map((r, i) => {
            const d = curva(r.a, r.b); const w = 1.5 + 7 * (r.n / max); const on = activo(r);
            const mx = r.b.x > r.a.x ? (r.a.x + r.b.x) / 2 : (r.a.x + r.b.x) / 2, my = r.b.x > r.a.x ? (r.a.y + r.b.y) / 2 : H - 30;
            return (
              <g key={r.k} style={{ cursor: "pointer" }} onMouseEnter={() => setHover(r.k)} onMouseLeave={() => setHover(null)} onClick={(e) => { e.stopPropagation(); setSel(r.k); }} opacity={on ? 1 : 0.12}>
                <path d={d} fill="none" stroke="transparent" strokeWidth={18} />
                <motion.path d={d} fill="none" stroke={foco === r.k ? C.heat : C.ink} strokeOpacity={0.25 + 0.55 * (r.n / max)} strokeWidth={w} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: i * 0.05 }} />
                <path d={d} fill="none" stroke={C.heat} strokeWidth={2} strokeDasharray="1 16" strokeLinecap="round"><animate attributeName="stroke-dashoffset" from="34" to="0" dur="1.2s" repeatCount="indefinite" /></path>
                <circle r={5} fill={C.heat} stroke={C.surface} strokeWidth={2}><animateMotion dur={`${3.2 - 1.6 * (r.n / max)}s`} repeatCount="indefinite" path={d} /></circle>
                <g transform={`translate(${mx},${my})`}>
                  <rect x={-15} y={-11} width={30} height={22} rx={11} fill={foco === r.k ? C.heat : C.surface} stroke={foco === r.k ? C.heat : C.line} />
                  <text textAnchor="middle" y={4.5} fontSize="12" fontWeight={800} fill={foco === r.k ? "#fff" : C.ink}>{r.n}</text>
                </g>
              </g>
            );
          })}
          {/* nodos */}
          {nodos.map((n, i) => {
            const vis = rutas.some((r) => r.a.id === n.id || r.b.id === n.id); const on = !foco || foco === n.id || rutas.some((r) => (r.k === foco || r.a.id === foco || r.b.id === foco) && (r.a.id === n.id || r.b.id === n.id));
            const propio = n.col === 0 || n.col === 4;
            return (
              <motion.g key={n.id} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: on ? 1 : 0.25, scale: 1 }} transition={{ delay: 0.1 + i * 0.04 }} style={{ transformOrigin: `${n.x}px ${n.y}px`, cursor: "pointer" }}
                onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onClick={(e) => { e.stopPropagation(); setSel(n.id); }}>
                {sel === n.id && <circle cx={n.x} cy={n.y} r={22} fill={C.heat} opacity={0.18}><animate attributeName="r" values="18;26;18" dur="1.6s" repeatCount="indefinite" /></circle>}
                <circle cx={n.x} cy={n.y} r={13} fill={propio ? C.heat : C.surface} stroke={vis ? C.ink : C.line} strokeWidth={2.5} />
                {propio && <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fontWeight={900} fill="#fff">{n.nombre[0]}</text>}
                <text x={n.x} y={n.y + 30} textAnchor="middle" fontSize="12" fontWeight={800} fill={C.ink}>{n.nombre}</text>
                <text x={n.x} y={n.y + 44} textAnchor="middle" fontSize="10" fill={C.muted}>{n.sub}</text>
              </motion.g>
            );
          })}
        </svg>
        {!rutas.length && <div className="absolute inset-0 grid place-items-center text-[13px] text-muted">No hubo viajes en este período.</div>}

        <AnimatePresence>
          {sel && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute right-3 top-3 w-[260px] rounded-2xl border border-line bg-surface p-4 shadow-2xl">
              <button className="absolute right-2 top-2 rounded-lg p-1 text-muted hover:bg-surface2" onClick={() => setSel(null)} aria-label="Cerrar"><X size={14} /></button>
              {selNodo ? (<>
                <div className="flex items-center gap-2"><MapPin size={15} className="text-heat" /><b className="text-[14px]">{selNodo.nombre}</b></div>
                <div className="text-[11.5px] text-muted">{selNodo.sub}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-surface2 p-2"><div className="tnum text-[18px] font-extrabold">{selRutas.filter((r) => r.b.id === sel).reduce((a, r) => a + r.n, 0)}</div><div className="text-[10.5px] text-muted">llegadas</div></div>
                  <div className="rounded-xl bg-surface2 p-2"><div className="tnum text-[18px] font-extrabold">{selRutas.filter((r) => r.a.id === sel).reduce((a, r) => a + r.n, 0)}</div><div className="text-[10.5px] text-muted">salidas</div></div>
                </div>
              </>) : selRutas[0] && (<>
                <div className="flex items-center gap-1.5 text-[13.5px] font-bold">{selRutas[0].a.nombre}<ArrowRight size={14} className="text-heat" />{selRutas[0].b.nombre}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-surface2 p-2"><div className="tnum text-[18px] font-extrabold">{selRutas[0].n}</div><div className="text-[10.5px] text-muted">viajes</div></div>
                  <div className="rounded-xl bg-surface2 p-2"><div className="tnum text-[18px] font-extrabold">{n0(selRutas[0].km)}</div><div className="text-[10.5px] text-muted">km</div></div>
                  <div className="rounded-xl bg-surface2 p-2"><div className="tnum text-[18px] font-extrabold">{selRutas[0].ords.size}</div><div className="text-[10.5px] text-muted">órdenes</div></div>
                </div>
                <div className="mt-2 text-[11.5px] text-muted">Último viaje: {fdate(selRutas[0].ultimo)}</div>
              </>)}
              <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-[12px] scroll-thin">
                {vs.filter((v) => { const a = nodoOrigen(v.origen), b = nodoDestino(v.destino); return selNodo ? a?.id === sel || b?.id === sel : a?.id + ">" + b?.id === sel; }).slice(0, 12).map((v) => (
                  <li key={v.id} className="flex justify-between gap-2 rounded-lg px-2 py-1 hover:bg-surface2"><span className="text-muted">{fdate(v.fecha)}</span><span className="truncate">{v.carga}</span><span className="font-mono text-muted">{v.ordenes.map(ordenLabel).join(" ")}</span></li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface2 px-3 py-2.5 text-[12px] text-ink2">
        <Info size={15} className="mt-0.5 shrink-0 text-heat" />
        <span>La mercadería viaja de izquierda a derecha: sale de la fábrica, pasa por corte, confección y personalización, y vuelve. <b>Cada número es la cantidad de viajes</b> por ese recorrido. Tocá un lugar o una línea para ver el detalle.</span>
      </div>

      <div className="mt-4">
        <div className="eyebrow mb-2 flex items-center gap-1.5"><Route size={13} /> Recorridos más usados</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {rutas.slice(0, 6).map((r, i) => (
            <button key={r.k} onClick={() => setSel(r.k)} onMouseEnter={() => setHover(r.k)} onMouseLeave={() => setHover(null)} className={cx("flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-[12.5px] transition", sel === r.k ? "border-heat bg-heat/5" : "border-line hover:border-muted")}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-bg">{i + 1}</span>
              <span className="flex min-w-0 flex-1 items-center gap-1 font-semibold"><span className="truncate">{r.a.nombre}</span><ArrowRight size={12} className="shrink-0 text-heat" /><span className="truncate">{r.b.nombre}</span></span>
              <span className="flex items-center gap-1 tnum text-muted"><Truck size={13} />{r.n}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
