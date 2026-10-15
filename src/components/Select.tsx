import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import cx from "clsx";

export interface Opcion<T extends string> { value: T; label: string; desc?: string; icon?: ReactNode }

/** Desplegable propio (reemplaza al <select> nativo): animado, con teclado y descripción opcional. */
export default function Select<T extends string>({ value, onChange, options, label, icon, className = "", tone = "light", align = "left", width = 260, activo }: {
  value: T; onChange: (v: T) => void; options: Opcion<T>[]; label?: string; icon?: ReactNode; className?: string; tone?: "light" | "dark"; align?: "left" | "right"; width?: number; activo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const sel = options.find((o) => o.value === value) || options[0];
  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, options.findIndex((o) => o.value === value)));
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", out); return () => document.removeEventListener("mousedown", out);
  }, [open]);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!open) setOpen(true); else setHi((h) => (h + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (open) { onChange(options[hi].value); setOpen(false); } else setOpen(true); }
  };
  const dark = tone === "dark";
  return (
    <div ref={ref} className={cx("relative", className)}>
      <button type="button" onClick={() => setOpen(!open)} onKeyDown={key} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-label={label}
        className={cx("flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-semibold transition",
          dark ? "border-white/10 bg-white/[.06] text-white hover:bg-white/10" : activo ? "border-heat/60 bg-heat/[.06] text-ink" : "border-line bg-surface text-ink hover:border-muted",
          open && !dark && "border-ink ring-4 ring-ink/5")}>
        {(sel?.icon || icon) && <span className={cx("shrink-0", dark ? "text-white/60" : activo ? "text-heat" : "text-muted")}>{sel?.icon || icon}</span>}
        <span className="min-w-0 flex-1 truncate">{sel?.label}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className={dark ? "text-white/50" : "text-muted"}><ChevronDown size={15} /></motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul id={id} role="listbox" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.16 }}
            style={{ width, transformOrigin: align === "right" ? "top right" : "top left" }}
            className={cx("absolute z-50 mt-1.5 max-h-80 overflow-y-auto rounded-2xl border p-1.5 shadow-2xl scroll-thin", align === "right" ? "right-0" : "left-0", dark ? "border-white/10 bg-[#1A1918] text-white" : "border-line bg-surface")}>
            {options.map((o, i) => {
              const on = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={on} onMouseEnter={() => setHi(i)} onClick={() => { onChange(o.value); setOpen(false); }}
                  className={cx("flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-colors", i === hi && (dark ? "bg-white/10" : "bg-surface2"))}>
                  {o.icon && <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", on ? "bg-heat text-white" : dark ? "bg-white/10 text-white/70" : "bg-surface2 text-ink2")}>{o.icon}</span>}
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{o.label}</span>{o.desc && <span className={cx("block truncate text-[11.5px]", dark ? "text-white/50" : "text-muted")}>{o.desc}</span>}</span>
                  {on && <Check size={15} className="shrink-0 text-heat" />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
