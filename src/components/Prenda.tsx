import { W_PATH } from "../lib/logo";

export type TipoPrenda = "remera" | "buzo" | "chaleco" | "campera";

/** Adivina el tipo de prenda por el nombre del producto. */
export const tipoDe = (nombre: string): TipoPrenda => {
  const n = nombre.toLowerCase();
  if (n.includes("buzo") || n.includes("hoodie")) return "buzo";
  if (n.includes("chaleco")) return "chaleco";
  if (n.includes("campera") || n.includes("parka")) return "campera";
  return "remera";
};

// Siluetas planas dibujadas para el sistema (viewBox 0 0 200 200).
const SIL: Record<TipoPrenda, { body: string; details: string[] }> = {
  remera: {
    body: "M70 30 Q100 44 130 30 L168 48 L156 84 L138 76 L138 172 Q100 178 62 172 L62 76 L44 84 L32 48 Z",
    details: ["M84 32 Q100 50 116 32"],
  },
  buzo: {
    body: "M72 34 Q78 14 100 12 Q122 14 128 34 L166 52 L176 150 L156 152 L146 86 L142 178 Q100 184 58 178 L54 86 L44 152 L24 150 L34 52 Z",
    details: ["M82 36 Q100 54 118 36", "M74 128 L126 128 L120 160 L80 160 Z", "M94 54 L92 82", "M106 54 L108 82"],
  },
  chaleco: {
    body: "M74 26 L100 40 L126 26 L148 40 Q140 60 146 84 L148 176 Q100 184 52 176 L54 84 Q60 60 52 40 Z",
    details: ["M100 40 L100 178", "M58 70 Q100 78 142 70", "M56 110 Q100 118 144 110", "M56 148 Q100 156 144 148"],
  },
  campera: {
    body: "M74 22 Q100 8 126 22 L130 36 L168 54 L178 164 L156 166 L146 92 L144 180 Q100 186 56 180 L54 92 L44 166 L22 164 L32 54 L70 36 Z",
    details: ["M100 30 L100 182", "M76 30 Q100 46 124 30", "M58 80 Q100 88 142 80", "M57 120 Q100 128 143 120", "M66 140 L84 140", "M116 140 L134 140"],
  },
};

export default function Prenda({ tipo, color, className = "", calor = false }: { tipo: TipoPrenda; color: string; className?: string; calor?: boolean }) {
  const s = SIL[tipo];
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`pg-${tipo}-${color.slice(1)}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity=".22" /><stop offset="1" stopColor="#000000" stopOpacity=".25" /></linearGradient>
        <filter id="ps" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity=".35" /></filter>
      </defs>
      <g filter="url(#ps)">
        <path d={s.body} fill={color} />
        <path d={s.body} fill={`url(#pg-${tipo}-${color.slice(1)})`} />
        {s.details.map((d, i) => <path key={i} d={d} fill="none" stroke="#000" strokeOpacity=".22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
        <path d={W_PATH} fill="#fff" fillOpacity=".9" transform={`translate(${tipo === "chaleco" || tipo === "campera" ? 112 : 108} ${tipo === "buzo" ? 64 : 58}) scale(0.026)`} />
        {calor && (
          <g>
            <circle cx="100" cy="96" r="7" fill="#E2412A" stroke="#fff" strokeWidth="2" />
            <circle cx="100" cy="96" r="12" fill="none" stroke="#F2853A" strokeOpacity=".7" strokeWidth="2"><animate attributeName="r" values="9;16;9" dur="2.2s" repeatCount="indefinite" /><animate attributeName="stroke-opacity" values=".8;0;.8" dur="2.2s" repeatCount="indefinite" /></circle>
          </g>
        )}
      </g>
    </svg>
  );
}

/** Achica una foto subida a un JPEG liviano (data URL) para guardarla con el producto. */
export async function fotoADataUrl(file: File, max = 900): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(url); }
}
