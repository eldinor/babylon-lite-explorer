import {
  addToScene,
  attachControl,
  createDefaultCamera,
  createEngine,
  createHemisphericLight,
  createSceneContext,
  loadGltf,
  registerScene,
  startEngine
} from "@babylonjs/lite";
import { showLiteExplorer } from "../../../src";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);

addToScene(scene, createHemisphericLight([0, 1, 0], 1));

const boombox = await loadGltf(
  engine,
  "https://playground.babylonjs.com/scenes/BoomBox.glb"
);
addToScene(scene, boombox);

const camera = createDefaultCamera(scene);
camera.alpha += Math.PI;
attachControl(camera, canvas, scene);

await registerScene(scene);
await startEngine(engine);
showLiteExplorer({ engine, scene, canvas }, { features: { canvasPicking: true } });
