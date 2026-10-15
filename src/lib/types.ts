export type Rol = "direccion" | "produccion" | "taller" | "chofer";
export type TipoTaller = "corte" | "confeccion" | "bordado" | "estampado" | "sublimado";
export type Unidad = "kg" | "m" | "u";

export interface Usuario { id: string; nombre: string; email: string; rol: Rol; tallerId?: string | null; activo: boolean; color: string }
export interface Material { id: string; nombre: string; unidad: Unidad; proveedor: string; costo: number; ejemplo?: boolean }
export interface RecetaItem { materialId: string; cantidad: number; merma?: number; nota?: string }
export interface PasoRuta { etapa: number; minutos: number; costo: number; nota: string }
export interface Producto { id: string; codigo?: string; foto?: string; tipoPrenda?: "remera" | "buzo" | "chaleco" | "campera"; nombre: string; categoria: string; ajusteTalle?: Record<string, number>; ruta?: PasoRuta[]; descripcion?: string; talles: string[]; personalizacion: string; receta: RecetaItem[]; costoCorte: number; costoConfeccion: number; costoPersonalizacion: number; precioVenta: number; color: string; ejemplo?: boolean }
export interface Taller { id: string; nombre: string; tipo: TipoTaller; contacto: string; telefono: string; zona: string; capacidadSemanal: number; ejemplo?: boolean }
export interface Linea { productoId: string; talle: string; cantidad: number }
export type Evento =
  | { id: string; tipo: "avance"; etapa: number; fecha: string; ts: number; por?: string; via?: string }
  | { id: string; tipo: "entrega"; etapa: number; unidades: number; tallerId: string | null; obs: string; fecha: string; ts: number; por?: string; via?: string };
export interface Calidad { id: string; tallerId: string; revisadas: number; fallas: number; motivo: string; fecha: string; por?: string }
export interface Orden {
  id: string; numero: number; tipo: "venta" | "stock"; cliente: string; factura: string; prioridad: "normal" | "alta";
  fechaEntrega: string; lineas: Linea[]; etapa: number; creada: string; fechaFin?: string; destino?: "cliente" | "deposito";
  historial: Evento[]; calidad: Calidad[]; notas: string; ejemplo?: boolean;
}
export interface Viaje { id: string; fecha: string; origen: string; destino: string; carga: string; ordenes: number[]; km: number; choferId?: string | null; via?: string; ejemplo?: boolean }
export interface Mensaje { id: string; de: "yo" | "bot"; texto: string; img?: string; accion?: AccionPropuesta; ts: number }
export type AccionPropuesta =
  | { tipo: "entrega"; ordenId: string; unidades: number; tallerId: string | null; desc: string; estado: "pendiente" | "hecha" | "descartada" }
  | { tipo: "avance"; ordenId: string; desc: string; estado: "pendiente" | "hecha" | "descartada" }
  | { tipo: "calidad"; ordenId: string; tallerId: string; revisadas: number; fallas: number; motivo: string; desc: string; estado: "pendiente" | "hecha" | "descartada" }
  | { tipo: "viaje"; viaje: Omit<Viaje, "id">; desc: string; estado: "pendiente" | "hecha" | "descartada" };

export const ETAPAS = ["Orden", "Compra de tela", "Corte", "Confección", "Personalización", "Control de calidad", "Empaquetado", "Finalizada"] as const;
export const ETAPA_DESC = ["", "Se compra la tela e insumos según receta", "Se corta la tela recibida", "Taller de confección tercerizado", "Bordado, sublimado o estampado", "Se revisan las prendas", "Listo para salir", "Enviada al cliente o en depósito"];
export const TIPOS_TALLER: Record<TipoTaller, string> = { corte: "Corte", confeccion: "Confección", bordado: "Bordado", estampado: "Estampado", sublimado: "Sublimado" };
export const ETAPA_DE_TALLER: Record<TipoTaller, number> = { corte: 2, confeccion: 3, bordado: 4, estampado: 4, sublimado: 4 };
export const ROLES: Record<Rol, { nombre: string; desc: string }> = {
  direccion: { nombre: "Dirección", desc: "Ve todo: tablero, costos, órdenes, catálogo y equipo." },
  produccion: { nombre: "Producción", desc: "Crea y mueve órdenes, carga calidad y viajes. No ve costos." },
  taller: { nombre: "Taller", desc: "Informa las entregas de su taller, por formulario o por chat." },
  chofer: { nombre: "Chofer", desc: "Registra los viajes de la camioneta." },
};

export interface Proceso {
  id: string; etapa: number; titulo: string; objetivo: string; responsable: string; tiempo: string;
  pasos: string[]; checklist: string[]; criterios: string[]; errores: string[]; actualizado: string; version: number;
}
export interface Lugar { id: string; nombre: string; tipo: "propio" | "proveedor" | "cliente"; direccion: string; kmDesdeFabrica: number }
export interface Config {
  empresa: { nombre: string; razonSocial: string; cuit: string; direccion: string; telefono: string; email: string };
  produccion: { metaFallas: number; diasAlerta: number; capacidadAlerta: number; plazoDefault: number; requiereCalidad: boolean; permitirSaltarEtapas: boolean; prefijoOrden: string };
  alertas: { atrasadas: boolean; fallas: boolean; entregas: boolean; capacidad: boolean; resumenDiario: boolean; horaResumen: string; canal: "app" | "mail" | "whatsapp"; destinatarios: string };
  lugares: Lugar[];
  motivosFalla: string[];
  categorias: string[];
  tallesEstandar: string[];
  apariencia: { densidad: "comoda" | "compacta"; animaciones: boolean; inicio: string };
  integraciones: { facturacion: boolean; whatsapp: boolean; whatsappNumero: string; mailContador: string };
}
