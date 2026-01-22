import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Ignore backend folder to prevent page reloads when gv_debug.html is saved
      ignored: ['**/backend/**', '**/node_modules/**', '**/.git/**']
    }
  },
  root: "src-ui",
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
}));
