// Supabase Edge Function: asistente de producción con Claude.
// Deploy:  supabase functions deploy asistente
// Secreto: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Lee los datos con el usuario que pregunta (respeta sus permisos) y NUNCA guarda nada:
// devuelve acciones propuestas que la persona confirma en la app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ETAPAS = ["Orden", "Compra de tela", "Corte", "Confección", "Personalización", "Control de calidad", "Empaquetado", "Finalizada"];
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { mensaje, rol, historial = [], imagen } = await req.json();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization")! } } });
    const get = async (t: string) => ((await sb.from(t).select("data")).data || []).map((r: any) => r.data);
    const [ordenes, talleres, productos, viajes, perfil] = await Promise.all([get("ordenes"), get("talleres"), get("productos"), get("viajes"), sb.from("perfiles").select("rol,taller_id").single()]);
    const miRol = perfil.data?.rol || rol;
    const hoy = new Date().toISOString().slice(0, 10);
    const units = (o: any) => o.lineas.reduce((a: number, l: any) => a + l.cantidad, 0);
    const prod = (id: string) => productos.find((p: any) => p.id === id)?.nombre || "producto";
    const datos = {
      hoy, rol: miRol, miTaller: talleres.find((t: any) => t.id === perfil.data?.taller_id)?.nombre,
      ordenes: ordenes.filter((o: any) => o.etapa < 7 || (o.fechaFin || "") >= hoy.slice(0, 7)).slice(0, 80).map((o: any) => ({ orden: o.numero, cliente: o.cliente, tipo: o.tipo, etapa: ETAPAS[o.etapa], unidades: units(o), detalle: o.lineas.map((l: any) => `${l.cantidad} ${prod(l.productoId)} ${l.talle}`).join(", "), entrega: o.fechaEntrega, atrasada: o.etapa < 7 && o.fechaEntrega < hoy, calidad: o.calidad?.map((c: any) => ({ taller: talleres.find((t: any) => t.id === c.tallerId)?.nombre, revisadas: c.revisadas, fallas: c.fallas })) })),
      talleres: talleres.map((t: any) => ({ nombre: t.nombre, tipo: t.tipo })),
      viajesRecientes: viajes.sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)).slice(0, 20),
    };

    const tools = [
      { name: "proponer_entrega", description: "Prepara el registro de unidades entregadas para una orden en su etapa actual. No guarda: la persona confirma.", input_schema: { type: "object", properties: { orden: { type: "integer" }, unidades: { type: "integer" }, taller: { type: "string" } }, required: ["orden", "unidades"] } },
      { name: "proponer_avance", description: "Prepara pasar una orden a la etapa siguiente.", input_schema: { type: "object", properties: { orden: { type: "integer" } }, required: ["orden"] } },
      { name: "proponer_calidad", description: "Prepara un control de calidad: revisadas y con falla, por taller.", input_schema: { type: "object", properties: { orden: { type: "integer" }, taller: { type: "string" }, revisadas: { type: "integer" }, fallas: { type: "integer" }, motivo: { type: "string" } }, required: ["orden", "revisadas", "fallas", "taller"] } },
      { name: "proponer_viaje", description: "Prepara el registro de un viaje de la camioneta. Lugares: Fábrica, Depósito o un taller.", input_schema: { type: "object", properties: { origen: { type: "string" }, destino: { type: "string" }, carga: { type: "string" }, ordenes: { type: "array", items: { type: "integer" } } }, required: ["origen", "destino"] } },
    ];
    const permitidas: Record<string, string[]> = { direccion: ["proponer_entrega", "proponer_avance", "proponer_calidad", "proponer_viaje"], produccion: ["proponer_entrega", "proponer_avance", "proponer_calidad", "proponer_viaje"], taller: ["proponer_entrega"], chofer: ["proponer_viaje"] };

    const system = `Sos el asistente de producción de Wanderwarm (indumentaria, Mendoza). Respondé en español rioplatense, breve (máx. 5 líneas). Usá SOLO estos datos. Si la persona quiere cargar algo, usá la herramienta proponer_* que corresponda; eso prepara un botón de confirmación, no guarda. Si mandan foto de un remito o planilla, extraé orden, unidades y taller. Rol: ${miRol}.${miRol !== "direccion" ? " No reveles costos." : ""}\nDATOS: ${JSON.stringify(datos)}`;
    const content: any[] = [];
    if (imagen) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imagen } });
    content.push({ type: "text", text: mensaje || "Te mando una foto." });
    const messages: any[] = [...historial.map((h: any) => ({ role: h.de === "yo" ? "user" : "assistant", content: h.texto })), { role: "user", content }];
    while (messages.length && messages[0].role !== "user") messages.shift();

    const acciones: any[] = [];
    let texto = "";
    for (let ronda = 0; ronda < 3; ronda++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 800, system, messages, tools: tools.filter((t) => permitidas[miRol]?.includes(t.name)) }),
      });
      const out = await r.json();
      if (!r.ok) throw new Error(out?.error?.message || "Error de la API");
      texto = out.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
      const usos = out.content.filter((c: any) => c.type === "tool_use");
      if (!usos.length) break;
      messages.push({ role: "assistant", content: out.content });
      const results = usos.map((u: any) => {
        const i = u.input; const o = ordenes.find((x: any) => x.numero === i.orden);
        const tal = (n?: string) => talleres.find((t: any) => n && t.nombre.toLowerCase().includes(String(n).toLowerCase()));
        try {
          if (u.name !== "proponer_viaje" && !o) throw new Error("No existe la orden " + i.orden);
          if (u.name === "proponer_entrega") { const t = miRol === "taller" ? talleres.find((x: any) => x.id === perfil.data?.taller_id) : tal(i.taller); acciones.push({ tipo: "entrega", ordenId: o.id, unidades: i.unidades, tallerId: t?.id || null, desc: `${i.unidades} u en ${ETAPAS[o.etapa].toLowerCase()} · #${String(o.numero).padStart(3, "0")}${t ? " · " + t.nombre : ""}`, estado: "pendiente" }); }
          if (u.name === "proponer_avance") acciones.push({ tipo: "avance", ordenId: o.id, desc: o.etapa === 6 ? `Finalizar #${o.numero}` : `Pasar #${o.numero} a ${ETAPAS[o.etapa + 1]}`, estado: "pendiente" });
          if (u.name === "proponer_calidad") { const t = tal(i.taller); if (!t) throw new Error("Taller desconocido"); acciones.push({ tipo: "calidad", ordenId: o.id, tallerId: t.id, revisadas: i.revisadas, fallas: i.fallas, motivo: i.motivo || "", desc: `${i.fallas} con falla de ${i.revisadas} · #${o.numero} · ${t.nombre}`, estado: "pendiente" }); }
          if (u.name === "proponer_viaje") acciones.push({ tipo: "viaje", viaje: { fecha: hoy, origen: i.origen, destino: i.destino, carga: i.carga || "", ordenes: i.ordenes || [], km: 0 }, desc: `${i.origen} → ${i.destino}${i.carga ? " · " + i.carga : ""}`, estado: "pendiente" });
          return { type: "tool_result", tool_use_id: u.id, content: "Preparado. La persona tiene que confirmarlo." };
        } catch (e) { return { type: "tool_result", tool_use_id: u.id, content: "Error: " + (e as Error).message, is_error: true }; }
      });
      messages.push({ role: "user", content: results });
    }
    return new Response(JSON.stringify({ texto: texto || "Listo, confirmalo abajo.", acciones }), { headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ texto: "No pude responder: " + (e as Error).message, acciones: [] }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
  }
});
