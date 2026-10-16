// Supabase Edge Function: alta y administración de usuarios.
// Solo la pueden usar Dirección y el super admin. Usa la clave de servicio del lado del servidor.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });
const ROLES = ["superadmin", "direccion", "produccion", "taller", "chofer"];
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 160;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "Sesión inválida" }, 401);
    const { data: yo } = await admin.from("perfiles").select("rol,activo").eq("id", u.user.id).single();
    if (!yo?.activo || !["superadmin", "direccion"].includes(yo.rol)) return json({ error: "Solo Dirección puede administrar usuarios" }, 403);
    const soySuper = yo.rol === "superadmin";
    const b = await req.json();

    if (b.accion === "crear") {
      const email = String(b.email || "").trim().toLowerCase();
      const nombre = String(b.nombre || "").trim().slice(0, 80);
      const rol = String(b.rol || "");
      const password = String(b.password || "");
      if (!emailOk(email)) return json({ error: "El mail no es válido" }, 400);
      if (!nombre) return json({ error: "Falta el nombre" }, 400);
      if (!ROLES.includes(rol)) return json({ error: "Rol inválido" }, 400);
      if (rol === "superadmin" && !soySuper) return json({ error: "Solo un super admin puede crear otro super admin" }, 403);
      if (password.length < 8) return json({ error: "La contraseña tiene que tener al menos 8 caracteres" }, 400);
      if (rol === "taller") {
        if (!b.tallerId) return json({ error: "Elegí el taller" }, 400);
        const { data: t } = await admin.from("talleres").select("id").eq("id", b.tallerId).maybeSingle();
        if (!t) return json({ error: "El taller no existe" }, 400);
      }
      const { data: creado, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre } });
      if (error) return json({ error: /already|registered|exists/i.test(error.message) ? "Ya existe un usuario con ese mail" : error.message }, 400);
      const { error: ep } = await admin.from("perfiles").upsert({ id: creado.user.id, email, nombre, rol, taller_id: rol === "taller" ? b.tallerId : null, activo: true, color: typeof b.color === "string" ? b.color.slice(0, 9) : "#E2412A" });
      if (ep) { await admin.auth.admin.deleteUser(creado.user.id); return json({ error: ep.message }, 400); }
      return json({ ok: true, id: creado.user.id });
    }

    const id = String(b.id || "");
    const { data: obj } = await admin.from("perfiles").select("rol").eq("id", id).maybeSingle();
    if (!obj) return json({ error: "Usuario inexistente" }, 404);
    if (obj.rol === "superadmin" && !soySuper) return json({ error: "Solo un super admin puede modificar a un super admin" }, 403);

    if (b.accion === "clave") {
      const password = String(b.password || "");
      if (password.length < 8) return json({ error: "La contraseña tiene que tener al menos 8 caracteres" }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (b.accion === "borrar") {
      if (!soySuper) return json({ error: "Solo el super admin elimina usuarios. Dirección puede desactivarlos." }, 403);
      if (id === u.user.id) return json({ error: "No podés eliminarte a vos mismo" }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
