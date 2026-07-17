import preact from "@preact/preset-vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import packageJson from "./package.json";
import babylonLitePackage from "./node_modules/@babylonjs/lite/package.json";
import type { Plugin } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const splitDistLiteRuntime = (): Plugin => ({
  name: "split-dist-lite-runtime",
  enforce: "pre",
  resolveId(source, importer) {
    const normalizedImporter = importer?.replaceAll("\\", "/");
    if (source === "@babylonjs/lite" && normalizedImporter?.endsWith("/dist/browser.js")) {
      return {
        id: `https://cdn.jsdelivr.net/npm/@babylonjs/lite@${babylonLitePackage.version}/+esm`,
        external: true,
      };
    }
    return null;
  },
});

export default defineConfig(({ command }) => ({
  root: "examples",
  base: command === "build" ? (process.env.DEMO_BASE ?? "./") : "/examples/",
  publicDir: "../public",
  plugins: [splitDistLiteRuntime(), preact()],
  define: {
    __BABYLON_LITE_VERSION__: JSON.stringify(babylonLitePackage.version),
    __EXPLORER_VERSION__: JSON.stringify(packageJson.version)
  },
  build: {
    target: "esnext",
    outDir: "../demo-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(projectRoot, "examples/index.html"),
        basic: resolve(projectRoot, "examples/basic/index.html"),
        sceneDiagnostics: resolve(projectRoot, "examples/scene-diagnostics/index.html"),
        nodeMaterial: resolve(projectRoot, "examples/node-material/index.html"),
        hundredMeshes: resolve(projectRoot, "examples/hundred-meshes/index.html"),
        boombox: resolve(projectRoot, "examples/boombox/index.html"),
        instancerAdapter: resolve(projectRoot, "examples/instancer-adapter/index.html"),
        instancerVat: resolve(projectRoot, "examples/instancer-vat/index.html"),
        distBundle: resolve(projectRoot, "examples/dist-bundle/index.html"),
        animatedGlb: resolve(projectRoot, "examples/animated-glb/index.html"),
        userGuide: resolve(projectRoot, "examples/user-guide/index.html")
      }
    }
  }
}));
