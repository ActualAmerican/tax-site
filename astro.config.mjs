import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://example.com", // update when deploying
  output: "static",
  vite: {
    build: { sourcemap: true },
  },
});
