import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API runs on :8000; /api calls are forwarded so the browser never needs CORS.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
});
