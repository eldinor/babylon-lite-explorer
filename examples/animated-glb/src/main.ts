import {
  addToScene,
  attachControl,
  createDefaultCamera,
  createEngine,
  createHemisphericLight,
  createSceneContext,
  loadGltf,
  playAnimation,
  registerScene,
  startEngine,
  stopAnimation,
} from "@babylonjs/lite";
import { showLiteExplorer } from "../../../src";
import { demoUrl } from "../../demoUrl";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);

addToScene(scene, createHemisphericLight([0, 1, 0], 1));

const shark = await loadGltf(engine, "https://assets.babylonjs.com/meshes/shark.glb");
addToScene(scene, shark);

for (const group of shark.animationGroups ?? []) stopAnimation(group);
const animation = shark.animationGroups?.[0];
if (animation) playAnimation(animation);

const camera = createDefaultCamera(scene);
camera.alpha += Math.PI;
attachControl(camera, canvas, scene);

await registerScene(scene);
await startEngine(engine);
showLiteExplorer({ engine, scene, canvas }, { features: { canvasPicking: true }, userGuideUrl: demoUrl("user-guide/") });
