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
import { showLiteExplorer } from "../../../src";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);

scene.clearColor = { r: 0.025, g: 0.035, b: 0.06, a: 1 };

const camera = createArcRotateCamera(-Math.PI / 4, Math.PI / 3.2, 16, { x: 0, y: 0, z: 0 });
scene.camera = camera;
attachControl(camera, canvas, scene);
addToScene(scene, createHemisphericLight([0.25, 1, 0.2], 1.25));

const colors = [
  [0.12, 0.45, 1, 1],
  [0.55, 0.18, 1, 1],
  [0.95, 0.22, 0.42, 1],
  [1, 0.58, 0.08, 1],
  [0.08, 0.75, 0.55, 1],
] as const;

const materials = colors.map((baseColorFactor, index) => createPbrMaterial({
  name: `Grid material ${index + 1}`,
  baseColorFactor: [...baseColorFactor],
  metallicFactor: 0.15,
  roughnessFactor: 0.38,
}));

const gridSize = 10;
const spacing = 1.2;
const offset = ((gridSize - 1) * spacing) / 2;

for (let row = 0; row < gridSize; row++) {
  for (let column = 0; column < gridSize; column++) {
    const index = row * gridSize + column;
    const mesh = createBox(engine, 0.82);
    mesh.name = `Grid box ${String(index + 1).padStart(3, "0")}`;
    mesh.position.x = column * spacing - offset;
    mesh.position.y = Math.sin(row * 0.75) * 0.35 + Math.cos(column * 0.65) * 0.2;
    mesh.position.z = row * spacing - offset;
    mesh.rotation.y = (row + column) * 0.12;
    mesh.material = materials[(row + column) % materials.length];
    addToScene(scene, mesh);
  }
}

await registerScene(scene);
await startEngine(engine);
showLiteExplorer(
  { engine, scene, canvas },
  { features: { canvasPicking: true }, userGuideUrl: "/examples/user-guide/" },
);
