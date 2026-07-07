import {
  addToScene,
  attachControl,
  createArcRotateCamera,
  createBox,
  createDirectionalLight,
  createEngine,
  createGround,
  createHemisphericLight,
  createPbrMaterial,
  createPcfDirectionalShadowGenerator,
  createSceneContext,
  createStandardMaterial,
  registerSceneWithShadowSupport,
  setClipPlane,
  setFog,
  setShadowTaskCasterMeshes,
  startEngine,
} from "@babylonjs/lite";
import { showLiteExplorer } from "../../../src";
import { demoUrl } from "../../demoUrl";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);
scene.clearColor = { r: 0.035, g: 0.055, b: 0.09, a: 1 };

const camera = createArcRotateCamera(-Math.PI / 3, Math.PI / 3.1, 15, { x: 0, y: 1, z: 1 });
scene.camera = camera;
attachControl(camera, canvas, scene);

addToScene(scene, createHemisphericLight([0, 1, 0], 0.45));
const sun = createDirectionalLight([-0.55, -1, 0.35], 1.8);
addToScene(scene, sun);

setFog(scene, {
  mode: 3,
  density: 0.025,
  start: 5,
  end: 22,
  color: [0.16, 0.22, 0.32],
});
// This public state appears in Explorer, but Lite 1.8's built-in PBR shaders do
// not consume scene.clipPlane. See docs/babylon-lite-pbr-clip-plane-issue.md.
setClipPlane(scene, [0.5, 0.866, 0, 0]);

const ground = createGround(engine, { width: 18, height: 24, subdivisions: 1 });
ground.name = "Fog ground";
ground.receiveShadows = true;
ground.material = createPbrMaterial({
  name: "Ground material",
  baseColorFactor: [0.12, 0.16, 0.2, 1],
  metallicFactor: 0,
  roughnessFactor: 0.92,
});
addToScene(scene, ground);

const casters = [];
for (let index = 0; index < 6; index++) {
  const box = createBox(engine, 1.4);
  box.name = `Shadow box ${index + 1}`;
  box.position.x = index % 2 === 0 ? -1.65 : 1.65;
  box.position.y = 1.4;
  box.position.z = -4 + index * 2;
  box.rotation.y = index * 0.22;
  box.scaling.y = 2;
  box.material = createPbrMaterial({
    name: `Box material ${index + 1}`,
    baseColorFactor: index % 2 === 0 ? [0.95, 0.3, 0.12, 1] : [0.1, 0.48, 1, 1],
    metallicFactor: 0.08,
    roughnessFactor: 0.38,
  });
  casters.push(box);
  addToScene(scene, box);
}

for (let index = 0; index < 4; index++) {
  const box = createBox(engine, 1.25);
  box.name = `Standard shadow box ${index + 1}`;
  box.position.x = 4.3;
  box.position.y = 1.55;
  box.position.z = -3 + index * 2.2;
  box.rotation.y = -0.18 * index;
  box.scaling.y = 2.45;
  const material = createStandardMaterial();
  material.name = `Standard material ${index + 1}`;
  material.diffuseColor = index % 2 === 0 ? [0.2, 0.85, 0.42] : [0.95, 0.72, 0.12];
  material.specularColor = [0.25, 0.25, 0.25];
  material.specularPower = 48;
  box.material = material;
  casters.push(box);
  addToScene(scene, box);
}

const { createClippedNodeBoxes } = await import("./createClippedNodeBoxes");
for (const box of await createClippedNodeBoxes(engine)) addToScene(scene, box);

const shadowGenerator = createPcfDirectionalShadowGenerator(engine, sun, {
  mapSize: 1024,
  bias: 0.001,
  normalBias: 0.02,
  darkness: 0.25,
});
setShadowTaskCasterMeshes(shadowGenerator, casters);
addToScene(scene, shadowGenerator);

await registerSceneWithShadowSupport(scene);
await startEngine(engine);
showLiteExplorer(
  { engine, scene, canvas },
  { features: { canvasPicking: true }, userGuideUrl: demoUrl("user-guide/") },
);
