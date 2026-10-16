import type { Config, Movimiento, MovChat, Orden, Parada, Taller, Viaje } from "./types";
import { ETAPA_KEY } from "./types";
import { today, uid } from "./format";

// ------------------------------------------------------------------
// Cómo funciona la camioneta
// Un VIAJE es una salida: arranca en la fábrica, hace paradas y vuelve.
// En cada PARADA el chofer DEJA o RETIRA mercadería de una o más órdenes,
// con cantidades. Con eso el sistema sabe:
//  · cuántos viajes y km hace la camioneta, y a qué talleres va más;
//  · qué viajes generó cada orden (costo logístico por orden);
//  · dónde está físicamente la mercadería de cada orden;
//  · si lo que retiró de un taller coincide con lo que el taller informó.
// ------------------------------------------------------------------

export interface Lugar { id: string; nombre: string; tipo: "propio" | "proveedor" | "cliente" | "taller"; km: number; tallerTipo?: Taller["tipo"] }

export function lugaresDe(config: Config, talleres: Taller[]): Lugar[] {
  return [
    ...config.lugares.map((l) => ({ id: l.id, nombre: l.nombre, tipo: l.tipo, km: l.kmDesdeFabrica || 0 })),
    ...talleres.map((t) => ({ id: t.id, nombre: t.nombre, tipo: "taller" as const, km: t.km ?? 8, tallerTipo: t.tipo })),
  ];
}

export const FABRICA = "l-fab";

/** Distancia estimada entre dos lugares (km), a partir de la distancia de cada uno a la fábrica. */
export function distancia(a: Lugar | undefined, b: Lugar | undefined) {
  if (!a || !b || a.id === b.id) return 0;
  if (a.km === 0 || b.km === 0) return Math.max(a.km, b.km);
  return Math.round(Math.max(Math.abs(a.km - b.km), (a.km + b.km) * 0.55) * 10) / 10;
}

export function kmEstimado(paradas: Parada[], lugares: Lugar[]) {
  let km = 0;
  for (let i = 1; i < paradas.length; i++) km += distancia(lugares.find((l) => l.id === paradas[i - 1].lugarId), lugares.find((l) => l.id === paradas[i].lugarId));
  return Math.round(km);
}

/** Km del viaje: el odómetro si se cargó, si no la estimación. */
export const kmViaje = (v: Viaje) => (v.kmInicio != null && v.kmFin != null ? Math.max(0, v.kmFin - v.kmInicio) : v.km || 0);

export const movsDe = (v: Viaje) => v.paradas.flatMap((p) => p.movs.map((m) => ({ ...m, parada: p })));
export const unidadesMovidas = (v: Viaje) => movsDe(v).filter((m) => m.tipo === "deja").reduce((a, m) => a + m.unidades, 0);
export const ordenesDe = (v: Viaje) => [...new Set(movsDe(v).map((m) => m.numero))].sort((a, b) => a - b);

/** "Fábrica → Corte Guaymallén → Confección Las Heras → Fábrica" */
export const recorridoTexto = (v: Viaje) => v.paradas.map((p) => p.nombre).join(" → ");

export function nuevaParada(l: Lugar, hora?: string): Parada { return { id: uid("p"), lugarId: l.id, nombre: l.nombre, hora, movs: [] }; }
export function nuevoMov(tipo: Movimiento["tipo"], o: Orden, unidades: number, detalle = ""): Movimiento {
  return { id: uid("mv"), tipo, ordenId: o.id, numero: o.numero, unidades, detalle };
}

/** Dónde está la mercadería de una orden según el último movimiento de la camioneta. */
export function ubicacionOrden(o: Orden, viajes: Viaje[]) {
  let ultimo: { fecha: string; hora?: string; lugar: string; tipo: Movimiento["tipo"]; unidades: number } | null = null;
  const ord = [...viajes].sort((a, b) => (a.fecha + (a.salida || "")).localeCompare(b.fecha + (b.salida || "")));
  for (const v of ord) for (const p of v.paradas) for (const m of p.movs) if (m.ordenId === o.id) {
    ultimo = { fecha: v.fecha, hora: p.hora, lugar: p.nombre, tipo: m.tipo, unidades: m.unidades };
  }
  return ultimo;
}

/** Movimientos de una orden, en orden cronológico. */
export function movimientosOrden(o: Orden, viajes: Viaje[]) {
  const out: { viaje: Viaje; parada: Parada; mov: Movimiento }[] = [];
  for (const v of viajes) for (const p of v.paradas) for (const m of p.movs) if (m.ordenId === o.id) out.push({ viaje: v, parada: p, mov: m });
  return out.sort((a, b) => (a.viaje.fecha + (a.parada.hora || "")).localeCompare(b.viaje.fecha + (b.parada.hora || "")));
}

const inRange = (s: string, a: string, b: string) => s >= a && s <= b;

export function statsViajes(viajes: Viaje[], talleres: Taller[], desde: string, hasta: string, costoKm = 0) {
  const vs = viajes.filter((v) => inRange(v.fecha, desde, hasta));
  const porLugar: Record<string, { nombre: string; visitas: number; deja: number; retira: number }> = {};
  const porOrden: Record<number, { viajes: Set<string>; km: number }> = {};
  const tramos: Record<string, { a: string; b: string; n: number }> = {};
  let km = 0, unidades = 0, paradas = 0;
  for (const v of vs) {
    const k = kmViaje(v); km += k;
    const nums = ordenesDe(v);
    for (const n of nums) { const x = (porOrden[n] ||= { viajes: new Set(), km: 0 }); x.viajes.add(v.id); x.km += k / Math.max(1, nums.length); }
    v.paradas.forEach((p, i) => {
      if (i > 0 && i < v.paradas.length - 1) paradas++;
      const L = (porLugar[p.lugarId] ||= { nombre: p.nombre, visitas: 0, deja: 0, retira: 0 });
      if (!(i === 0 || (i === v.paradas.length - 1 && p.lugarId === v.paradas[0].lugarId)) || p.movs.length) L.visitas++;
      for (const m of p.movs) { if (m.tipo === "deja") { L.deja += m.unidades; unidades += m.unidades; } else L.retira += m.unidades; }
      if (i > 0) { const a = v.paradas[i - 1].lugarId, b = p.lugarId; if (a !== b) { const key = a + ">" + b; (tramos[key] ||= { a, b, n: 0 }).n++; } }
    });
  }
  const visitasTaller = talleres.map((t) => ({ taller: t, visitas: porLugar[t.id]?.visitas || 0, deja: porLugar[t.id]?.deja || 0, retira: porLugar[t.id]?.retira || 0 }))
    .sort((a, b) => b.visitas - a.visitas);
  return {
    viajes: vs, n: vs.length, km, costo: km * costoKm, unidades, paradas,
    paradasPorViaje: vs.length ? paradas / vs.length : 0,
    porLugar, visitasTaller, tramos: Object.values(tramos).sort((a, b) => b.n - a.n),
    porOrden: Object.entries(porOrden).map(([n, x]) => ({ numero: +n, viajes: x.viajes.size, km: Math.round(x.km), costo: Math.round(x.km * costoKm) })).sort((a, b) => b.viajes - a.viajes),
  };
}

/**
 * Control cruzado: por cada orden y taller, compara
 *  · lo que la camioneta DEJÓ en el taller,
 *  · lo que el taller INFORMÓ como terminado,
 *  · lo que la camioneta RETIRÓ del taller.
 */
export function conciliacion(ordenes: Orden[], viajes: Viaje[], talleres: Taller[]) {
  const filas: { orden: Orden; taller: Taller; dejado: number; informado: number; retirado: number; estado: "ok" | "falta_retirar" | "diferencia" | "sin_informar" }[] = [];
  for (const o of ordenes) {
    const tIds = new Set<string>([...Object.values(o.asignacion || {})]);
    for (const tid of tIds) {
      const t = talleres.find((x) => x.id === tid); if (!t) continue;
      const etapa = +ETAPA_KEY[t.tipo];
      let dejado = 0, retirado = 0;
      for (const v of viajes) for (const p of v.paradas) if (p.lugarId === tid) for (const m of p.movs) if (m.ordenId === o.id) {
        if (m.tipo === "deja") dejado += m.unidades; else retirado += m.unidades;
      }
      const informado = o.historial.reduce((a, h) => a + (h.tipo === "entrega" && h.tallerId === tid && h.etapa === etapa ? h.unidades : 0), 0);
      if (!dejado && !informado && !retirado) continue;
      const estado = retirado > informado ? "diferencia" : informado > retirado && o.etapa > etapa ? "falta_retirar" : dejado > 0 && informado === 0 && o.etapa > etapa ? "sin_informar" : "ok";
      filas.push({ orden: o, taller: t, dejado, informado, retirado, estado });
    }
  }
  return filas;
}

/** Arma un viaje cerrado a partir de traslados sueltos (origen → destino) del mismo día. Lo usan los datos de ejemplo y el asistente. */
export function armarViaje(fecha: string, traslados: { de: string; a: string; orden: Orden; unidades: number; detalle: string }[], lugares: Lugar[], opts: { choferId?: string | null; kmInicio?: number; salida?: string; ejemplo?: boolean } = {}): Viaje {
  const L = (id: string) => lugares.find((l) => l.id === id)!;
  const pendientes = new Set<string>();
  traslados.forEach((t) => { if (t.de !== FABRICA) pendientes.add(t.de); if (t.a !== FABRICA) pendientes.add(t.a); });
  const ruta: string[] = [FABRICA];
  const visitados = new Set<string>([FABRICA]);
  while (pendientes.size) {
    const posibles = [...pendientes].filter((id) => traslados.every((t) => t.a !== id || visitados.has(t.de)));
    const actual = L(ruta[ruta.length - 1]);
    const sig = (posibles.length ? posibles : [...pendientes]).sort((a, b) => distancia(actual, L(a)) - distancia(actual, L(b)))[0];
    ruta.push(sig); visitados.add(sig); pendientes.delete(sig);
  }
  ruta.push(FABRICA);
  const [h0, m0] = (opts.salida || "08:30").split(":").map(Number);
  let min = h0 * 60 + m0;
  const paradas: Parada[] = ruta.map((id, i) => {
    if (i > 0) min += Math.round(distancia(L(ruta[i - 1]), L(id)) * 2.2 + 12);
    return nuevaParada(L(id), `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`);
  });
  for (const t of traslados) {
    const iDe = t.de === FABRICA ? 0 : ruta.indexOf(t.de);
    const iA = t.a === FABRICA ? ruta.length - 1 : ruta.indexOf(t.a);
    paradas[iDe].movs.push(nuevoMov("retira", t.orden, t.unidades, t.detalle));
    paradas[iA].movs.push(nuevoMov("deja", t.orden, t.unidades, t.detalle));
  }
  const km = kmEstimado(paradas, lugares);
  const kmInicio = opts.kmInicio;
  return {
    id: uid("v"), fecha, choferId: opts.choferId ?? null, estado: "cerrado", salida: paradas[0].hora, regreso: paradas[paradas.length - 1].hora,
    kmInicio, kmFin: kmInicio != null ? kmInicio + km : undefined, km, paradas, ejemplo: opts.ejemplo,
  };
}

/** Suma un movimiento dicho por chat al viaje en curso del usuario de hoy, o abre un viaje nuevo que sale de la fábrica. */
export function aplicarMovChat(m: MovChat, viajes: Viaje[], ordenes: Orden[], lugares: Lugar[], usuarioId: string | null): Viaje | null {
  const o = ordenes.find((x) => x.id === m.ordenId); const L = (id: string) => lugares.find((l) => l.id === id);
  if (!o || !L(m.lugarId)) return null;
  const hora = new Date().toTimeString().slice(0, 5);
  const actual = viajes.find((v) => v.estado === "en_curso" && v.fecha === today() && (!usuarioId || v.choferId === usuarioId));
  const v: Viaje = actual ? structuredClone(actual) : { id: uid("v"), fecha: today(), choferId: usuarioId, estado: "en_curso", salida: hora, km: 0, paradas: [nuevaParada(L(FABRICA) || L(m.lugarId)!, hora)], via: "asistente" };
  const paradaEn = (lugarId: string) => {
    const ult = v.paradas[v.paradas.length - 1];
    if (ult.lugarId === lugarId) return ult;
    const p = nuevaParada(L(lugarId)!, hora); v.paradas.push(p); return p;
  };
  if (m.tipo === "traslado" && m.deLugarId && L(m.deLugarId)) {
    paradaEn(m.deLugarId).movs.push(nuevoMov("retira", o, m.unidades));
    paradaEn(m.lugarId).movs.push(nuevoMov("deja", o, m.unidades));
  } else if (m.tipo === "deja") {
    // si no consta que la llevaba, se asume que la cargó en la salida
    const lleva = v.paradas.flatMap((p) => p.movs).filter((x) => x.ordenId === o.id).reduce((a, x) => a + (x.tipo === "retira" ? x.unidades : -x.unidades), 0);
    if (lleva < m.unidades) v.paradas[0].movs.push(nuevoMov("retira", o, m.unidades - Math.max(0, lleva)));
    paradaEn(m.lugarId).movs.push(nuevoMov("deja", o, m.unidades));
  } else paradaEn(m.lugarId).movs.push(nuevoMov("retira", o, m.unidades));
  v.km = kmEstimado(v.paradas, lugares);
  return v;
}
