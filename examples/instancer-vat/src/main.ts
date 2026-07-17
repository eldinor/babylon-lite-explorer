import {
  addToScene,
  attachControl,
  createArcRotateCamera,
  createEngine,
  createHemisphericLight,
  createSceneContext,
  loadEnvironment,
  loadGltf,
  mat4Compose,
  onBeforeRender,
  registerScene,
  startEngine,
  type SceneNode,
} from "@babylonjs/lite";
import * as lite from "@babylonjs/lite";
import {
  bakeVatSocketAsset,
  createVatAttachmentBinding,
  createVatCharacterSet,
  type VatAttachmentPreset,
} from "@litools/instancer";
import { createInstancerExplorerAdapter, showLiteExplorer } from "../../../src";
import { demoUrl } from "../../demoUrl";

const MODEL_URL = "https://assets.babylonjs.com/meshes/HVGirl.glb";
const SWORD_URL = "https://raw.githubusercontent.com/eldinor/lite-instancer/main/public/fantasy_sword.glb";
const ENVIRONMENT_URL = "https://assets.babylonjs.com/environments/environmentSpecular.env";
const CLIP_NAME = "Samba";
const RIGHT_HAND = "mixamorig:RightHand";
const CHARACTER_SCALE = 0.1;
const CAPACITY = 5;

type CharacterMetadata = { label: string };
type SwordMetadata = { label: string; characterIndex: number };

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);

const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.55, 10, { x: 0, y: 0.9, z: 0 });
scene.camera = camera;
attachControl(camera, canvas, scene);
addToScene(scene, createHemisphericLight([0, 1, 0], 1));

await loadEnvironment(scene, ENVIRONMENT_URL, {
  brdfUrl: demoUrl("brdf-lut.png"),
  skipSkybox: true,
  skipGround: true,
});

// A separate, non-rendered source rig is used only to bake the hand socket tracks.
const socketSource = await loadGltf(engine, MODEL_URL);
const sourceAnimations = socketSource.animationGroups ?? [];

const characterContainer = await loadGltf(engine, MODEL_URL);
addToScene(scene, characterContainer);
const characterRoot = firstSceneNode(characterContainer.entities);
const characterAnimations = characterContainer.animationGroups ?? [];
if (!characterRoot || sourceAnimations.length === 0 || characterAnimations.length === 0) {
  throw new Error("HVGirl.glb must provide a scene root, skinned meshes, and animation groups.");
}

const characters = createVatCharacterSet<CharacterMetadata>(engine, characterRoot, characterAnimations, {
  capacity: CAPACITY,
  engine,
  visibleStrategy: "scale-zero",
  clip: CLIP_NAME,
});
// These skeletal groups were consumed by VAT baking. Leaving them registered
// would expose non-functional playback controls in the regular Scene Explorer.
removeConsumedAnimationGroups(scene.animationGroups, characterAnimations);
const socketAsset = bakeVatSocketAsset(engine, sourceAnimations, {
  clips: characters.clips,
  sockets: { sword: RIGHT_HAND },
});

const swordContainer = await loadGltf(engine, SWORD_URL);
addToScene(scene, swordContainer);
const swordRoot = firstSceneNode(swordContainer.entities);
if (!swordRoot) throw new Error("fantasy_sword.glb did not provide a scene-node root.");

const swordPreset: VatAttachmentPreset = {
  version: 1,
  character: { kind: "url", url: MODEL_URL },
  attachment: { kind: "url", url: SWORD_URL },
  socket: { key: "sword", nodeIndex: 0, nodeName: RIGHT_HAND },
  clipScope: "all",
  // Configurator preset for Samba Girl with the authored Fantasy Sword GLB.
  grip: {
    translation: [500, 100, 0],
    rotationEulerDegrees: [0, 0, 0],
    scale: [600, 600, 600],
  },
};
const swords = createVatAttachmentBinding<SwordMetadata>({
  engine,
  character: characters,
  attachmentRoot: swordRoot,
  socketAsset,
  preset: swordPreset,
  instanceOptions: { capacity: CAPACITY, visibleStrategy: "scale-zero" },
});

const transforms = [
  mat4Compose(-2.1, 0, -1.5, 0, 0, 0, 1, CHARACTER_SCALE, CHARACTER_SCALE, CHARACTER_SCALE),
  mat4Compose(0, 0, -1.5, 0, 0, 0, 1, CHARACTER_SCALE, CHARACTER_SCALE, CHARACTER_SCALE),
  mat4Compose(2.1, 0, -1.5, 0, 0, 0, 1, CHARACTER_SCALE, CHARACTER_SCALE, CHARACTER_SCALE),
  mat4Compose(-1.05, 0, 1.25, 0, 0, 0, 1, CHARACTER_SCALE, CHARACTER_SCALE, CHARACTER_SCALE),
  mat4Compose(1.05, 0, 1.25, 0, 0, 0, 1, CHARACTER_SCALE, CHARACTER_SCALE, CHARACTER_SCALE),
];

for (let index = 0; index < transforms.length; index++) {
  const characterId = characters.create({
    transform: transforms[index],
    offset: 0,
    metadata: { label: `Samba Dancer ${index + 1}` },
  });
  const swordId = swords.create(undefined, { label: `Fantasy Sword ${index + 1}`, characterIndex: index });
  if (!swords.bind(characterId, swordId)) throw new Error(`Could not bind sword ${index + 1}.`);
}

let playing = true;

onBeforeRender(scene, (deltaMs) => {
  if (playing) characters.update(deltaMs * 0.001);
  swords.update();
});

const instancerAdapter = createInstancerExplorerAdapter();
instancerAdapter.register(characters, {
  label: "Samba VAT Characters",
  getPlaybackPaused: () => !playing,
  setPlaybackPaused: (paused) => { playing = !paused; },
});
instancerAdapter.register(swords.attachments, { label: "Right-hand Fantasy Swords" });

await registerScene(scene);
await startEngine(engine);

showLiteExplorer(
  { engine, scene, canvas, lite },
  {
    adapters: [instancerAdapter],
    features: { canvasPicking: true },
    userSettings: {
      picking: { enabled: true },
      instancer: { pickMode: "instance" },
    },
    userGuideUrl: demoUrl("user-guide/"),
  },
);

function firstSceneNode(entities: readonly unknown[]): SceneNode | undefined {
  return entities.find((entity): entity is SceneNode => typeof entity === "object" && entity !== null && "children" in entity);
}

function removeConsumedAnimationGroups<T>(sceneGroups: T[], consumedGroups: T[]): void {
  const consumed = new Set(consumedGroups);
  for (let index = sceneGroups.length - 1; index >= 0; index--) {
    if (consumed.has(sceneGroups[index])) sceneGroups.splice(index, 1);
  }
  // addToScene's animation callback closes over this array. Clearing it also
  // prevents the obsolete skeletal animation loop from continuing in the background.
  consumedGroups.length = 0;
}
