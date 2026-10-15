import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Bell, Building2, Database, Download, Eraser, Factory, Info, MapPin, MessageCircle, Monitor, Moon, Palette, Plug, Plus, ReceiptText,
  RefreshCw, Sparkles, Sun, Tags, Trash2, Upload, Users, X,
} from "lucide-react";
import { Field, Page, PageHead, cx } from "../components/ui";
import { useStore } from "../store/useStore";
import { remote } from "../lib/supabase";
import { today, uid } from "../lib/format";
import type { Config } from "../lib/types";
import { NAV } from "../components/Layout";

type Sec = "empresa" | "produccion" | "alertas" | "lugares" | "catalogo" | "integraciones" | "apariencia" | "equipo" | "datos" | "acerca";
const SECS: [Sec, string, ReactNode][] = [
  ["empresa", "Empresa", <Building2 size={16} />], ["produccion", "Producción", <Factory size={16} />], ["alertas", "Alertas y avisos", <Bell size={16} />],
  ["lugares", "Lugares y logística", <MapPin size={16} />], ["catalogo", "Listas del sistema", <Tags size={16} />], ["integraciones", "Integraciones", <Plug size={16} />],
  ["apariencia", "Apariencia", <Palette size={16} />], ["equipo", "Equipo y permisos", <Users size={16} />], ["datos", "Datos y copias", <Database size={16} />], ["acerca", "Acerca de", <Info size={16} />],
];

function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-center gap-4 rounded-xl px-1 py-2.5 text-left">
      <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold">{label}</div>{desc && <div className="text-[12px] text-muted">{desc}</div>}</div>
      <span className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-heat" : "bg-line")}>
        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow", on ? "right-0.5" : "left-0.5")} />
      </span>
    </button>
  );
}
function Bloque({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return <section className="card p-5"><h3 className="font-display text-[15px] font-bold">{title}</h3>{desc && <p className="mt-0.5 text-[12.5px] text-muted">{desc}</p>}<div className="mt-4">{children}</div></section>;
}
function Chips({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence>{items.map((x) => (
          <motion.span layout key={x} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="pill !py-1 !pr-1">{x}<button onClick={() => onChange(items.filter((y) => y !== x))} className="rounded-full p-0.5 hover:bg-line" aria-label={"Quitar " + x}><X size={12} /></button></motion.span>
        ))}</AnimatePresence>
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = v.trim(); if (t && !items.includes(t)) onChange([...items, t]); setV(""); }}>
        <input className="input !py-2" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} /><button className="btn" type="submit"><Plus size={15} /> Agregar</button>
      </form>
    </div>
  );
}

export default function Ajustes() {
  const s = useStore();
  const c = s.config;
  const [sec, setSec] = useState<Sec>("empresa");
  const [confirm, setConfirm] = useState<"" | "borrar" | "demo">("");
  const file = useRef<HTMLInputElement>(null);
  const ejemplos = [...s.ordenes, ...s.viajes, ...s.productos, ...s.materiales, ...s.talleres].filter((x) => x.ejemplo).length;
  const up = <K extends keyof Config>(k: K, patch: Partial<Config[K]>) => { s.setConfig(k, { ...(c[k] as object), ...patch } as Config[K]); };
  const ok = () => toast.success("Guardado", { duration: 1200 });

  const exportar = () => {
    const data = { version: 2, exportado: today(), config: s.config, usuarios: s.usuarios, materiales: s.materiales, productos: s.productos, talleres: s.talleres, ordenes: s.ordenes, viajes: s.viajes, procesos: s.procesos };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `wanderwarm-produccion-${today()}.json`; a.click(); URL.revokeObjectURL(url);
    toast.success("Copia descargada");
  };
  const exportarCSV = () => {
    const rows = [["orden", "tipo", "cliente", "factura", "etapa", "prendas", "creada", "entrega", "finalizada"], ...s.ordenes.map((o) => [o.numero, o.tipo, o.cliente, o.factura, o.etapa, o.lineas.reduce((a, l) => a + l.cantidad, 0), o.creada, o.fechaEntrega, o.fechaFin || ""])];
    const csv = "﻿" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `ordenes-${today()}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success("Planilla de órdenes descargada");
  };
  const importar = async (f: File) => {
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.ordenes)) throw new Error();
      s.hydrateRemote({ usuarios: d.usuarios || s.usuarios, materiales: d.materiales || [], productos: d.productos || [], talleres: d.talleres || [], ordenes: d.ordenes, viajes: d.viajes || [], procesos: d.procesos || s.procesos } as never);
      if (d.config) s.hydrateRemote({ config: d.config } as never);
      toast.success("Datos importados");
    } catch { toast.error("Ese archivo no es una copia válida del sistema."); }
  };

  return (
    <Page>
      <PageHead eyebrow="Ajustes" title="Configuración del sistema" />
      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        <nav className="flex gap-1 overflow-x-auto pb-1 scroll-thin lg:sticky lg:top-4 lg:flex-col lg:self-start lg:overflow-visible">
          {SECS.map(([k, l, ic]) => (
            <button key={k} onClick={() => setSec(k)} className={cx("relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-colors", sec === k ? "text-bg" : "text-muted hover:bg-surface2 hover:text-ink")}>
              {sec === k && <motion.span layoutId="aj-tab" className="absolute inset-0 rounded-xl bg-ink" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <span className="relative flex items-center gap-2.5">{ic}{l}</span>
            </button>
          ))}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div key={sec} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="min-w-0 space-y-4">
            {sec === "empresa" && (
              <Bloque title="Datos de la empresa" desc="Aparecen en remitos, exportaciones y en los avisos.">
                <div className="grid gap-3 sm:grid-cols-2">
                  {([["nombre", "Nombre comercial"], ["razonSocial", "Razón social"], ["cuit", "CUIT"], ["telefono", "Teléfono"], ["email", "Mail"], ["direccion", "Dirección"]] as [keyof Config["empresa"], string][]).map(([k, l]) => (
                    <Field key={k} label={l}><input className="input" value={c.empresa[k]} onChange={(e) => up("empresa", { [k]: e.target.value })} onBlur={ok} /></Field>
                  ))}
                </div>
              </Bloque>
            )}

            {sec === "produccion" && (<>
              <Bloque title="Metas e indicadores" desc="Definen cuándo algo se marca en rojo en el tablero.">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Meta de fallas (%)" hint="Arriba de esto, el taller se marca en rojo."><input className="input tnum" type="number" min="0" step="0.5" value={c.produccion.metaFallas} onChange={(e) => up("produccion", { metaFallas: +e.target.value })} /></Field>
                  <Field label="Avisar entregas a (días)" hint="Órdenes que vencen dentro de este plazo."><input className="input tnum" type="number" min="1" value={c.produccion.diasAlerta} onChange={(e) => up("produccion", { diasAlerta: +e.target.value })} /></Field>
                  <Field label="Alerta de capacidad (%)" hint="Uso semanal de un taller."><input className="input tnum" type="number" min="10" max="150" value={c.produccion.capacidadAlerta} onChange={(e) => up("produccion", { capacidadAlerta: +e.target.value })} /></Field>
                </div>
              </Bloque>
              <Bloque title="Órdenes">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Plazo de entrega por defecto (días)"><input className="input tnum" type="number" min="1" value={c.produccion.plazoDefault} onChange={(e) => up("produccion", { plazoDefault: +e.target.value })} /></Field>
                  <Field label="Prefijo de numeración"><input className="input font-mono" value={c.produccion.prefijoOrden} onChange={(e) => up("produccion", { prefijoOrden: e.target.value })} /></Field>
                </div>
                <div className="mt-3 divide-y divide-line">
                  <Toggle on={c.produccion.requiereCalidad} onChange={(v) => up("produccion", { requiereCalidad: v })} label="Exigir control de calidad" desc="No se puede pasar a empaquetado sin cargar el control." />
                  <Toggle on={c.produccion.permitirSaltarEtapas} onChange={(v) => up("produccion", { permitirSaltarEtapas: v })} label="Permitir saltar etapas" desc="Por ejemplo, una orden sin personalización puede ir de confección a calidad." />
                </div>
              </Bloque>
            </>)}

            {sec === "alertas" && (<>
              <Bloque title="Qué avisos recibir">
                <div className="divide-y divide-line">
                  <Toggle on={c.alertas.atrasadas} onChange={(v) => up("alertas", { atrasadas: v })} label="Órdenes atrasadas" desc="Cuando una orden pasa su fecha de entrega." />
                  <Toggle on={c.alertas.fallas} onChange={(v) => up("alertas", { fallas: v })} label="Fallas sobre la meta" desc="Cuando un taller supera la meta de fallas." />
                  <Toggle on={c.alertas.entregas} onChange={(v) => up("alertas", { entregas: v })} label="Entregas de talleres" desc="Cada vez que un taller informa una entrega." />
                  <Toggle on={c.alertas.capacidad} onChange={(v) => up("alertas", { capacidad: v })} label="Taller cerca del límite" desc="Cuando un taller pasa la alerta de capacidad." />
                  <Toggle on={c.alertas.resumenDiario} onChange={(v) => up("alertas", { resumenDiario: v })} label="Resumen diario" desc="Indicadores del día anterior y lo que vence." />
                </div>
              </Bloque>
              <Bloque title="Cómo y a quién" desc="Los avisos por mail y WhatsApp se activan al conectar el sistema en la nube.">
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {([["app", "En el sistema", <Monitor size={16} />], ["mail", "Por mail", <Bell size={16} />], ["whatsapp", "Por WhatsApp", <MessageCircle size={16} />]] as const).map(([k, l, ic]) => (
                    <button key={k} onClick={() => up("alertas", { canal: k })} className={cx("flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[12.5px] font-semibold transition", c.alertas.canal === k ? "border-heat bg-heat/5 text-heat" : "border-line text-muted hover:border-muted")}>{ic}{l}</button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                  <Field label="Hora del resumen"><input className="input" type="time" value={c.alertas.horaResumen} onChange={(e) => up("alertas", { horaResumen: e.target.value })} /></Field>
                  <Field label="Destinatarios" hint="Mails o teléfonos, separados por coma."><input className="input" value={c.alertas.destinatarios} onChange={(e) => up("alertas", { destinatarios: e.target.value })} onBlur={ok} /></Field>
                </div>
              </Bloque>
            </>)}

            {sec === "lugares" && (
              <Bloque title="Lugares propios" desc="Además de los talleres, a dónde va y vuelve la camioneta. Los km se usan para estimar el recorrido.">
                <div className="space-y-2">
                  {c.lugares.map((l, i) => (
                    <motion.div layout key={l.id} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_130px_1.3fr_90px_36px]">
                      <input className="input !py-2" value={l.nombre} onChange={(e) => s.setConfig("lugares", c.lugares.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} aria-label="Nombre" />
                      <select className="input !py-2" value={l.tipo} onChange={(e) => s.setConfig("lugares", c.lugares.map((x, j) => (j === i ? { ...x, tipo: e.target.value as typeof l.tipo } : x)))} aria-label="Tipo"><option value="propio">Propio</option><option value="proveedor">Proveedor</option><option value="cliente">Cliente</option></select>
                      <input className="input !py-2" placeholder="Dirección" value={l.direccion} onChange={(e) => s.setConfig("lugares", c.lugares.map((x, j) => (j === i ? { ...x, direccion: e.target.value } : x)))} aria-label="Dirección" />
                      <input className="input !py-2 tnum" type="number" min="0" value={l.kmDesdeFabrica} onChange={(e) => s.setConfig("lugares", c.lugares.map((x, j) => (j === i ? { ...x, kmDesdeFabrica: +e.target.value } : x)))} aria-label="Km desde fábrica" title="Km desde la fábrica" />
                      <button className="btn-ghost !px-2" disabled={l.nombre === "Fábrica"} onClick={() => s.setConfig("lugares", c.lugares.filter((_, j) => j !== i))} aria-label="Quitar"><Trash2 size={15} /></button>
                    </motion.div>
                  ))}
                  <button className="btn" onClick={() => s.setConfig("lugares", [...c.lugares, { id: uid("l-"), nombre: "Nuevo lugar", tipo: "proveedor", direccion: "", kmDesdeFabrica: 0 }])}><Plus size={15} /> Agregar lugar</button>
                </div>
                <p className="mt-3 text-[12px] text-muted">Los talleres se administran desde <Link to="/talleres" className="font-semibold text-heat">Talleres</Link>.</p>
              </Bloque>
            )}

            {sec === "catalogo" && (<>
              <Bloque title="Motivos de falla" desc="Las opciones al cargar un control de calidad."><Chips items={c.motivosFalla} onChange={(v) => s.setConfig("motivosFalla", v)} placeholder="Nuevo motivo" /></Bloque>
              <Bloque title="Categorías de producto"><Chips items={c.categorias} onChange={(v) => s.setConfig("categorias", v)} placeholder="Nueva categoría" /></Bloque>
              <Bloque title="Talles estándar" desc="El orden de esta lista es el orden en que se muestran."><Chips items={c.tallesEstandar} onChange={(v) => s.setConfig("tallesEstandar", v)} placeholder="Ej: 3XL" /></Bloque>
            </>)}

            {sec === "integraciones" && (
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { ic: <Database size={18} />, t: "Base de datos en la nube", d: "Supabase: todo el equipo ve lo mismo en vivo, con permisos por rol.", on: remote.enabled, extra: !remote.enabled && <p className="text-[12px] text-muted">Seguí el README: correr <code className="font-mono">supabase/schema.sql</code> y completar el <code className="font-mono">.env</code>.</p> },
                  { ic: <Sparkles size={18} />, t: "Asistente con Claude", d: "Entiende cualquier mensaje y lee fotos de remitos y planillas.", on: remote.enabled, extra: <p className="text-[12px] text-muted">{remote.enabled ? "Necesita la función 'asistente' desplegada con la clave de Anthropic." : "En modo demo, el asistente entiende frases comunes."}</p> },
                  { ic: <ReceiptText size={18} />, t: "Facturación (ARCA)", d: "Conectar con el sistema de facturas de Stoka para que cada venta facturada cree su orden sola.", on: c.integraciones.facturacion, toggle: (v: boolean) => up("integraciones", { facturacion: v }), extra: <span className="pill-warn">Fase 3</span> },
                  { ic: <MessageCircle size={18} />, t: "WhatsApp", d: "Que talleres y chofer carguen y consulten por WhatsApp.", on: c.integraciones.whatsapp, toggle: (v: boolean) => up("integraciones", { whatsapp: v }), extra: <Field label="Número de la empresa"><input className="input !py-2" placeholder="+54 9 261 ..." value={c.integraciones.whatsappNumero} onChange={(e) => up("integraciones", { whatsappNumero: e.target.value })} /></Field> },
                  { ic: <Bell size={18} />, t: "Mail al contador", d: "Envío mensual de órdenes y costos.", on: !!c.integraciones.mailContador, extra: <Field label="Mail"><input className="input !py-2" type="email" value={c.integraciones.mailContador} onChange={(e) => up("integraciones", { mailContador: e.target.value })} /></Field> },
                ].map((x) => (
                  <motion.div layout key={x.t} className="card p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface2">{x.ic}</span>
                      <div className="min-w-0 flex-1"><div className="font-bold">{x.t}</div><div className="text-[12.5px] text-muted">{x.d}</div></div>
                      {x.toggle ? <button onClick={() => x.toggle!(!x.on)} className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", x.on ? "bg-heat" : "bg-line")} aria-label={x.t}><motion.span layout className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow", x.on ? "right-0.5" : "left-0.5")} /></button>
                        : <span className={x.on ? "pill-ok" : "pill"}>{x.on ? "Conectado" : "No conectado"}</span>}
                    </div>
                    {x.extra && <div className="mt-3">{x.extra}</div>}
                  </motion.div>
                ))}
              </div>
            )}

            {sec === "apariencia" && (<>
              <Bloque title="Tema">
                <div className="grid grid-cols-2 gap-3">
                  {([["claro", "Claro", <Sun size={18} />], ["oscuro", "Oscuro", <Moon size={18} />]] as const).map(([k, l, ic]) => (
                    <button key={k} onClick={() => s.setTema(k)} className={cx("overflow-hidden rounded-2xl border-2 text-left transition", s.tema === k ? "border-heat" : "border-line hover:border-muted")}>
                      <div className={cx("flex h-20 gap-2 p-3", k === "claro" ? "bg-[#EFECE7]" : "bg-[#141312]")}><div className="w-6 rounded bg-[#0D0C0B]" /><div className="flex flex-1 flex-col gap-1.5"><div className={cx("h-3 w-2/3 rounded", k === "claro" ? "bg-white" : "bg-[#232220]")} /><div className={cx("h-8 rounded", k === "claro" ? "bg-white" : "bg-[#1C1B1A]")} /></div></div>
                      <div className="flex items-center gap-2 px-3 py-2 text-[13px] font-semibold">{ic}{l}</div>
                    </button>
                  ))}
                </div>
              </Bloque>
              <Bloque title="Pantalla">
                <div className="divide-y divide-line">
                  <Toggle on={c.apariencia.animaciones} onChange={(v) => up("apariencia", { animaciones: v })} label="Animaciones" desc="Apagalas si la compu es lenta." />
                  <Toggle on={c.apariencia.densidad === "compacta"} onChange={(v) => up("apariencia", { densidad: v ? "compacta" : "comoda" })} label="Vista compacta" desc="Entra más información en pantalla." />
                </div>
                <div className="mt-3 max-w-xs"><Field label="Pantalla de inicio (Dirección)"><select className="input" value={c.apariencia.inicio} onChange={(e) => up("apariencia", { inicio: e.target.value })}>{NAV.filter((n) => n.roles.includes("direccion")).map((n) => <option key={n.to} value={n.to}>{n.label}</option>)}</select></Field></div>
              </Bloque>
            </>)}

            {sec === "equipo" && (
              <Bloque title="Equipo y permisos" desc="Quién entra al sistema y qué puede hacer cada rol.">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(["direccion", "produccion", "taller", "chofer"] as const).map((r) => (
                    <div key={r} className="rounded-xl bg-surface2 p-3"><div className="tnum font-display text-[24px] font-extrabold">{s.usuarios.filter((u) => u.rol === r && u.activo).length}</div><div className="text-[12px] capitalize text-muted">{r === "direccion" ? "Dirección" : r === "produccion" ? "Producción" : r}</div></div>
                  ))}
                </div>
                <Link to="/equipo" className="btn-ink mt-4"><Users size={15} /> Administrar el equipo</Link>
              </Bloque>
            )}

            {sec === "datos" && (<>
              <Bloque title="Dónde se guardan los datos">
                <div className="flex items-center gap-3"><span className={remote.enabled ? "pill-ok" : "pill-warn"}>{remote.enabled ? "En la nube (Supabase)" : "En este navegador (demo)"}</span></div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[["Órdenes", s.ordenes.length], ["Viajes", s.viajes.length], ["Productos", s.productos.length], ["Talleres", s.talleres.length], ["Procesos", s.procesos.length]].map(([l, n]) => (
                    <div key={l as string} className="rounded-xl bg-surface2 p-3"><div className="tnum font-display text-[22px] font-extrabold">{n}</div><div className="text-[12px] text-muted">{l}</div></div>
                  ))}
                </div>
              </Bloque>
              <Bloque title="Copias de seguridad" desc="Descargá todo en un archivo o las órdenes en una planilla para Excel.">
                <div className="flex flex-wrap gap-2">
                  <button className="btn" onClick={exportar}><Download size={15} /> Copia completa (.json)</button>
                  <button className="btn" onClick={exportarCSV}><Download size={15} /> Órdenes en planilla (.csv)</button>
                  {!remote.enabled && <><button className="btn" onClick={() => file.current?.click()}><Upload size={15} /> Importar copia</button><input ref={file} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} /></>}
                </div>
              </Bloque>
              <Bloque title="Datos de ejemplo" desc={`Hay ${ejemplos} registros de ejemplo. Borralos cuando empiecen a cargar los reales.`}>
                <div className="flex flex-wrap gap-2">
                  {confirm === "borrar"
                    ? <><button className="btn !border-heat !text-heat" onClick={() => { s.borrarEjemplos(); setConfirm(""); toast.success("Datos de ejemplo borrados"); }}><Eraser size={15} /> Sí, borrar {ejemplos}</button><button className="btn-ghost" onClick={() => setConfirm("")}>Cancelar</button></>
                    : <button className="btn" disabled={!ejemplos} onClick={() => setConfirm("borrar")}><Eraser size={15} /> Borrar datos de ejemplo</button>}
                  {!remote.enabled && (confirm === "demo"
                    ? <><button className="btn !border-heat !text-heat" onClick={() => { s.restaurarDemo(); setConfirm(""); toast.success("Demo reiniciada"); }}><RefreshCw size={15} /> Sí, reiniciar</button><button className="btn-ghost" onClick={() => setConfirm("")}>Cancelar</button></>
                    : <button className="btn" onClick={() => setConfirm("demo")}><RefreshCw size={15} /> Reiniciar la demo</button>)}
                </div>
              </Bloque>
            </>)}

            {sec === "acerca" && (
              <section className="card overflow-hidden">
                <div className="bg-night p-6 text-white"><div className="wide font-display text-[22px] font-black">Sistema de producción Wanderwarm</div><div className="text-[13px] text-white/60">Versión 2.0 · {remote.enabled ? "Nube" : "Demo"}</div></div>
                <div className="space-y-2 p-5 text-[13.5px]">
                  <p>Desarrollado por <b>Stoka Software</b> para {c.empresa.nombre}.</p>
                  <p className="text-muted">Incluye: órdenes por etapa, BOM con merma, estándares de procesos, calidad por taller, logística, asistente y roles.</p>
                  <p className="text-muted">Soporte y mantenimiento incluidos en el abono mensual.</p>
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Page>
  );
}
