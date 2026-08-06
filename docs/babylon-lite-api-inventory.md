# Babylon Lite 1.17.0 public API inventory

Audited on 2026-08-06 against the installed `@babylonjs/lite@1.17.0` declarations, changelog, and package implementation, plus the default Explorer adapter. Babylon Lite exposes one public package entry point: `@babylonjs/lite`.

This inventory describes what the default adapter currently uses. A public Babylon Lite feature is not automatically Explorer-supported until it is listed here.

## Implemented coverage

| Explorer feature | Babylon Lite 1.17.0 public surface | Explorer behavior |
| --- | --- | --- |
| Scene tree | `SceneContext.camera`, `meshes`, `lights`, `animationGroups`, `shadowGenerators` | Enumerates camera, meshes, lights, and animation groups, and reconstructs reachable transform ancestors. Shadow generators are not yet shown. |
| Scene settings | `clearColor`, `imageProcessing`, `setSceneImageProcessing()`, `StandardToneMapping`, `AcesToneMapping`, `NeutralToneMapping`, `environmentPrimaryColor`, `envRotationY`, `fog`, `clipPlane`, `shadowGenerators`, `fixedDeltaMs`, `setFog()`, `metadata` | Edits clear color, fixed delta, existing fog, exposure, contrast, tone-mapping enabled state and algorithm, environment primary color, and environment rotation. Algorithm-only tone-mapping changes are subject to the cache limitation below. Displays metadata read-only. Clip plane and shadow count are read-only. |
| Transform nodes | `SceneNode.name`, `children`, `position`, `rotation`, `scaling`, `visible`, `metadata` | Reads and edits name and transforms. Visibility is applied to the subtree with `setSubtreeVisible()`. Zero scaling components are rejected. Displays metadata read-only. |
| Mesh geometry and deformation | `getMeshGeometry()`, `Mesh.skeleton`, `Mesh.morphTargets` | Shows cached CPU vertex/index/triangle-list and attribute counts, plus skinned state, bone count, morph-target state/count, and all current public weights. Geometry refreshes with the scene tree; morph weights refresh while selected. |
| Mesh deletion | `removeFromScene(scene, mesh)` | Shows a Delete action in the selected-entity bar and as a red Scene Explorer row action for meshes. `confirmEntityRemoval` can enable a confirmation prompt and is designed to be backed by a future user setting; the default is `false`. The default adapter does not expose transform node, light, or camera deletion until Babylon Lite provides an official public removal API for those entity types. |
| Base cameras | `Camera.fov`, `nearPlane`, `farPlane`, `viewport`; `getProjectionMatrix()` | Reads and edits finite projection and viewport values, subject to the cache limitation below. |
| ArcRotate camera | `ArcRotateCamera` | Edits orbit, target, inertia, `angularSensibility`, `panningSensibility`, `wheelPrecision`, and defined limits. |
| Free camera | `FreeCamera` | Edits position, target, speed, angular sensitivity, and inertia. |
| Geospatial camera | `GeospatialCamera` | Edits center, yaw, pitch, radius, and finite limits; derived position/up vectors are read-only. |
| Lights | `SceneContext.lights`, `LightBase` and structural public fields | Shows public light type and edits available intensity, position, and direction fields. Displays metadata read-only. |
| Materials | `Mesh.material`, `Material`, `MaterialView`, `getMaterialFamily()`, family type guards, PBR/Standard public properties, `metadata` | Derives materials from meshes, deduplicates by identity, identifies official PBR, Standard, Node, and Shader families, preserves material-view labels, edits the documented values listed below, and displays metadata read-only. Structural detection remains as a compatibility fallback. |
| Textures | Public `Texture2D` slots on discovered materials | Derives and deduplicates referenced 2D textures. Shows usages, dimensions, UV transform, `invertY`, and metadata read-only. |
| Animation groups | `AnimationGroup.name`, `duration`, `frameRate`, `currentTime`, `isPlaying`, `speedRatio`, `loopAnimation`, `targetedAnimations`, `mask`, `metadata` | Shows live time and derived frame, displays metadata read-only, and provides Play/Stop actions. Targets and masks are not yet displayed. |
| Canvas picking | `createGpuPicker()`, `pickAsync()`, `disposePicker()`, `PickingInfo` | Optional mesh/instance selection from short primary-pointer clicks, with the latest point, distance, normals, exact face/submesh, barycentric, and thin-instance diagnostics shown in Properties. Picker resources are disposed with the Explorer. |
| Statistics | Browser `requestAnimationFrame`; `EngineContext.drawCallCount`, `gpuFrameTimeMs`, `surfaces`; scene collections | Shows the averaged browser frame interval, draw calls, available GPU time, surface count, and scene object counts. Frame interval is not render duration, and Explorer does not enable GPU timing itself. |
| Upload GLB | `loadGltf()`, `addToScene()` | Loads a local self-contained `.glb` into the current public scene. |
| Export Scene | Adapter property descriptors | Downloads an inspection snapshot of public values. This is not Babylon serialization. |

## Editable material values

The adapter calls `markMaterialUboDirty()` after supported material writes.

- PBR: `name`, `baseColorFactor`, `metallicFactor`, `roughnessFactor`, `alpha`, and `environmentIntensity`. `doubleSided` is displayed read-only because it affects pipeline state.
- Standard: `name`, `diffuseColor`, `specularColor`, `specularPower`, `emissiveColor`, `ambientColor`, `alpha`, `bumpLevel`, `ambientTexLevel`, `lightmapLevel`, `opacityLevel`, and `reflectionLevel`.
- Node, Shader, material-view, and undetermined/custom families are identified where their public shape permits it, but their family-specific values are not edited by the default adapter.

Thin-instance per-instance colors are supported by Babylon Lite's built-in PBR and Standard-style shader paths when the mesh has a color buffer. The shader multiplies the instance color into the source material color, so color edits are most visible when the source material is white or otherwise neutral.

Babylon Lite's `getMaterialFamily()` and `isPbrMaterial()` identify an empty `createPbrMaterial()` result without relying on property-shape heuristics.

## Discovered texture slots

The default adapter follows these documented material references:

- Direct slots: base color, normal, ORM, emissive, specular-glossiness, occlusion, metallic-reflectance, reflectance, diffuse, bump, specular, ambient, lightmap, opacity, and 2D reflection textures.
- Clear coat: texture, roughness texture, and bump texture.
- Sheen: color and separate roughness textures.
- Anisotropy: anisotropy texture.
- Iridescence: main and thickness textures.
- Subsurface: thickness, refraction, and translucency color/intensity textures.

Cube reflection textures and environment textures are not treated as `Texture2D` entries.

## Public 1.17.0 surfaces not currently shown

- `AnimationGroup.targetedAnimations` and `mask`, including public mask membership helpers.
- Skeleton/bone editing and morph-weight editing through `setMorphTargetWeights()`.
- Material plugins, stencil configuration, and opt-in automatic PBR/Standard mutation tracking through `enableMaterialTracking()`.
- Thin-instance data and mutation helpers, VAT controls, frame graphs, render tasks and GPU task timings, physics, navigation, sprites, particles, text, audio, and additional surfaces.
- Application-retained objects that are not reachable from the public scene collections.

These are omissions from the default Explorer adapter, not claims that Babylon Lite lacks the APIs.

## Recommended Explorer additions

These are supported by public APIs and fit the existing adapter without private-state access:

1. Show animation targets and mask mode/membership beneath each animation group.
2. Make morph weights editable through `setMorphTargetWeights()` rather than direct array mutation.
3. Show material plugin names and enabled state. Pipeline-affecting plugin edits should remain read-only until a rebuild policy is defined.

Frame-graph and render-task objects are public, but `FrameGraph` exposes operations rather than a public task collection. The default adapter therefore still cannot enumerate them from a scene. A host-retained task can be supplied through a registered adapter.

Node Particle APIs are public, but registered particle systems are not exposed through a public scene collection. A host-retained `NodeParticleSet` or `ParticleSystem` can be supplied through a registered/composed adapter.

## Useful additions from 1.12.0 through 1.17.0

The following additions are the best matches for Explorer rather than general application features:

1. **Orthographic camera inspection (`camera.ortho`, `enableOrthographicCamera`, `disableOrthographicCamera`)** — detect projection mode, expose mutable orthographic bounds, and label `fov` as inactive while orthographic projection is enabled.
2. **Device-loss diagnostics (`enableDeviceLostSceneRecovery`)** — expose lost/recovering/recovered/failed state when the Explorer is explicitly asked to own recovery. This must be opt-in because enabling recovery changes host-engine behavior; the returned handle must be disabled with the Explorer.
3. **Line-system overlays (`createLines`, `createLineSystem`, `updateLineSystem`)** — useful for an optional bounds/axes/debug overlay extension. The default inspector should not create scene geometry implicitly.

Lower priority for the default adapter: navigation queries, particle attractors, media-stream audio, KTX2 arrays, alpha-to-coverage, and compatibility wrappers. They are useful application APIs but the scene does not provide enough public enumeration to make them broadly inspectable.

## Public API limitations affecting Explorer

### Environment discovery

`loadEnvironment()` returns `EnvironmentTextures`, but `SceneContext` has no public environment-texture field, presence flag, or general texture collection. Explorer cannot determine from the scene alone whether an environment is loaded and intentionally does not inspect private `_envTextures` state.

### Particle discovery

`parseNodeParticleSetFromSnippet()` returns a public `NodeParticleSet`, and `registerNodeParticleSet()` registers each system through billboard renderables and a before-render update callback. `SceneContext` does not expose public `particleSystems`, `nodeParticleSets`, `billboardSystems`, or `spriteSystems` collections. Explorer therefore cannot auto-discover registered particles from the scene alone.

### Tone mapping after registration

`imageProcessing.toneMappingEnabled` and `imageProcessing.toneMapping` are public and `setSceneImageProcessing()` calls `rebuildScenePbrPipelines()` when the effective algorithm id changes while tone mapping is enabled. Explorer maps its selector to `StandardToneMapping`, `AcesToneMapping`, and `NeutralToneMapping`.

The earlier 1.11.0 audit found that PBR cache keys omitted `toneMapping.id`. The 1.17.0 declarations and changelog do not provide a compatibility guarantee for this behavior, so algorithm switching still needs a browser rendering regression test before this limitation can be removed.

### Clip planes on built-in materials

`setClipPlane()` publicly stores the plane and registers its scene-UBO writer. The public declarations still expose clip-plane use as a material feature bit, and the package implementation still writes the scene uniform separately from the built-in material paths. Explorer therefore displays the configured plane as diagnostic state without implying that built-in materials render it.

### Camera projection updates

Resolved by 1.15.0's public projection revision tracking. Assigning `camera.fov`, `nearPlane`, or `farPlane` now invalidates the projection cache without requiring camera movement or an aspect-ratio change. Orthographic bounds use the same projection revision mechanism.

### Texture source and previews

`Texture2D` exposes GPU handles, dimensions, UV transforms, and `invertY`, but no original URL/source image or portable texture pixel-readback API. The UV fields are documented as build-time state and require rebuilding each consuming material after mutation. Explorer cannot provide reliable previews and currently keeps texture metadata read-only.

### Names and enumeration

- The glTF loader preserves node names on public transform nodes, while generated render meshes may use names such as `gltf_mesh_0`; the original glTF mesh name is not recoverable from the public `Mesh` object.
- Transform nodes not reachable from a public camera/mesh hierarchy cannot be discovered from `SceneContext`.
- Concrete light and material kinds are never inferred from private tags or constructors.

## Lifecycle APIs deliberately unused

`onBeforeRender()` and `onSceneDispose()` are public but return no removal handle. The Explorer avoids registering callbacks it cannot detach. Its live UI refresh uses Explorer-owned timers that are removed on disposal.

Callers can replace the default behavior with `createRegisteredSceneAdapter`, or append registered/custom entities through the `adapters` composition option.
