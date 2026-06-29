import { resolve } from "path";
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  root: resolve(__dirname, "src/renderer"),
  server: {
    fs: {
      allow: ["../.."],
    },
  },
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "out/renderer"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      external: ["node:fs", "node:path"],
      input: {
        index: resolve(__dirname, "src/renderer/index.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("three")) return "three";
            if (id.includes("@monaco-editor")) return "monaco";
            if (id.includes("xterm")) return "xterm";
            if (id.includes("react") || id.includes("react-dom")) return "react-vendor";
            if (id.includes("openai") || id.includes("anthropic") || id.includes("google"))
              return "ai-sdks";
          }
        },
      },
    },
  },
  pack: [
    {
      entry: resolve(__dirname, "src/main/index.ts"),
      format: "cjs",
      outDir: "out/main",
      clean: true,
      external: ["electron", "node-pty", "sqlite3", "better-sqlite3"],
    },
    {
      entry: resolve(__dirname, "src/preload/index.ts"),
      format: "cjs",
      outDir: "out/preload",
      clean: true,
      external: ["electron"],
    },
    {
      entry: resolve(__dirname, "src/main/workers/swarmWorker.ts"),
      format: "cjs",
      outDir: "out/main/workers",
      clean: true,
      external: ["ws"],
    },
  ],
  test: {
    root: __dirname,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "**/.git/**",
      "testing/ast-engine/**",
    ],
  },
});
