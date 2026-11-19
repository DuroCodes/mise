import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here("./src"),
  publicDir: here("./public"),
  envDir: here("."),
  cacheDir: here("./node_modules/.vite"),
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": here("./src"),
    },
  },
  build: {
    outDir: here("./dist"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      // yt-dlp + whisper + chat can take a while for reels import
      "/api": {
        target: "http://127.0.0.1:3001",
        timeout: 180_000,
        proxyTimeout: 180_000,
      },
      "/uploads": "http://127.0.0.1:3001",
    },
    allowedHosts: [
      "merchants-scholarship-deutschland-fighters.trycloudflare.com",
    ],
  },
});
