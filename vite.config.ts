import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves this repo below /pnle-practice-hub/, while Vercel
  // serves it from the root of the custom domain.
  base: process.env.VERCEL ? "/" : "/pnle-practice-hub/",
  plugins: [react()],
});
