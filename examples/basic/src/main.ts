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
  loadEnvironment,
  registerScene,
  startEngine,
} from "@babylonjs/lite";
import { showLiteExplorer } from "../../../src";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);
const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.5, 4, { x: 0, y: 0, z: 0 });
scene.camera = camera;
attachControl(camera, canvas, scene);
addToScene(scene, createHemisphericLight([0, 1, 0], 1));

await loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
  brdfUrl: "/brdf-lut.png",
});

const sphere = createSphere(engine, { segments: 16, diameter: 2 });
sphere.name = "Sphere";
sphere.position.x = -1.25;
sphere.material = createPbrMaterial();
addToScene(scene, sphere);

const box = createBox(engine, 1.5);
box.name = "Blue box";
box.position.x = 1.25;
box.material = createPbrMaterial({
  name: "boxMaterial",
  baseColorFactor: [0.05, 0.25, 0.95, 1],
  metallicFactor: 0.1,
  roughnessFactor: 0.35,
});
addToScene(scene, box);

await registerScene(scene);
await startEngine(engine);
showLiteExplorer({ engine, scene, canvas }, { features: { canvasPicking: true }, userGuideUrl: "/examples/user-guide/" });
