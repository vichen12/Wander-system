import { useStore } from "../store/useStore";

const LIGHT = { ink: "#121110", ink2: "#3A3734", muted: "#7D776F", line: "#E0DBD3", surface: "#FFFFFF", surface2: "#F6F5F3", heat: "#E2412A", ember: "#F2853A", ok: "#2F7D4F", sCorte: "#F2A33A", sConf: "#E2412A", sPers: "#3B6FD4" };
const DARK = { ink: "#F2EFEA", ink2: "#D2CDC5", muted: "#958F86", line: "#33302D", surface: "#1C1B1A", surface2: "#232220", heat: "#F0563E", ember: "#F69650", ok: "#5FBF85", sCorte: "#F6B95C", sConf: "#F0563E", sPers: "#6B9BF2" };
/** Colores para gráficos (recharts necesita valores concretos, no variables CSS). */
export const useColors = () => (useStore((s) => s.tema) === "oscuro" ? DARK : LIGHT);
