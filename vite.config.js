import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json" with { type: "json" };

export default defineConfig({
  // Relative asset URLs allow the same build to run at a GitHub Pages
  // repository path (for example /ForteStack/) or at a custom domain.
  base: "./",
  plugins: [react()],
  define: {
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  server: {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  },
});
