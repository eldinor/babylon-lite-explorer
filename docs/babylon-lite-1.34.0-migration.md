# Babylon Lite 1.34.0 migration

Checked on 2026-10-15 against the published npm packages, their declarations and implementation, and the [Lite release history](https://github.com/BabylonJS/Babylon-Lite/releases). The previous Explorer baseline was Lite 1.17.0 with Instancer 0.3.1; the new baseline is Lite 1.34.0 with Instancer 0.7.0. Both peer and development ranges, including the lockfile, use the new baseline.

## Changes in Explorer

| Upstream change | Explorer migration |
| --- | --- |
| Allocation-conscious math names were standardized in Lite 1.29. | The VAT character example imports and calls `composeMat4()` instead of the removed `mat4Compose()`. |
| `SceneContext` no longer declares `envRotationY`. Environment rotation is changed through `setEnvironmentRotation()`, which has no public getter. | Removed the rotation property and its write path. Explorer cannot show the application's current rotation through public APIs. Applications can call the setter themselves, including before skybox creation as required by its documentation. |
| Lights are full scene nodes in Lite 1.30. | Existing light child traversal and field edits remain compatible. Regression coverage now uses a factory-created directional light in a real headless scene. |
| Lite 1.31 makes resource lifetimes explicit. | Mesh deletion continues through `removeFromScene()`. Removing a mesh from its last scene permanently retires it and releases its resource claims; visibility remains the reversible way to hide it. Explorer does not add a second disposal call. |
| Instancer 0.7.0 targets the newer Lite API. | Updated the optional peer, development dependency, installation examples, and packaged-consumer verification. Existing thin/hierarchy/VAT adapter contracts still typecheck and pass their regression tests. |

The audit also checked the used material mutation, picker creation/disposal, animation, scene image-processing, geometry, and statistics APIs against the installed package. Existing public PBR/Standard factor edits still use `markMaterialUboDirty()`. Optional shader features added upstream are not enabled by Explorer. The factories for both material families are exercised in the adapter regression suite.

Lite 1.34's asynchronous GL effect readiness changes do not require a migration here: Explorer's examples use native WebGPU and do not create GL effects. Physics, moving particle emitters, custom draw tasks, and GPU geometry ownership APIs are likewise outside the adapter's current calls.

## Scope and validation

The [1.17 API inventory](babylon-lite-api-inventory.md) remains a historical snapshot. This migration does not add every introspection feature introduced since then. In particular, Lite now accepts lights, cameras, and transform nodes in `removeFromScene()`, while Explorer still exposes deletion only for meshes.

Validation covers TypeScript, the full unit/UI suite, npm and browser library builds, all demo builds, and packed base/Instancer consumer builds. GPU rendering and remote GLB/VAT asset playback need a browser check; these build and headless checks do not establish rendering parity or resolve the earlier tone-mapping cache concern.
