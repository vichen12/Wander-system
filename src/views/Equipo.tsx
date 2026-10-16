import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check, Minus, Plus, UserPlus } from "lucide-react";
import { Avatar, Field, Page, PageHead, Sheet, cx, rise, stagger } from "../components/ui";
import { useStore } from "../store/useStore";
import { can, type Permiso } from "../lib/roles";
import { ROLES, type Rol, type Usuario } from "../lib/types";
import { uid } from "../lib/format";
import { remote } from "../lib/supabase";

const COLS: [Permiso, string][] = [["verTablero", "Tablero"], ["verCostos", "Costos"], ["crearOrdenes", "Crear órdenes"], ["moverOrdenes", "Mover etapas"], ["cargarCalidad", "Calidad"], ["cargarEntregas", "Entregas"], ["cargarViajes", "Viajes"], ["editarCatalogo", "Catálogo"], ["gestionarEquipo", "Equipo"]];
const PALETA = ["#E2412A", "#2F7D4F", "#6B5BD2", "#C27A16", "#2B6CB0", "#121110"];

export default function Equipo() {
  const { talleres, sesion } = useStore();
  const usuarios = useStore((st) => st.usuarios.filter((x) => x.rol !== "superadmin" || st.usuarios.find((y) => y.id === st.sesion)?.rol === "superadmin"));
  const [edit, setEdit] = useState<Usuario | null>(null);
  return (
    <Page>
      <PageHead eyebrow="Equipo" title="Personas y permisos">
        <button className="btn-heat" onClick={() => setEdit({ id: "", nombre: "", email: "", rol: "produccion", activo: true, color: PALETA[usuarios.length % PALETA.length] })}><UserPlus size={16} /> Sumar persona</button>
      </PageHead>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {usuarios.map((u) => (
          <motion.button variants={rise} whileHover={{ y: -3 }} key={u.id} onClick={() => setEdit(u)} className={cx("card flex items-center gap-3 p-4 text-left", !u.activo && "opacity-55")}>
            <Avatar name={u.nombre} color={u.color} size={46} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{u.nombre}{u.id === sesion && <span className="ml-1.5 text-[11px] font-semibold text-muted">(vos)</span>}</div>
              <div className="truncate text-[12px] text-muted">{u.email}</div>
              <div className="mt-1.5 flex flex-wrap gap-1"><span className={u.rol === "direccion" || u.rol === "superadmin" ? "pill-heat" : "pill"}>{ROLES[u.rol].nombre}</span>{u.tallerId && <span className="pill">{talleres.find((t) => t.id === u.tallerId)?.nombre}</span>}{!u.activo && <span className="pill">Sin acceso</span>}</div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      <section className="card mt-6 overflow-x-auto scroll-thin">
        <div className="px-5 pt-5"><h2 className="font-display text-[16px] font-bold">Qué puede hacer cada rol</h2><p className="text-[12.5px] text-muted">Los permisos se aplican en las pantallas y, con Supabase, también en la base de datos.</p></div>
        <table className="mt-3 w-full min-w-[760px]">
          <thead><tr><th className="th">Rol</th>{COLS.map(([, l]) => <th key={l} className="th text-center">{l}</th>)}</tr></thead>
          <tbody>{(Object.keys(ROLES) as Rol[]).filter((r) => r !== "superadmin").map((r) => (
            <tr key={r}><td className="td"><div className="font-bold">{ROLES[r].nombre}</div><div className="max-w-[220px] text-[11.5px] text-muted">{ROLES[r].desc}</div></td>
              {COLS.map(([p]) => <td key={p} className="td text-center">{can(r, p) ? <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-ok/15 text-ok"><Check size={14} /></span> : <Minus size={14} className="mx-auto text-line" />}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </section>
      <EditarUsuario u={edit} onClose={() => setEdit(null)} />
    </Page>
  );
}

const generarClave = () => {
  const c = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(r, (x) => c[x % c.length]).join("");
};

function EditarUsuario({ u, onClose }: { u: Usuario | null; onClose: () => void }) {
  const { guardar, talleres, sesion, usuarios } = useStore();
  const yo = usuarios.find((x) => x.id === sesion);
  const [f, setF] = useState<Usuario | null>(null);
  const [clave, setClave] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(u ? { ...u } : null); setClave(u && !u.id ? generarClave() : ""); }, [u]);
  const roles = (Object.keys(ROLES) as Rol[]).filter((r) => r !== "superadmin" || yo?.rol === "superadmin");
  const esYo = f?.id === sesion;
  const bloqueado = f?.rol === "superadmin" && yo?.rol !== "superadmin";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f) return;
    const nombre = f.nombre.trim(), email = f.email.trim().toLowerCase();
    if (!nombre) return toast.error("Falta el nombre.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast.error("El mail no es válido.");
    if (f.rol === "taller" && !f.tallerId) return toast.error("Elegí el taller de esta persona.");
    if (esYo && (f.rol !== u?.rol || !f.activo)) return toast.error("No podés cambiar tu propio rol ni quitarte el acceso.");
    if (!f.id && usuarios.some((x) => x.email.toLowerCase() === email)) return toast.error("Ya hay una persona con ese mail.");
    if (clave && clave.length < 8) return toast.error("La contraseña tiene que tener al menos 8 caracteres.");
    setBusy(true);
    try {
      if (remote.enabled && !f.id) {
        if (!clave) throw new Error("Poné una contraseña inicial.");
        await remote.usuarios("crear", { email, password: clave, nombre, rol: f.rol, tallerId: f.rol === "taller" ? f.tallerId : null, color: f.color });
        toast.success(`${nombre} ya puede entrar con ${email}`, { description: "Pasale la contraseña por un medio seguro." });
      } else {
        guardar("usuarios", { ...f, id: f.id || uid("u-"), nombre, email, tallerId: f.rol === "taller" ? f.tallerId : null });
        if (remote.enabled && clave) { await remote.usuarios("clave", { id: f.id, password: clave }); toast.success("Contraseña cambiada"); }
        else toast.success("Guardado");
      }
      onClose();
    } catch (err) { toast.error((err as Error).message); }
    setBusy(false);
  };
  const borrar = async () => {
    if (!f?.id) return;
    if (!confirmarTexto(f.nombre)) return;
    setBusy(true);
    try { await remote.usuarios("borrar", { id: f.id }); toast.success("Usuario eliminado"); onClose(); } catch (err) { toast.error((err as Error).message); }
    setBusy(false);
  };

  return (
    <Sheet open={!!u} onClose={onClose} width={520}>
      {f && (<>
        <div className="eyebrow">Equipo</div>
        <h2 className="mt-1.5 font-display text-[24px] font-black">{f.id ? f.nombre : "Sumar persona"}</h2>
        {bloqueado ? <p className="mt-4 text-[13px] text-muted">Este usuario es super admin: solo otro super admin lo puede modificar.</p> : (
        <form className="mt-5 space-y-4" onSubmit={enviar}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre"><input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} maxLength={80} required /></Field>
            <Field label="Mail"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} disabled={remote.enabled && !!f.id} required /></Field>
          </div>
          {remote.enabled && (
            <Field label={f.id ? "Nueva contraseña (opcional)" : "Contraseña inicial"} hint="Mínimo 8 caracteres. La persona la puede cambiar después con “Me olvidé la contraseña”.">
              <div className="flex gap-2"><input className="input font-mono" value={clave} onChange={(e) => setClave(e.target.value)} placeholder={f.id ? "Dejala vacía para no cambiarla" : ""} autoComplete="new-password" /><button type="button" className="btn-ghost shrink-0" onClick={() => setClave(generarClave())}>Generar</button></div>
            </Field>
          )}
          <div>
            <div className="label mb-2">Rol</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((r) => (
                <button type="button" key={r} disabled={esYo} onClick={() => setF({ ...f, rol: r })} className={cx("rounded-xl border p-3 text-left transition disabled:opacity-60", f.rol === r ? "border-heat bg-heat/5 ring-2 ring-heat/20" : "border-line hover:border-muted")}>
                  <div className="text-[13.5px] font-bold">{ROLES[r].nombre}</div><div className="text-[11.5px] text-muted">{ROLES[r].desc}</div>
                </button>
              ))}
            </div>
          </div>
          {f.rol === "taller" && <Field label="Taller"><select className="input" value={f.tallerId || ""} onChange={(e) => setF({ ...f, tallerId: e.target.value })}><option value="">Elegí un taller</option>{talleres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></Field>}
          <div className="flex gap-1.5">{PALETA.map((c) => <button type="button" key={c} onClick={() => setF({ ...f, color: c })} className={cx("h-7 w-7 rounded-full ring-offset-2 transition", f.color === c && "ring-2 ring-ink")} style={{ background: c }} aria-label={"Color " + c} />)}</div>
          {f.id && (
            <label className="flex items-center gap-3 rounded-xl border border-line p-3">
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--heat))]" checked={f.activo} disabled={esYo} onChange={(e) => setF({ ...f, activo: e.target.checked })} />
              <span className="text-[13px]"><b>Tiene acceso</b><br /><span className="text-muted">Si lo desactivás, no puede entrar ni ver datos.</span></span>
            </label>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <button className="btn-heat" type="submit" disabled={busy}>{busy ? "Guardando…" : f.id ? "Guardar" : "Crear usuario"}</button>
            <button className="btn-ghost" type="button" onClick={onClose}>Cancelar</button>
            {remote.enabled && f.id && !esYo && yo?.rol === "superadmin" && <button className="btn-ghost ml-auto text-heat" type="button" onClick={borrar} disabled={busy}>Eliminar usuario</button>}
          </div>
        </form>)}
      </>)}
    </Sheet>
  );
}

function confirmarTexto(nombre: string) {
  // Sin diálogos del navegador: se pide confirmación con un segundo toque.
  const k = "borrar:" + nombre; const w = window as unknown as Record<string, number>;
  if (w[k] && Date.now() - w[k] < 4000) { delete w[k]; return true; }
  w[k] = Date.now(); toast("Tocá de nuevo “Eliminar usuario” para confirmar."); return false;
}
