import { animate, AnimatePresence, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { Ridge, Topo } from "./Brand";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import clsx from "clsx";
import { W_PATH, W_VIEWBOX } from "../lib/logo";
import type { Orden } from "../lib/types";
import { ETAPAS } from "../lib/types";
import { atrasada, venceProntoDias } from "../lib/metrics";
import { fdate, initials } from "../lib/format";

export const cx = clsx;

export function Logo({ className = "", animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox={W_VIEWBOX} className={className} aria-label="Wanderwarm" role="img">
      {animated ? (
        <motion.path d={W_PATH} fill="currentColor" stroke="currentColor" strokeWidth={6}
          initial={{ pathLength: 0, fillOpacity: 0 }} animate={{ pathLength: 1, fillOpacity: 1 }}
          transition={{ pathLength: { duration: 1.4, ease: "easeInOut" }, fillOpacity: { delay: 1, duration: 0.6 } }} />
      ) : <path d={W_PATH} fill="currentColor" />}
    </svg>
  );
}

/** Número que cuenta hasta su valor cuando aparece en pantalla. */
export function AnimatedNumber({ value, decimals = 0, className = "" }: { value: number | null; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const txt = useTransform(mv, (v) => v.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  useEffect(() => {
    if (!inView || value == null) return;
    const c = animate(mv, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [inView, value]);
  if (value == null) return <span className={className}>—</span>;
  return <motion.span ref={ref} className={cx("tnum", className)}>{txt}</motion.span>;
}

export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
export const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 26 } } };

export function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-28">
      {children}
    </motion.div>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="relative mb-7">
      <Topo fade className="-right-10 -top-16 h-64 w-[620px] max-w-full bg-ink/[.09] dark:bg-white/[.07]" size={440} />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-2 text-balance font-display text-[30px] font-black leading-[1] tracking-[-0.01em] sm:text-[40px]" style={{ fontStretch: "118%" }}>{title}</h1>
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
      <Ridge className="relative mt-5 h-5 w-full text-line" />
    </div>
  );
}

export function Kpi({ label, value, decimals = 0, suffix, sub, alert, icon }: { label: string; value: number | null; decimals?: number; suffix?: string; sub?: ReactNode; alert?: boolean; icon?: ReactNode }) {
  return (
    <motion.div variants={rise} whileHover={{ y: -4 }} className={cx("card group overflow-hidden p-4 sm:p-5", alert && "!border-heat/50")}>
      <div className={cx("pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100", alert ? "bg-heat/25" : "bg-ember/20")} />
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-[3px]", alert ? "bg-gradient-to-r from-heat to-ember" : "bg-gradient-to-r from-transparent via-line to-transparent")} />
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon && <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-lg", alert ? "bg-heat text-white" : "bg-surface2 text-ink2 ring-1 ring-line")}>{icon}</span>}
          <span className="text-[12.5px] font-semibold leading-tight text-muted">{label}</span>
        </div>
        {alert && <span className="h-2 w-2 shrink-0 animate-pulseheat rounded-full bg-heat" />}
      </div>
      <div className={cx("wide relative mt-4 font-display text-[34px] font-extrabold leading-none tracking-tight", alert && "text-heat")}>
        <AnimatedNumber value={value} decimals={decimals} />
        {suffix && value != null && <span className="ml-1 text-[15px] font-semibold text-muted">{suffix}</span>}
      </div>
      {sub && <div className="relative mt-2.5 border-t border-dashed border-line pt-2 text-[12px] text-muted">{sub}</div>}
    </motion.div>
  );
}

export function Sheet({ open, onClose, children, width = 600 }: { open: boolean; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <motion.div className="absolute inset-0 bg-night/50 backdrop-blur-[2px]" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside role="dialog" aria-modal="true" style={{ width: `min(${width}px, 100%)` }}
            className="relative h-full overflow-y-auto bg-bg px-5 pb-10 pt-5 shadow-2xl scroll-thin sm:px-7"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}>
            <button className="btn-ghost absolute right-4 top-4 !px-2" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-surface2"><Logo className="w-7 text-muted" /></div>
      <div className="font-display text-[16px] font-bold">{title}</div>
      {children && <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stepper({ etapa }: { etapa: number }) {
  return (
    <div className="flex gap-1" aria-label={`Etapa ${ETAPAS[etapa]}`}>
      {[1, 2, 3, 4, 5, 6, 7].map((e) => (
        <div key={e} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          {e <= etapa && (
            <motion.div className={cx("absolute inset-0 rounded-full", e === etapa && etapa < 7 ? "bg-heat" : "bg-ink")}
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 0 }} transition={{ delay: e * 0.05, duration: 0.4 }} />
          )}
        </div>
      ))}
    </div>
  );
}

export function Bar({ pct, heat = false, delay = 0 }: { pct: number; heat?: boolean; delay?: number }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-surface2 ring-1 ring-inset ring-line">
      <motion.div className={cx("h-full rounded-full", heat ? "bg-gradient-to-r from-ember to-heat" : "bg-ink")}
        initial={{ width: 0 }} whileInView={{ width: `${Math.max(0, Math.min(100, pct))}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }} />
    </div>
  );
}

export function Avatar({ name, color, size = 32 }: { name: string; color?: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.38, background: color || "#121110" }}>
      {initials(name)}
    </span>
  );
}

export function EstadoOrden({ o }: { o: Orden }) {
  if (o.etapa === 7) return <span className="pill-ok">Finalizada {fdate(o.fechaFin)}</span>;
  if (atrasada(o)) return <span className="pill-heat">Atrasada · {fdate(o.fechaEntrega)}</span>;
  if (venceProntoDias(o) <= 5) return <span className="pill-warn">Vence {fdate(o.fechaEntrega)}</span>;
  return <span className="pill">Entrega {fdate(o.fechaEntrega)}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-muted">{hint}</span>}
    </label>
  );
}

export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="relative inline-flex rounded-xl border border-line bg-surface p-1">
      {options.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={cx("relative z-10 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors", value === k ? "text-bg" : "text-muted hover:text-ink")}>
          {value === k && <motion.span layoutId={"seg-" + options.map((o) => o[0]).join()} className="absolute inset-0 -z-10 rounded-lg bg-ink" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
          {l}
        </button>
      ))}
    </div>
  );
}

/** Paginación simple para listas largas. */
export function usePagina<T>(items: T[], porPagina = 10) {
  const [pagina, setPagina] = useState(1);
  const total = Math.max(1, Math.ceil(items.length / porPagina));
  const p = Math.min(pagina, total);
  useEffect(() => { if (pagina > total) setPagina(total); }, [total]);
  return { items: items.slice((p - 1) * porPagina, p * porPagina), pagina: p, total, setPagina, desde: items.length ? (p - 1) * porPagina + 1 : 0, hasta: Math.min(p * porPagina, items.length), cantidad: items.length };
}

export function Paginacion({ pg, nombre = "registros" }: { pg: ReturnType<typeof usePagina<unknown>>; nombre?: string }) {
  if (pg.cantidad === 0) return null;
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pg.total; i++) {
    if (i === 1 || i === pg.total || Math.abs(i - pg.pagina) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 text-[12.5px]">
      <span className="text-muted">Mostrando <b className="tnum text-ink">{pg.desde}–{pg.hasta}</b> de <b className="tnum text-ink">{pg.cantidad}</b> {nombre}</span>
      {pg.total > 1 && (
        <div className="flex items-center gap-1">
          <button className="btn-ghost !h-8 !px-2" disabled={pg.pagina === 1} onClick={() => pg.setPagina(pg.pagina - 1)} aria-label="Página anterior"><ChevronLeft size={15} /></button>
          {nums.map((n, i) => n === "…" ? <span key={"e" + i} className="px-1 text-muted">…</span> : (
            <button key={n} onClick={() => pg.setPagina(n)} className={cx("relative grid h-8 min-w-8 place-items-center rounded-lg px-2 font-semibold tnum transition-colors", n === pg.pagina ? "text-bg" : "text-muted hover:bg-surface2 hover:text-ink")}>
              {n === pg.pagina && <motion.span layoutId={"pag-" + nombre} className="absolute inset-0 rounded-lg bg-ink" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="relative">{n}</span>
            </button>
          ))}
          <button className="btn-ghost !h-8 !px-2" disabled={pg.pagina === pg.total} onClick={() => pg.setPagina(pg.pagina + 1)} aria-label="Página siguiente"><ChevronRight size={15} /></button>
        </div>
      )}
    </div>
  );
}
