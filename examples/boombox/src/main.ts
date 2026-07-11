import {
  addToScene,
  attachControl,
  createDefaultCamera,
  createEngine,
  createHemisphericLight,
  createSceneContext,
  loadEnvironment,
  loadGltf,
  registerScene,
  startEngine,
} from "@babylonjs/lite";
import * as lite from "@babylonjs/lite";
import { showLiteExplorer } from "../../../src";
import { demoUrl } from "../../demoUrl";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);

addToScene(scene, createHemisphericLight([0, 1, 0], 1));

await loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
  brdfUrl: demoUrl("brdf-lut.png"),
  skipSkybox: true,
  skipGround: true,
});
scene.imageProcessing.toneMappingEnabled = false;

const boombox = await loadGltf(engine, "https://playground.babylonjs.com/scenes/BoomBox.glb");
addToScene(scene, boombox);

const camera = createDefaultCamera(scene);
camera.alpha += Math.PI;
attachControl(camera, canvas, scene);

await registerScene(scene);
await startEngine(engine);
showLiteExplorer({ engine, scene, canvas, lite }, { features: { canvasPicking: true }, userGuideUrl: demoUrl("user-guide/") });
