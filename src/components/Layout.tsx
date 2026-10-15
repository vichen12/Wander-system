import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Command } from "cmdk";
import {
  BarChart3, Boxes, Factory, Shirt, Truck, MessageSquareText, Users, Settings, PackageCheck, ShieldCheck, BookOpen,
  Search, Moon, Sun, LogOut, Eye, Plus, ChevronDown, ChevronsUpDown, Check,
} from "lucide-react";
import { HeatButton, Topo } from "./Brand";
import { Avatar, Logo, cx } from "./ui";
import ChatWidget from "./ChatWidget";
import { useRol, useStore, useYo } from "../store/useStore";
import { ROLES, type Rol } from "../lib/types";
import { ordenLabel } from "../lib/format";

type Item = { to: string; label: string; icon: ReactNode; roles: Rol[] };
export const NAV: Item[] = [
  { to: "/tablero", label: "Tablero", icon: <BarChart3 size={18} />, roles: ["direccion", "produccion"] },
  { to: "/ordenes", label: "Órdenes", icon: <Boxes size={18} />, roles: ["direccion", "produccion"] },
  { to: "/calidad", label: "Calidad", icon: <ShieldCheck size={18} />, roles: ["direccion", "produccion"] },
  { to: "/talleres", label: "Talleres", icon: <Factory size={18} />, roles: ["direccion", "produccion"] },
  { to: "/productos", label: "Productos", icon: <Shirt size={18} />, roles: ["direccion", "produccion"] },
  { to: "/entregas", label: "Mis entregas", icon: <PackageCheck size={18} />, roles: ["taller"] },
  { to: "/logistica", label: "Logística", icon: <Truck size={18} />, roles: ["direccion", "produccion", "chofer"] },
  { to: "/procesos", label: "Procesos", icon: <BookOpen size={18} />, roles: ["direccion", "produccion", "taller", "chofer"] },
  { to: "/equipo", label: "Equipo", icon: <Users size={18} />, roles: ["direccion"] },
  { to: "/ajustes", label: "Ajustes", icon: <Settings size={18} />, roles: ["direccion"] },
];
export const homeFor = (r?: Rol) => (r === "taller" ? "/entregas" : r === "chofer" ? "/logistica" : "/tablero");

const GRUPOS: { nombre: string; rutas: string[] }[] = [
  { nombre: "Operación", rutas: ["/tablero", "/ordenes", "/entregas", "/calidad", "/logistica"] },
  { nombre: "Catálogo", rutas: ["/productos", "/talleres", "/procesos"] },
  { nombre: "Empresa", rutas: ["/equipo", "/ajustes"] },
];
const ROL_ICON: Record<Rol, ReactNode> = { direccion: <Eye size={16} />, produccion: <Boxes size={16} />, taller: <Factory size={16} />, chofer: <Truck size={16} /> };

function MenuUsuario({ onClose, dark = false }: { onClose: () => void; dark?: boolean }) {
  const yo = useYo();
  const rol = useRol();
  const { vistaComo, setVistaComo, tema, setTema, logout } = useStore();
  const nav = useNavigate();
  if (!yo) return null;
  const ver = (r: Rol) => { const v = r === "direccion" ? null : r; setVistaComo(v); nav(homeFor(r)); onClose(); };
  return (
    <div className={cx("w-full overflow-hidden rounded-2xl border", dark ? "border-line bg-surface text-ink" : "border-line bg-surface text-ink")}>
      <div className="flex items-center gap-3 border-b border-line p-3.5">
        <Avatar name={yo.nombre} color={yo.color} size={38} />
        <div className="min-w-0"><div className="truncate text-[14px] font-bold">{yo.nombre}</div><div className="truncate text-[12px] text-muted">{yo.email}</div></div>
      </div>
      {yo.rol === "direccion" && (
        <div className="border-b border-line p-2">
          <div className="px-2 pb-1.5 pt-1 text-[12px] font-semibold text-muted">Ver el sistema como</div>
          {(Object.keys(ROLES) as Rol[]).map((r) => {
            const on = (vistaComo || "direccion") === r;
            return (
              <button key={r} onClick={() => ver(r)} className={cx("flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition", on ? "bg-ink/[.06]" : "hover:bg-ink/[.05]")}>
                <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", on ? "bg-heat text-white" : "bg-ink/[.05] text-ink2")}>{ROL_ICON[r]}</span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">{ROLES[r].nombre}{r === "direccion" && " (tu vista)"}</span><span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{ROLES[r].desc}</span></span>
                {on && <Check size={15} className="shrink-0 text-heat" />}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2 p-2">
        <div className="relative flex flex-1 rounded-xl bg-ink/[.05] p-0.5">
          {(["claro", "oscuro"] as const).map((t) => (
            <button key={t} onClick={() => setTema(t)} className={cx("relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-semibold transition-colors", tema === t ? "text-ink" : "text-muted hover:text-ink")}>
              {tema === t && <motion.span layoutId="tema-sel" className="absolute inset-0 rounded-lg bg-surface shadow-sm ring-1 ring-line" />}
              <span className="relative flex items-center gap-1.5">{t === "claro" ? <Sun size={13} /> : <Moon size={13} />}{t === "claro" ? "Claro" : "Oscuro"}</span>
            </button>
          ))}
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-muted transition hover:bg-ink/[.05] hover:text-ink"><LogOut size={14} /> Salir</button>
      </div>
      {rol && null}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const rol = useRol();
  const yo = useYo();
  const { vistaComo, setVistaComo } = useStore();
  const items = NAV.filter((i) => rol && i.roles.includes(rol));
  const [cmd, setCmd] = useState(false);
  const [menu, setMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((v) => !v); } if (e.key === "Escape") setUserMenu(false); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { setMenu(false); setUserMenu(false); }, [loc.pathname]);
  useEffect(() => {
    if (!userMenu) return;
    const out = (e: MouseEvent) => { if (!userRef.current?.contains(e.target as Node)) setUserMenu(false); };
    document.addEventListener("mousedown", out); return () => document.removeEventListener("mousedown", out);
  }, [userMenu]);

  return (
    <div className="flex h-full">
      {/* Barra lateral */}
      <aside className="relative hidden w-[256px] shrink-0 flex-col border-r border-line bg-surface2 text-ink lg:flex">
        <Topo className="inset-0 bg-ink/[.045]" size={560} />
        <div className="pointer-events-none absolute -left-24 bottom-[-140px] h-80 w-80 rounded-full bg-heat/10 blur-3xl" />
        <div className="relative px-5 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <Logo className="w-11" animated />
            <div className="leading-none"><div className="font-display text-[15px] font-black uppercase tracking-[0.08em]" style={{ fontStretch: "125%" }}>Wander</div><div className="mt-1 text-[11.5px] text-muted">Producción</div></div>
          </div>
        </div>
        <div className="relative px-3.5">
          <button onClick={() => setCmd(true)} className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] text-muted transition hover:border-muted/40 hover:text-ink">
            <Search size={15} /> Buscar o crear <kbd className="ml-auto rounded-md border border-line px-1.5 py-0.5 font-sans text-[10px]">Ctrl K</kbd>
          </button>
        </div>
        <nav className="relative mt-4 flex-1 space-y-5 overflow-y-auto px-3.5 scroll-thin" aria-label="Secciones">
          {GRUPOS.map((g) => {
            const its = g.rutas.map((r) => items.find((i) => i.to === r)).filter((i): i is Item => !!i);
            if (!its.length) return null;
            return (
              <div key={g.nombre}>
                <div className="mb-1.5 px-3 text-[11.5px] font-semibold text-muted">{g.nombre}</div>
                <div className="flex flex-col gap-0.5">
                  {its.map((i) => (
                    <NavLink key={i.to} to={i.to} className={({ isActive }) => cx("group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-semibold transition-colors", isActive ? "text-ink" : "text-ink2 hover:text-ink")}>
                      {({ isActive }) => (<>
                        {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-gradient-to-r bg-surface shadow-[0_1px_2px_rgb(0_0_0/.06),0_4px_12px_-4px_rgb(0_0_0/.08)] ring-1 ring-line" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                        {isActive && <motion.span layoutId="nav-heat" className="absolute -left-3.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-heat shadow-[0_0_12px_rgb(var(--heat))]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                        <span className={cx("relative transition-colors", isActive ? "text-heat" : "group-hover:text-ink")}>{i.icon}</span><span className="relative">{i.label}</span>
                      </>)}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="relative px-3.5 pb-4 pt-3">
          <div className="mb-3 flex items-center gap-2 px-2 text-[11.5px] text-muted"><HeatButton size={16} animado /> Te acompaña todo el año</div>
          <div ref={userRef} className="relative">
            <AnimatePresence>
              {userMenu && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.16 }} className="absolute bottom-full left-0 right-0 z-50 mb-2 origin-bottom shadow-2xl">
                  <MenuUsuario onClose={() => setUserMenu(false)} />
                </motion.div>
              )}
            </AnimatePresence>
            <button onClick={() => setUserMenu(!userMenu)} aria-expanded={userMenu} className={cx("flex w-full items-center gap-2.5 rounded-2xl border p-2 text-left transition", userMenu ? "border-muted/40 bg-ink/[.06]" : "border-line bg-surface hover:bg-ink/[.06]")}>
              {yo && <Avatar name={yo.nombre} color={yo.color} size={34} />}
              <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{yo?.nombre}</div><div className="truncate text-[11.5px] text-muted">{rol && ROLES[rol].nombre}{vistaComo && " · vista previa"}</div></div>
              <ChevronsUpDown size={15} className="shrink-0 text-muted" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior en celular */}
        <header className="relative flex items-center justify-between gap-3 overflow-hidden border-b border-line bg-surface px-4 py-3 text-ink lg:hidden" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <Topo className="inset-0 bg-ink/[.045]" size={400} />
          <div className="relative flex items-center gap-2.5"><Logo className="w-9" /><span className="font-display text-[13px] font-black uppercase tracking-[0.08em]" style={{ fontStretch: "125%" }}>Wander</span></div>
          <div className="relative flex items-center gap-1">
            <button className="rounded-lg p-2 hover:bg-ink/[.06]" onClick={() => setCmd(true)} aria-label="Buscar"><Search size={18} /></button>
            <button className="flex items-center gap-1.5 rounded-lg p-1 hover:bg-ink/[.06]" onClick={() => setMenu((v) => !v)} aria-label="Menú">{yo && <Avatar name={yo.nombre} color={yo.color} size={28} />}<ChevronDown size={14} /></button>
          </div>
        </header>
        <AnimatePresence>
          {menu && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-b border-line bg-surface lg:hidden">
              <div className="px-3 pb-3"><MenuUsuario onClose={() => setMenu(false)} /></div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {vistaComo && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-heat text-white">
              <div className="flex items-center justify-center gap-3 px-4 py-1.5 text-[12.5px] font-semibold">
                <Eye size={14} /> Estás viendo el sistema como {ROLES[vistaComo].nombre}
                <button onClick={() => { setVistaComo(null); nav(homeFor("direccion")); }} className="rounded-full bg-white/20 px-2.5 py-0.5 transition hover:bg-white/30">Volver a mi vista</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="min-h-0 flex-1 overflow-y-auto scroll-thin" id="main">{children}</main>

        {/* Navegación inferior en celular */}
        <nav className="flex justify-around border-t border-line bg-surface px-1 pt-1.5 text-muted lg:hidden" style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }} aria-label="Secciones">
          {["/tablero", "/ordenes", "/entregas", "/logistica", "/procesos", "/calidad"].map((to) => items.find((i) => i.to === to)).filter((i): i is Item => !!i).slice(0, 5).map((i) => (
            <NavLink key={i.to} to={i.to} className={({ isActive }) => cx("relative flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10.5px] font-semibold", isActive && "text-ink")}>
              {({ isActive }) => (<>
                {isActive && <motion.span layoutId="nav-mobile" className="absolute inset-0 rounded-xl bg-ink/[.06]" />}
                <span className={cx("relative", isActive && "text-heat")}>{i.icon}</span><span className="relative">{i.label.replace("Mis ", "")}</span>
              </>)}
            </NavLink>
          ))}
        </nav>
      </div>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} items={items} />
      <ChatWidget />
    </div>
  );
}

function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: Item[] }) {
  const nav = useNavigate();
  const ordenes = useStore((s) => s.ordenes);
  const rol = useRol();
  const go = (to: string) => { onClose(); nav(to); };
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  const ords = useMemo(() => ordenes.slice(0, 200), [ordenes]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-night/50 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
            <Command label="Buscar" loop>
              <div className="flex items-center gap-2 border-b border-line px-4"><Search size={17} className="text-muted" />
                <Command.Input autoFocus placeholder="Buscar orden, cliente o sección…" className="h-14 flex-1 bg-transparent text-[15px] outline-none focus-visible:outline-none" />
              </div>
              <Command.List className="max-h-[360px] overflow-y-auto p-2 scroll-thin">
                <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted">Sin resultados</Command.Empty>
                {(rol === "direccion" || rol === "produccion") && (
                  <Command.Group heading="Acciones" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                    <Command.Item onSelect={() => go("/ordenes?nueva=1")} className="cmd-item"><Plus size={16} /> Nueva orden de producción</Command.Item>
                    <Command.Item onSelect={() => go("/logistica?nuevo=1")} className="cmd-item"><Truck size={16} /> Registrar viaje</Command.Item>
                  </Command.Group>
                )}
                <Command.Group heading="Asistente" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  <Command.Item onSelect={() => { onClose(); useStore.getState().setChatAbierto(true); }} className="cmd-item"><MessageSquareText size={16} /> Abrir el asistente</Command.Item>
                </Command.Group>
                <Command.Group heading="Ir a" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {items.map((i) => <Command.Item key={i.to} onSelect={() => go(i.to)} className="cmd-item">{i.icon} {i.label}</Command.Item>)}
                </Command.Group>
                {(rol === "direccion" || rol === "produccion") && (
                  <Command.Group heading="Órdenes" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                    {ords.map((o) => (
                      <Command.Item key={o.id} value={`${ordenLabel(o.numero)} ${o.numero} ${o.cliente}`} onSelect={() => go(`/ordenes?o=${o.id}`)} className="cmd-item">
                        <span className="font-mono text-[12px] text-muted">{ordenLabel(o.numero)}</span> {o.cliente}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
