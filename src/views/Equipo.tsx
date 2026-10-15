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
  const { usuarios, talleres, sesion } = useStore();
  const [edit, setEdit] = useState<Usuario | null>(null);
  return (
    <Page>
      <PageHead eyebrow="Equipo" title="Personas y permisos">
        {!remote.enabled && <button className="btn-heat" onClick={() => setEdit({ id: "", nombre: "", email: "", rol: "produccion", activo: true, color: PALETA[usuarios.length % PALETA.length] })}><UserPlus size={16} /> Sumar persona</button>}
      </PageHead>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {usuarios.map((u) => (
          <motion.button variants={rise} whileHover={{ y: -3 }} key={u.id} onClick={() => setEdit(u)} className={cx("card flex items-center gap-3 p-4 text-left", !u.activo && "opacity-55")}>
            <Avatar name={u.nombre} color={u.color} size={46} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{u.nombre}{u.id === sesion && <span className="ml-1.5 text-[11px] font-semibold text-muted">(vos)</span>}</div>
              <div className="truncate text-[12px] text-muted">{u.email}</div>
              <div className="mt-1.5 flex flex-wrap gap-1"><span className={u.rol === "direccion" ? "pill-heat" : "pill"}>{ROLES[u.rol].nombre}</span>{u.tallerId && <span className="pill">{talleres.find((t) => t.id === u.tallerId)?.nombre}</span>}{!u.activo && <span className="pill">Sin acceso</span>}</div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      <section className="card mt-6 overflow-x-auto scroll-thin">
        <div className="px-5 pt-5"><h2 className="font-display text-[16px] font-bold">Qué puede hacer cada rol</h2><p className="text-[12.5px] text-muted">Los permisos se aplican en las pantallas y, con Supabase, también en la base de datos.</p></div>
        <table className="mt-3 w-full min-w-[760px]">
          <thead><tr><th className="th">Rol</th>{COLS.map(([, l]) => <th key={l} className="th text-center">{l}</th>)}</tr></thead>
          <tbody>{(Object.keys(ROLES) as Rol[]).map((r) => (
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

function EditarUsuario({ u, onClose }: { u: Usuario | null; onClose: () => void }) {
  const { guardar, talleres, sesion } = useStore();
  const [f, setF] = useState<Usuario | null>(null);
  useEffect(() => setF(u ? { ...u } : null), [u]);
  return (
    <Sheet open={!!u} onClose={onClose} width={500}>
      {f && (<>
        <div className="eyebrow">Equipo</div>
        <h2 className="wide mt-1.5 font-display text-[24px] font-extrabold">{f.id ? f.nombre : "Sumar persona"}</h2>
        <form className="mt-5 space-y-4" onSubmit={(e) => {
          e.preventDefault();
          if (!f.nombre.trim()) return toast.error("Falta el nombre.");
          if (f.rol === "taller" && !f.tallerId) return toast.error("Elegí el taller de esta persona.");
          if (f.id === sesion && f.rol !== "direccion") return toast.error("No podés quitarte el rol de Dirección a vos mismo.");
          guardar("usuarios", { ...f, id: f.id || uid("u-"), nombre: f.nombre.trim(), tallerId: f.rol === "taller" ? f.tallerId : null });
          toast.success("Guardado"); onClose();
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre"><input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} disabled={remote.enabled} /></Field>
            <Field label="Mail"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} disabled={remote.enabled} /></Field>
          </div>
          <div>
            <div className="label mb-2">Rol</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(ROLES) as Rol[]).map((r) => (
                <button type="button" key={r} onClick={() => setF({ ...f, rol: r })} className={cx("rounded-xl border p-3 text-left transition", f.rol === r ? "border-heat bg-heat/5 ring-2 ring-heat/20" : "border-line hover:border-muted")}>
                  <div className="text-[13.5px] font-bold">{ROLES[r].nombre}</div><div className="text-[11.5px] text-muted">{ROLES[r].desc}</div>
                </button>
              ))}
            </div>
          </div>
          {f.rol === "taller" && <Field label="Taller"><select className="input" value={f.tallerId || ""} onChange={(e) => setF({ ...f, tallerId: e.target.value })}><option value="">Elegí un taller</option>{talleres.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></Field>}
          <label className="flex items-center gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--heat))]" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} />
            <span className="text-[13px]"><b>Tiene acceso</b><br /><span className="text-muted">Si lo desactivás, no puede entrar al sistema.</span></span>
          </label>
          {remote.enabled && !f.id && <p className="text-[12px] text-muted">Con Supabase, las personas se invitan desde el panel de Supabase (Authentication → Invite). Cuando entran, aparecen acá para asignarles rol.</p>}
          <div className="flex gap-2 pt-2"><button className="btn-heat" type="submit">Guardar</button><button className="btn-ghost" type="button" onClick={onClose}>Cancelar</button></div>
        </form>
      </>)}
    </Sheet>
  );
}
