import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// O build vai para dist/ (o Vercel serve de lá). api/ e middleware.js continuam fora do build, como funções do Vercel.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
});
