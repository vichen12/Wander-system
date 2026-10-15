import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Modo Supabase: se activa solo si existen VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.
// Sin eso, el sistema funciona en modo demo y guarda todo en el navegador.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

type Row = { id: string; data: unknown };
const TABLAS = ["materiales", "productos", "talleres", "ordenes", "viajes", "procesos"] as const;

export const remote = {
  enabled: !!supabase,
  async upsert(tabla: string, item: { id: string }) {
    if (!supabase) return;
    if (tabla === "usuarios") {
      const u = item as unknown as { id: string; nombre: string; rol: string; tallerId?: string | null; activo: boolean; color: string };
      const { error } = await supabase.from("perfiles").update({ nombre: u.nombre, rol: u.rol, taller_id: u.tallerId ?? null, activo: u.activo, color: u.color }).eq("id", u.id);
      if (error) console.warn(error); return;
    }
    const { error } = await supabase.from(tabla).upsert({ id: item.id, data: item });
    if (error) console.warn(tabla, error);
  },
  async remove(tabla: string, id: string) {
    if (!supabase || tabla === "usuarios") return;
    const { error } = await supabase.from(tabla).delete().eq("id", id);
    if (error) console.warn(tabla, error);
  },
  async saveConfig(config: unknown) {
    if (!supabase) return;
    const { error } = await supabase.from("ajustes").upsert({ id: "general", data: config });
    if (error) console.warn(error);
  },
  async rpcEntrega(ordenId: string, evento: unknown) {
    if (!supabase) return;
    const { error } = await supabase.rpc("registrar_entrega", { p_orden: ordenId, p_evento: evento });
    if (error) console.warn(error);
  },
  async signIn(email: string, password: string) {
    if (!supabase) throw new Error("Supabase no está configurado");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },
  async signOut() { if (supabase) await supabase.auth.signOut(); },
  async loadAll() {
    if (!supabase) return null;
    const out: Record<string, unknown> = {};
    for (const t of TABLAS) {
      const { data, error } = await supabase.from(t).select("id,data");
      if (error) throw error;
      out[t] = (data as Row[]).map((r) => r.data);
    }
    const { data: aj } = await supabase.from("ajustes").select("data").eq("id", "general").maybeSingle();
    if (aj?.data) out.config = aj.data as never;
    const { data: perfiles } = await supabase.from("perfiles").select("id,nombre,email,rol,taller_id,activo,color");
    out.usuarios = (perfiles || []).map((p: any) => ({ id: p.id, nombre: p.nombre, email: p.email, rol: p.rol, tallerId: p.taller_id, activo: p.activo, color: p.color || "#E2412A" }));
    return out;
  },
  subscribe(onChange: () => void) {
    if (!supabase) return () => {};
    const ch = supabase.channel("cambios");
    for (const t of [...TABLAS, "perfiles"]) ch.on("postgres_changes", { event: "*", schema: "public", table: t }, onChange);
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  },
  async asistente(payload: unknown, imagenBase64?: string) {
    if (!supabase) return null;
    const { data, error } = await supabase.functions.invoke("asistente", { body: { ...(payload as object), imagen: imagenBase64 } });
    if (error) throw error;
    return data as { texto: string; acciones?: unknown[] };
  },
};
