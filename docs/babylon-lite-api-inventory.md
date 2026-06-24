# Babylon Lite 1.4.0 public API inventory

Audited on 2026-06-24 against the installed `@babylonjs/lite@1.4.0` declarations and the default Explorer adapter. Babylon Lite exposes one public package entry point: `@babylonjs/lite`.

This inventory describes what the default adapter currently uses. A public Babylon Lite feature is not automatically Explorer-supported until it is listed here.

## Implemented coverage

| Explorer feature | Babylon Lite 1.4.0 public surface | Explorer behavior |
| --- | --- | --- |
| Scene tree | `SceneContext.camera`, `meshes`, `lights`, `animationGroups` | Enumerates these public collections and reconstructs reachable transform ancestors. |
| Scene settings | `clearColor`, `imageProcessing`, `environmentPrimaryColor`, `envRotationY` | Edits clear color, exposure, contrast, environment primary color, and environment rotation. Tone-mapping enabled state and type are read-only. |
| Transform nodes | `SceneNode.name`, `children`, `position`, `rotation`, `scaling`, `visible` | Reads and edits name and transforms. Visibility is applied to the subtree with `setSubtreeVisible()`. Zero scaling components are rejected. |
| Mesh deformation | `Mesh.skeleton`, `Mesh.morphTargets` | Shows skinned state, bone count, morph-target state/count, and all current public weights. Morph weights refresh while selected. |
| Base cameras | `Camera.fov`, `nearPlane`, `farPlane`, `viewport` | Reads and edits finite projection and viewport values, subject to the cache limitation below. |
| ArcRotate camera | `ArcRotateCamera` | Edits orbit, target, inertia, `angularSensibility`, `panningSensibility`, `wheelPrecision`, and defined limits. |
| Free camera | `FreeCamera` | Edits position, target, speed, angular sensitivity, and inertia. |
| Geospatial camera | `GeospatialCamera` | Edits center, yaw, pitch, radius, and finite limits; derived position/up vectors are read-only. |
| Lights | `SceneContext.lights`, `LightBase` and structural public fields | Shows public light type and edits available intensity, position, and direction fields. |
| Materials | `Mesh.material`, `Material`, `MaterialView`, PBR/Standard public properties | Derives materials from meshes, deduplicates by identity, identifies verified families structurally, and edits the documented values listed below. |
| Textures | Public `Texture2D` slots on discovered materials | Derives and deduplicates referenced 2D textures. Shows usages, dimensions, UV transform, and `invertY` read-only. |
| Animation groups | `AnimationGroup.name`, `duration`, `frameRate`, `currentTime`, `isPlaying`, `speedRatio`, `loopAnimation` | Shows live time and derived frame, and provides Play/Stop actions. `targetedAnimations` is public in 1.4.0 but is not yet displayed. |
| Canvas picking | `createGpuPicker()`, `pickAsync()`, `disposePicker()` | Optional mesh selection from short primary-pointer clicks. Picker resources are disposed with the Explorer. |
| Statistics | Browser `requestAnimationFrame`; `EngineContext.drawCallCount`, `gpuFrameTimeMs`, `surfaces`; scene collections | Shows the averaged browser frame interval, draw calls, available GPU time, surface count, and scene object counts. Frame interval is not render duration, and Explorer does not enable GPU timing itself. |
| Upload GLB | `loadGltf()`, `addToScene()` | Loads a local self-contained `.glb` into the current public scene. |
| Export Scene | Adapter property descriptors | Downloads an inspection snapshot of public values. This is not Babylon serialization. |

## Editable material values

The adapter calls `markMaterialUboDirty()` after supported material writes.

- PBR: `name`, `baseColorFactor`, `metallicFactor`, `roughnessFactor`, `alpha`, and `environmentIntensity`. `doubleSided` is displayed read-only because it affects pipeline state.
- Standard: `name`, `diffuseColor`, `specularColor`, `specularPower`, `emissiveColor`, `ambientColor`, `alpha`, `bumpLevel`, `ambientTexLevel`, `lightmapLevel`, `opacityLevel`, and `reflectionLevel`.
- Node, Shader, material-view, and undetermined/custom families are identified where their public shape permits it, but their family-specific values are not edited by the default adapter.

An empty `createPbrMaterial()` result still has no stable public family discriminator. See [the material-type API issue](babylon-lite-material-type-issue.md).

## Discovered texture slots

The default adapter follows these documented material references:

- Direct slots: base color, normal, ORM, emissive, specular-glossiness, occlusion, metallic-reflectance, reflectance, diffuse, bump, specular, ambient, lightmap, opacity, and 2D reflection textures.
- Clear coat: texture, roughness texture, and bump texture.
- Sheen: color texture and the 1.4.0 separate roughness texture.
- Anisotropy: the 1.4.0 anisotropy texture.
- Iridescence: main and thickness textures.
- Subsurface: thickness, refraction, and the 1.4.0 translucency color/intensity textures.

Cube reflection textures and environment textures are not treated as `Texture2D` entries.

## Public 1.4.0 surfaces not currently shown

- `metadata?: LiteMetadata` on scene nodes, materials, and animation groups, including `metadata.gltf.extras`.
- `AnimationGroup.targetedAnimations` and masks.
- Skeleton/bone editing, morph-weight editing through `setMorphTargetWeights()`, thin-instance data, VAT controls, material plugins, frame graphs, render tasks, physics, navigation, sprites, text, and additional surfaces.
- Application-retained objects that are not reachable from the public scene collections.

These are omissions from the default Explorer adapter, not claims that Babylon Lite lacks the APIs.

## Public API limitations affecting Explorer

### Environment discovery

`loadEnvironment()` returns `EnvironmentTextures`, but `SceneContext` has no public environment-texture field, presence flag, or general texture collection. Explorer cannot determine from the scene alone whether an environment is loaded and intentionally does not inspect private `_envTextures` state.

### Tone mapping after registration

`imageProcessing.toneMappingEnabled` and `toneMappingType` are public, but PBR material groups consume them while shaders are built during `registerScene()`. `rebuildMaterial()` reuses the already-created group builder and does not switch that scene-wide shader configuration. Explorer therefore displays both fields read-only. See [the runtime tone-mapping API issue](babylon-lite-runtime-tone-mapping-issue.md).

### Camera projection cache

Assigning `camera.fov`, `nearPlane`, or `farPlane` changes the public value, but `getProjectionMatrix()` is documented and implemented as cached by `worldMatrixVersion` and aspect ratio. Rendering may retain the previous projection until camera movement or an aspect-ratio change invalidates the cache. Explorer does not modify private cache fields.

### Texture source and previews

`Texture2D` exposes GPU handles, dimensions, UV transforms, and `invertY`, but no original URL/source image or portable pixel-readback API. Explorer cannot provide reliable previews and keeps texture metadata read-only.

### Names and enumeration

- The glTF loader preserves node names on public transform nodes, while generated render meshes may use names such as `gltf_mesh_0`; the original glTF mesh name is not recoverable from the public `Mesh` object.
- Transform nodes not reachable from a public camera/mesh hierarchy cannot be discovered from `SceneContext`.
- Concrete light and material kinds are never inferred from private tags or constructors.

## Lifecycle APIs deliberately unused

`onBeforeRender()` and `onSceneDispose()` are public but return no removal handle. The Explorer avoids registering callbacks it cannot detach. Its live UI refresh uses Explorer-owned timers that are removed on disposal.

Callers can replace the default behavior with `createRegisteredSceneAdapter`; custom adapters currently replace rather than extend the default adapter.
