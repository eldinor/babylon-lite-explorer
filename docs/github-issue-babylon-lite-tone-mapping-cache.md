# Tone-mapping algorithm changes can reuse cached PBR WGSL in 1.10.0

## Summary

In `@babylonjs/lite@1.10.0`, `setSceneImageProcessing(scene, { toneMapping })` detects tone-mapping algorithm changes and calls `rebuildScenePbrPipelines(scene)`, but rendered output can remain unchanged after switching between built-in algorithms such as Standard, ACES, and Khronos PBR Neutral.

The lower-level PBR bindings cache key appears to omit the effective `toneMapping.id`, so a rebuild after an algorithm-only change can return cached bindings whose composed fragment WGSL still contains the previous tone-mapping function.

## Version

- Package: `@babylonjs/lite`
- Version: `1.10.0`
- Release metadata from package: `sourceVersion` `2e50a77046ec4b4891791e7ef31834e1543aaf09`

## Reproduction

1. Create a scene with PBR content and environment lighting.
2. Enable tone mapping before or during initial scene registration, so the first PBR pipeline is compiled with the default Standard tone mapping.
3. After the scene is registered and rendering, call:

```ts
await setSceneImageProcessing(scene, {
  toneMappingEnabled: true,
  toneMapping: AcesToneMapping,
});
```

4. Then try:

```ts
await setSceneImageProcessing(scene, {
  toneMappingEnabled: true,
  toneMapping: NeutralToneMapping,
});
```

## Expected Behavior

Switching `imageProcessing.toneMapping` between `StandardToneMapping`, `AcesToneMapping`, and `NeutralToneMapping` should visibly change PBR rendering after `setSceneImageProcessing()` resolves.

## Actual Behavior

The public scene state changes, and `setSceneImageProcessing()` does call the rebuild path, but rendered output can remain visually unchanged. It appears to keep using previously composed PBR WGSL.

## Notes From Local Audit

`lib/scene/scene-image-processing.js` correctly compares the effective tone-mapping id:

```js
const prevToneMappingId = ip.toneMapping?.id ?? StandardToneMapping.id;
Object.assign(ip, update);
const nextToneMappingId = ip.toneMapping?.id ?? StandardToneMapping.id;
const toneMappingChanged = ip.toneMappingEnabled && nextToneMappingId !== prevToneMappingId;
if (enabledChanged || toneMappingChanged) {
  await rebuildScenePbrPipelines(scene);
}
```

`lib/material/pbr/pbr-renderable.js` bakes the selected tone mapping into the PBR composer:

```js
const hasTonemap = scene.imageProcessing.toneMappingEnabled;
if (hasTonemap) {
  const toneMapping = scene.imageProcessing.toneMapping ?? StandardToneMapping;
  _toneMappingHelpers = toneMapping.helpersWGSL;
  _toneMappingCall = toneMapping.callWGSL;
}
```

But `lib/material/pbr/pbr-pipeline.js` keys `_bindingsCache` without the algorithm id:

```js
const key = `${features}:${features2}:${meshFeatures}:${sceneFeatures}:${shaderKey}${resolvedStencil ? resolvedStencil._key : ""}`;
```

Because `sceneFeatures` only captures whether tone mapping is enabled, not which tone mapping is selected, algorithm-only rebuilds can reuse the old cached binding/composed shader.

## Suggested Fix

Include the effective tone-mapping id in the PBR binding/pipeline cache key whenever `PBR_HAS_TONEMAP` is present, or otherwise clear/partition the PBR bindings cache when `setSceneImageProcessing()` rebuilds because `toneMapping.id` changed.

