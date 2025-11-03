import { defineConfig } from "astro/config";

export default defineConfig({
  // Pin where pages live so discovery can't drift.
  srcDir: "./src",
  site: "http://localhost:4321", // safe for dev; change on deploy
  output: "static",
  trailingSlash: "ignore",
  server: { host: true, port: 4321 },

  vite: {
    build: { sourcemap: true, assetsInlineLimit: 0 },
  },
});
