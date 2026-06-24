import preact from "@preact/preset-vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import packageJson from "./package.json";
import babylonLitePackage from "./node_modules/@babylonjs/lite/package.json";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "examples",
  base: "/examples/",
  publicDir: "../public",
  plugins: [preact()],
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
        boombox: resolve(projectRoot, "examples/boombox/index.html"),
        animatedGlb: resolve(projectRoot, "examples/animated-glb/index.html"),
        userGuide: resolve(projectRoot, "examples/user-guide/index.html")
      }
    }
  }
});
