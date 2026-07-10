# Babylon Lite tone-mapping algorithm cache issue

Audited on 2026-07-10 against `@babylonjs/lite@1.9.0`.

## Summary

Babylon Lite 1.9.0 exposes `StandardToneMapping`, `AcesToneMapping`, `NeutralToneMapping`, and `setSceneImageProcessing(scene, { toneMapping })`. The public state update succeeds, but changing only the tone-mapping algorithm after PBR pipelines have been built can leave rendered output unchanged.

Tone-mapping enabled/disabled changes are still reliable because they toggle the PBR `PBR_HAS_TONEMAP` feature bit.

## Evidence

`setSceneImageProcessing()` detects a changed `toneMapping.id` and calls the scene PBR rebuild path while tone mapping is enabled.

The installed package then composes PBR shaders through `createPbrComposer()`. Its cache key includes:

```txt
features:features2:meshFeatures:sceneFeatures:lightMode:singleLightType:vbKey
```

`sceneFeatures` records whether tone mapping is enabled, but it does not encode `toneMapping.id`. `getOrCreatePbrBindings()` uses the same feature-style key. Because the selected algorithm supplies different WGSL through `_toneMappingHelpers` and `_toneMappingCall`, reusing a cached entry can reuse the previous algorithm's shader code.

## Explorer behavior

Explorer keeps `imageProcessing.toneMappingEnabled` editable through `setSceneImageProcessing()`.

Explorer displays `imageProcessing.toneMapping` read-only until Babylon Lite exposes a public cache-safe runtime update path, or until the PBR cache keys include the selected tone-mapping algorithm.
