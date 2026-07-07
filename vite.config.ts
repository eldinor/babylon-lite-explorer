import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import packageJson from "./package.json";

const babylonLitePackage = JSON.parse(
  readFileSync(resolve(process.cwd(), "node_modules/@babylonjs/lite/package.json"), "utf8")
) as { version: string };

const importExtractedCss = (): Plugin => ({
  name: "import-extracted-css",
  enforce: "post",
  generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type === "chunk" && output.isEntry) {
        output.code = `import "./lite-explorer.css";\n${output.code}`;
      }
    }
  }
});

export default defineConfig(({ command }) => ({
  publicDir: command === "serve" ? "public" : false,
  plugins: [preact(), importExtractedCss()],
  define: {
    __BABYLON_LITE_VERSION__: JSON.stringify(babylonLitePackage.version),
    __EXPLORER_VERSION__: JSON.stringify(packageJson.version)
  },
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
      cssFileName: "lite-explorer"
    },
    rollupOptions: {
      external: ["preact", "preact/hooks", "preact/jsx-runtime", "@preact/signals", "@babylonjs/lite"]
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"]
  }
}));
