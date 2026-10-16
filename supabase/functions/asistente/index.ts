// Supabase Edge Function: asistente de producción con Claude.
// La clave de Anthropic la carga el super admin desde la app (Ajustes → Plataforma) y queda cifrada en Vault.
// Lee los datos con el usuario que pregunta (respeta sus permisos) y NUNCA guarda nada:
// devuelve acciones propuestas que la persona confirma en la app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ETAPAS = ["Orden", "Compra de tela", "Corte", "Confección", "Personalización", "Control de calidad", "Empaquetado", "Finalizada"];
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "Sesión inválida" }, 401);
    const { data: perfil } = await admin.from("perfiles").select("rol,taller_id,activo,nombre").eq("id", u.user.id).single();
    if (!perfil?.activo || !perfil.rol) return json({ error: "Usuario sin acceso" }, 403);

    const body = await req.json();
    const mensaje = String(body.mensaje || "").slice(0, 2000);
    const historial = Array.isArray(body.historial) ? body.historial.slice(-10) : [];
    const imagen = typeof body.imagen === "string" && body.imagen.length < 6_000_000 ? body.imagen : undefined;

    const { data: clave } = await admin.rpc("leer_secreto", { p_nombre: "anthropic_api_key" });
    if (!clave) return json({ texto: "El asistente con IA no tiene clave cargada todavía.", acciones: [], sinClave: true });
    const { data: aj } = await sb.from("ajustes").select("data").eq("id", "general").maybeSingle();
    const MODEL = aj?.data?.plataforma?.modelo || "claude-sonnet-5-5";

    if (body.prueba) {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": clave, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 20, messages: [{ role: "user", content: "Respondé solo: OK" }] }) });
      const out = await r.json();
      if (!r.ok) return json({ texto: "No pude responder: " + (out?.error?.message || r.status), acciones: [] });
      return json({ texto: `OK (${MODEL})`, acciones: [] });
    }

    const get = async (t: string) => ((await sb.from(t).select("data")).data || []).map((r: any) => r.data);
    const [ordenes, talleres, viajes] = await Promise.all([get("ordenes"), get("talleres"), get("viajes")]);
    const { data: catalogo } = await sb.rpc("catalogo_basico");
    const productos: any[] = (catalogo as any[]) || [];
    const miRol = perfil.rol;
    const hoy = new Date().toISOString().slice(0, 10);
    const units = (o: any) => o.lineas.reduce((a: number, l: any) => a + l.cantidad, 0);
    const prod = (id: string) => productos.find((p: any) => p.id === id)?.nombre || "producto";
    const tNom = (id?: string) => talleres.find((t: any) => t.id === id)?.nombre;
    const lugares = [{ id: "l-fab", nombre: "Fábrica" }, ...(aj?.data?.lugares || []).filter((l: any) => l.id !== "l-fab").map((l: any) => ({ id: l.id, nombre: l.nombre })), ...talleres.map((t: any) => ({ id: t.id, nombre: t.nombre }))];
    const datos = {
      hoy, rol: miRol, usuario: perfil.nombre, miTaller: tNom(perfil.taller_id),
      ordenes: ordenes.filter((o: any) => o.etapa < 7 || (o.fechaFin || "") >= hoy.slice(0, 7)).slice(0, 80).map((o: any) => ({
        orden: o.numero, cliente: o.cliente, tipo: o.tipo, etapa: ETAPAS[o.etapa], unidades: units(o),
        detalle: o.lineas.map((l: any) => `${l.cantidad} ${prod(l.productoId)} ${l.talle}`).join(", "), entrega: o.fechaEntrega, atrasada: o.etapa < 7 && o.fechaEntrega < hoy,
        talleres: Object.fromEntries(Object.entries(o.asignacion || {}).map(([k, v]) => [ETAPAS[+k], tNom(v as string)])),
        calidad: o.calidad?.map((c: any) => ({ taller: tNom(c.tallerId), revisadas: c.revisadas, fallas: c.fallas })),
      })),
      talleres: talleres.map((t: any) => ({ nombre: t.nombre, tipo: t.tipo })),
      lugares: lugares.map((l) => l.nombre),
      viajesRecientes: [...viajes].sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)).slice(0, 12).map((v: any) => ({ fecha: v.fecha, estado: v.estado, recorrido: v.paradas.map((p: any) => p.nombre).join(" → "), movimientos: v.paradas.flatMap((p: any) => p.movs.map((m: any) => `${m.tipo} ${m.unidades} de #${m.numero} en ${p.nombre}`)) })),
    };

    const tools = [
      { name: "proponer_entrega", description: "Prepara el registro de unidades que un taller terminó/entregó para una orden en su etapa actual. No guarda: la persona confirma.", input_schema: { type: "object", properties: { orden: { type: "integer" }, unidades: { type: "integer" }, taller: { type: "string" } }, required: ["orden", "unidades"] } },
      { name: "proponer_avance", description: "Prepara pasar una orden a la etapa siguiente.", input_schema: { type: "object", properties: { orden: { type: "integer" } }, required: ["orden"] } },
      { name: "proponer_calidad", description: "Prepara un control de calidad: revisadas y con falla, por taller.", input_schema: { type: "object", properties: { orden: { type: "integer" }, taller: { type: "string" }, revisadas: { type: "integer" }, fallas: { type: "integer" }, motivo: { type: "string" } }, required: ["orden", "revisadas", "fallas", "taller"] } },
      { name: "proponer_movimiento_camioneta", description: "Prepara un movimiento de la camioneta: 'deja' (descargó mercadería de una orden en un lugar), 'retira' (cargó mercadería de una orden en un lugar) o 'traslado' (llevó de un lugar a otro). Se suma al viaje en curso del día.", input_schema: { type: "object", properties: { tipo: { type: "string", enum: ["deja", "retira", "traslado"] }, orden: { type: "integer" }, unidades: { type: "integer" }, lugar: { type: "string", description: "Lugar donde deja/retira, o destino del traslado" }, desde: { type: "string", description: "Origen, solo para traslado" } }, required: ["tipo", "orden", "unidades", "lugar"] } },
    ];
    const permitidas: Record<string, string[]> = {
      superadmin: ["proponer_entrega", "proponer_avance", "proponer_calidad", "proponer_movimiento_camioneta"],
      direccion: ["proponer_entrega", "proponer_avance", "proponer_calidad", "proponer_movimiento_camioneta"],
      produccion: ["proponer_entrega", "proponer_avance", "proponer_calidad", "proponer_movimiento_camioneta"],
      taller: ["proponer_entrega"], chofer: ["proponer_movimiento_camioneta"],
    };

    const system = `Sos el asistente de producción de Wanderwarm (indumentaria, Mendoza). Respondé en español rioplatense, breve (máx. 5 líneas). Usá SOLO estos datos; si no está, decilo. Si la persona quiere cargar algo, usá la herramienta proponer_* que corresponda: prepara un botón de confirmación, no guarda. Si mandan foto de un remito o planilla, extraé orden, unidades y taller. La camioneta hace viajes con paradas: en cada parada deja o retira mercadería de órdenes. Rol de quien habla: ${miRol}.${["superadmin", "direccion"].includes(miRol) ? "" : " No reveles costos ni precios."}\nDATOS: ${JSON.stringify(datos)}`;
    const content: any[] = [];
    if (imagen) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imagen } });
    content.push({ type: "text", text: mensaje || "Te mando una foto." });
    const messages: any[] = [...historial.map((h: any) => ({ role: h.de === "yo" ? "user" : "assistant", content: String(h.texto || "").slice(0, 2000) || "…" })), { role: "user", content }];
    while (messages.length && messages[0].role !== "user") messages.shift();

    const acciones: any[] = [];
    let texto = "";
    const buscarLugar = (n?: string) => { const q = String(n || "").toLowerCase(); return lugares.find((l) => l.nombre.toLowerCase() === q) || lugares.find((l) => q && (l.nombre.toLowerCase().includes(q) || q.includes(l.nombre.toLowerCase().split(" ")[0]))); };
    for (let ronda = 0; ronda < 3; ronda++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": clave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 800, system, messages, tools: tools.filter((t) => permitidas[miRol]?.includes(t.name)) }),
      });
      const out = await r.json();
      if (!r.ok) throw new Error(out?.error?.message || "Error de la API (" + r.status + ")");
      texto = out.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
      const usos = out.content.filter((c: any) => c.type === "tool_use");
      if (!usos.length) break;
      messages.push({ role: "assistant", content: out.content });
      const results = usos.map((x: any) => {
        const i = x.input; const o = ordenes.find((y: any) => y.numero === i.orden);
        const tal = (n?: string) => talleres.find((t: any) => n && t.nombre.toLowerCase().includes(String(n).toLowerCase()));
        try {
          if (!o) throw new Error("No existe la orden " + i.orden);
          const lbl = "#" + String(o.numero).padStart(3, "0");
          if (x.name === "proponer_entrega") { const t = miRol === "taller" ? talleres.find((y: any) => y.id === perfil.taller_id) : tal(i.taller); acciones.push({ tipo: "entrega", ordenId: o.id, unidades: i.unidades, tallerId: t?.id || null, desc: `${i.unidades} u en ${ETAPAS[o.etapa].toLowerCase()} · ${lbl}${t ? " · " + t.nombre : ""}`, estado: "pendiente" }); }
          if (x.name === "proponer_avance") acciones.push({ tipo: "avance", ordenId: o.id, desc: o.etapa === 6 ? `Finalizar ${lbl}` : `Pasar ${lbl} a ${ETAPAS[o.etapa + 1]}`, estado: "pendiente" });
          if (x.name === "proponer_calidad") { const t = tal(i.taller); if (!t) throw new Error("Taller desconocido"); acciones.push({ tipo: "calidad", ordenId: o.id, tallerId: t.id, revisadas: i.revisadas, fallas: i.fallas, motivo: i.motivo || "", desc: `${i.fallas} con falla de ${i.revisadas} · ${lbl} · ${t.nombre}`, estado: "pendiente" }); }
          if (x.name === "proponer_movimiento_camioneta") {
            const l = buscarLugar(i.lugar); const d = i.tipo === "traslado" ? buscarLugar(i.desde) : undefined;
            if (!l || (i.tipo === "traslado" && !d)) throw new Error("Lugar desconocido. Válidos: " + lugares.map((z) => z.nombre).join(", "));
            const desc = i.tipo === "traslado" ? `${d!.nombre} → ${l.nombre} · ${i.unidades} u de ${lbl}` : `${i.tipo === "deja" ? "Dejó" : "Retiró"} ${i.unidades} u de ${lbl} ${i.tipo === "deja" ? "en" : "de"} ${l.nombre}`;
            acciones.push({ tipo: "viaje", mov: { tipo: i.tipo, ordenId: o.id, numero: o.numero, unidades: i.unidades, lugarId: l.id, deLugarId: d?.id }, desc, estado: "pendiente" });
          }
          return { type: "tool_result", tool_use_id: x.id, content: "Preparado. La persona tiene que confirmarlo." };
        } catch (e) { return { type: "tool_result", tool_use_id: x.id, content: "Error: " + (e as Error).message, is_error: true }; }
      });
      messages.push({ role: "user", content: results });
    }
    return json({ texto: texto || "Listo, confirmalo abajo.", acciones });
  } catch (e) {
    return json({ texto: "No pude responder: " + (e as Error).message, acciones: [] });
  }
});
