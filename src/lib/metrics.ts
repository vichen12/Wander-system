import type { Material, Orden, Producto, Taller, Viaje } from "./types";
import { addDays, days, monthKey, today } from "./format";
import { kmViaje } from "./viajes";

export const unidades = (o: Orden) => o.lineas.reduce((a, l) => a + (+l.cantidad || 0), 0);
export const atrasada = (o: Orden) => o.etapa < 7 && !!o.fechaEntrega && o.fechaEntrega < today();
export const venceProntoDias = (o: Orden) => (o.etapa < 7 ? days(today(), o.fechaEntrega) : 999);

export function necesidades(lineas: Orden["lineas"], productos: Producto[], materiales: Material[]) {
  const mats = new Map<string, number>();
  let costoMat = 0, costoMano = 0, venta = 0;
  for (const l of lineas) {
    const p = productos.find((x) => x.id === l.productoId); if (!p) continue;
    const q = +l.cantidad || 0;
    const f = p.ajusteTalle?.[l.talle] ?? 1;
    for (const r of p.receta) {
      const m = materiales.find((x) => x.id === r.materialId); if (!m) continue;
      const fx = m.unidad === "u" ? 1 : f; // los avíos por unidad no cambian con el talle
      const c = q * r.cantidad * fx * (1 + (r.merma || 0) / 100);
      mats.set(m.id, (mats.get(m.id) || 0) + c);
      costoMat += c * m.costo;
    }
    costoMano += q * (p.costoCorte + p.costoConfeccion + p.costoPersonalizacion);
    venta += q * (p.precioVenta || 0);
  }
  return {
    mats: [...mats.entries()].map(([id, q]) => ({ m: materiales.find((x) => x.id === id)!, q })),
    costoMat, costoMano, costo: costoMat + costoMano, venta, margen: venta ? (venta - costoMat - costoMano) / venta : null,
  };
}

const inRange = (s: string | undefined, a: string, b: string) => !!s && s >= a && s <= b;

export function periodo(k: string) {
  // k = YYYY-MM  →  [inicio, fin]
  const [y, m] = k.split("-").map(Number);
  const a = `${k}-01`;
  const b = new Date(y, m, 0).getDate();
  return [a, `${k}-${String(b).padStart(2, "0")}`] as const;
}

export function metricas(ordenes: Orden[], viajes: Viaje[], talleres: Taller[], desde: string, hasta: string) {
  const porTaller: Record<string, { unidades: number; revisadas: number; fallas: number; viajes: number; entregas: number }> = {};
  const T = (id: string) => (porTaller[id] ||= { unidades: 0, revisadas: 0, fallas: 0, viajes: 0, entregas: 0 });
  let confeccionadas = 0, revisadas = 0, fallas = 0;
  const motivos: Record<string, number> = {};
  for (const o of ordenes) {
    for (const h of o.historial) if (h.tipo === "entrega" && inRange(h.fecha, desde, hasta)) {
      if (h.tallerId) { T(h.tallerId).unidades += h.unidades; T(h.tallerId).entregas++; }
      if (h.etapa === 3) confeccionadas += h.unidades;
    }
    for (const c of o.calidad) if (inRange(c.fecha, desde, hasta)) {
      revisadas += c.revisadas; fallas += c.fallas; T(c.tallerId).revisadas += c.revisadas; T(c.tallerId).fallas += c.fallas;
      if (c.fallas && c.motivo) motivos[c.motivo] = (motivos[c.motivo] || 0) + c.fallas;
    }
  }
  const vs = viajes.filter((v) => inRange(v.fecha, desde, hasta));
  for (const v of vs) for (const id of new Set(v.paradas.map((p) => p.lugarId))) if (talleres.some((t) => t.id === id)) T(id).viajes++;
  const fin = ordenes.filter((o) => o.etapa === 7 && inRange(o.fechaFin, desde, hasta));
  const aTiempo = fin.filter((o) => !o.fechaEntrega || (o.fechaFin || "") <= o.fechaEntrega).length;
  const ciclo = fin.length ? fin.reduce((a, o) => a + Math.max(0, days(o.creada, o.fechaFin!)), 0) / fin.length : null;
  const abiertas = ordenes.filter((o) => o.etapa < 7);
  const porEtapa = [1, 2, 3, 4, 5, 6].map((e) => ({ etapa: e, n: abiertas.filter((o) => o.etapa === e).length, u: abiertas.filter((o) => o.etapa === e).reduce((a, o) => a + unidades(o), 0) }));
  // tiempo promedio por etapa (días) de órdenes que pasaron por ella en el período
  const tEtapa = [1, 2, 3, 4, 5, 6].map((e) => {
    const xs: number[] = [];
    for (const o of ordenes) {
      const a = o.historial.find((h) => h.tipo === "avance" && h.etapa === e);
      const b = o.historial.find((h) => h.tipo === "avance" && h.etapa === e + 1);
      if (a && b && inRange(b.fecha, desde, hasta)) xs.push(days(a.fecha, b.fecha));
    }
    return { etapa: e, dias: xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0 };
  });
  return {
    porTaller, confeccionadas, revisadas, fallas, tasa: revisadas ? (fallas / revisadas) * 100 : null,
    viajes: vs, km: vs.reduce((a, v) => a + kmViaje(v), 0), fin, aTiempo, cumplimiento: fin.length ? (aTiempo / fin.length) * 100 : null, ciclo,
    abiertas, porEtapa, atrasadas: abiertas.filter(atrasada), motivos, tEtapa,
    unidadesFin: fin.reduce((a, o) => a + unidades(o), 0),
  };
}

/** Serie diaria de unidades entregadas (todas las etapas de taller) para los últimos `n` días hasta `hasta`. */
export function serieDiaria(ordenes: Orden[], hasta: string, n = 30) {
  const out: { fecha: string; confeccion: number; personalizacion: number; corte: number }[] = [];
  for (let i = n - 1; i >= 0; i--) out.push({ fecha: addDays(hasta, -i), confeccion: 0, personalizacion: 0, corte: 0 });
  const idx = new Map(out.map((x, i) => [x.fecha, i]));
  for (const o of ordenes) for (const h of o.historial) if (h.tipo === "entrega") {
    const i = idx.get(h.fecha); if (i == null) continue;
    if (h.etapa === 2) out[i].corte += h.unidades; else if (h.etapa === 3) out[i].confeccion += h.unidades; else if (h.etapa === 4) out[i].personalizacion += h.unidades;
  }
  return out;
}

export function mesesDisponibles(ordenes: Orden[], viajes: Viaje[]) {
  const s = new Set<string>([monthKey(today())]);
  ordenes.forEach((o) => o.historial.forEach((h) => s.add(monthKey(h.fecha))));
  viajes.forEach((v) => s.add(monthKey(v.fecha)));
  return [...s].sort().reverse();
}

/** Prendas entregadas por semana (últimas `n` semanas hasta `hasta`). */
export function serieSemanal(ordenes: Orden[], hasta: string, n = 12) {
  const out: { semana: string; desde: string; confeccion: number; personalizacion: number; corte: number }[] = [];
  for (let i = n - 1; i >= 0; i--) { const fin = addDays(hasta, -7 * i); const ini = addDays(fin, -6); out.push({ semana: ini, desde: ini, confeccion: 0, personalizacion: 0, corte: 0 }); }
  for (const o of ordenes) for (const h of o.historial) if (h.tipo === "entrega") {
    const w = out.find((x) => h.fecha >= x.desde && h.fecha <= addDays(x.desde, 6)); if (!w) continue;
    if (h.etapa === 2) w.corte += h.unidades; else if (h.etapa === 3) w.confeccion += h.unidades; else if (h.etapa === 4) w.personalizacion += h.unidades;
  }
  return out;
}

/** BOM de una prenda (talle base): consumo neto, con merma, costo y peso en el costo total. */
export function bom(p: Producto, materiales: Material[], talle?: string) {
  const f = (talle ? p.ajusteTalle?.[talle] : undefined) ?? 1;
  const filas = p.receta.map((r) => {
    const m = materiales.find((x) => x.id === r.materialId);
    const fx = m?.unidad === "u" ? 1 : f;
    const neto = r.cantidad * fx;
    const bruto = neto * (1 + (r.merma || 0) / 100);
    return { r, m, neto, bruto, costo: bruto * (m?.costo || 0) };
  });
  const mano = p.ruta?.length ? p.ruta.reduce((a, x) => a + x.costo, 0) : p.costoCorte + p.costoConfeccion + p.costoPersonalizacion;
  const mat = filas.reduce((a, x) => a + x.costo, 0);
  const total = mat + mano;
  const minutos = (p.ruta || []).reduce((a, x) => a + x.minutos, 0);
  return { filas, mat, mano, total, minutos, margen: p.precioVenta ? (p.precioVenta - total) / p.precioVenta : null };
}
