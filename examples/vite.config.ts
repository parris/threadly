import { defineConfig } from "vite";
import { threadly } from "../src/vite-plugin";

export default defineConfig({
  plugins: [
    threadly({
      outputDir: "./dist/workers",
      emitWorkerFiles: true,
      target: "es2020",
      module: "esnext",
      sourceMap: true,
    }),
  ],
  build: {
    target: "es2020",
    sourcemap: true,
  },
});
