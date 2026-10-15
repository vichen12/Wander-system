import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Boxes, Clock, Copy, Layers, Plus, Route, Search, Trash2, X } from "lucide-react";
import { Empty, Field, Page, PageHead, Seg, Sheet, cx, rise, stagger, Paginacion, usePagina } from "../components/ui";
import { useRol, useStore } from "../store/useStore";
import { can } from "../lib/roles";
import { bom } from "../lib/metrics";
import { ETAPAS, type Material, type PasoRuta, type Producto, type Unidad } from "../lib/types";
import { money, n0, n1, n2, uid } from "../lib/format";
import Prenda, { fotoADataUrl, tipoDe } from "../components/Prenda";
import { Camera, ImageOff } from "lucide-react";

const COLORES = ["#E2412A", "#C27A16", "#6B5BD2", "#2B6CB0", "#2F7D4F", "#121110"];
const MAT_COLORS = ["#E2412A", "#F2853A", "#121110", "#7D776F", "#C9C2B8", "#6B5BD2", "#2B6CB0"];

export default function Productos() {
  const { productos, materiales } = useStore();
  const rol = useRol();
  const [tab, setTab] = useState<"productos" | "materiales">("productos");
  const [ep, setEp] = useState<Producto | null>(null);
  const [em, setEm] = useState<Material | null>(null);
  const [q, setQ] = useState("");
  const verCostos = can(rol, "verCostos");
  const editar = can(rol, "editarCatalogo");
  const pgM = usePagina(materiales.filter((m) => !q || m.nombre.toLowerCase().includes(q.toLowerCase())), 10);
  const nuevo = (): Producto => ({ id: "", codigo: "", nombre: "", categoria: "Corporativo", talles: ["S", "M", "L", "XL"], ajusteTalle: { S: 0.92, M: 1, L: 1.08, XL: 1.16 }, personalizacion: "Bordado", receta: [], ruta: [2, 3, 4, 5, 6].map((e) => ({ etapa: e, minutos: 0, costo: 0, nota: "" })), costoCorte: 0, costoConfeccion: 0, costoPersonalizacion: 0, precioVenta: 0, color: COLORES[productos.length % COLORES.length], descripcion: "" });
  const lista = productos.filter((p) => !q || `${p.nombre} ${p.codigo} ${p.categoria}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Page>
      <PageHead eyebrow="Catálogo" title="Productos y BOM">
        <div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !w-[190px] !py-2 !pl-9" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /></div>
        <Seg value={tab} onChange={setTab} options={[["productos", "Productos"], ["materiales", "Materiales"]]} />
        {editar && (tab === "productos"
          ? <button className="btn-heat" onClick={() => setEp(nuevo())}><Plus size={16} /> Nuevo producto</button>
          : <button className="btn-heat" onClick={() => setEm({ id: "", nombre: "", unidad: "kg", proveedor: "", costo: 0 })}><Plus size={16} /> Nuevo material</button>)}
      </PageHead>

      {tab === "productos" ? (
        !lista.length ? <Empty title="Sin productos">Cargá cada producto con su BOM: qué materiales lleva, cuánto por prenda y cuánta merma.</Empty> : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lista.map((p) => {
              const b = bom(p, materiales);
              return (
                <motion.button variants={rise} whileHover={{ y: -4 }} key={p.id} onClick={() => setEp(p)} className="card group overflow-hidden text-left">
                  <div className="relative h-52 overflow-hidden" style={{ background: `radial-gradient(120% 90% at 75% 30%, ${p.color}, #121110 75%)` }}>
                    {p.foto ? (<>
                      <img src={p.foto} alt={p.nombre} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/20 to-transparent" />
                    </>) : (<>
                      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.25) 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
                      <motion.div className="absolute -bottom-2 right-2 h-48 w-48" initial={{ y: 8, rotate: -4 }} animate={{ y: [8, 0, 8], rotate: [-4, -1, -4] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
                        <Prenda tipo={p.tipoPrenda || tipoDe(p.nombre)} color={p.color} calor={p.categoria === "Calefaccionado"} className="h-full w-full transition duration-500 group-hover:scale-110" />
                      </motion.div>
                      <div className="absolute inset-0 bg-gradient-to-r from-night/70 via-night/10 to-transparent" />
                    </>)}
                    <div className="absolute left-4 top-3 flex items-center gap-2"><span className="rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[10.5px] text-white/80 backdrop-blur">{p.codigo}</span><span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">{p.categoria}</span></div>
                    {!p.foto && <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[10.5px] text-white/70 backdrop-blur"><Camera size={11} /> Sin foto</span>}
                    <div className="absolute bottom-4 left-4 max-w-[60%] text-white"><div className="wide font-display text-[22px] font-black leading-[1.05] drop-shadow">{p.nombre}</div></div>
                  </div>
                  <div className="p-4">
                    <div className="mb-3 flex flex-wrap gap-1">{p.talles.map((t) => <span key={t} className="pill">{t}</span>)}</div>
                    <div className="flex items-center gap-3 text-[12px] text-muted"><span className="flex items-center gap-1"><Layers size={13} /> {p.receta.length} componentes</span><span className="flex items-center gap-1"><Clock size={13} /> {n0(b.minutos)} min</span></div>
                    {verCostos && b.total > 0 && (<>
                      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface2">
                        {b.filas.map((f, i) => <motion.div key={i} initial={{ width: 0 }} animate={{ width: `${(f.costo / b.total) * 100}%` }} transition={{ delay: 0.1 + i * 0.05 }} style={{ background: MAT_COLORS[i % MAT_COLORS.length] }} />)}
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(b.mano / b.total) * 100}%` }} className="bg-[repeating-linear-gradient(45deg,#7D776F_0_4px,#C9C2B8_4px_8px)]" />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div><div className="text-[10.5px] text-muted">Costo</div><div className="tnum text-[14px] font-extrabold">{money(b.total)}</div></div>
                        <div><div className="text-[10.5px] text-muted">Precio</div><div className="tnum text-[14px] font-extrabold">{money(p.precioVenta)}</div></div>
                        <div><div className="text-[10.5px] text-muted">Margen</div><div className={cx("tnum text-[14px] font-extrabold", (b.margen ?? 0) < 0.3 && "text-heat")}>{b.margen == null ? "—" : Math.round(b.margen * 100) + "%"}</div></div>
                      </div>
                    </>)}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )
      ) : (
        !materiales.length ? <Empty title="Sin materiales">Cargá telas e insumos con su unidad y costo.</Empty> : (
          <div className="card overflow-x-auto scroll-thin">
            <table className="w-full min-w-[620px]">
              <thead><tr className="[&>th]:pt-4"><th className="th">Material</th><th className="th">Unidad</th><th className="th">Proveedor</th><th className="th">Se usa en</th>{verCostos && <th className="th text-right">Costo por unidad</th>}</tr></thead>
              <tbody>{pgM.items.map((m) => (
                <tr key={m.id} className={cx(editar && "cursor-pointer hover:bg-surface2")} onClick={() => editar && setEm(m)}>
                  <td className="td font-semibold">{m.nombre}</td><td className="td">{m.unidad}</td><td className="td text-muted">{m.proveedor || "—"}</td>
                  <td className="td"><div className="flex flex-wrap gap-1">{productos.filter((p) => p.receta.some((r) => r.materialId === m.id)).map((p) => <span key={p.id} className="pill"><i className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />{p.nombre}</span>)}</div></td>
                  {verCostos && <td className="td text-right tnum">{money(m.costo)}</td>}
                </tr>
              ))}</tbody>
            </table>
            <div className="px-4 pb-4"><Paginacion pg={pgM as never} nombre="materiales" /></div>
          </div>
        )
      )}
      <FichaProducto p={ep} onClose={() => setEp(null)} />
      <EditarMaterial m={em} onClose={() => setEm(null)} />
    </Page>
  );
}

type TabFicha = "bom" | "ruta" | "costos" | "datos";

function FichaProducto({ p, onClose }: { p: Producto | null; onClose: () => void }) {
  const { guardar, eliminar, materiales, config } = useStore();
  const rol = useRol();
  const editar = can(rol, "editarCatalogo");
  const verCostos = can(rol, "verCostos");
  const [f, setF] = useState<Producto | null>(null);
  const [tab, setTab] = useState<TabFicha>("bom");
  const [talle, setTalle] = useState("");
  const [cant, setCant] = useState(100);
  const [borrar, setBorrar] = useState(false);
  useEffect(() => { if (p) { setF(JSON.parse(JSON.stringify({ ...p, ruta: p.ruta || [] }))); setTalle(p.talles.includes("M") ? "M" : p.talles[0]); setTab(p.id ? "bom" : "datos"); setBorrar(false); } else setF(null); }, [p]);
  const b = useMemo(() => (f ? bom(f, materiales, talle) : null), [f, materiales, talle]);
  if (!f || !b) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const set = (patch: Partial<Producto>) => setF({ ...f, ...patch });
  const setR = (i: number, patch: Partial<Producto["receta"][number]>) => set({ receta: f.receta.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const setRuta = (i: number, patch: Partial<PasoRuta>) => set({ ruta: (f.ruta || []).map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const mover = (i: number, d: number) => { const r = [...f.receta]; const j = i + d; if (j < 0 || j >= r.length) return; [r[i], r[j]] = [r[j], r[i]]; set({ receta: r }); };
  const guardarTodo = () => {
    if (!f.nombre.trim()) { setTab("datos"); return toast.error("Falta el nombre."); }
    const ruta = f.ruta || [];
    const c = (e: number) => ruta.filter((x) => x.etapa === e).reduce((a, x) => a + x.costo, 0);
    guardar("productos", { ...f, id: f.id || uid("p-"), nombre: f.nombre.trim(), receta: f.receta.filter((r) => r.materialId && r.cantidad > 0), costoCorte: c(2), costoConfeccion: c(3), costoPersonalizacion: c(4) });
    toast.success("Producto guardado"); onClose();
  };
  const tabs: [TabFicha, string, JSX.Element][] = [["bom", "BOM", <Layers size={14} />], ["ruta", "Ruta de proceso", <Route size={14} />], ...(verCostos ? [["costos", "Costos y precio", <Boxes size={14} />] as [TabFicha, string, JSX.Element]] : []), ["datos", "Datos", <Copy size={14} />]];

  return (
    <Sheet open={!!p} onClose={onClose} width={900}>
      <div className="relative -mx-5 -mt-5 mb-5 overflow-hidden px-5 pb-5 pt-6 text-white sm:-mx-7 sm:px-7" style={{ background: `radial-gradient(120% 120% at 85% 20%, ${f.color}, #121110 70%)` }}>
        {f.foto ? <><img src={f.foto} alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-night via-night/80 to-night/30" /></>
          : <div className="pointer-events-none absolute -right-6 bottom-0 hidden h-56 w-56 sm:block"><Prenda tipo={f.tipoPrenda || tipoDe(f.nombre)} color={f.color} calor={f.categoria === "Calefaccionado"} className="h-full w-full" /></div>}
        <div className="relative">
        <div className="font-mono text-[11px] text-white/60">{f.codigo || "Sin código"} · {f.categoria}</div>
        <h2 className="wide mt-1 pr-10 font-display text-[28px] font-black leading-tight">{f.nombre || "Nuevo producto"}</h2>
        {f.descripcion && <p className="mt-1 max-w-xl text-[13px] text-white/70">{f.descripcion}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Componentes", n0(f.receta.length)], ["Minutos por prenda", n1(b.minutos)], ...(verCostos ? [["Costo por prenda", money(b.total)], ["Margen", b.margen == null ? "—" : Math.round(b.margen * 100) + "%"]] : [])].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur"><div className="text-[10.5px] text-white/60">{l}</div><div className="tnum font-display text-[18px] font-extrabold">{v}</div></div>
          ))}
        </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map(([k, l, ic]) => (
          <button key={k} onClick={() => setTab(k)} className={cx("relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition", tab === k ? "text-bg" : "text-muted hover:text-ink")}>
            {tab === k && <motion.span layoutId="ficha-tab" className="absolute inset-0 -z-0 rounded-xl bg-ink" />}<span className="relative flex items-center gap-1.5">{ic}{l}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          {tab === "bom" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px]"><span className="text-muted">Ver para talle</span>
                  <div className="flex gap-1">{f.talles.map((t) => <button key={t} onClick={() => setTalle(t)} className={cx("h-8 min-w-8 rounded-lg px-2 text-[12px] font-bold transition", talle === t ? "bg-heat text-white" : "bg-surface2 text-ink2 hover:bg-line")}>{t}</button>)}</div>
                  <span className="pill">×{n2(f.ajusteTalle?.[talle] ?? 1)} de consumo</span>
                </div>
                {editar && <button className="btn" disabled={!materiales.length} onClick={() => set({ receta: [...f.receta, { materialId: materiales[0].id, cantidad: 0.1, merma: 5 }] })}><Plus size={15} /> Agregar componente</button>}
              </div>
              <div className="card overflow-x-auto scroll-thin">
                <table className="w-full min-w-[880px]">
                  <thead><tr className="[&>th]:pt-4"><th className="th w-8">#</th><th className="th">Componente</th><th className="th text-right">Por prenda</th><th className="th text-right">Merma %</th><th className="th text-right">Con merma ({talle})</th>{verCostos && <th className="th text-right">Costo</th>}{verCostos && <th className="th w-[120px]">Peso</th>}{editar && <th className="th" />}</tr></thead>
                  <tbody>
                    {b.filas.map((x, i) => (
                      <tr key={i} className="group">
                        <td className="td"><span className="grid h-6 w-6 place-items-center rounded-md text-[11px] font-bold text-white" style={{ background: MAT_COLORS[i % MAT_COLORS.length] }}>{i + 1}</span></td>
                        <td className="td">
                          {editar ? <select className="input min-w-[210px] !py-1.5" value={x.r.materialId} onChange={(e) => setR(i, { materialId: e.target.value })} aria-label="Material">{materiales.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select> : <span className="font-semibold">{x.m?.nombre}</span>}
                          {editar ? <input className="mt-1 w-full bg-transparent text-[11.5px] text-muted outline-none placeholder:text-muted/60" placeholder="Nota (ej: cuerpo y mangas)" value={x.r.nota || ""} onChange={(e) => setR(i, { nota: e.target.value })} /> : x.r.nota && <div className="text-[11.5px] text-muted">{x.r.nota}</div>}
                        </td>
                        <td className="td text-right">{editar ? <div className="flex items-center justify-end gap-1"><input className="input !w-[84px] !py-1.5 text-right tnum" type="number" step="0.001" min="0" value={x.r.cantidad} onChange={(e) => setR(i, { cantidad: +e.target.value })} aria-label="Cantidad" /><span className="w-6 text-[12px] text-muted">{x.m?.unidad}</span></div> : <span className="tnum">{n2(x.r.cantidad)} {x.m?.unidad}</span>}</td>
                        <td className="td text-right">{editar ? <input className="input !w-[70px] !py-1.5 text-right tnum" type="number" min="0" max="50" value={x.r.merma || 0} onChange={(e) => setR(i, { merma: +e.target.value })} aria-label="Merma" /> : <span className="tnum">{x.r.merma || 0}%</span>}</td>
                        <td className="td text-right tnum font-bold">{n2(x.bruto)} {x.m?.unidad}</td>
                        {verCostos && <td className="td text-right tnum">{money(x.costo)}</td>}
                        {verCostos && <td className="td"><div className="h-2 overflow-hidden rounded-full bg-surface2"><motion.div className="h-full rounded-full" style={{ background: MAT_COLORS[i % MAT_COLORS.length] }} initial={{ width: 0 }} animate={{ width: `${b.total ? (x.costo / b.total) * 100 : 0}%` }} /></div><div className="mt-0.5 text-right text-[10.5px] text-muted">{b.total ? Math.round((x.costo / b.total) * 100) : 0}%</div></td>}
                        {editar && <td className="td whitespace-nowrap text-right"><button className="btn-ghost !p-1" onClick={() => mover(i, -1)} aria-label="Subir"><ArrowUp size={14} /></button><button className="btn-ghost !p-1" onClick={() => mover(i, 1)} aria-label="Bajar"><ArrowDown size={14} /></button><button className="btn-ghost !p-1" onClick={() => set({ receta: f.receta.filter((_, j) => j !== i) })} aria-label="Quitar"><X size={14} /></button></td>}
                      </tr>
                    ))}
                    {!b.filas.length && <tr><td className="td text-muted" colSpan={8}>Todavía no hay componentes. Agregá el primero.</td></tr>}
                    {verCostos && b.filas.length > 0 && <tr className="bg-surface2/60"><td className="td" /><td className="td font-bold" colSpan={4}>Total materiales</td><td className="td text-right tnum font-bold">{money(b.mat)}</td><td className="td" colSpan={editar ? 2 : 1} /></tr>}
                  </tbody>
                </table>
              </div>
              <div className="card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="eyebrow">Calcular para una cantidad</div>
                  <div className="flex items-center gap-2 text-[13px]"><input className="input !w-[100px] !py-1.5 tnum" inputMode="numeric" value={cant} onChange={(e) => setCant(+e.target.value.replace(/\D/g, "") || 0)} aria-label="Cantidad de prendas" /> prendas talle {talle}</div></div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{b.filas.map((x, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2 text-[13px]"><span className="truncate">{x.m?.nombre}</span><b className="tnum">{n2(x.bruto * cant)} {x.m?.unidad}</b></div>
                ))}</div>
              </div>
              {editar && (
                <div className="card p-4">
                  <div className="eyebrow mb-2">Ajuste de consumo por talle</div>
                  <p className="mb-3 text-[12.5px] text-muted">Multiplica el consumo de tela de cada talle (1 = talle base). Los avíos por unidad no cambian.</p>
                  <div className="flex flex-wrap gap-2">{f.talles.map((t) => (
                    <label key={t} className="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-[13px]"><b>{t}</b><input className="w-14 bg-transparent text-right tnum outline-none" type="number" step="0.01" value={f.ajusteTalle?.[t] ?? 1} onChange={(e) => set({ ajusteTalle: { ...(f.ajusteTalle || {}), [t]: +e.target.value } })} aria-label={"Ajuste " + t} /></label>
                  ))}</div>
                </div>
              )}
            </div>
          )}

          {tab === "ruta" && (
            <div className="space-y-3">
              <p className="text-[13px] text-muted">Por qué etapas pasa cada prenda, cuánto tarda y cuánto cuesta. Se usa para el costo estándar y para los tiempos.</p>
              <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-0.5 before:bg-line">
                {(f.ruta || []).map((r, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative flex gap-3">
                    <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink font-display text-[14px] font-extrabold text-bg">{r.etapa}</span>
                    <div className="card grid flex-1 gap-3 p-3 sm:grid-cols-[1.2fr_100px_120px_1.6fr]">
                      <div><div className="text-[11px] text-muted">Etapa</div><div className="font-bold">{ETAPAS[r.etapa]}</div></div>
                      <Field label="Minutos">{editar ? <input className="input !py-1.5 tnum" type="number" min="0" step="0.5" value={r.minutos} onChange={(e) => setRuta(i, { minutos: +e.target.value })} /> : <span className="tnum font-semibold">{n1(r.minutos)}</span>}</Field>
                      {verCostos ? <Field label="Costo ($)">{editar ? <input className="input !py-1.5 tnum" inputMode="numeric" value={r.costo} onChange={(e) => setRuta(i, { costo: +e.target.value.replace(/\D/g, "") || 0 })} /> : <span className="tnum font-semibold">{money(r.costo)}</span>}</Field> : <div />}
                      <Field label="Instrucción">{editar ? <input className="input !py-1.5" value={r.nota} onChange={(e) => setRuta(i, { nota: e.target.value })} /> : <span className="text-[13px]">{r.nota || "—"}</span>}</Field>
                    </div>
                  </motion.li>
                ))}
              </ol>
              <div className="flex justify-between rounded-xl bg-surface2 px-4 py-3 text-[13px]"><span>Tiempo total por prenda</span><b className="tnum">{n1(b.minutos)} min · {n1((b.minutos * 100) / 60)} h cada 100 prendas</b></div>
            </div>
          )}

          {tab === "costos" && verCostos && (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="eyebrow mb-3">De dónde sale el costo (talle {talle})</div>
                {[...b.filas.map((x, i) => ({ l: x.m?.nombre || "", v: x.costo, c: MAT_COLORS[i % MAT_COLORS.length] })), ...(f.ruta || []).filter((r) => r.costo).map((r) => ({ l: "Mano de obra · " + ETAPAS[r.etapa], v: r.costo, c: "#7D776F" }))].map((x, i, arr) => {
                  const acc = arr.slice(0, i).reduce((a, y) => a + y.v, 0);
                  return (
                    <div key={i} className="grid grid-cols-[minmax(0,180px)_1fr_90px] items-center gap-3 py-1 text-[12.5px]">
                      <span className="truncate">{x.l}</span>
                      <div className="relative h-5 rounded bg-surface2"><motion.div className="absolute top-0 h-5 rounded" style={{ background: x.c, left: `${(acc / b.total) * 100}%` }} initial={{ width: 0 }} animate={{ width: `${(x.v / b.total) * 100}%` }} transition={{ delay: i * 0.06 }} /></div>
                      <span className="tnum text-right">{money(x.v)}</span>
                    </div>
                  );
                })}
                <div className="mt-2 grid grid-cols-[minmax(0,180px)_1fr_90px] items-center gap-3 border-t border-line pt-2 text-[13px] font-bold"><span>Costo total</span><span /><span className="tnum text-right">{money(b.total)}</span></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Precio de venta ($)"><input className="input tnum" inputMode="numeric" value={f.precioVenta} onChange={(e) => set({ precioVenta: +e.target.value.replace(/\D/g, "") || 0 })} disabled={!editar} /></Field>
                <div className="card p-3"><div className="text-[11px] text-muted">Ganancia por prenda</div><div className="tnum font-display text-[20px] font-extrabold">{money(f.precioVenta - b.total)}</div></div>
                <div className="card p-3"><div className="text-[11px] text-muted">Margen</div><div className={cx("tnum font-display text-[20px] font-extrabold", (b.margen ?? 0) < 0.3 && "text-heat")}>{b.margen == null ? "—" : Math.round(b.margen * 100) + "%"}</div></div>
              </div>
            </div>
          )}

          {tab === "datos" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line p-4">
                <div className="relative grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: `radial-gradient(circle at 70% 30%, ${f.color}, #121110 80%)` }}>
                  {f.foto ? <img src={f.foto} alt="" className="h-full w-full object-cover" /> : <Prenda tipo={f.tipoPrenda || tipoDe(f.nombre)} color={f.color} className="h-24 w-24" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold">Foto del producto</div>
                  <div className="text-[12px] text-muted">Se ve en el catálogo y en las órdenes. Si no hay foto, se muestra el dibujo de la prenda.</div>
                  {editar && <div className="mt-3 flex flex-wrap gap-2">
                    <label className="btn cursor-pointer"><Camera size={15} /> {f.foto ? "Cambiar foto" : "Subir foto"}<input type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) { try { set({ foto: await fotoADataUrl(file) }); toast.success("Foto cargada. Guardá el producto para que quede."); } catch { toast.error("No se pudo leer esa imagen."); } } e.target.value = ""; }} /></label>
                    {f.foto && <button className="btn-ghost" onClick={() => set({ foto: undefined })}><ImageOff size={15} /> Quitar</button>}
                    <select className="input !w-auto !py-2" value={f.tipoPrenda || tipoDe(f.nombre)} onChange={(e) => set({ tipoPrenda: e.target.value as Producto["tipoPrenda"] })} aria-label="Dibujo de la prenda"><option value="remera">Dibujo: remera</option><option value="buzo">Dibujo: buzo</option><option value="chaleco">Dibujo: chaleco</option><option value="campera">Dibujo: campera</option></select>
                  </div>}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Nombre"><input className="input" value={f.nombre} onChange={(e) => set({ nombre: e.target.value })} disabled={!editar} autoFocus={!f.id} /></Field>
                <Field label="Código"><input className="input font-mono" value={f.codigo || ""} onChange={(e) => set({ codigo: e.target.value.toUpperCase() })} disabled={!editar} placeholder="WW-REM-01" /></Field>
                <Field label="Categoría"><select className="input" value={f.categoria} onChange={(e) => set({ categoria: e.target.value })} disabled={!editar}>{[...new Set([...config.categorias, f.categoria])].map((c) => <option key={c}>{c}</option>)}</select></Field>
              </div>
              <Field label="Descripción"><textarea className="input min-h-[70px]" value={f.descripcion || ""} onChange={(e) => set({ descripcion: e.target.value })} disabled={!editar} /></Field>
              <div>
                <div className="label mb-2">Talles</div>
                <div className="flex flex-wrap gap-1.5">{[...new Set([...config.tallesEstandar, ...f.talles])].map((t) => { const on = f.talles.includes(t); return (
                  <button key={t} type="button" disabled={!editar} onClick={() => set({ talles: on ? f.talles.filter((x) => x !== t) : config.tallesEstandar.filter((x) => x === t || f.talles.includes(x)), ajusteTalle: { ...(f.ajusteTalle || {}), [t]: f.ajusteTalle?.[t] ?? 1 } })} className={cx("h-9 min-w-10 rounded-xl border px-3 text-[13px] font-bold transition", on ? "border-heat bg-heat text-white" : "border-line text-muted hover:border-muted")}>{t}</button>
                ); })}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Personalización habitual"><select className="input" value={f.personalizacion} onChange={(e) => set({ personalizacion: e.target.value })} disabled={!editar}>{["", "Bordado", "Estampado", "Sublimado"].map((x) => <option key={x} value={x}>{x || "Ninguna"}</option>)}</select></Field>
                <Field label="Color en el sistema"><div className="flex gap-2 pt-1">{COLORES.map((c) => <button type="button" key={c} disabled={!editar} onClick={() => set({ color: c })} className={cx("h-8 w-8 rounded-full ring-offset-2 ring-offset-bg transition", f.color === c && "ring-2 ring-heat")} style={{ background: c }} aria-label={"Color " + c} />)}</div></Field>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {editar && (
        <div className="sticky bottom-0 -mx-5 mt-6 flex flex-wrap items-center gap-2 border-t border-line bg-bg/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:px-7">
          <button className="btn-heat" onClick={guardarTodo}>Guardar producto</button>
          {f.id && <button className="btn" onClick={() => { const c = { ...f, id: uid("p-"), nombre: f.nombre + " (copia)", codigo: (f.codigo || "") + "-B", ejemplo: false }; guardar("productos", c); toast.success("Producto duplicado"); onClose(); }}><Copy size={15} /> Duplicar</button>}
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          {f.id && can(rol, "eliminar") && (borrar ? <button className="btn ml-auto !border-heat !text-heat" onClick={() => { eliminar("productos", f.id); toast.success("Producto eliminado"); onClose(); }}>Sí, eliminar</button> : <button className="btn-ghost ml-auto" onClick={() => setBorrar(true)}><Trash2 size={15} /> Eliminar</button>)}
        </div>
      )}
    </Sheet>
  );
}

function EditarMaterial({ m, onClose }: { m: Material | null; onClose: () => void }) {
  const { guardar, eliminar } = useStore();
  const rol = useRol();
  const [f, setF] = useState<Material | null>(null);
  const [borrar, setBorrar] = useState(false);
  useEffect(() => { setF(m ? { ...m } : null); setBorrar(false); }, [m]);
  return (
    <Sheet open={!!m} onClose={onClose} width={480}>
      {f && (<>
        <div className="eyebrow">Materiales</div>
        <h2 className="wide mt-1.5 font-display text-[24px] font-extrabold">{f.id ? "Editar material" : "Nuevo material"}</h2>
        <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); if (!f.nombre.trim()) return toast.error("Falta el nombre."); guardar("materiales", { ...f, id: f.id || uid("m-"), nombre: f.nombre.trim() }); toast.success("Material guardado"); onClose(); }}>
          <Field label="Nombre"><input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Unidad"><select className="input" value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value as Unidad })}><option value="kg">kg</option><option value="m">metros</option><option value="u">unidades</option></select></Field>
            {can(rol, "verCostos") && <Field label="Costo por unidad ($)"><input className="input tnum" inputMode="numeric" value={f.costo} onChange={(e) => setF({ ...f, costo: +e.target.value.replace(/\D/g, "") || 0 })} /></Field>}
          </div>
          <Field label="Proveedor"><input className="input" value={f.proveedor} onChange={(e) => setF({ ...f, proveedor: e.target.value })} /></Field>
          <div className="flex flex-wrap gap-2 pt-2">
            <button className="btn-heat" type="submit">Guardar</button><button className="btn-ghost" type="button" onClick={onClose}>Cancelar</button>
            {f.id && can(rol, "eliminar") && (borrar ? <button type="button" className="btn ml-auto !border-heat !text-heat" onClick={() => { eliminar("materiales", f.id); toast.success("Material eliminado"); onClose(); }}>Sí, eliminar</button> : <button type="button" className="btn-ghost ml-auto" onClick={() => setBorrar(true)}><Trash2 size={15} /> Eliminar</button>)}
          </div>
        </form>
      </>)}
    </Sheet>
  );
}
