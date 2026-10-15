import type React from "react";
import { motion } from "framer-motion";
import topo from "../assets/topo.svg?raw";
import cx from "clsx";

// Textura topográfica (curvas de nivel) como variable CSS, para usar como máscara en cualquier color.
const uri = `url("data:image/svg+xml,${encodeURIComponent(topo.replace(/currentColor/g, "#000"))}")`;
if (typeof document !== "undefined") document.documentElement.style.setProperty("--topo", uri);

/** Curvas de nivel de montaña. El color sale de `className` (bg-*). */
export function Topo({ className = "", size = 520, fade = false }: { className?: string; size?: number; fade?: boolean }) {
  const img = fade ? "var(--topo), radial-gradient(ellipse at 70% 40%, #000 0%, transparent 70%)" : "var(--topo)";
  const st: React.CSSProperties = { WebkitMaskImage: img, maskImage: img, WebkitMaskSize: fade ? `${size}px, 100% 100%` : `${size}px`, maskSize: fade ? `${size}px, 100% 100%` : `${size}px`, WebkitMaskRepeat: fade ? "repeat, no-repeat" : "repeat", maskRepeat: fade ? "repeat, no-repeat" : "repeat" };
  if (fade) { (st as Record<string, string>).WebkitMaskComposite = "source-in"; st.maskComposite = "intersect"; }
  return <div aria-hidden className={cx("pointer-events-none absolute", className)} style={st} />;
}

/** El botón de calor de las prendas Wanderwarm: círculo rojo con 3 niveles. */
export function HeatButton({ nivel = 3, size = 22, animado = false, className = "" }: { nivel?: number; size?: number; animado?: boolean; className?: string }) {
  return (
    <span className={cx("relative inline-grid shrink-0 place-items-center rounded-full bg-heat shadow-[0_0_0_3px_rgb(var(--heat)/.18),0_4px_14px_-2px_rgb(var(--heat)/.6)]", className)} style={{ width: size, height: size }}>
      <span className="flex flex-col items-center" style={{ gap: size * 0.08 }}>
        {[3, 2, 1].map((n) => (
          <motion.span key={n} className="rounded-full bg-white" style={{ width: size * 0.14, height: size * 0.14 }}
            animate={animado ? { opacity: [0.25, 1, 0.25] } : { opacity: n <= nivel ? 1 : 0.3 }}
            transition={animado ? { duration: 1.6, repeat: Infinity, delay: (3 - n) * 0.22 } : { duration: 0.3 }} />
        ))}
      </span>
    </span>
  );
}

/** Línea de cordillera para separar secciones. */
export function Ridge({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className={cx("h-6 w-full", className)} aria-hidden>
      <path d="M0 38 L90 22 L140 30 L230 8 L300 26 L360 18 L450 34 L520 12 L600 28 L660 20 L760 36 L840 10 L910 26 L980 16 L1060 32 L1130 20 L1200 30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d="M230 8 L246 14 L222 13 Z M520 12 L536 18 L512 17 Z M840 10 L856 16 L832 15 Z" fill="currentColor" opacity=".5" />
    </svg>
  );
}
