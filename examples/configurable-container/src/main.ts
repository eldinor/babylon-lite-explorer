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
import * as lite from "@babylonjs/lite";
import { showLiteExplorer } from "../../../src";
import { demoUrl } from "../../demoUrl";

const workspace = document.querySelector<HTMLElement>("#workspace")!;
const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const status = document.querySelector<HTMLOutputElement>("#mountStatus")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);
scene.clearColor = { r: 0.025, g: 0.04, b: 0.07, a: 1 };

const camera = createArcRotateCamera(-Math.PI / 2.4, Math.PI / 2.6, 6, { x: 0, y: 0.4, z: 0 });
scene.camera = camera;
attachControl(camera, canvas, scene);
addToScene(scene, createHemisphericLight([0, 1, 0], 1.1));

const sphere = createSphere(engine, { diameter: 1.8, segments: 20 });
sphere.name = "Container sphere";
sphere.position.x = -1.15;
sphere.material = createPbrMaterial({ name: "Orange", baseColorFactor: [1, 0.28, 0.08, 1], metallicFactor: 0.05, roughnessFactor: 0.4 });
addToScene(scene, sphere);

const box = createBox(engine, 1.6);
box.name = "Container box";
box.position.x = 1.15;
box.material = createPbrMaterial({ name: "Blue", baseColorFactor: [0.08, 0.35, 1, 1], metallicFactor: 0.1, roughnessFactor: 0.35 });
addToScene(scene, box);

await registerScene(scene);
await startEngine(engine);

const explorer = showLiteExplorer(
  { engine, scene, canvas, lite },
  {
    container: workspace,
    mode: "overlay",
    layout: "single",
    features: { canvasPicking: true },
    userGuideUrl: demoUrl("user-guide/"),
    onDispose: () => { status.value = "Explorer state: disposed"; },
  },
);
await explorer.ready;
status.value = `Explorer state: ${explorer.state}; mounted in #${workspace.id}`;
