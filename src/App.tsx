import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
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
import { remote, supabase } from "./lib/supabase";

export default function App() {
  const tema = useStore((s) => s.tema);
  const sesion = useStore((s) => s.sesion);
  const rol = useRol();
  const loc = useLocation();
  const [cargando, setCargando] = useState(remote.enabled);

  const apar = useStore((s) => s.config.apariencia);
  useEffect(() => { document.documentElement.classList.toggle("dark", tema === "oscuro"); }, [tema]);
  useEffect(() => { document.documentElement.classList.toggle("compact", apar.densidad === "compacta"); }, [apar.densidad]);

  // Modo Supabase: cargar datos y escuchar cambios en vivo.
  useEffect(() => {
    if (!remote.enabled || !supabase) return;
    let off = () => {};
    const cargar = async () => { try { const d = await remote.loadAll(); if (d) useStore.getState().hydrateRemote(d as never); } catch (e) { console.warn(e); } setCargando(false); };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { useStore.getState().login(data.session.user.id); cargar(); off = remote.subscribe(cargar); } else { useStore.getState().logout(); setCargando(false); }
    });
    return () => off();
  }, [sesion]);

  if (cargando) return <div className="grid h-full place-items-center bg-night text-white/60">Cargando…</div>;

  const permitido = (path: string) => !!rol && NAV.find((n) => n.to === path)?.roles.includes(rol);
  const guard = (path: string, el: JSX.Element) => (permitido(path) ? el : <Navigate to={homeFor(rol)} replace />);

  const inicio = rol === "direccion" && apar.inicio ? apar.inicio : homeFor(rol);
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
