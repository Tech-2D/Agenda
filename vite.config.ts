import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages serves the site from /aprovae-web/; local dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/aprovae-web/" : "/",
  plugins: [react(), tailwindcss()],
}));
