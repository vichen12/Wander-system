import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build:demo` genera un único HTML que se abre con doble clic (carpeta demo/).
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), ...(mode === "demo" ? [viteSingleFile()] : [])],
  build: mode === "demo" ? { outDir: "demo", assetsInlineLimit: 100000000, copyPublicDir: true } : { outDir: "dist" },
}));
