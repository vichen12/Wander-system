import type { Calidad, Config, Evento, Material, Orden, Proceso, Producto, Taller, Usuario, Viaje } from "./types";
import { ETAPA_DE_TALLER } from "./types";
import { addDays, today } from "./format";

// Datos de ejemplo. Se generan relativos a la fecha de hoy para que la demo siempre se vea al día.
// Todos llevan `ejemplo: true` y se borran desde Ajustes → "Borrar datos de ejemplo".

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export const SEED_USUARIOS: Usuario[] = [
  { id: "u-dir", nombre: "Kevin Schejter", email: "kevin@wanderwarm.com.ar", rol: "direccion", activo: true, color: "#E2412A" },
  { id: "u-prod", nombre: "Encargada de producción", email: "produccion@wanderwarm.com.ar", rol: "produccion", activo: true, color: "#2F7D4F" },
  { id: "u-lh", nombre: "Confección Las Heras", email: "lasheras@ejemplo.com", rol: "taller", tallerId: "t-lh", activo: true, color: "#6B5BD2" },
  { id: "u-bord", nombre: "Bordados Centro", email: "bordados@ejemplo.com", rol: "taller", tallerId: "t-bord", activo: true, color: "#C27A16" },
  { id: "u-chofer", nombre: "Chofer de la camioneta", email: "chofer@wanderwarm.com.ar", rol: "chofer", activo: true, color: "#2B6CB0" },
];

export const SEED_MATERIALES: Material[] = [
  { id: "m-algodon", nombre: "Algodón peinado 24/1", unidad: "kg", proveedor: "Hilandería (ejemplo)", costo: 9800, ejemplo: true },
  { id: "m-friza", nombre: "Friza invisible", unidad: "kg", proveedor: "Hilandería (ejemplo)", costo: 11500, ejemplo: true },
  { id: "m-tecnica", nombre: "Tela técnica rompeviento", unidad: "m", proveedor: "Textil importado (ejemplo)", costo: 7200, ejemplo: true },
  { id: "m-guata", nombre: "Guata térmica 120 g", unidad: "m", proveedor: "Textil importado (ejemplo)", costo: 3900, ejemplo: true },
  { id: "m-modulo", nombre: "Módulo calefactor + batería", unidad: "u", proveedor: "Importado (ejemplo)", costo: 18500, ejemplo: true },
  { id: "m-cuello", nombre: "Cuello rib", unidad: "u", proveedor: "Avíos (ejemplo)", costo: 350, ejemplo: true },
  { id: "m-etiqueta", nombre: "Etiqueta bordada", unidad: "u", proveedor: "Avíos (ejemplo)", costo: 120, ejemplo: true },
  { id: "m-cierre", nombre: "Cierre 60 cm", unidad: "u", proveedor: "Avíos (ejemplo)", costo: 1400, ejemplo: true },
];

const AJ4 = { S: 0.92, M: 1, L: 1.08, XL: 1.16, XXL: 1.25 };
const ruta = (c: number, cf: number, p: number, mc: number, mcf: number, mp: number) => [
  { etapa: 2, minutos: mc, costo: c, nota: "Corte por capas con molde" },
  { etapa: 3, minutos: mcf, costo: cf, nota: "Confección en taller tercerizado" },
  { etapa: 4, minutos: mp, costo: p, nota: "Bordado / estampado del logo" },
  { etapa: 5, minutos: 2, costo: 0, nota: "Control de calidad 100%" },
  { etapa: 6, minutos: 1.5, costo: 0, nota: "Doblado, etiqueta y bolsa" },
];
export const SEED_PRODUCTOS: Producto[] = [
  { id: "p-remera", codigo: "WW-REM-01", nombre: "Remera básica", categoria: "Corporativo", talles: ["S", "M", "L", "XL", "XXL"], personalizacion: "Bordado", color: "#E2412A", ajusteTalle: AJ4,
    descripcion: "Remera de algodón peinado 24/1, cuello rib, logo bordado en pecho.",
    receta: [{ materialId: "m-algodon", cantidad: 0.22, merma: 8, nota: "Cuerpo y mangas" }, { materialId: "m-cuello", cantidad: 1, merma: 2 }, { materialId: "m-etiqueta", cantidad: 1, merma: 1 }],
    ruta: ruta(400, 1800, 900, 1.5, 12, 4), costoCorte: 400, costoConfeccion: 1800, costoPersonalizacion: 900, precioVenta: 14500, ejemplo: true },
  { id: "p-buzo", codigo: "WW-BUZ-01", nombre: "Buzo canguro", categoria: "Corporativo", talles: ["S", "M", "L", "XL"], personalizacion: "Estampado", color: "#C27A16", ajusteTalle: AJ4,
    descripcion: "Buzo de friza invisible con capucha y bolsillo canguro, estampa frontal.",
    receta: [{ materialId: "m-friza", cantidad: 0.65, merma: 10, nota: "Cuerpo, capucha y bolsillo" }, { materialId: "m-etiqueta", cantidad: 1, merma: 1 }],
    ruta: ruta(700, 3800, 1200, 3, 25, 5), costoCorte: 700, costoConfeccion: 3800, costoPersonalizacion: 1200, precioVenta: 32000, ejemplo: true },
  { id: "p-chaleco", codigo: "WW-CHA-CAL", nombre: "Chaleco calefaccionado", categoria: "Calefaccionado", talles: ["S", "M", "L", "XL"], personalizacion: "Bordado", color: "#6B5BD2", ajusteTalle: AJ4,
    descripcion: "Chaleco rompeviento con guata térmica y módulo calefactor de 3 zonas con batería.",
    receta: [{ materialId: "m-tecnica", cantidad: 1.1, merma: 12, nota: "Exterior y forro" }, { materialId: "m-guata", cantidad: 0.9, merma: 6 }, { materialId: "m-modulo", cantidad: 1, merma: 0, nota: "3 placas + botón + batería" }, { materialId: "m-cierre", cantidad: 1, merma: 2 }, { materialId: "m-etiqueta", cantidad: 1, merma: 1 }],
    ruta: ruta(900, 6500, 1000, 4, 45, 4), costoCorte: 900, costoConfeccion: 6500, costoPersonalizacion: 1000, precioVenta: 119000, ejemplo: true },
  { id: "p-campera", codigo: "WW-CAM-CAL", nombre: "Campera calefaccionada", categoria: "Calefaccionado", talles: ["S", "M", "L", "XL"], personalizacion: "Bordado", color: "#2B6CB0", ajusteTalle: AJ4,
    descripcion: "Campera técnica con capucha, guata térmica y módulo calefactor con batería.",
    receta: [{ materialId: "m-tecnica", cantidad: 1.8, merma: 12, nota: "Exterior, forro y capucha" }, { materialId: "m-guata", cantidad: 1.5, merma: 6 }, { materialId: "m-modulo", cantidad: 1, merma: 0 }, { materialId: "m-cierre", cantidad: 1, merma: 2 }, { materialId: "m-etiqueta", cantidad: 1, merma: 1 }],
    ruta: ruta(1400, 9800, 1000, 6, 70, 4), costoCorte: 1400, costoConfeccion: 9800, costoPersonalizacion: 1000, precioVenta: 189000, ejemplo: true },
];

export const SEED_TALLERES: Taller[] = [
  { id: "t-corte", nombre: "Corte Guaymallén", tipo: "corte", contacto: "Taller de corte (ejemplo)", telefono: "261 000-0001", zona: "Guaymallén", capacidadSemanal: 900, ejemplo: true },
  { id: "t-lh", nombre: "Confección Las Heras", tipo: "confeccion", contacto: "Taller de confección (ejemplo)", telefono: "261 000-0002", zona: "Las Heras", capacidadSemanal: 450, ejemplo: true },
  { id: "t-gc", nombre: "Confección Godoy Cruz", tipo: "confeccion", contacto: "Taller de confección (ejemplo)", telefono: "261 000-0003", zona: "Godoy Cruz", capacidadSemanal: 350, ejemplo: true },
  { id: "t-bord", nombre: "Bordados Centro", tipo: "bordado", contacto: "Bordadora (ejemplo)", telefono: "261 000-0004", zona: "Ciudad", capacidadSemanal: 600, ejemplo: true },
  { id: "t-est", nombre: "Estampados Sur", tipo: "estampado", contacto: "Estampador (ejemplo)", telefono: "261 000-0005", zona: "Maipú", capacidadSemanal: 700, ejemplo: true },
];

const CLIENTES = ["Bodega Andina", "Constructora Cuyo", "Club de Montaña", "Agencia Aconcagua", "Hotel Potrerillos", "Minera del Oeste", "Centro de Esquí", "Transportes Cuyanos", "Universidad (área deportes)", "Cooperativa Vitícola"];

export function buildSeed() {
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const T = today();
  const ordenes: Orden[] = [];
  const viajes: Viaje[] = [];
  let id = 0;
  const N = 34;
  for (let i = 0; i < N; i++) {
    const numero = i + 1;
    const ageDays = Math.round(95 - i * (93 / N) + r() * 3);
    const creada = addDays(T, -ageDays);
    const tipo: "venta" | "stock" = r() < 0.32 ? "stock" : "venta";
    const prod = pick(SEED_PRODUCTOS);
    const talles = prod.talles.filter(() => r() < 0.6).slice(0, 3);
    if (!talles.length) talles.push(prod.talles[1]);
    const base = prod.id === "p-campera" || prod.id === "p-chaleco" ? 15 + Math.round(r() * 35) : 40 + Math.round(r() * 110);
    const lineas = talles.map((t) => ({ productoId: prod.id, talle: t, cantidad: Math.max(10, Math.round((base * (0.6 + r() * 0.8)) / 5) * 5) }));
    const tot = lineas.reduce((a, l) => a + l.cantidad, 0);
    const plazo = i === N - 7 || i === N - 10 ? 9 : 18 + Math.round(r() * 12);
    const fechaEntrega = addDays(creada, plazo);
    // velocidad: cuántos días tarda cada etapa
    const dur = [0, 3 + r() * 3, 2 + r() * 2, 5 + r() * 5, 3 + r() * 3, 1 + r() * 2, 1 + r() * 1.5];
    const conf = r() < 0.55 ? "t-lh" : "t-gc";
    const pers = prod.personalizacion === "Estampado" ? "t-est" : "t-bord";
    const historial: Evento[] = [];
    const calidad: Calidad[] = [];
    let d = creada;
    let etapa = 1;
    historial.push({ id: "e" + id++, tipo: "avance", etapa: 1, fecha: d, ts: Date.parse(d) + 1 });
    let fechaFin: string | undefined;
    for (let e = 1; e <= 6; e++) {
      const next = addDays(d, Math.round(dur[e]));
      if (next > T) break;
      // entregas de la etapa
      if (e === 2) historial.push({ id: "e" + id++, tipo: "entrega", etapa: 2, unidades: tot, tallerId: "t-corte", obs: "", fecha: next, ts: Date.parse(next) + 10 });
      if (e === 3) { const a = Math.round(tot * 0.5); historial.push({ id: "e" + id++, tipo: "entrega", etapa: 3, unidades: a, tallerId: conf, obs: "", fecha: addDays(next, -2), ts: Date.parse(addDays(next, -2)) + 10 }); historial.push({ id: "e" + id++, tipo: "entrega", etapa: 3, unidades: tot - a, tallerId: conf, obs: "", fecha: next, ts: Date.parse(next) + 11 }); }
      if (e === 4) historial.push({ id: "e" + id++, tipo: "entrega", etapa: 4, unidades: tot, tallerId: pers, obs: "", fecha: next, ts: Date.parse(next) + 10 });
      if (e === 5) {
        const resp = r() < 0.5 ? conf : pers;
        const base = resp === "t-est" ? 0.055 : resp === "t-gc" ? 0.028 : 0.014;
        const fallas = Math.round(tot * base * (0.5 + r()));
        calidad.push({ id: "c" + id++, tallerId: resp, revisadas: tot, fallas, motivo: fallas ? pick(["Costura despareja", "Estampa corrida", "Talle mal etiquetado", "Hilo suelto", "Mancha de aceite"]) : "", fecha: next });
      }
      d = next;
      etapa = e + 1;
      historial.push({ id: "e" + id++, tipo: "avance", etapa, fecha: d, ts: Date.parse(d) + 20 + e });
      if (etapa === 7) { fechaFin = d; const fal = calidad.reduce((a, c) => a + c.fallas, 0); historial.push({ id: "e" + id++, tipo: "entrega", etapa: 6, unidades: tot - fal, tallerId: null, obs: "", fecha: d, ts: Date.parse(d) + 30 }); }
    }
    // entregas parciales en curso
    if (etapa === 3 && r() < 0.7) historial.push({ id: "e" + id++, tipo: "entrega", etapa: 3, unidades: Math.round(tot * (0.2 + r() * 0.4)), tallerId: conf, obs: "", fecha: addDays(T, -1), ts: Date.parse(addDays(T, -1)) + 5 });
    const cliente = tipo === "stock" ? "Stock temporada " + (new Date().getFullYear() + 1) : pick(CLIENTES);
    ordenes.push({
      id: "o-" + String(numero).padStart(3, "0"), numero, tipo, cliente, factura: tipo === "venta" ? `A-0003-${String(1200 + numero).padStart(8, "0")}` : "",
      prioridad: r() < 0.18 ? "alta" : "normal", fechaEntrega, lineas, etapa, creada, fechaFin, destino: fechaFin ? (tipo === "stock" ? "deposito" : "cliente") : undefined,
      historial: historial.sort((a, b) => a.ts - b.ts), calidad, notas: "", ejemplo: true,
    });
    // viajes asociados a cada traspaso entre talleres
    const tal = (x: string) => SEED_TALLERES.find((t) => t.id === x)!.nombre;
    const hops: [number, string, string, string][] = [
      [2, "Fábrica", tal("t-corte"), "Tela para " + tot + " prendas"],
      [3, tal("t-corte"), tal(conf), tot + " prendas cortadas"],
      [4, tal(conf), tal(pers), tot + " prendas confeccionadas"],
      [5, tal(pers), "Fábrica", tot + " prendas personalizadas"],
    ];
    for (const [e, o, de, c] of hops) {
      const ev = historial.find((h) => h.tipo === "avance" && h.etapa === e);
      if (ev) viajes.push({ id: "v" + id++, fecha: ev.fecha, origen: o, destino: de, carga: c, ordenes: [numero], km: Math.round(8 + r() * 22), choferId: "u-chofer", ejemplo: true });
    }
  }
  return { ordenes, viajes };
}

export { ETAPA_DE_TALLER };

export const SEED_CONFIG: Config = {
  empresa: { nombre: "Wanderwarm", razonSocial: "", cuit: "", direccion: "Mendoza, Argentina", telefono: "", email: "hola@wanderwarm.com.ar" },
  produccion: { metaFallas: 3, diasAlerta: 5, capacidadAlerta: 90, plazoDefault: 21, requiereCalidad: true, permitirSaltarEtapas: true, prefijoOrden: "#" },
  alertas: { atrasadas: true, fallas: true, entregas: true, capacidad: false, resumenDiario: true, horaResumen: "08:00", canal: "app", destinatarios: "" },
  lugares: [
    { id: "l-fab", nombre: "Fábrica", tipo: "propio", direccion: "Mendoza", kmDesdeFabrica: 0 },
    { id: "l-dep", nombre: "Depósito", tipo: "propio", direccion: "Mendoza", kmDesdeFabrica: 6 },
  ],
  motivosFalla: ["Costura despareja", "Estampa corrida", "Bordado desalineado", "Talle mal etiquetado", "Hilo suelto", "Mancha", "Módulo calefactor no enciende"],
  categorias: ["Corporativo", "Calefaccionado", "Merch", "Accesorios"],
  tallesEstandar: ["XS", "S", "M", "L", "XL", "XXL"],
  apariencia: { densidad: "comoda", animaciones: true, inicio: "/tablero" },
  integraciones: { facturacion: false, whatsapp: false, whatsappNumero: "", mailContador: "" },
};

const hoy = () => new Date().toISOString().slice(0, 10);
export const SEED_PROCESOS: Proceso[] = [
  { id: "sop-0", etapa: 0, titulo: "Cómo funciona una orden de producción", objetivo: "Que todos sepan por qué etapas pasa una prenda y quién es responsable de cada una.", responsable: "Encargada de producción", tiempo: "Plazo estándar: 21 días",
    pasos: ["Toda producción arranca con una orden: por una venta (con factura) o para stock.", "La orden se crea en el sistema con productos, talles, cantidades y fecha de entrega.", "Cada etapa se registra en el sistema el mismo día que ocurre.", "Una orden solo pasa de etapa cuando la anterior está completa.", "Si algo se atrasa, se avisa a producción y se anota en la orden."],
    checklist: ["La orden tiene cliente o temporada", "Tiene fecha de entrega", "Las cantidades por talle están revisadas"], criterios: ["Nada se produce sin orden cargada"], errores: ["Producir sin orden y cargarla después", "No registrar entregas parciales"], actualizado: hoy(), version: 1 },
  { id: "sop-1", etapa: 1, titulo: "Compra de tela e insumos", objetivo: "Comprar exactamente lo que pide el BOM, con la merma incluida.", responsable: "Producción", tiempo: "2 a 5 días",
    pasos: ["Abrí la orden y mirá \"Materiales según BOM\": ya incluye la merma.", "Pedí cotización a los proveedores habituales.", "Al recibir la tela, pesala o medila y compará con lo pedido.", "Registrá en la orden cuántas prendas cubre la tela recibida.", "Mandá la tela al taller de corte y registrá el viaje."],
    checklist: ["Color y lote coinciden con la muestra", "Cantidad recibida ≥ cantidad del BOM", "Remito del proveedor guardado"], criterios: ["Diferencia de color: rechazar", "Faltante mayor al 3%: reclamar al proveedor"], errores: ["Comprar sin contar la merma", "Mezclar lotes de color distinto en una misma orden"], actualizado: hoy(), version: 1 },
  { id: "sop-2", etapa: 2, titulo: "Corte", objetivo: "Cortar todas las piezas con el molde correcto y el mínimo desperdicio.", responsable: "Taller de corte", tiempo: "1 a 3 días",
    pasos: ["Verificá que el molde sea la última versión del producto.", "Tendé la tela en capas, siempre al hilo.", "Cortá por talle según la orden.", "Atá cada paquete con una etiqueta: orden, talle y cantidad.", "Informá en el sistema las prendas cortadas (o mandá foto al asistente)."],
    checklist: ["Molde correcto", "Paquetes etiquetados por talle", "Recortes sobrantes separados"], criterios: ["Piezas con diferencia mayor a 5 mm: se descartan"], errores: ["Cortar contra el hilo", "Mezclar talles en un mismo paquete"], actualizado: hoy(), version: 1 },
  { id: "sop-3", etapa: 3, titulo: "Confección", objetivo: "Coser las prendas con la calidad estándar de Wanderwarm.", responsable: "Taller de confección", tiempo: "5 a 10 días",
    pasos: ["Revisá que los paquetes de corte estén completos antes de empezar.", "Seguí la ficha técnica del producto (costuras, puntadas por cm).", "En prendas calefaccionadas, colocá las placas y el cableado según el plano antes de cerrar el forro.", "Informá entregas parciales cada vez que mandes prendas.", "Avisá a producción si falta material."],
    checklist: ["Costuras rectas y rematadas", "Etiqueta de talle cosida", "Módulo calefactor probado (encender 10 segundos)"], criterios: ["Puntada abierta o torcida: se devuelve", "Módulo que no enciende: se devuelve"], errores: ["Cerrar el forro sin probar el módulo", "No informar entregas parciales"], actualizado: hoy(), version: 1 },
  { id: "sop-4", etapa: 4, titulo: "Personalización (bordado, estampado, sublimado)", objetivo: "Aplicar el logo del cliente en la posición y tamaño acordados.", responsable: "Bordadora / estampador", tiempo: "2 a 4 días",
    pasos: ["Pedí la aprobación del diseño (arte final) antes de producir.", "Hacé una prenda de muestra y mandá foto a producción.", "Con el OK, producí el resto.", "Informá las prendas terminadas en el sistema."],
    checklist: ["Arte aprobado por el cliente", "Muestra aprobada por producción", "Posición: 8 cm debajo del cuello, centrado"], criterios: ["Desalineado más de 5 mm: se rehace", "Color distinto al Pantone pedido: se rehace"], errores: ["Producir sin muestra aprobada", "Usar un archivo de logo viejo"], actualizado: hoy(), version: 1 },
  { id: "sop-5", etapa: 5, titulo: "Control de calidad", objetivo: "Que ninguna prenda con falla llegue al cliente y saber qué taller la causó.", responsable: "Producción", tiempo: "1 día",
    pasos: ["Revisá el 100% de las prendas (en pedidos de más de 500, mínimo 20%).", "Separá las prendas con falla y anotá el motivo.", "Cargá en el sistema: revisadas, con falla, motivo y taller responsable.", "Devolvé las prendas con falla al taller responsable."],
    checklist: ["Costuras", "Medidas por talle", "Logo", "Módulo calefactor encendido", "Etiquetas"], criterios: ["Meta: menos de 3% de fallas por taller"], errores: ["No anotar el motivo de la falla", "Atribuir la falla al taller equivocado"], actualizado: hoy(), version: 1 },
  { id: "sop-6", etapa: 6, titulo: "Empaquetado y despacho", objetivo: "Que el cliente reciba exactamente lo que pidió, prolijo.", responsable: "Producción", tiempo: "1 día",
    pasos: ["Doblá cada prenda con la técnica estándar.", "Embolsá con etiqueta de talle visible.", "Armá las cajas por talle y pegá el rótulo (orden, cliente, cantidad).", "Si es venta, adjuntá remito y factura. Si es stock, ingresá al depósito.", "Finalizá la orden en el sistema."],
    checklist: ["Cantidad por talle igual a la orden", "Remito impreso", "Cajas rotuladas"], criterios: ["Faltante de una sola prenda: no se despacha"], errores: ["Despachar sin contar", "Mezclar talles en una caja"], actualizado: hoy(), version: 1 },
  { id: "sop-7", etapa: 7, titulo: "Viajes de la camioneta", objetivo: "Registrar cada movimiento de mercadería entre fábrica, talleres y depósito.", responsable: "Chofer", tiempo: "Cada viaje",
    pasos: ["Antes de salir, contá lo que llevás.", "Pedí que te firmen el remito al entregar.", "Registrá el viaje en el sistema o mandale un mensaje al asistente: “llevé 200 remeras de la fábrica a Bordados Centro”.", "Indicá a qué órdenes corresponde la carga."],
    checklist: ["Carga contada", "Remito firmado", "Viaje registrado el mismo día"], criterios: [], errores: ["Registrar los viajes a fin de semana de memoria"], actualizado: hoy(), version: 1 },
];
