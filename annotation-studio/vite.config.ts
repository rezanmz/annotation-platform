import vinext from "vinext";
import { defineConfig } from "vite";

// The production target is a standalone Node server (Railway). Local development
// uses the same Vite pipeline through `vinext dev`.
export default defineConfig({
  plugins: [vinext()],
  server: {
    host: process.env.HOST ?? "127.0.0.1",
  },
});
