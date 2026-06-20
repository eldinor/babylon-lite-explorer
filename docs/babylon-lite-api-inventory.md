# Babylon Lite 1.2.0 Public API Inventory

Audited from `node_modules/@babylonjs/lite/index.d.ts` on 2026-06-20. The package exports one public root entry point (`@babylonjs/lite`). Re-audit this file when upgrading the peer dependency.

| Inspector feature | Verified public surface | Read | Write | Enumerate | MVP support |
|---|---|---:|---:|---:|---|
| Scene | `SceneContext` | Yes | Limited | N/A | Yes |
| Camera | `SceneContext.camera`, `Camera` | Yes | `fov`, `nearPlane`, `farPlane` | One | Yes |
| Arc camera fields | `ArcRotateCamera` | Yes | Public fields | One | Read-only until explicitly registered as arc camera |
| Meshes | `SceneContext.meshes`, `Mesh` | Yes | Public node fields | Yes | Yes |
| Lights | `SceneContext.lights`, `LightBase` | Yes | Type-specific fields require explicit knowledge | Yes | Base read-only |
| Animation groups | `SceneContext.animationGroups` | Yes | Not audited | Yes | Read-only summary |
| Transform hierarchy | `SceneNode.children` | Yes | Public observable vectors | Yes | Yes |
| Visibility | `SceneNode.visible`, `setMeshVisible` | Yes | Yes | N/A | Yes |
| Materials | `Mesh.material`, `Material.name` | Yes | Concrete public props | Derived from meshes | Common fields plus verified PBR-like props |
| Textures | Public PBR/Standard material `Texture2D` slots | Yes | No | Derived from mesh materials | Read-only derived section |
| Draw calls | `EngineContext.drawCallCount` | Yes | No | N/A | Yes |
| GPU frame time | `EngineContext.gpuFrameTimeMs`, `isGpuTimingSupported`, `setGpuTimingEnabled` | Yes | Opt-in | N/A | Display only; inspector never opts in by default |
| Render lifecycle | `onBeforeRender(SceneContext, callback)` | Yes | Registration has no documented removal handle | N/A | Not used in MVP lifecycle |
| Scene disposal | `onSceneDispose(SceneContext, callback)` | Yes | Registration has no documented removal handle | N/A | Not used in MVP lifecycle |
| Canvas picking | `createGpuPicker`, `pickAsync`, `disposePicker`, `PickingInfo.pickedMesh` | Yes | No | N/A | Opt-in |

## Public structures used

- `SceneContext.camera`
- `SceneContext.meshes`
- `SceneContext.lights`
- `SceneContext.animationGroups`
- `SceneNode.name`, `children`, `position`, `rotation`, `scaling`, and `visible`
- `Mesh.id`, `material`, `thinInstances`, and `receiveShadows`
- `Material.name`
- `Camera.fov`, `nearPlane`, and `farPlane`
- `EngineContext.drawCallCount` and `gpuFrameTimeMs`

## Deliberately unsupported discovery

- Textures are not globally enumerable through `SceneContext`; the official adapter derives referenced `Texture2D` values from documented material slots and deduplicates them by object identity.
- Transform nodes not reachable through a public camera/mesh child hierarchy are not discoverable.
- Concrete light and material kinds are not inferred from private tags or constructors.
- Frame graph and render tasks are not included until their public enumeration/lifecycle surface is separately audited.

Callers can expose application-owned entities through `createRegisteredSceneAdapter`.
