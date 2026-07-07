# Support changing tone mapping after scene registration

Verified against `@babylonjs/lite` 1.8.0.

## Description

`SceneContext.imageProcessing` publicly exposes `toneMappingEnabled: boolean` and the optional `toneMappingType?: "standard" | "aces"`, but PBR material shaders read these values while the scene is built during `registerScene()`.

Changing either value after registration updates the public scene object without updating the rendered result:

```ts
scene.imageProcessing.toneMappingEnabled = true;
scene.imageProcessing.toneMappingType = "standard";

await registerScene(scene);
await startEngine(engine);

scene.imageProcessing.toneMappingType = "aces";
// The existing PBR shaders still use Standard tone mapping.
```

This makes the fields appear runtime-editable even though their effective values are fixed when the material groups are built.

## Why `rebuildMaterial()` is insufficient

Calling `rebuildMaterial()` for every scene material does not apply the new tone-mapping configuration. This remains true when passing `{ rebuildFrameGraph: true }`: material rebuilding reuses the existing group builder, which has already captured whether tone mapping is enabled and which shader implementation to use.

As of Lite 1.8.0, the relevant public API is still material-scoped:

```ts
rebuildMaterial(scene, material, {
  rebuildViews: true,
  rebuildFrameGraph: true,
});
```

There is no public scene-level API that rebuilds the PBR group builder after either tone-mapping field changes.

External tools cannot force a complete public rebuild without recreating the scene or accessing private renderer state.

## Use case

Scene explorers, editors, debugging tools, and applications need to compare Standard and ACES tone mapping at runtime. They should be able to change the public image-processing configuration and request the required pipeline rebuild through public APIs.

## Suggested API

Provide a scene-level image-processing update that rebuilds affected pipelines when necessary:

```ts
await setSceneImageProcessing(scene, {
  toneMappingEnabled: true,
  toneMappingType: "aces",
});
```

Alternatively, expose a general scene pipeline rebuild:

```ts
scene.imageProcessing.toneMappingType = "aces";
await rebuildScenePipelines(scene);
```

The API could rebuild only material groups affected by image-processing compile-time features.

## Expected result

After changing the tone-mapping enabled state or type through the supported public path, all affected materials render with the new configuration without recreating the scene.

If runtime changes are intentionally unsupported, consider marking these fields read-only after registration or documenting that they must be configured before `registerScene()`.
