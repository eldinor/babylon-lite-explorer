import {
  addToScene,
  attachControl,
  createArcRotateCamera,
  createBox,
  createEngine,
  createHemisphericLight,
  createPbrMaterial,
  createSceneContext,
  loadEnvironment,
  registerScene,
  startEngine,
} from "@babylonjs/lite";
import * as lite from "@babylonjs/lite";
import { createInstanceSet } from "@litools/instancer";
import { createInstancerExplorerAdapter, showLiteExplorer } from "../../../src";
import { demoUrl } from "../../demoUrl";

type BoxMetadata = {
  label: string;
  group: string;
};

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);

const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.6, 12, { x: 0, y: 0, z: 0 });
scene.camera = camera;
attachControl(camera, canvas, scene);
addToScene(scene, createHemisphericLight([0, 1, 0], 1));

await loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
  brdfUrl: demoUrl("brdf-lut.png"),
  skipSkybox: true,
  skipGround: true,
});

const redSource = createBox(engine, 0.7);
redSource.name = "Red Box Source";
redSource.material = createPbrMaterial({
  name: "redSourceMaterial",
  baseColorFactor: [0.9, 0.08, 0.05, 1],
  roughnessFactor: 0.45,
});
addToScene(scene, redSource);

const blueSource = createBox(engine, 0.7);
blueSource.name = "Blue Box Source";
blueSource.material = createPbrMaterial({
  name: "blueSourceMaterial",
  baseColorFactor: [0.05, 0.25, 0.95, 1],
  roughnessFactor: 0.45,
});
addToScene(scene, blueSource);

const redBoxes = createInstanceSet<BoxMetadata>(redSource, { capacity: 16, engine });
const blueBoxes = createInstanceSet<BoxMetadata>(blueSource, { capacity: 16, engine });

for (let index = 0; index < 8; index++) {
  redBoxes.create({
    position: [-3 + index * 0.8, 0, -1.2],
    scale: 0.75,
  }, {
    label: `Red Box ${index + 1}`,
    group: "red",
  });

  blueBoxes.create({
    position: [-3 + index * 0.8, 0, 1.2],
    scale: 0.75,
  }, {
    label: `Blue Box ${index + 1}`,
    group: "blue",
  });
}

const instancerAdapter = createInstancerExplorerAdapter();
instancerAdapter.register(redBoxes, {
  label: "Red Boxes",
  saveSet: (snapshot) => {
    console.log("Saved Red Boxes snapshot", snapshot);
  },
});
instancerAdapter.register(blueBoxes, {
  label: "Blue Boxes",
  saveSet: (snapshot) => {
    console.log("Saved Blue Boxes snapshot", snapshot);
  },
});

console.log("Initial Red Boxes snapshot", instancerAdapter.exportSet(redBoxes));

await registerScene(scene);
await startEngine(engine);

showLiteExplorer(
  { engine, scene, canvas, lite },
  {
    adapters: [instancerAdapter],
    features: { canvasPicking: true },
    userGuideUrl: demoUrl("user-guide/"),
  },
);
