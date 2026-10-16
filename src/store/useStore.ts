import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Calidad, Config, Evento, Material, Mensaje, Orden, Proceso, Producto, Rol, Taller, Usuario, Viaje } from "../lib/types";
import { SEED_CONFIG, SEED_MATERIALES, SEED_PROCESOS, SEED_PRODUCTOS, SEED_TALLERES, SEED_USUARIOS, buildSeed } from "../lib/seed";
import { today, uid } from "../lib/format";
import { remote } from "../lib/supabase";

export type Tabla = "materiales" | "productos" | "talleres" | "ordenes" | "viajes" | "usuarios" | "procesos";

interface State {
  usuarios: Usuario[]; materiales: Material[]; productos: Producto[]; talleres: Taller[]; ordenes: Orden[]; viajes: Viaje[]; procesos: Proceso[];
  config: Config; chatAbierto: boolean; setChatAbierto: (v: boolean) => void;
  setConfig: <K extends keyof Config>(k: K, v: Config[K]) => void;
  sesion: string | null; // id del usuario logueado
  vistaComo: Rol | null; // previsualizar otro rol (solo Dirección)
  tema: "claro" | "oscuro";
  chat: Mensaje[];
  seeded: boolean;
  // acciones
  login: (id: string) => void; logout: () => void; setVistaComo: (r: Rol | null) => void; setTema: (t: "claro" | "oscuro") => void;
  hydrateRemote: (data: Partial<Pick<State, Tabla>>) => void;
  crearOrden: (o: Omit<Orden, "id" | "numero" | "historial" | "calidad" | "etapa" | "creada">) => Orden;
  editarOrden: (id: string, patch: Partial<Orden>) => void;
  eliminarOrden: (id: string) => void;
  registrarEntrega: (ordenId: string, e: { unidades: number; tallerId: string | null; obs?: string; via?: string }) => void;
  registrarCalidad: (ordenId: string, c: Omit<Calidad, "id" | "fecha">) => void;
  moverEtapa: (ordenId: string, etapa: number, via?: string) => void;
  guardar: <K extends Exclude<Tabla, "ordenes">>(tabla: K, item: State[K][number]) => void;
  eliminar: (tabla: Exclude<Tabla, "ordenes">, id: string) => void;
  pushMsg: (m: Omit<Mensaje, "id" | "ts">) => string;
  updMsg: (id: string, patch: Partial<Mensaje>) => void;
  limpiarChat: () => void;
  borrarEjemplos: () => void;
  restaurarDemo: () => void;
}

function seedState() {
  // Con Supabase no se muestran datos de ejemplo: todo viene de la base.
  if (remote.enabled) return { usuarios: [], materiales: [], productos: [], talleres: [], ordenes: [], viajes: [], procesos: [], seeded: true };
  const { ordenes, viajes } = buildSeed();
  return { usuarios: SEED_USUARIOS, materiales: SEED_MATERIALES, productos: SEED_PRODUCTOS, talleres: SEED_TALLERES, ordenes, viajes, procesos: SEED_PROCESOS, seeded: true };
}

const sync = (tabla: Tabla, item: { id: string }) => { remote.upsert(tabla, item); };
const unsync = (tabla: Tabla, id: string) => { remote.remove(tabla, id); };

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...seedState(),
      sesion: null, vistaComo: null, tema: "claro", chat: [], config: SEED_CONFIG, chatAbierto: false,
      setChatAbierto: (v) => set({ chatAbierto: v }),
      setConfig: (k, v) => { const config = { ...get().config, [k]: v }; set({ config }); remote.saveConfig(config); },
      login: (id) => set({ sesion: id, vistaComo: null }),
      logout: () => { remote.signOut(); set({ sesion: null, vistaComo: null, chat: [] }); },
      setVistaComo: (r) => set({ vistaComo: r, chat: [] }),
      setTema: (t) => set({ tema: t }),
      hydrateRemote: (data) => set(data as Partial<State>),

      crearOrden: (o) => {
        const numero = Math.max(0, ...get().ordenes.map((x) => x.numero)) + 1;
        const ts = Date.now();
        const orden: Orden = { ...o, id: uid("o-"), numero, etapa: 1, creada: today(), historial: [{ id: uid("e"), tipo: "avance", etapa: 1, fecha: today(), ts, por: get().sesion || undefined }], calidad: [] };
        set({ ordenes: [orden, ...get().ordenes] }); sync("ordenes", orden); return orden;
      },
      editarOrden: (id, patch) => {
        const ordenes = get().ordenes.map((o) => (o.id === id ? { ...o, ...patch } : o));
        set({ ordenes }); const o = ordenes.find((x) => x.id === id); if (o) sync("ordenes", o);
      },
      eliminarOrden: (id) => { set({ ordenes: get().ordenes.filter((o) => o.id !== id) }); unsync("ordenes", id); },
      registrarEntrega: (ordenId, e) => {
        const o = get().ordenes.find((x) => x.id === ordenId); if (!o) return;
        const ev: Evento = { id: uid("e"), tipo: "entrega", etapa: o.etapa, unidades: e.unidades, tallerId: e.tallerId, obs: e.obs || "", fecha: today(), ts: Date.now(), por: get().sesion || undefined, via: e.via };
        const real = get().usuarios.find((u) => u.id === get().sesion)?.rol;
        if (remote.enabled && real === "taller") {
          // Los talleres no pueden editar órdenes: la entrega pasa por una función segura en Supabase.
          set({ ordenes: get().ordenes.map((x) => (x.id === ordenId ? { ...x, historial: [...x.historial, ev] } : x)) });
          remote.rpcEntrega(ordenId, ev).catch(() => {}); return;
        }
        get().editarOrden(ordenId, { historial: [...o.historial, ev] });
      },
      registrarCalidad: (ordenId, c) => {
        const o = get().ordenes.find((x) => x.id === ordenId); if (!o) return;
        get().editarOrden(ordenId, { calidad: [...o.calidad, { ...c, id: uid("c"), fecha: today(), por: get().sesion || undefined }] });
      },
      moverEtapa: (ordenId, etapa, via) => {
        const o = get().ordenes.find((x) => x.id === ordenId); if (!o || etapa === o.etapa) return;
        const ev: Evento = { id: uid("e"), tipo: "avance", etapa, fecha: today(), ts: Date.now(), por: get().sesion || undefined, via };
        const patch: Partial<Orden> = { etapa, historial: [...o.historial, ev] };
        if (etapa === 7) { patch.fechaFin = today(); patch.destino = o.tipo === "stock" ? "deposito" : "cliente"; }
        if (etapa < 7 && o.etapa === 7) { patch.fechaFin = undefined; patch.destino = undefined; }
        get().editarOrden(ordenId, patch);
      },
      guardar: (tabla, item) => {
        const arr = get()[tabla] as { id: string }[];
        const exists = arr.some((x) => x.id === item.id);
        set({ [tabla]: exists ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item] } as Partial<State>);
        sync(tabla, item);
      },
      eliminar: (tabla, id) => { set({ [tabla]: (get()[tabla] as { id: string }[]).filter((x) => x.id !== id) } as Partial<State>); unsync(tabla, id); },
      pushMsg: (m) => { const id = uid("m"); set({ chat: [...get().chat, { ...m, id, ts: Date.now() }] }); return id; },
      updMsg: (id, patch) => set({ chat: get().chat.map((m) => (m.id === id ? { ...m, ...patch } : m)) }),
      limpiarChat: () => set({ chat: [] }),
      borrarEjemplos: () => {
        const s = get();
        const del = <T extends { id: string; ejemplo?: boolean }>(t: Tabla, arr: T[]) => { arr.filter((x) => x.ejemplo).forEach((x) => unsync(t, x.id)); return arr.filter((x) => !x.ejemplo); };
        set({ ordenes: del("ordenes", s.ordenes), viajes: del("viajes", s.viajes), productos: del("productos", s.productos), materiales: del("materiales", s.materiales), talleres: del("talleres", s.talleres) });
      },
      restaurarDemo: () => set({ ...seedState(), chat: [] }),
    }),
    {
      name: "wanderwarm-produccion-v2",
      partialize: (s) => (remote.enabled
        ? { sesion: s.sesion, tema: s.tema }
        : { usuarios: s.usuarios, materiales: s.materiales, productos: s.productos, talleres: s.talleres, ordenes: s.ordenes, viajes: s.viajes, procesos: s.procesos, config: s.config, sesion: s.sesion, tema: s.tema, seeded: s.seeded }),
    },
  ),
);

export function currentRol(s: Pick<State, "usuarios" | "sesion" | "vistaComo">): Rol | undefined {
  const u = s.usuarios.find((x) => x.id === s.sesion);
  if (!u) return undefined;
  return ((u.rol === "direccion" || u.rol === "superadmin") && s.vistaComo) || u.rol;
}
export const useYo = () => useStore((s) => s.usuarios.find((u) => u.id === s.sesion));
export const useRol = () => useStore((s) => currentRol(s));
/** Taller del usuario actual (o el primero de su tipo cuando Dirección previsualiza como taller). */
export const useMiTaller = () => useStore((s) => {
  const u = s.usuarios.find((x) => x.id === s.sesion);
  if (u?.rol === "taller") return s.talleres.find((t) => t.id === u.tallerId);
  if (s.vistaComo === "taller") return s.talleres.find((t) => t.id === "t-lh") || s.talleres[0];
  return undefined;
});
