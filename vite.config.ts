import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
      cssFileName: "lite-inspector"
    },
    rollupOptions: {
      external: ["preact", "preact/hooks", "preact/jsx-runtime", "@preact/signals", "@babylonjs/lite"]
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"]
  }
});
