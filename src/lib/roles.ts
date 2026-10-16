import type { Rol } from "./types";
export type Permiso = "verCostos" | "verTablero" | "crearOrdenes" | "moverOrdenes" | "editarOrdenes" | "eliminar" | "editarCatalogo" | "cargarCalidad" | "cargarViajes" | "cargarEntregas" | "gestionarEquipo" | "ajustes" | "verTalleres" | "verLogistica" | "plataforma";
const DIRECCION: Permiso[] = ["verCostos","verTablero","crearOrdenes","moverOrdenes","editarOrdenes","eliminar","editarCatalogo","cargarCalidad","cargarViajes","cargarEntregas","gestionarEquipo","ajustes","verTalleres","verLogistica"];
const P: Record<Rol, Permiso[]> = {
  superadmin: [...DIRECCION, "plataforma"],
  direccion: DIRECCION,
  produccion: ["verTablero","crearOrdenes","moverOrdenes","editarOrdenes","editarCatalogo","cargarCalidad","cargarViajes","cargarEntregas","verTalleres","verLogistica"],
  taller: ["cargarEntregas"],
  chofer: ["cargarViajes","verLogistica"],
};
export const can = (rol: Rol | undefined, p: Permiso) => !!rol && P[rol].includes(p);
