import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages serves the site from /pegaki/; local dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/pegaki/" : "/",
  plugins: [react(), tailwindcss()],
}));
