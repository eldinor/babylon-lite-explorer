import {
  addToScene,
  attachControl,
  createArcRotateCamera,
  createBox,
  createEngine,
  createHemisphericLight,
  createPbrMaterial,
  createSceneContext,
  registerScene,
  startEngine,
} from "@babylonjs/lite";
import * as lite from "@babylonjs/lite";
import { showLiteExplorer } from "../../../src";
import { demoUrl } from "../../demoUrl";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);

const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.4, 4, { x: 0, y: 0, z: 0 });
scene.camera = camera;
attachControl(camera, canvas, scene);
addToScene(scene, createHemisphericLight([0, 1, 0], 1));

const box = createBox(engine, 1.25);
box.name = "Regular PBR Box";
box.position.x = 1.2;
box.material = createPbrMaterial({
  name: "Regular PBR Material",
  baseColorFactor: [1, 0.25, 0.08, 1],
  metallicFactor: 0.1,
  roughnessFactor: 0.4,
});
addToScene(scene, box);

try {
  const { createNodeMaterialTorus } = await import("./createNodeMaterialTorus");
  addToScene(scene, await createNodeMaterialTorus(engine));
} catch (error) {
  console.error("Could not create the Node Material torus.", error);
}

await registerScene(scene);
await startEngine(engine);
showLiteExplorer(
  { engine, scene, canvas, lite },
  { features: { canvasPicking: true }, userGuideUrl: demoUrl("user-guide/") },
);
