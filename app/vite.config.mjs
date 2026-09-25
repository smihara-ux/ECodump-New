import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base:
    process.env.VITE_BASE_PATH ||
    (process.env.GITHUB_ACTIONS ? "/ECodump-New/" : "/"),
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
    proxy: {
      "/api/match": process.env.MATCH_API_PROXY_TARGET || "http://127.0.0.1:6103",
      "/api/direct": process.env.MATCH_API_PROXY_TARGET || "http://127.0.0.1:6103",
      "/api": process.env.WORKFLOW_API_PROXY_TARGET || "http://127.0.0.1:4180",
    },
  },
  plugins: [react()],
});
