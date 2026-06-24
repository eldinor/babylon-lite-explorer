import {
  addToScene,
  attachControl,
  createArcRotateCamera,
  createEngine,
  createSceneContext,
  createTorus,
  parseNodeMaterialFromSnippet,
  registerScene,
  startEngine,
} from "@babylonjs/lite";
import { showLiteExplorer } from "../../../src";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);

const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.4, 4, { x: 0, y: 0, z: 0 });
scene.camera = camera;
attachControl(camera, canvas, scene);

const graph = {
  blocks: [
    {
      id: 1,
      name: "position",
      customType: "BABYLON.InputBlock",
      mode: 1,
      type: 8,
      outputs: [{ name: "output" }],
    },
    {
      id: 2,
      name: "worldViewProjection",
      customType: "BABYLON.InputBlock",
      systemValue: 6,
      type: 128,
      outputs: [{ name: "output" }],
    },
    {
      id: 3,
      name: "World View Projection",
      customType: "BABYLON.TransformBlock",
      complementW: 1,
      complementZ: 0,
      inputs: [
        { name: "vector", targetBlockId: 1, targetConnectionName: "output" },
        { name: "transform", targetBlockId: 2, targetConnectionName: "output" },
      ],
      outputs: [{ name: "output" }],
    },
    {
      id: 4,
      name: "VertexOutput",
      customType: "BABYLON.VertexOutputBlock",
      inputs: [{ name: "vector", targetBlockId: 3, targetConnectionName: "output" }],
      outputs: [],
    },
    {
      id: 5,
      name: "Color",
      customType: "BABYLON.InputBlock",
      mode: 0,
      type: 16,
      value: [0.12, 0.55, 1, 1],
      outputs: [{ name: "output" }],
    },
    {
      id: 6,
      name: "FragmentOutput",
      customType: "BABYLON.FragmentOutputBlock",
      inputs: [{ name: "rgba", targetBlockId: 5, targetConnectionName: "output" }],
      outputs: [],
    },
  ],
};

const material = await parseNodeMaterialFromSnippet(engine, "inline", { json: graph });
material.name = "Blue Node Material";

const torus = createTorus(engine, { diameter: 2, thickness: 0.55, tessellation: 48 });
torus.name = "Node Material Torus";
torus.material = material;
addToScene(scene, torus);

await registerScene(scene);
await startEngine(engine);
showLiteExplorer(
  { engine, scene, canvas },
  { features: { canvasPicking: true }, userGuideUrl: "/examples/user-guide/" },
);
