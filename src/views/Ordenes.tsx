import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, pointerWithin, rectIntersection, MeasuringStrategy, AutoScrollActivator, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
const colision: CollisionDetection = (args) => { const p = pointerWithin(args); return p.length ? p : rectIntersection(args); };
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { BookOpen, ChevronLeft, ChevronRight, Flame, GripVertical, Plus, Search, Scissors, Shirt, Sparkles, ShieldCheck, Package, Truck, ShoppingCart, CheckCircle2 } from "lucide-react";
import { Empty, EstadoOrden, Page, PageHead, Seg, cx, Paginacion, usePagina } from "../components/ui";
import { DetalleOrden, NuevaOrden } from "../components/OrdenSheets";
import { useRol, useStore } from "../store/useStore";
import { can } from "../lib/roles";
import { atrasada, unidades } from "../lib/metrics";
import type { Orden, Producto } from "../lib/types";
import { ETAPAS, ETAPA_DESC } from "../lib/types";
import { fdate, n0, ordenLabel } from "../lib/format";

type Filtro = "todas" | "venta" | "stock" | "atrasadas";
const ICONOS = [null, ShoppingCart, Scissors, Shirt, Sparkles, ShieldCheck, Package, CheckCircle2];
const TONOS = ["", "#C27A16", "#7D776F", "#E2412A", "#6B5BD2", "#2B6CB0", "#2F7D4F", "#121110"];

export function festejar() {
  confetti({ particleCount: 110, spread: 75, origin: { y: 0.7 }, colors: ["#E2412A", "#F2853A", "#121110", "#F4F1EC"], disableForReducedMotion: true });
}

export default function Ordenes() {
  const { ordenes, productos, moverEtapa } = useStore();
  const rol = useRol();
  const [sp, setSp] = useSearchParams();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [vista, setVista] = useState<"etapas" | "recorrido">("etapas");
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState<Orden | null>(null);
  const [verFin, setVerFin] = useState(false);
  const abierta = sp.get("o");
  const nueva = sp.get("nueva") === "1";
  const editar = sp.get("editar");
  const puedeMover = can(rol, "moverOrdenes");

  const lista = useMemo(() => ordenes.filter((o) =>
    (filtro === "todas" || (filtro === "atrasadas" ? atrasada(o) : o.tipo === filtro)) &&
    (!q || `${o.numero} ${o.cliente} ${o.factura}`.toLowerCase().includes(q.toLowerCase()))), [ordenes, filtro, q]);

  const mover = (o: Orden, to: number) => {
    if (to === o.etapa || to < 1 || to > 7) return;
    if (!puedeMover) { toast.error("No tenés permiso para mover órdenes."); return; }
    const cfg = useStore.getState().config.produccion;
    if (!cfg.permitirSaltarEtapas && Math.abs(to - o.etapa) > 1) { toast.error("Se mueve de a una etapa por vez (Ajustes → Producción)."); return; }
    if (cfg.requiereCalidad && o.etapa <= 5 && to >= 6 && !o.calidad.length) { toast.error("Primero cargá el control de calidad de esta orden."); return; }
    const from = o.etapa;
    moverEtapa(o.id, to);
    if (to === 7) festejar();
    toast.success(`${ordenLabel(o.numero)} → ${ETAPAS[to]}`, { action: { label: "Deshacer", onClick: () => moverEtapa(o.id, from) } });
  };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));
  const onEnd = (e: DragEndEvent) => {
    setDrag(null);
    const o = ordenes.find((x) => x.id === e.active.id); const to = e.over ? Number(e.over.id) : null;
    if (o && to) mover(o, to);
  };

  return (
    <Page>
      <PageHead eyebrow="Órdenes de producción" title="Cada orden, en su etapa">
        <div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !w-[200px] !py-2 !pl-9" placeholder="Buscar orden o cliente" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /></div>
        <Seg value={vista} onChange={setVista} options={[["etapas", "Por etapa"], ["recorrido", "Recorrido"]]} />
        {can(rol, "crearOrdenes") && <button className="btn-heat" onClick={() => setSp({ nueva: "1" })}><Plus size={16} /> Nueva orden</button>}
      </PageHead>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Seg value={filtro} onChange={setFiltro} options={[["todas", "Todas"], ["venta", "Ventas"], ["stock", "Stock"], ["atrasadas", "Atrasadas"]]} />
        {puedeMover && <span className="flex items-center gap-1.5 text-[12px] text-muted"><GripVertical size={14} /> {vista === "etapas" ? "Arrastrá una orden a otra fila, o usá las flechas." : "Tocá una etapa para mover la orden ahí."}</span>}
      </div>

      {!ordenes.length ? (
        <Empty title="No hay órdenes todavía" action={can(rol, "crearOrdenes") && <button className="btn-heat" onClick={() => setSp({ nueva: "1" })}><Plus size={16} /> Crear la primera</button>}>
          Elegís productos y talles, y el sistema calcula la tela y los insumos con el BOM.
        </Empty>
      ) : vista === "etapas" ? (
        <DndContext sensors={sensors} collisionDetection={colision} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} autoScroll={{ activator: AutoScrollActivator.Pointer, threshold: { x: 0.05, y: 0.08 }, acceleration: 6 }} onDragStart={(e) => setDrag(ordenes.find((o) => o.id === e.active.id) || null)} onDragEnd={onEnd} onDragCancel={() => setDrag(null)}>
          <LayoutGroup>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7].map((e) => {
                const os = lista.filter((o) => o.etapa === e);
                const mostrar = e === 7 && !verFin ? os.slice(0, 6) : os;
                return <Fila key={e} etapa={e} ordenes={mostrar} total={os} onOpen={(id) => setSp({ o: id })} productos={productos} onMover={mover} puedeMover={puedeMover} extra={e === 7 && os.length > 6 ? <button className="btn-ghost shrink-0 self-center" onClick={() => setVerFin(!verFin)}>{verFin ? "Ver menos" : `Ver las ${os.length}`}</button> : null} />;
              })}
            </div>
          </LayoutGroup>
          <DragOverlay dropAnimation={{ duration: 220 }}>{drag && <Tarjeta o={drag} productos={productos} overlay />}</DragOverlay>
        </DndContext>
      ) : (
        <Recorrido ordenes={lista} productos={productos} onOpen={(id) => setSp({ o: id })} onMover={mover} puedeMover={puedeMover} />
      )}

      <DetalleOrden id={abierta} onClose={() => setSp({})} onEditar={(id) => setSp({ editar: id })} />
      <NuevaOrden open={nueva || !!editar} editarId={editar} onClose={() => setSp({})} onCreada={(id) => setSp({ o: id })} />
    </Page>
  );
}

function Fila({ etapa, ordenes, total, onOpen, productos, onMover, puedeMover, extra }: { etapa: number; ordenes: Orden[]; total: Orden[]; onOpen: (id: string) => void; productos: Producto[]; onMover: (o: Orden, to: number) => void; puedeMover: boolean; extra: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: String(etapa) });
  const Icon = ICONOS[etapa]!;
  const u = total.reduce((a, o) => a + unidades(o), 0);
  const late = total.filter(atrasada).length;
  return (
    <motion.section ref={setNodeRef} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: etapa * 0.04 }}
      className={cx("relative flex overflow-hidden rounded-2xl border transition-all", isOver ? "scale-[1.005] border-heat bg-heat/5 shadow-glow" : "border-line bg-surface")}>
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: TONOS[etapa] }} />
      {/* Encabezado de la fila */}
      <div className="flex w-[150px] shrink-0 flex-col justify-between border-r border-line bg-surface2/60 py-3 pl-5 pr-3 sm:w-[210px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: TONOS[etapa] }}><Icon size={16} /></span>
            <span className="font-display text-[12px] font-bold text-muted">{etapa}/7</span>
          </div>
          <div className="mt-2 font-display text-[15px] font-extrabold leading-tight sm:text-[16px]">{ETAPAS[etapa]}</div>
          <div className="mt-0.5 hidden text-[11.5px] leading-snug text-muted sm:block">{ETAPA_DESC[etapa]}</div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <motion.span key={total.length} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="pill-ink tnum">{total.length} órd.</motion.span>
          <span className="pill tnum">{n0(u)} u</span>
          {late > 0 && <span className="pill-heat">{late} atras.</span>}
        </div>
        {etapa < 7 && <Link to={`/procesos?etapa=${etapa}`} className="mt-2 flex items-center gap-1 text-[11.5px] font-semibold text-muted hover:text-heat"><BookOpen size={12} /> Ver estándar</Link>}
      </div>
      {/* Tarjetas */}
      <div className="flex min-h-[132px] min-w-0 flex-1 gap-2.5 overflow-x-auto p-3 scroll-thin">
        <AnimatePresence initial={false}>
          {ordenes.map((o) => <Arrastrable key={o.id} o={o} onOpen={onOpen} productos={productos} onMover={onMover} puedeMover={puedeMover} />)}
        </AnimatePresence>
        {!ordenes.length && <div className={cx("grid flex-1 place-items-center rounded-xl border-2 border-dashed text-[12.5px] transition", isOver ? "border-heat text-heat" : "border-line text-muted")}>{isOver ? "Soltá acá" : "Sin órdenes en esta etapa"}</div>}
        {extra}
      </div>
    </motion.section>
  );
}

function Arrastrable({ o, onOpen, productos, onMover, puedeMover }: { o: Orden; onOpen: (id: string) => void; productos: Producto[]; onMover: (o: Orden, to: number) => void; puedeMover: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: o.id, disabled: !puedeMover });
  return (
    <motion.div layout layoutId={o.id} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: isDragging ? 0.3 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}
      ref={setNodeRef} {...attributes} {...listeners} onClick={() => onOpen(o.id)} className="relative w-[232px] shrink-0 touch-none">
      <Tarjeta o={o} productos={productos} />
      {puedeMover && (
        <div className="absolute bottom-2 right-2 flex gap-1" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {o.etapa > 1 && <button className="grid h-7 w-7 place-items-center rounded-lg bg-surface2 text-muted transition hover:bg-ink hover:text-bg" onClick={() => onMover(o, o.etapa - 1)} aria-label="Etapa anterior" title={"Volver a " + ETAPAS[o.etapa - 1]}><ChevronLeft size={15} /></button>}
          {o.etapa < 7 && <button className="grid h-7 w-7 place-items-center rounded-lg bg-heat/10 text-heat transition hover:bg-heat hover:text-white" onClick={() => onMover(o, o.etapa + 1)} aria-label="Etapa siguiente" title={"Pasar a " + ETAPAS[o.etapa + 1]}><ChevronRight size={15} /></button>}
        </div>
      )}
    </motion.div>
  );
}

function Tarjeta({ o, productos, overlay }: { o: Orden; productos: Producto[]; overlay?: boolean }) {
  const prods = [...new Set(o.lineas.map((l) => productos.find((p) => p.id === l.productoId)))].filter(Boolean) as Producto[];
  const late = atrasada(o);
  return (
    <div className={cx("h-full cursor-grab rounded-xl border bg-surface p-3 pb-11 shadow-card transition hover:-translate-y-0.5 hover:border-muted active:cursor-grabbing", late ? "border-heat/60" : "border-line", overlay && "w-[232px] rotate-2 shadow-2xl ring-2 ring-heat")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11.5px] font-semibold text-muted">{ordenLabel(o.numero)}</span>
        <div className="flex items-center gap-1">
          {o.prioridad === "alta" && <span className="pill-heat !px-1.5"><Flame size={11} /></span>}
          <span className={o.tipo === "venta" ? "pill-ink" : "pill"}>{o.tipo === "venta" ? "Venta" : "Stock"}</span>
        </div>
      </div>
      <div className="mt-1.5 line-clamp-1 text-[13.5px] font-bold">{o.cliente}</div>
      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
        {prods.slice(0, 2).map((p) => <i key={p.id} className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />)}
        <span className="truncate">{n0(unidades(o))} u · {prods.map((p) => p.nombre).join(", ")}</span>
      </div>
      <div className={cx("absolute bottom-3 left-3 text-[11.5px] font-semibold", late ? "text-heat" : "text-muted")}>{o.etapa === 7 ? `Finalizada ${fdate(o.fechaFin)}` : `${late ? "Atrasada · " : "Entrega "}${fdate(o.fechaEntrega)}`}</div>
    </div>
  );
}

function Recorrido({ ordenes, productos, onOpen, onMover, puedeMover }: { ordenes: Orden[]; productos: Producto[]; onOpen: (id: string) => void; onMover: (o: Orden, to: number) => void; puedeMover: boolean }) {
  const [verFin, setVerFin] = useState(false);
  const lista = [...ordenes].sort((a, b) => (a.etapa === 7 ? 1 : 0) - (b.etapa === 7 ? 1 : 0) || a.fechaEntrega.localeCompare(b.fechaEntrega)).filter((o) => verFin || o.etapa < 7);
  const pgR = usePagina(lista, 10);
  return (
    <div className="card overflow-x-auto scroll-thin">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[260px_repeat(7,1fr)_120px] items-end gap-1 border-b border-line px-4 pb-3 pt-4">
          <span className="th !p-0">Orden</span>
          {[1, 2, 3, 4, 5, 6, 7].map((e) => { const I = ICONOS[e]!; return <span key={e} className="flex flex-col items-center gap-1 text-center text-[10.5px] font-bold text-muted"><I size={15} style={{ color: TONOS[e] }} />{ETAPAS[e].replace("Control de calidad", "Calidad").replace("Personalización", "Personaliz.").replace("Compra de tela", "Tela")}</span>; })}
          <span className="th !p-0 text-right">Estado</span>
        </div>
        <AnimatePresence initial={false}>
          {pgR.items.map((o) => (
            <motion.div layout key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-[260px_repeat(7,1fr)_120px] items-center gap-1 border-b border-line px-4 py-2.5 last:border-0 hover:bg-surface2/50">
              <button onClick={() => onOpen(o.id)} className="min-w-0 text-left">
                <div className="flex items-center gap-2"><span className="font-mono text-[12px] font-semibold text-muted">{ordenLabel(o.numero)}</span>{o.prioridad === "alta" && <Flame size={12} className="text-heat" />}<span className="truncate text-[13.5px] font-bold">{o.cliente}</span></div>
                <div className="truncate text-[12px] text-muted">{n0(unidades(o))} u · {[...new Set(o.lineas.map((l) => productos.find((p) => p.id === l.productoId)?.nombre))].join(", ")}</div>
              </button>
              {[1, 2, 3, 4, 5, 6, 7].map((e) => {
                const done = e < o.etapa, cur = e === o.etapa;
                return (
                  <div key={e} className="relative flex items-center justify-center">
                    {e > 1 && <span className={cx("absolute right-1/2 top-1/2 h-1 w-full -translate-y-1/2 rounded", e <= o.etapa ? "bg-ink" : "bg-line")} />}
                    <motion.button whileHover={puedeMover ? { scale: 1.25 } : undefined} whileTap={puedeMover ? { scale: 0.9 } : undefined} disabled={!puedeMover} onClick={() => onMover(o, e)} title={puedeMover ? `Mover a ${ETAPAS[e]}` : ETAPAS[e]}
                      className={cx("relative z-10 grid place-items-center rounded-full border-2 transition", cur ? "h-8 w-8 border-heat bg-heat text-white shadow-glow" : done ? "h-5 w-5 border-ink bg-ink" : "h-5 w-5 border-line bg-surface hover:border-heat")}>
                      {cur && <motion.span layoutId={"cur-" + o.id} className="text-[11px] font-bold">{e}</motion.span>}
                    </motion.button>
                  </div>
                );
              })}
              <div className="text-right"><EstadoOrden o={o} /></div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="px-4"><Paginacion pg={pgR as never} nombre="órdenes" /></div>
        <div className="p-3 text-center"><button className="btn-ghost" onClick={() => setVerFin(!verFin)}>{verFin ? "Ocultar finalizadas" : "Mostrar también las finalizadas"}</button></div>
      </div>
    </div>
  );
}
