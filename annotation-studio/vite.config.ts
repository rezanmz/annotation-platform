import vinext from "vinext";
import { defineConfig } from "vite";

// The production target is a standalone Node server (Railway). Local development
// uses the same Vite pipeline through `vinext dev`.
export default defineConfig({
  plugins: [vinext()],
  server: {
    host: process.env.HOST ?? "127.0.0.1",
    fs: {
      // Keep Vite's standard secret exclusions and protect private runtime files.
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.data/**", "*.annotators.json*",
        "qualification-answer-keys.json", "*_annotation_guidelines.pdf", "**/guidelines/*.pdf"],
    },
  },
});
