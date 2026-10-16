import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Modo Supabase: se activa con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (en .env o en Vercel).
// Sin eso, el sistema funciona en modo demo y guarda todo en el navegador.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

type Row = { id: string; data: unknown };
const TABLAS = ["materiales", "productos", "talleres", "ordenes", "viajes", "procesos"] as const;

/** Traduce los errores de la base a algo que se entienda. */
export function mensajeError(e: unknown): string {
  const m = (e as { message?: string })?.message || String(e);
  if (/row-level security|permission denied|42501/i.test(m)) return "No tenés permiso para hacer eso.";
  if (/orden_valida/.test(m)) return "La orden tiene datos incompletos: cliente, fecha de entrega y al menos una prenda con cantidad.";
  if (/viaje_valido/.test(m)) return "El viaje tiene datos inválidos: revisá paradas, unidades y km.";
  if (/_valido/.test(m)) return "Falta el nombre.";
  if (/duplicate key|23505/.test(m)) return "Ya existe un registro con ese número.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sin conexión. Revisá internet y probá de nuevo.";
  if (/JWT|token|session/i.test(m)) return "Tu sesión venció. Volvé a ingresar.";
  return m.replace(/^.*?ERROR:\s*/, "");
}

let alFallar: (msg: string) => void = (m) => console.warn(m);
// Escrituras en curso: mientras haya alguna, no se recarga desde la base (evita pisar lo que se acaba de guardar).
let pendientes = 0, version = 0;
const escribiendo = async <T,>(f: () => Promise<T>) => { pendientes++; version++; try { return await f(); } finally { pendientes--; version++; } };

export const remote = {
  enabled: !!supabase,
  /** La app registra acá qué hacer cuando un guardado falla (avisar y recargar). */
  onError(fn: (msg: string) => void) { alFallar = fn; },

  ocupado: () => pendientes > 0,
  version: () => version,
  async upsert(tabla: string, item: { id: string }): Promise<boolean> {
    if (!supabase) return true;
    return escribiendo(() => this._upsert(tabla, item));
  },
  async _upsert(tabla: string, item: { id: string }) {
    if (!supabase) return true;
    if (tabla === "usuarios") {
      const u = item as unknown as { id: string; nombre: string; rol: string; tallerId?: string | null; activo: boolean; color: string };
      const { error } = await supabase.from("perfiles").update({ nombre: u.nombre, rol: u.rol, taller_id: u.rol === "taller" ? u.tallerId ?? null : null, activo: u.activo, color: u.color }).eq("id", u.id);
      if (error) { alFallar(mensajeError(error)); return false; }
      return true;
    }
    const { error } = await supabase.from(tabla).upsert({ id: item.id, data: item });
    if (error) { alFallar(mensajeError(error)); return false; }
    return true;
  },
  async remove(tabla: string, id: string) {
    if (!supabase || tabla === "usuarios") return true;
    const { error } = await escribiendo(async () => await supabase!.from(tabla).delete().eq("id", id));
    if (error) { alFallar(mensajeError(error)); return false; }
    return true;
  },
  async saveConfig(config: unknown) {
    if (!supabase) return;
    const { error } = await supabase.from("ajustes").upsert({ id: "general", data: config });
    if (error) alFallar(mensajeError(error));
  },
  async rpcEntrega(ordenId: string, evento: unknown) {
    if (!supabase) return;
    const { error } = await escribiendo(async () => await supabase!.rpc("registrar_entrega", { p_orden: ordenId, p_evento: evento }));
    if (error) { alFallar(mensajeError(error)); throw error; }
  },

  // ---------- Sesión ----------
  async signIn(email: string, password: string) {
    if (!supabase) throw new Error("Supabase no está configurado");
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
    const { data: p } = await supabase.from("perfiles").select("activo,rol").eq("id", data.user.id).maybeSingle();
    if (!p?.activo || !p.rol) { await supabase.auth.signOut(); throw new Error("inactivo"); }
    return data.user;
  },
  async signOut() { if (supabase) await supabase.auth.signOut(); },
  async recuperar(email: string) {
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: location.origin + location.pathname });
    if (error) throw error;
  },
  async nuevaClave(password: string) {
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  // ---------- Datos ----------
  async loadAll() {
    if (!supabase) return null;
    const out: Record<string, unknown> = {};
    const { data: ses } = await supabase.auth.getSession();
    const uidActual = ses.session?.user.id;
    const res = await Promise.all(TABLAS.map((t) => supabase!.from(t).select("id,data")));
    res.forEach((r, i) => { if (r.error) throw r.error; out[TABLAS[i]] = (r.data as Row[]).map((x) => x.data); });
    const { data: perfiles, error: ep } = await supabase.from("perfiles").select("id,nombre,email,rol,taller_id,activo,color");
    if (ep) throw ep;
    out.usuarios = (perfiles || []).filter((p: any) => p.rol).map((p: any) => ({ id: p.id, nombre: p.nombre, email: p.email, rol: p.rol, tallerId: p.taller_id, activo: p.activo, color: p.color || "#E2412A" }));
    const yo = (perfiles || []).find((p: any) => p.id === uidActual);
    // Talleres y chofer no ven costos: reciben un catálogo reducido.
    if (yo && (yo.rol === "taller" || yo.rol === "chofer")) {
      const { data: cat } = await supabase.rpc("catalogo_basico");
      out.productos = ((cat as any[]) || []).map((p) => ({ receta: [], costoCorte: 0, costoConfeccion: 0, costoPersonalizacion: 0, precioVenta: 0, talles: [], ...p }));
    }
    const { data: aj } = await supabase.from("ajustes").select("data").eq("id", "general").maybeSingle();
    if (aj?.data) out.config = aj.data as never;
    return out;
  },
  subscribe(onChange: () => void) {
    if (!supabase) return () => {};
    let t: ReturnType<typeof setTimeout> | undefined;
    const debounce = () => { clearTimeout(t); t = setTimeout(() => (pendientes > 0 ? debounce() : onChange()), 500); };
    const ch = supabase.channel("cambios");
    for (const tb of [...TABLAS, "perfiles", "ajustes"]) ch.on("postgres_changes", { event: "*", schema: "public", table: tb }, debounce);
    ch.subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  },

  // ---------- Asistente ----------
  async asistente(payload: unknown, imagenBase64?: string) {
    if (!supabase) return null;
    const { data, error } = await supabase.functions.invoke("asistente", { body: { ...(payload as object), imagen: imagenBase64 } });
    if (error) throw error;
    return data as { texto: string; acciones?: unknown[] };
  },

  // ---------- Usuarios (función segura en el servidor) ----------
  async usuarios(accion: "crear" | "clave" | "borrar", datos: Record<string, unknown>) {
    if (!supabase) throw new Error("Solo con Supabase");
    const { data, error } = await supabase.functions.invoke("usuarios", { body: { accion, ...datos } });
    if (error) {
      let msg = error.message;
      try { const ctx = (error as any).context; if (ctx?.json) msg = (await ctx.json()).error || msg; } catch { /* sin detalle */ }
      throw new Error(msg);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as { ok: true; id?: string };
  },

  // ---------- Plataforma (super admin) ----------
  async guardarSecreto(nombre: string, valor: string) {
    if (!supabase) throw new Error("Solo con Supabase");
    const { error } = await supabase.rpc("guardar_secreto", { p_nombre: nombre, p_valor: valor });
    if (error) throw new Error(mensajeError(error));
  },
  async estadoSecretos() {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc("estado_secretos");
    if (error) throw new Error(mensajeError(error));
    return (data || []) as { nombre: string; final: string; actualizado: string }[];
  },
  async auditoria(limite = 60) {
    if (!supabase) return [];
    const { data, error } = await supabase.from("auditoria").select("id,tabla,registro,accion,usuario,cuando").order("cuando", { ascending: false }).limit(limite);
    if (error) throw new Error(mensajeError(error));
    return data as { id: number; tabla: string; registro: string; accion: string; usuario: string | null; cuando: string }[];
  },
};
