import {
  addToScene,
  attachControl,
  createArcRotateCamera,
  createEngine,
  createHemisphericLight,
  createPbrMaterial,
  createSceneContext,
  createSolidTexture2D,
  createSphere,
  loadGltf,
  registerScene,
  startEngine
} from "@babylonjs/lite";
import { showLiteExplorer } from "../../../src";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);
const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.5, 4, { x: 0, y: 0, z: 0 });
scene.camera = camera;
attachControl(camera, canvas, scene);
addToScene(scene, createHemisphericLight([0, 1, 0], 1));
const sphere = createSphere(engine, { segments: 16, diameter: 2 });
sphere.name = "Sphere";
sphere.material = createPbrMaterial({
  // Babylon Lite 1.2.0's PBR bind group expects these two textures even when
  // the corresponding factors are present. Neutral white textures preserve
  // the factor values: ORM channels are occlusion=1, roughness=1, metallic=1.
  baseColorTexture: createSolidTexture2D(engine, 1, 1, 1, 1),
  ormTexture: createSolidTexture2D(engine, 1, 1, 1, 1),
  baseColorFactor: [0.9, 0.1, 0.1, 1],
  metallicFactor: 0.1,
  roughnessFactor: 0.4
});
addToScene(scene, sphere);

addToScene(
  scene,
  await loadGltf(engine, "https://playground.babylonjs.com/scenes/BoomBox.glb")
);

await registerScene(scene);
await startEngine(engine);
showLiteExplorer({ engine, scene, canvas }, { features: { canvasPicking: true } });
