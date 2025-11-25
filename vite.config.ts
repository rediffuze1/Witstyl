import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: "client",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"), // ✅ ajout pour fixer l'import
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    // En développement, Vite est intégré dans Express sur le port 5001
    // Ce fichier de config est principalement pour le build
    port: 5001,
    strictPort: false, // Permettre à Express de gérer le port
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
