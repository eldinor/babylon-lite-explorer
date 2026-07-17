# VAT Character and Sword Instancer Example

This example creates five VAT-animated Samba Girl characters, attaches a Fantasy Sword GLB to each character's right hand, and registers both sets with Babylon Lite Explorer. VAT animation selection and playback live in the dedicated **Instancer** panel.

The runnable source is in [`examples/instancer-vat`](../examples/instancer-vat/).

## What the example demonstrates

- A multi-part `VatCharacterSet` built from every skinned mesh in a GLB hierarchy
- Stable character and sword instance IDs
- A baked `mixamorig:RightHand` socket shared by all VAT clips
- A multi-mesh Fantasy Sword attachment kept synchronized with each character
- Logical screen-space picking for deformed VAT characters
- VAT clip inspection, selection, and inline Play/Pause controls in Explorer
- Removal of obsolete skeletal animation groups after VAT baking

## Install

Install Explorer, Babylon Lite, and the optional Instancer integration peer:

```sh
npm install babylon-lite-explorer @babylonjs/lite @litools/instancer@^0.3.1
```

The Instancer package is optional for the base Explorer, but required by applications that import and use `createInstancerExplorerAdapter()`.

## Assets and constants

The demo loads the public Babylon HVGirl model and the Fantasy Sword used by the upstream Instancer socket example:

```ts
const MODEL_URL = "https://assets.babylonjs.com/meshes/HVGirl.glb";
const SWORD_URL = "https://raw.githubusercontent.com/eldinor/lite-instancer/main/public/fantasy_sword.glb";
const CLIP_NAME = "Samba";
const RIGHT_HAND = "mixamorig:RightHand";
const CHARACTER_SCALE = 0.1;
const CAPACITY = 5;
```

For production applications, host the assets on infrastructure you control and configure CORS for the application origin.

## Create the VAT character set

Load one non-rendered copy for socket baking and one rendered copy for the VAT characters:

```ts
const socketSource = await loadGltf(engine, MODEL_URL);
const sourceAnimations = socketSource.animationGroups ?? [];

const characterContainer = await loadGltf(engine, MODEL_URL);
addToScene(scene, characterContainer);
const characterRoot = characterContainer.entities.find(isSceneNode);
const characterAnimations = characterContainer.animationGroups ?? [];

if (!characterRoot || sourceAnimations.length === 0 || characterAnimations.length === 0) {
  throw new Error("The character must contain a scene root, skinned meshes, and animation groups.");
}

const characters = createVatCharacterSet(engine, characterRoot, characterAnimations, {
  capacity: CAPACITY,
  engine,
  visibleStrategy: "scale-zero",
  clip: CLIP_NAME,
});
```

`VatCharacterSet` coordinates the primary and secondary skinned mesh parts. Transform, visibility, clip, phase, and FPS writes must go through this wrapper so every part remains synchronized.

## Remove consumed skeletal animation groups

The loaded `AnimationGroup` objects are inputs to VAT baking. They no longer control the rendered VAT characters. Leaving them in `scene.animationGroups` would make Scene Explorer show playback actions that cannot control the VAT result.

Remove the consumed groups after `createVatCharacterSet()` has completed:

```ts
function removeConsumedAnimationGroups<T>(sceneGroups: T[], consumedGroups: T[]): void {
  const consumed = new Set(consumedGroups);
  for (let index = sceneGroups.length - 1; index >= 0; index--) {
    if (consumed.has(sceneGroups[index])) sceneGroups.splice(index, 1);
  }

  // addToScene's animation callback closes over this array. Clearing it also
  // stops the obsolete skeletal animation loop.
  consumedGroups.length = 0;
}

removeConsumedAnimationGroups(scene.animationGroups, characterAnimations);
```

Do this only for groups consumed by VAT. Ordinary non-Instancer animated models should remain in `scene.animationGroups`; Explorer will continue to show their standard Animation Groups UI.

## Bake the right-hand socket

The separate source rig retains the original skeletal tracks needed to bake the socket for every VAT clip:

```ts
const socketAsset = bakeVatSocketAsset(engine, sourceAnimations, {
  clips: characters.clips,
  sockets: { sword: RIGHT_HAND },
});
```

The source rig is not added to the scene. Keep it alive until socket baking is complete, then release it with the lifecycle appropriate for your application.

## Create the sword attachment binding

Load the sword hierarchy and create one synchronized attachment set:

```ts
const swordContainer = await loadGltf(engine, SWORD_URL);
addToScene(scene, swordContainer);
const swordRoot = swordContainer.entities.find(isSceneNode);
if (!swordRoot) throw new Error("The sword GLB did not provide a scene root.");

const swordPreset: VatAttachmentPreset = {
  version: 1,
  character: { kind: "url", url: MODEL_URL },
  attachment: { kind: "url", url: SWORD_URL },
  socket: { key: "sword", nodeIndex: 0, nodeName: RIGHT_HAND },
  clipScope: "all",
  grip: {
    translation: [500, 100, 0],
    rotationEulerDegrees: [0, 0, 0],
    scale: [600, 600, 600],
  },
};

const swords = createVatAttachmentBinding({
  engine,
  character: characters,
  attachmentRoot: swordRoot,
  socketAsset,
  preset: swordPreset,
  instanceOptions: { capacity: CAPACITY, visibleStrategy: "scale-zero" },
});
```

The grip values are authored for this specific character/sword pair. Different assets normally require their own translation, rotation, and scale calibration.

## Create and bind instances

Create each character with a world transform, then create and bind its sword:

```ts
const transforms = [
  mat4Compose(-2.1, 0, -1.5, 0, 0, 0, 1, 0.1, 0.1, 0.1),
  mat4Compose(0, 0, -1.5, 0, 0, 0, 1, 0.1, 0.1, 0.1),
  mat4Compose(2.1, 0, -1.5, 0, 0, 0, 1, 0.1, 0.1, 0.1),
  mat4Compose(-1.05, 0, 1.25, 0, 0, 0, 1, 0.1, 0.1, 0.1),
  mat4Compose(1.05, 0, 1.25, 0, 0, 0, 1, 0.1, 0.1, 0.1),
];

for (let index = 0; index < transforms.length; index++) {
  const characterId = characters.create({
    transform: transforms[index],
    offset: 0,
    metadata: { label: `Samba Dancer ${index + 1}` },
  });
  const swordId = swords.create(undefined, {
    label: `Fantasy Sword ${index + 1}`,
    characterIndex: index,
  });
  if (!swords.bind(characterId, swordId)) throw new Error("Could not bind sword.");
}
```

The characters use the set's shared active clip. Avoid assigning the same per-instance clip override to every character if you want the set-level clip selector to affect all of them.

## Update playback and attachments

VAT time belongs to the application's render loop. Keep a pause flag that Explorer can read and update:

```ts
let playing = true;

onBeforeRender(scene, (deltaMs) => {
  if (playing) characters.update(deltaMs * 0.001);
  swords.update();
});
```

The attachment binding should still update while paused so transform and visibility edits remain synchronized.

## Register with Explorer

Register the character wrapper and the underlying rigid sword hierarchy:

```ts
const instancerAdapter = createInstancerExplorerAdapter();

instancerAdapter.register(characters, {
  label: "Samba VAT Characters",
  getPlaybackPaused: () => !playing,
  setPlaybackPaused: (paused) => { playing = !paused; },
});

instancerAdapter.register(swords.attachments, {
  label: "Right-hand Fantasy Swords",
});

showLiteExplorer(
  { engine, scene, canvas, lite },
  {
    adapters: [instancerAdapter],
    features: { canvasPicking: true },
    userSettings: {
      picking: { enabled: true },
      instancer: { pickMode: "instance" },
    },
  },
);
```

`getPlaybackPaused` and `setPlaybackPaused` are necessary because the adapter cannot pause an update loop owned by the application. This design preserves per-instance clip, phase, and FPS settings.

## Using the example in Explorer

Open the **Instancer** tab and expand:

```text
Samba character
└─ Samba VAT Characters
   ├─ Samba Dancer 1
   ├─ ...
   └─ Animations
      ├─ Idle
      ├─ Samba
      └─ Walking
```

- Select the character set to change its shared **Active clip**.
- Expand **Animations** to inspect clip FPS, frame count, and duration.
- Use the inline button on a clip row to play that clip or pause the active clip.
- Select an individual character to assign a per-instance clip.
- Enable Pick and click near a visible character's projected center to select its stable instance row.
- Select the sword set to inspect the synchronized hierarchy instances separately.

The original Idle/Samba/Walking skeletal groups should not appear in Scene Explorer after cleanup. Unrelated animated models continue to appear there normally.

## Troubleshooting

### Animation groups still appear in Scene Explorer

Remove the consumed source groups from `scene.animationGroups` after VAT and socket baking. Also clear the container-owned group array to stop its obsolete update callback.

### Inline Pause does nothing

Provide both playback callbacks during registration and guard `characters.update()` with the same state.

### Changing the set clip has no visible effect

Check whether every instance was created with a per-instance `clip` override. Clear those overrides or create instances without `clip` when they should follow the shared active clip.

### A sword is misaligned

Grip transforms are asset-specific. Recalibrate translation, Euler rotation, and scale for the exact character, socket, and attachment GLBs.

### A character cannot be picked

Enable canvas picking and use Instancer `pickMode: "instance"`. VAT picking requires an active scene camera, a canvas with non-zero dimensions, a visible instance, and a click within the adapter's 24 CSS-pixel logical radius.
