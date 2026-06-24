# Babylon Lite Explorer

A compact Preact explorer for Babylon Lite. The built-in adapter reads only documented public fields from `@babylonjs/lite`; it never probes underscore-prefixed or otherwise private engine state.

## Install

```bash
npm install babylon-lite-explorer
```

The default adapter uses the `@babylonjs/lite` installation from your application. Install it separately if your application does not already include it.

## Use

```ts
import { showLiteExplorer } from "babylon-lite-explorer";

const explorer = showLiteExplorer(
  { engine, scene, canvas },
  {
    mode: "overlay",
    layout: "single",
    theme: "dark",
    features: { focusSelected: false, canvasPicking: false },
    notificationDurationMs: 3000,
    notificationsEnabled: true,
    keyboardShortcutsEnabled: true,
  },
);

await explorer.ready;

// Later:
explorer.refresh();
explorer.hide();
explorer.show();
explorer.dispose();
```

Each call owns independent state. `dispose()` is idempotent. Caller-provided adapters remain caller-owned and are not disposed by the explorer.

`layout: "single"` is the compact default and stacks Properties beneath Scene Explorer at the top-right. Use `layout: "split"` for simultaneous side-by-side columns at the top-left.

Drag the thin divider in Single mode to resize the stacked panes; the proportion is persisted. Split mode docks Scene Explorer at the left edge and Properties at the right, leaving the canvas interactive between them. Selected entities expose only adapter-backed actions, such as visibility and safe snapshot copying. Snapshots from the built-in adapter contain clean public property values without explorer IDs or UI descriptor metadata. Verified public PBR base color, metallic, roughness, and alpha fields are editable when present.

The header switches layout and theme. Keyboard shortcuts are `Ctrl+Shift+L` (layout), `Ctrl+Shift+Y` (theme), `Ctrl+Shift+E` (show/hide), and `Ctrl+Shift+F` (focus scene search). Set `keyboardShortcutsEnabled: false` to disable all of them. Property rows include a copy-value control.

Camera focus is optional and disabled by default. Set `features.focusSelected: true` to expose Focus only for entities whose adapter reports `focusable: true` and implements `focusEntity`.

Canvas picking is also optional. Set `features.canvasPicking: true` to add a Pick toggle to the Scene Explorer header. Picking mode is inactive by default; while active, a short primary-pointer click selects a public scene mesh. Pointer drags are ignored so camera controls keep their normal behavior. Custom adapters can support it through `pickEntityId`.

Notifications dismiss automatically after three seconds. Configure `notificationDurationMs`, or set it to `0` for manual dismissal. Set `notificationsEnabled: false` to disable notifications completely. These options are ready for a future preferences UI.

## Public API coverage

The default adapter currently exposes the public scene camera, meshes, mesh hierarchy, lights, derived materials, and animation groups. Material properties identify PBR, Standard, Node, Shader, material-view, and custom/other families from their documented public fields. The adapter edits documented scene-node transforms and visibility, base camera projection/viewport fields, recognized arc-rotate/free/geospatial camera fields, and documented light fields. See [the audited API inventory](docs/babylon-lite-api-inventory.md).

Selecting **Scene** exposes its public clear color, image-processing exposure, contrast, tone-mapping state and type, environment primary color, and environment Y rotation. These values are editable through the documented `SceneContext` fields.

The Basic example loads `environmentSpecular.env`; the Boombox and Animated GLB examples do not load environment textures. Babylon Lite returns public `EnvironmentTextures` from its environment loaders, but does not expose the loaded object through a public `SceneContext` field. The Explorer therefore cannot discover an environment texture from the scene alone. Environment intensity is a per-PBR-material field rather than a scene setting.

Babylon Lite 1.3.0 projection fields have a runtime cache-invalidation limitation. Assigning `camera.fov`, `camera.nearPlane`, or `camera.farPlane` updates the public value, but `getProjectionMatrix()` caches by `worldMatrixVersion` and aspect ratio rather than those projection values. The rendered projection can therefore remain unchanged until the camera moves or the aspect ratio changes. Babylon Lite exposes no public projection-cache invalidation function, so the default adapter does not modify the private cache fields as a workaround.

Babylon Lite 1.3.0 preserves glTF node names on public transform nodes, but generated renderable meshes are named `gltf_mesh_0`, `gltf_mesh_1`, and so on. The original glTF `mesh.name` is not retained on the public mesh object, so Explorer cannot recover it through public APIs. A named parent transform may still provide the model’s original node-level label.

Texture previews and original texture URLs are unavailable through the default adapter. Babylon Lite 1.3.0 exposes GPU handles, dimensions, UV transforms, and `invertY` on `Texture2D`, but it does not retain public source-image/URL metadata or provide a public pixel-readback surface for these textures. These build-time texture fields are read-only in Explorer because changing them after pipeline compilation requires a material rebuild and the adapter has no general public rebuild operation.

## Future: additional application-owned entities

The Explorer can automatically discover only objects exposed through public scene collections such as `scene.meshes`, `scene.lights`, `scene.animationGroups`, and `scene.camera`.

Some objects can exist without appearing in those collections. An application may already hold a direct reference to such an object—for example, the `EnvironmentTextures` returned by `loadEnvironment()`. Future adapter composition will let applications add these objects alongside the entities discovered by the default adapter.

Currently, passing a custom `adapter` replaces the default adapter completely; it does not extend the existing scene tree. The registration API is therefore intended for fully custom integrations until adapter composition is implemented.

## Development

```bash
npm install
npm run demo
npm run typecheck
npm test
npm run build
```

`npm run demo` serves and opens the examples at `http://localhost:5173/examples/`.

Vite builds the ESM library and CSS. Preact, Signals, and Babylon Lite are externalized.
