# Agent task: build an independent Babylon Lite app with Babylon Lite Explorer

Use this file as a handoff prompt for an agent working in a separate repository.

The npm package is published here:

https://www.npmjs.com/package/babylon-lite-explorer

## Goal

Create a small independent app using Vite, which is the default and expected bundler for this test, that:

- uses `@babylonjs/lite` directly
- creates a simple Babylon Lite scene
- installs and imports `babylon-lite-explorer` from npm
- opens the Explorer over the canvas
- can be run with `npm run dev`
- can be built with `npm run build`

Do not import from this repository's `src/` folder. The test app must consume the published npm package.

## Recommended project shape

Create or use a clean folder outside the Explorer repository:

```text
my-lite-explorer-test/
  index.html
  package.json
  src/
    main.ts
    style.css
  tsconfig.json
```

## Install

For a new Vite TypeScript app:

```bash
npm create vite@latest my-lite-explorer-test -- --template vanilla-ts
cd my-lite-explorer-test
npm install
npm install @babylonjs/lite babylon-lite-explorer
```

`babylon-lite-explorer` uses Preact internally. With modern npm, its peer dependencies should be installed automatically. If the package manager reports missing peer dependencies, install them explicitly:

```bash
npm install preact @preact/signals
```

## `index.html`

Use a single full-screen canvas:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Babylon Lite Explorer test</title>
  </head>
  <body>
    <canvas id="renderCanvas"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

## `src/style.css`

```css
html,
body,
#renderCanvas {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

body {
  background: #111827;
}

#renderCanvas {
  display: block;
  touch-action: none;
}
```

## `src/main.ts`

This is the minimal scene:

```ts
import {
  addToScene,
  attachControl,
  createArcRotateCamera,
  createBox,
  createEngine,
  createHemisphericLight,
  createPbrMaterial,
  createSceneContext,
  createSphere,
  registerScene,
  startEngine,
} from "@babylonjs/lite";
import { showLiteExplorer } from "babylon-lite-explorer";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");

if (!canvas) {
  throw new Error("Canvas #renderCanvas was not found.");
}

const engine = await createEngine(canvas);
const scene = createSceneContext(engine);

const camera = createArcRotateCamera(
  -Math.PI / 2,
  Math.PI / 2.5,
  5,
  { x: 0, y: 0, z: 0 },
);

scene.camera = camera;
attachControl(camera, canvas, scene);

const light = createHemisphericLight([0, 1, 0], 1);
addToScene(scene, light);

const sphere = createSphere(engine, { segments: 24, diameter: 1.5 });
sphere.name = "Red sphere";
sphere.position.x = -1.2;
sphere.material = createPbrMaterial({
  name: "Red PBR material",
  baseColorFactor: [1, 0.1, 0.08, 1],
  metallicFactor: 0.05,
  roughnessFactor: 0.45,
});
addToScene(scene, sphere);

const box = createBox(engine, 1.4);
box.name = "Blue box";
box.position.x = 1.2;
box.material = createPbrMaterial({
  name: "Blue PBR material",
  baseColorFactor: [0.05, 0.25, 1, 1],
  metallicFactor: 0.1,
  roughnessFactor: 0.35,
});
addToScene(scene, box);

await registerScene(scene);
await startEngine(engine);

const explorer = showLiteExplorer(
  { engine, scene, canvas },
  {
    mode: "overlay",
    layout: "single",
    theme: "dark",
    features: {
      canvasPicking: true,
      focusSelected: false,
    },
  },
);

await explorer.ready;
```

The published package imports its Explorer CSS from the JavaScript entry, and Vite should include it automatically. If the Explorer renders without styling, add this explicit import near the top of `src/main.ts`:

```ts
import "babylon-lite-explorer/styles.css";
```

Do not add this import unless it is needed.

## Run

```bash
npm run dev
```

Open the local Vite URL. Usually it is:

```text
http://localhost:5173/
```

Expected result:

- the scene shows a red sphere and a blue box
- the Explorer appears over the canvas
- Scene Explorer lists `Scene`, camera, light, meshes, and materials
- selecting a mesh shows position, rotation, scaling, deformation info, and material link
- selecting a material shows its public PBR values
- canvas picking can be enabled from the Explorer header

## Build

```bash
npm run build
npm run preview
```

Expected production result:

- the scene still renders
- the Explorer still appears
- no missing CSS or JavaScript chunk errors appear in the browser console

## WebGPU notes

Babylon Lite uses WebGPU. Test in a browser with WebGPU support, such as a recent Chrome or Edge.

For local development, `localhost` is acceptable. For deployment, use HTTPS.

If the app fails before rendering, check for errors like:

- WebGPU adapter not available
- browser does not support WebGPU
- page is not served from a secure context

## Things not to include in this small test

Keep the first independent app simple. Do not add these until the basic package test is working:

- GLB loading
- environment textures
- BRDF LUT files
- Node Material
- custom Explorer adapters
- server-side rendering

The purpose of this app is to prove that the published npm package can be installed and used by a normal external application.

## Report back

When done, report:

- package manager used
- installed versions of `@babylonjs/lite` and `babylon-lite-explorer`
- whether dev mode works
- whether production build and preview work
- any browser console errors
- whether the Explorer CSS loaded from the package automatically
