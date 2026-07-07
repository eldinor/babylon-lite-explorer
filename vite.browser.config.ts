import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import packageJson from "./package.json";

const babylonLitePackage = JSON.parse(
  readFileSync(resolve(process.cwd(), "node_modules/@babylonjs/lite/package.json"), "utf8")
) as { version: string };

const importBrowserCss = (): Plugin => ({
  name: "import-browser-css",
  enforce: "post",
  generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type === "chunk" && output.isEntry) {
        output.code = `import "./browser.css";\n${output.code}`;
      }
    }
  }
});

export default defineConfig({
  publicDir: false,
  plugins: [preact(), importBrowserCss()],
  define: {
    __BABYLON_LITE_VERSION__: JSON.stringify(babylonLitePackage.version),
    __EXPLORER_VERSION__: JSON.stringify(packageJson.version)
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "browser",
      cssFileName: "browser"
    },
    rollupOptions: {
      // Preact and Signals are intentionally bundled so browser CDNs cannot
      // resolve them to incompatible Preact instances.
      external: ["@babylonjs/lite"]
    }
  }
});
