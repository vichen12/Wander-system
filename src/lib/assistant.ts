import type { AccionPropuesta, Material, Orden, Producto, Rol, Taller, Viaje } from "./types";
import { ETAPAS, TIPOS_TALLER } from "./types";
import { addDays, fdate, monthKey, n0, n1, n2, ordenLabel, today } from "./format";
import { atrasada, metricas, necesidades, periodo, unidades } from "./metrics";

// Asistente local: entiende frases comunes de producción sin conexión.
// Con Supabase configurado, el chat usa la función `asistente` (Claude) y este parser queda de respaldo.

export interface Ctx { rol: Rol; ordenes: Orden[]; talleres: Taller[]; productos: Producto[]; materiales: Material[]; viajes: Viaje[]; miTaller?: Taller }
export interface Respuesta { texto: string; accion?: AccionPropuesta }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const num = (s: string) => parseInt(s.replace(/\./g, ""), 10);

function buscarOrden(t: string, ordenes: Orden[]) {
  const m = t.match(/(?:orden|op|pedido|#)\s*(?:n(?:ro|umero)?\.?\s*)?#?(\d{1,4})/);
  return m ? ordenes.find((o) => o.numero === +m[1]) : undefined;
}
function buscarTaller(t: string, talleres: Taller[]) {
  return talleres.find((x) => t.includes(norm(x.nombre))) || talleres.find((x) => norm(x.nombre).split(" ").some((w) => w.length > 4 && t.includes(w)));
}
function lugar(s: string, talleres: Taller[]): { id: string; nombre: string } | undefined {
  const t = norm(s);
  if (/fabrica|planta|oficina/.test(t)) return { id: "l-fab", nombre: "Fábrica" };
  if (/deposito/.test(t)) return { id: "l-dep", nombre: "Depósito" };
  if (/expreso|transporte|despacho/.test(t)) return { id: "l-exp", nombre: "Expreso (despachos)" };
  const x = buscarTaller(t, talleres); return x ? { id: x.id, nombre: x.nombre } : undefined;
}
const estado = (o: Orden) =>
  `${ordenLabel(o.numero)} · ${o.cliente}\n- Etapa: ${ETAPAS[o.etapa]}\n- ${n0(unidades(o))} prendas\n- ${o.etapa === 7 ? "Finalizada el " + fdate(o.fechaFin) : (atrasada(o) ? "Atrasada: vencía el " : "Entrega pactada: ") + fdate(o.fechaEntrega)}`;

export function responder(texto: string, c: Ctx): Respuesta {
  const t = norm(texto);
  const o = buscarOrden(t, c.ordenes);
  const cant = t.match(/(\d[\d.]*)\s*(?:u\b|unid|prendas|remeras|buzos|chalecos|camperas|piezas)?/);
  const esTaller = c.rol === "taller";

  // --- CARGAS ---
  if (/(entregue|entregamos|entregaron|termine|terminamos|terminaron|listas|listos|mande|mandamos)/.test(t) && cant) {
    if (c.rol === "chofer") return { texto: "Como chofer podés registrar viajes. Las entregas las informa cada taller." };
    if (!o) return { texto: "¿De qué número de orden? Por ejemplo: “entregué 200 remeras de la orden 15”." };
    if (o.etapa === 7) return { texto: `La ${ordenLabel(o.numero)} ya está finalizada.` };
    const u = num(t.replace(/(orden|op|#)\s*\d+/, "").match(/(\d[\d.]*)/)?.[1] || "0");
    if (!u) return { texto: "¿Cuántas unidades fueron?" };
    const tal = esTaller ? c.miTaller : buscarTaller(t, c.talleres);
    return { texto: `Preparé el registro. Confirmalo y queda guardado en la ${ordenLabel(o.numero)}.`, accion: { tipo: "entrega", ordenId: o.id, unidades: u, tallerId: tal?.id || null, desc: `${n0(u)} u en ${ETAPAS[o.etapa].toLowerCase()} · ${ordenLabel(o.numero)}${tal ? " · " + tal.nombre : ""}`, estado: "pendiente" } };
  }
  // Camioneta: "dejé 200 de la orden 15 en Bordados Centro", "retiré 120 de la orden 31 de Confección Las Heras",
  // "llevé 200 remeras de la orden 15 de la fábrica a Bordados Centro"
  const tras = t.match(/(?:lleve|llevamos|traslade|trasladamos)\b.*?\bde(?:sde)?\s+(?:la\s+|el\s+)?(.+?)\s+(?:a|al|hasta|hacia)\s+(?:la\s+|el\s+)?(.+?)(?:[,.]|$)/);
  const deja = !tras && t.match(/(?:deje|dejamos|descargue|entregue en|baje)\b.*?\s(?:en|a|al)\s+(?:la\s+|el\s+)?(.+?)(?:[,.]|$)/);
  const retira = !tras && t.match(/(?:retire|retiramos|busque|buscamos|levante|cargue)\b.*?\s(?:de|en|del)\s+(?:la\s+|el\s+)?([a-z][^,.]+?)(?:[,.]|$)/);
  if (tras || deja || retira) {
    if (esTaller) return { texto: "Los viajes los registra el chofer o producción." };
    if (!o) return { texto: "¿De qué orden era la mercadería? Ej: “dejé 200 remeras de la orden 15 en Bordados Centro”." };
    const u = num(t.replace(/(orden|op|#)\s*\d+/g, "").match(/(\d[\d.]*)/)?.[1] || "0") || unidades(o);
    const destino = lugar((tras ? tras[2] : deja ? deja[1] : (retira as RegExpMatchArray)[1]).replace(/(orden|#)\s*\d+/g, ""), c.talleres);
    const origen = tras ? lugar(tras[1].replace(/(orden|#)\s*\d+/g, ""), c.talleres) : undefined;
    if (!destino || (tras && !origen)) return { texto: `No reconozco el lugar. Lugares válidos: Fábrica, Depósito, Expreso, ${c.talleres.map((x) => x.nombre).join(", ")}.` };
    const tipo = tras ? "traslado" : deja ? "deja" : "retira";
    const desc = tipo === "traslado" ? `${origen!.nombre} → ${destino.nombre} · ${n0(u)} u de ${ordenLabel(o.numero)}` : `${tipo === "deja" ? "Dejó" : "Retiró"} ${n0(u)} u de ${ordenLabel(o.numero)} ${tipo === "deja" ? "en" : "de"} ${destino.nombre}`;
    return { texto: "Lo sumo a tu viaje de hoy (si no tenés uno abierto, arranco uno desde la fábrica). Confirmalo:", accion: { tipo: "viaje", mov: { tipo, ordenId: o.id, numero: o.numero, unidades: u, lugarId: destino.id, deLugarId: origen?.id }, desc, estado: "pendiente" } };
  }
  if (/(revisamos|revise|control|calidad).*(falla|defect|mal)/.test(t) && o) {
    if (!["superadmin", "direccion", "produccion"].includes(c.rol)) return { texto: "El control de calidad lo carga producción." };
    const nums = [...t.matchAll(/(\d[\d.]*)/g)].map((m) => num(m[1])).filter((x) => x !== o.numero);
    if (nums.length < 2) return { texto: "Decime cuántas revisaste y cuántas tenían falla. Ej: “revisamos 200 de la orden 5, 6 con falla”." };
    const [rev, fal] = nums[0] >= nums[1] ? nums : [nums[1], nums[0]];
    const tal = buscarTaller(t, c.talleres) || c.talleres.find((x) => { const h = [...o.historial].reverse().find((h) => h.tipo === "entrega" && h.etapa === 3 && h.tallerId); return h?.tipo === "entrega" && x.id === h.tallerId; });
    if (!tal) return { texto: "¿Qué taller es el responsable de las fallas?" };
    const motivo = texto.match(/(?:por|motivo:?)\s+(.+)$/i)?.[1] || "";
    return { texto: "Preparé el control de calidad. Confirmalo para guardarlo.", accion: { tipo: "calidad", ordenId: o.id, tallerId: tal.id, revisadas: rev, fallas: fal, motivo, desc: `${fal} con falla de ${rev} · ${ordenLabel(o.numero)} · ${tal.nombre}`, estado: "pendiente" } };
  }
  if (/(pasa|pasala|pasar|avanza|avanzar|mover|move|finaliza|finalizar|cerra)/.test(t) && o) {
    if (!["superadmin", "direccion", "produccion"].includes(c.rol)) return { texto: "Mover órdenes de etapa lo hace producción." };
    if (o.etapa === 7) return { texto: `La ${ordenLabel(o.numero)} ya está finalizada.` };
    return { texto: "Listo para mover. Confirmá:", accion: { tipo: "avance", ordenId: o.id, desc: o.etapa === 6 ? `Finalizar ${ordenLabel(o.numero)}` : `Pasar ${ordenLabel(o.numero)} a ${ETAPAS[o.etapa + 1]}`, estado: "pendiente" } };
  }

  // --- CONSULTAS ---
  if (o) return { texto: estado(o) };
  const [a, b] = periodo(monthKey(today()));
  const M = metricas(c.ordenes, c.viajes, c.talleres, a, b);
  if (/atrasad|demorad|tarde/.test(t)) {
    return { texto: M.atrasadas.length ? `Hay ${M.atrasadas.length} atrasadas:\n` + M.atrasadas.slice(0, 8).map((x) => `- ${ordenLabel(x.numero)} ${x.cliente} · ${ETAPAS[x.etapa]} · vencía ${fdate(x.fechaEntrega)}`).join("\n") : "No hay órdenes atrasadas. Todo en fecha." };
  }
  if (/falla|calidad|defect/.test(t)) {
    const rows = Object.entries(M.porTaller).filter(([, v]) => v.revisadas).map(([id, v]) => ({ n: c.talleres.find((x) => x.id === id)?.nombre || id, t: (v.fallas / v.revisadas) * 100, f: v.fallas, r: v.revisadas })).sort((x, y) => y.t - x.t);
    if (!rows.length) return { texto: "Todavía no hay controles de calidad este mes." };
    return { texto: `Tasa de fallas del mes: ${n1(M.tasa || 0)}%.\n` + rows.map((r) => `- ${r.n}: ${n1(r.t)}% (${r.f} de ${n0(r.r)})`).join("\n") };
  }
  if (/viaje|camioneta|km/.test(t)) {
    const ult = [...M.viajes].sort((x, y) => y.fecha.localeCompare(x.fecha))[0];
    return { texto: `Este mes la camioneta hizo ${M.viajes.length} viajes (${n0(M.km)} km).` + (ult ? `\nÚltimo: ${fdate(ult.fecha)} ${ult.paradas.map((p) => p.nombre).join(" → ")}.` : "") };
  }
  if (/tela|material|insumo|comprar|necesit/.test(t)) {
    const ab = c.ordenes.filter((x) => x.etapa <= 1);
    const nd = necesidades(ab.flatMap((x) => x.lineas), c.productos, c.materiales);
    if (!nd.mats.length) return { texto: "No hay órdenes esperando compra de tela." };
    return { texto: `Para las ${ab.length} órdenes en compra de tela necesitás:\n` + nd.mats.map((x) => `- ${x.m.nombre}: ${n2(x.q)} ${x.m.unidad}`).join("\n") };
  }
  if (/vence|semana|proxim/.test(t)) {
    const lim = addDays(today(), 7);
    const vs = c.ordenes.filter((x) => x.etapa < 7 && x.fechaEntrega >= today() && x.fechaEntrega <= lim);
    return { texto: vs.length ? "Vencen en los próximos 7 días:\n" + vs.map((x) => `- ${ordenLabel(x.numero)} ${x.cliente} · ${ETAPAS[x.etapa]} · ${fdate(x.fechaEntrega)}`).join("\n") : "Nada vence en los próximos 7 días." };
  }
  const etapaQ = ETAPAS.findIndex((e, i) => i > 0 && i < 7 && t.includes(norm(e).split(" ").pop()!));
  if (etapaQ > 0 && /(que|cuales|cuantas|ordenes|hay)/.test(t)) {
    const xs = c.ordenes.filter((x) => x.etapa === etapaQ);
    return { texto: xs.length ? `En ${ETAPAS[etapaQ].toLowerCase()} hay ${xs.length}:\n` + xs.map((x) => `- ${ordenLabel(x.numero)} ${x.cliente} · ${n0(unidades(x))} u`).join("\n") : `No hay órdenes en ${ETAPAS[etapaQ].toLowerCase()}.` };
  }
  if (/pendiente|tengo|mis ordenes/.test(t) && esTaller && c.miTaller) {
    const et = { corte: 2, confeccion: 3, bordado: 4, estampado: 4, sublimado: 4 }[c.miTaller.tipo];
    const xs = c.ordenes.filter((x) => x.etapa === et);
    return { texto: xs.length ? `Tenés ${xs.length} en ${TIPOS_TALLER[c.miTaller.tipo].toLowerCase()}:\n` + xs.map((x) => `- ${ordenLabel(x.numero)} · ${n0(unidades(x))} u · entrega ${fdate(x.fechaEntrega)}`).join("\n") : "No tenés órdenes pendientes ahora." };
  }
  if (/como venimos|resumen|mes|como vamos|indicador|tablero/.test(t)) {
    return { texto: `Resumen del mes:\n- ${n0(M.confeccionadas)} prendas confeccionadas\n- Fallas: ${M.tasa == null ? "sin datos" : n1(M.tasa) + "%"}\n- ${M.fin.length} órdenes finalizadas, ${M.cumplimiento == null ? "—" : n0(M.cumplimiento) + "%"} a tiempo\n- ${M.abiertas.length} abiertas, ${M.atrasadas.length} atrasadas\n- ${M.viajes.length} viajes de camioneta` };
  }
  return {
    texto: esTaller
      ? "Puedo registrar entregas (“entregué 120 remeras de la orden 7”) o decirte qué tenés pendiente."
      : "Probá con: “¿cómo va la orden 12?”, “¿qué está atrasado?”, “¿qué taller tiene más fallas?”, “entregaron 80 buzos de la orden 9”, “dejé 200 remeras de la orden 15 en Bordados Centro”.",
  };
}
