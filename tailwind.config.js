/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--ink) / <alpha-value>)",
        ink2: "rgb(var(--ink2) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        surface2: "rgb(var(--surface2) / <alpha-value>)",
        heat: "rgb(var(--heat) / <alpha-value>)",
        ember: "rgb(var(--ember) / <alpha-value>)",
        ok: "rgb(var(--ok) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        night: "#0D0C0B",
      },
      fontFamily: {
        display: ['"Archivo"', '"Helvetica Neue"', "Arial", "sans-serif"],
        sans: ['"Archivo"', '"Helvetica Neue"', "Arial", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / .05), 0 8px 24px -8px rgb(0 0 0 / .10)",
        glow: "0 0 0 1px rgb(var(--heat) / .4), 0 10px 40px -10px rgb(var(--heat) / .55)",
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        pulseheat: { "0%,100%": { opacity: ".55", transform: "scale(1)" }, "50%": { opacity: "1", transform: "scale(1.08)" } },
      },
      animation: { shimmer: "shimmer 2.4s linear infinite", pulseheat: "pulseheat 2.2s ease-in-out infinite" },
    },
  },
  plugins: [],
};
