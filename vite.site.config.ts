import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** the site's public address, for link previews. Set SITE_URL when building. */
const siteUrl = (process.env.SITE_URL ?? "").replace(/\/+$/, "");

/**
 * fills the page's placeholders from the repo, so the install steps always
 * show the compose file that actually ships.
 */
const siteHtml = () => ({
  name: "mise-site-html",
  transformIndexHtml: {
    order: "pre" as const,
    handler: (html: string) =>
      html.replaceAll(
        "{{preview}}",
        siteUrl
          ? `<meta property="og:url" content="${siteUrl}/" />
    <meta property="og:image" content="${siteUrl}/preview.jpg" />
    <meta name="twitter:card" content="summary_large_image" />`
          : ""
      ),
  },
});

export default defineConfig({
  root: here("./site"),
  // relative asset paths, so the build works at a domain root or under a
  // sub-path (github pages serves a project at /mise/).
  base: "./",
  publicDir: here("./site/public"),
  cacheDir: here("./node_modules/.vite-site"),
  plugins: [
    siteHtml(),
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
    outDir: here("./dist-site"),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    // the demos import the app's own components from ../src.
    fs: { allow: [here(".")] },
  },
});
