import {
  addToScene,
  attachControl,
  createBox,
  createDefaultCamera,
  createEngine,
  createHemisphericLight,
  createPbrMaterial,
  createSceneContext,
  registerScene,
  startEngine,
} from "@babylonjs/lite";
import * as lite from "@babylonjs/lite";
// This example intentionally exercises the generated browser/CDN artifact.
// The demo config resolves Babylon Lite imports originating in that artifact
// to a separate CDN module, while this scene uses the local package instance.
// @ts-expect-error The artifact exists after `npm run build:npm` and is not a TypeScript source entry.
import { showLiteExplorer } from "../../../dist/browser.js";
import { demoUrl } from "../../demoUrl";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);

addToScene(scene, createHemisphericLight([0, 1, 0], 1));

const box = createBox(engine, 1.5);
box.name = "Initial dist-consumer box";
box.material = createPbrMaterial({
  name: "Initial PBR material",
  baseColorFactor: [0.1, 0.45, 0.95, 1],
  metallicFactor: 0.15,
  roughnessFactor: 0.35,
});
addToScene(scene, box);

const camera = createDefaultCamera(scene);
camera.alpha += Math.PI;
attachControl(camera, canvas, scene);

await registerScene(scene);
await startEngine(engine);

const explorer = showLiteExplorer(
  { engine, scene, canvas, lite },
  { features: { canvasPicking: true }, userGuideUrl: demoUrl("user-guide/") },
);
await explorer.ready;
