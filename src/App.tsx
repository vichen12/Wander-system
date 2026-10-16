import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { Toaster, toast } from "sonner";
import Layout, { homeFor, NAV } from "./components/Layout";
import Login from "./views/Login";
import Tablero from "./views/Tablero";
import Ordenes from "./views/Ordenes";
import Calidad from "./views/Calidad";
import Talleres from "./views/Talleres";
import Productos from "./views/Productos";
import Logistica from "./views/Logistica";
import Entregas from "./views/Entregas";
import Procesos from "./views/Procesos";
import Equipo from "./views/Equipo";
import Ajustes from "./views/Ajustes";
import { useRol, useStore } from "./store/useStore";
import { mensajeError, remote, supabase } from "./lib/supabase";
import { Logo } from "./components/ui";
import { NuevaClave } from "./views/Login";

export default function App() {
  const tema = useStore((s) => s.tema);
  const sesion = useStore((s) => s.sesion);
  const rol = useRol();
  const loc = useLocation();
  const [cargando, setCargando] = useState(remote.enabled);

  const apar = useStore((s) => s.config.apariencia);
  useEffect(() => { document.documentElement.classList.toggle("dark", tema === "oscuro"); }, [tema]);
  useEffect(() => { document.documentElement.classList.toggle("compact", apar.densidad === "compacta"); }, [apar.densidad]);

  // Modo Supabase: cargar datos, escuchar cambios en vivo y avisar si algo no se pudo guardar.
  const [recuperando, setRecuperando] = useState(false);
  useEffect(() => {
    if (!remote.enabled || !supabase) return;
    let off = () => {};
    const cargar = async () => {
      const v0 = remote.version();
      try {
        const d = await remote.loadAll();
        // si mientras se cargaba alguien guardó algo, se descarta esta lectura y se vuelve a pedir
        if (remote.version() !== v0 || remote.ocupado()) { setTimeout(cargar, 600); return; }
        if (d) useStore.getState().hydrateRemote(d as never);
      }
      catch (e) { toast.error("No se pudieron cargar los datos: " + mensajeError(e)); }
      setCargando(false);
    };
    remote.onError((msg) => { toast.error("No se guardó: " + msg); cargar(); });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { useStore.getState().login(data.session.user.id); cargar(); off = remote.subscribe(cargar); }
      else { useStore.getState().logout(); setCargando(false); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "PASSWORD_RECOVERY") setRecuperando(true);
      if (ev === "SIGNED_OUT") useStore.setState({ sesion: null, vistaComo: null });
    });
    return () => { off(); sub.subscription.unsubscribe(); };
  }, [sesion]);

  if (cargando) return <div className="grid h-full place-items-center bg-bg"><div className="flex flex-col items-center gap-3 text-muted"><Logo className="w-14 text-ink" animated /><span className="text-[13px]">Cargando…</span></div></div>;
  if (recuperando) return <NuevaClave onListo={() => setRecuperando(false)} />;

  const permitido = (path: string) => !!rol && NAV.find((n) => n.to === path)?.roles.includes(rol);
  const guard = (path: string, el: JSX.Element) => (permitido(path) ? el : <Navigate to={homeFor(rol)} replace />);

  const inicio = (rol === "direccion" || rol === "superadmin") && apar.inicio ? apar.inicio : homeFor(rol);
  return (
    <MotionConfig reducedMotion={apar.animaciones ? "user" : "always"}>
      <Toaster position="bottom-center" toastOptions={{ className: "!rounded-xl !font-sans" }} richColors />
      {!sesion || !rol ? <Login /> : (
        <Layout>
          <AnimatePresence mode="wait">
            <Routes location={loc} key={loc.pathname}>
              <Route path="/tablero" element={guard("/tablero", <Tablero />)} />
              <Route path="/ordenes" element={guard("/ordenes", <Ordenes />)} />
              <Route path="/calidad" element={guard("/calidad", <Calidad />)} />
              <Route path="/talleres" element={guard("/talleres", <Talleres />)} />
              <Route path="/productos" element={guard("/productos", <Productos />)} />
              <Route path="/logistica" element={guard("/logistica", <Logistica />)} />
              <Route path="/entregas" element={guard("/entregas", <Entregas />)} />
              <Route path="/procesos" element={guard("/procesos", <Procesos />)} />
              <Route path="/asistente" element={<AbrirChat to={homeFor(rol)} />} />
              <Route path="/equipo" element={guard("/equipo", <Equipo />)} />
              <Route path="/ajustes" element={guard("/ajustes", <Ajustes />)} />
              <Route path="*" element={<Navigate to={inicio} replace />} />
            </Routes>
          </AnimatePresence>
        </Layout>
      )}
    </MotionConfig>
  );
}

function AbrirChat({ to }: { to: string }) {
  useEffect(() => { useStore.getState().setChatAbierto(true); }, []);
  return <Navigate to={to} replace />;
}
