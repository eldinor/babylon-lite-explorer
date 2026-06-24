# Babylon Lite 1.4.0 migration notes

Audited against the published `@babylonjs/lite@1.4.0` declarations and package implementation on 2026-06-24.

## Explorer changes

- Updated the peer and development dependency ranges from `^1.3.0` to `^1.4.0`.
- Replaced the removed `AnimationGroup.currentFrame` read with the new live `AnimationGroup.currentTime` field. The Explorer no longer estimates playback time with its own clock.
- Added the new public ArcRotate controls: `angularSensibility`, `panningSensibility`, and `wheelPrecision`.
- Added texture discovery for `anisotropy.texture`, `sheen.roughnessTexture`, `subsurface.translucency.colorTexture`, and `subsurface.translucency.intensityTexture`.

## Relevant public API changes

- `AnimationGroup.currentFrame` was replaced by `currentTime` in seconds.
- `AnimationGroup.targetedAnimations` and public `TargetedAnimation` descriptors were added.
- `metadata?: LiteMetadata` was added to animation groups, materials, and scene nodes; glTF extras can be available through `metadata.gltf.extras`.
- ArcRotate cameras now publicly expose mouse orbit, panning, and wheel sensitivities.
- Morph bindings are no longer documented as limited to four targets; current weights can cover the full target count.
- New PBR extension textures include anisotropy, separate sheen roughness, and diffuse-transmission color/intensity textures.
- `SurfaceOptions.srgb` and sprite-atlas `srgb` support were added for gamma-correct rendering workflows.
- Allocation-saving vector helpers were added in `InPlace` and `ToRef` forms.
- `disposeNavigationPlugin()` was added.
- `VERSION` is now declared as `string` instead of the stale literal `"0.1.0"`; at runtime it reports `1.4.0`.

## Limitations unchanged in 1.4.0

- Tone-mapping enabled state and type are still consumed while PBR material groups are built. Changing them after `registerScene()` does not rebuild those shader groups, so Explorer keeps them read-only.
- Scene environment textures remain internal rather than publicly enumerable from `SceneContext`.
- Original texture URLs and portable texture pixel readback remain unavailable through the public texture interface.
