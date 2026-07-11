# Babylon Lite Explorer

A compact Preact explorer for Babylon Lite. The built-in adapter reads only documented public fields from `@babylonjs/lite`; it never probes underscore-prefixed or otherwise private engine state.

## Install

```bash
npm install babylon-lite-explorer
```

The default adapter uses the `@babylonjs/lite` installation from your application. Install it separately if your application does not already include it.

## Use

[Read the detailed User Guide](docs/user-guide.md).

```ts
import * as lite from "@babylonjs/lite";
import { showLiteExplorer } from "babylon-lite-explorer";

const explorer = showLiteExplorer(
  { engine, scene, canvas, lite },
  {
    mode: "overlay",
    layout: "single",
    theme: "dark",
    features: { focusSelected: false, canvasPicking: false },
    notificationDurationMs: 3000,
    notificationsEnabled: true,
    keyboardShortcutsEnabled: true,
    userGuideUrl: "https://example.com/babylon-lite-explorer-guide",
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

Set `userGuideUrl` to change the page opened by the footer `?` icon. It defaults to this repository's Markdown guide; the bundled demo points it to the in-app HTML guide.

`layout: "single"` is the compact default and stacks Properties beneath Scene Explorer at the top-right. Use `layout: "split"` for simultaneous side-by-side columns at the top-left.

Drag the thin divider in Single mode to resize the stacked panes; the proportion is persisted. Split mode docks Scene Explorer at the left edge and Properties at the right, leaving the canvas interactive between them. Selected entities expose only adapter-backed actions, such as visibility, safe snapshot copying, and mesh deletion. Removable meshes also show a red Delete action on their Scene Explorer row. Set `confirmEntityRemoval: true` to ask before deletion; the default is `false`, and the option can be backed by a future user setting. Snapshots from the built-in adapter contain clean public property values without explorer IDs or UI descriptor metadata. Verified public PBR base color, metallic, roughness, and alpha fields are editable when present.

The header switches layout and theme. Keyboard shortcuts are `Ctrl+Shift+L` (layout), `Ctrl+Shift+Y` (theme), `Ctrl+Shift+E` (show/hide), and `Ctrl+Shift+F` (focus scene search). Set `keyboardShortcutsEnabled: false` to disable all of them. Property rows include a copy-value control.

Camera focus is optional and disabled by default. Set `features.focusSelected: true` to expose Focus only for entities whose adapter reports `focusable: true` and implements `focusEntity`.

Canvas picking is also optional. Set `features.canvasPicking: true` to add a Pick toggle to the Scene Explorer header. Picking mode is inactive by default; while active, a short primary-pointer click selects a public scene mesh. Pointer drags are ignored so camera controls keep their normal behavior. Custom adapters can support it through `pickEntityId`.

Notifications dismiss automatically after three seconds. Configure `notificationDurationMs`, or set it to `0` for manual dismissal. Set `notificationsEnabled: false` to disable notifications completely. These options are ready for a future preferences UI.

Pass the application's `lite` module namespace when using Explorer from a CDN, playground, or any setup that may load two Babylon Lite module instances. This ensures uploads, picking, animation, visibility, fog, image-processing updates, and material edits run through the same Lite runtime that owns the scene. It is optional when your bundler guarantees one deduplicated Lite instance.

For jsDelivr and Lite Playground, use the browser export. The root `+esm` URL may externalize Preact and Signals separately and prevent asynchronous UI updates:

```ts
import * as lite from "@babylonjs/lite";
import { showLiteExplorer } from "https://cdn.jsdelivr.net/npm/babylon-lite-explorer@0.3.1/browser/+esm";

const explorer = showLiteExplorer({ engine, scene, canvas, lite });
await explorer.ready;
```

The footer's **FPS** and **Frame interval** are calculated from browser animation frames over 500 ms; they are not CPU or GPU render duration. Babylon Lite GPU time appears separately when its GPU timing is enabled and available; Explorer does not enable it automatically.

## Instancer adapter

`createInstancerExplorerAdapter()` lets applications register Instancer sets without adding every instance to the main Scene Explorer. Registered source meshes get an `I` row action. Clicking it opens the dedicated Instancer tab, where source meshes contain their registered sets and stable instance rows.

```ts
import { createInstancerExplorerAdapter, showLiteExplorer } from "babylon-lite-explorer";

const instancerAdapter = createInstancerExplorerAdapter();

instancerAdapter.register(redBoxes, {
  label: "Red Boxes",
  saveSet: async (snapshot) => {
    await saveRedBoxes(snapshot);
  },
});

showLiteExplorer(
  { engine, scene, canvas, lite },
  { adapters: [instancerAdapter] },
);
```

Selecting a set with `saveSet` registered shows a **Save Set** action. Explorer passes an `InstancerSetSnapshot` with stable instance IDs, current slots, visibility, optional positions, optional matrices, and serialized metadata. Explorer does not choose the storage format. Applications can also export directly:

```ts
const snapshot = instancerAdapter.exportSet(redBoxes);
```

The snapshot is intended as a convenient bridge back to Instancer code: save it as JSON, convert it into app-specific TypeScript data, or send it to a backend and recreate instances by iterating the stable IDs and transforms.

## Public API coverage

The default adapter currently exposes the public scene camera, meshes, mesh hierarchy, lights, derived materials, and animation groups. Material properties identify PBR, Standard, Node, Shader, material-view, and undetermined/custom families from their documented public fields. PBR materials expose environment intensity; Standard materials expose their public colors, alpha, specular power, and texture levels. The adapter edits documented scene-node transforms and visibility, base camera projection/viewport fields, recognized arc-rotate/free/geospatial camera fields, and documented light fields. Mesh deletion is routed through Babylon Lite's public `removeFromScene(scene, mesh)` API; optional confirmation is controlled by `confirmEntityRemoval`. Transform node, light, and camera removal are not exposed by the default adapter until Babylon Lite provides an official public removal method for those entity types. See [the audited API inventory](docs/babylon-lite-api-inventory.md).

Mesh properties include a **Deformation** section showing whether the mesh is skinned, its public bone count, whether morph targets are present, the morph-target count, and current morph weights. Morph weights refresh while that mesh is selected. Skeletal animation usually changes bone matrices and deforms vertices without changing the mesh's own position, rotation, or scaling.

Selecting **Scene** exposes its public clear color, fixed simulation delta, image-processing exposure, contrast, tone-mapping state and algorithm, environment primary color, and environment Y rotation. Babylon Lite 1.10.0 exposes `setSceneImageProcessing()` updates for image-processing values, so exposure, contrast, tone-mapping enabled state, and the Standard/ACES/Khronos PBR Neutral tone-mapping algorithm can be routed through the public runtime update path.

### Environment textures

The Basic and Boombox examples load `environmentSpecular.env`; the Animated GLB example does not load environment textures. Boombox leaves tone mapping initially disabled after loading the environment so selecting ACES or Khronos PBR Neutral compiles the chosen algorithm into a fresh tone-mapped PBR pipeline.

`loadEnvironment()` returns a public `EnvironmentTextures` object and stores the environment internally for rendering. However, `SceneContext` exposes no public `environmentTextures` field, `hasEnvironment` flag, or general `scene.textures` collection. The Explorer therefore cannot reliably determine from the scene alone whether an environment texture is present. Reading private state such as `_envTextures` would make the Explorer dependent on implementation details, so the default adapter intentionally does not do it.

Ordinary material textures can sometimes be discovered by following documented texture properties on public materials. Environment textures are not exposed through those properties. An application can know that an environment is present by retaining the loader result itself:

```ts
const environment = await loadEnvironment(scene, url, options);
```

The current Explorer cannot add that retained object alongside its automatically discovered entities because a custom adapter replaces the default adapter rather than extending it. Future adapter composition is intended to support this case. Environment intensity is a per-PBR-material field, not a scene-level environment setting.

Babylon Lite 1.10.0 projection fields still have a runtime cache-invalidation limitation. Assigning `camera.fov`, `camera.nearPlane`, or `camera.farPlane` updates the public value, but `getProjectionMatrix()` is documented as cached by `worldMatrixVersion` and aspect ratio rather than those projection values. The rendered projection can therefore remain unchanged until the camera moves or the aspect ratio changes. Babylon Lite exposes no public projection-cache invalidation function, so the default adapter does not modify private cache fields as a workaround.

Babylon Lite 1.10.0 tone-mapping enabled/disabled and algorithm changes are routed through `setSceneImageProcessing()`. In the current package, `setSceneImageProcessing()` detects algorithm changes and calls `rebuildScenePbrPipelines()`, but the lower-level PBR bindings cache is keyed by feature flags and does not include `toneMapping.id`. Switching only Standard, ACES, or Khronos PBR Neutral after a tone-mapped pipeline has already been cached can therefore reuse the previous WGSL. The Boombox example leaves tone mapping initially disabled after loading its environment so choosing an algorithm compiles the selected tone map into a fresh PBR pipeline.

Babylon Lite 1.4.0 preserves glTF node names on public transform nodes, but generated renderable meshes are named `gltf_mesh_0`, `gltf_mesh_1`, and so on. The original glTF `mesh.name` is not retained on the public mesh object, so Explorer cannot recover it through public APIs. A named parent transform may still provide the model's original node-level label.

Texture previews and original texture URLs are unavailable through the default adapter. Babylon Lite 1.10.0 exposes GPU handles, dimensions, UV transforms, and `invertY` on `Texture2D`, but it does not retain public source-image/URL metadata or provide a public pixel-readback surface for these textures. These build-time texture fields remain read-only in Explorer.

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
npm run build:npm
npm run build:demo
npm run verify:package
```

`npm run demo` serves and opens the examples at `http://localhost:5173/examples/`.

The demo includes Basic PBR, inline Node Material, a 100-mesh grid, remote Boombox GLB, and animated shark scenes, plus the HTML User Guide.

`npm run build:npm` creates the publishable library in `dist/`. `npm run build:demo` creates the static multi-page examples app in `demo-dist/`. `npm run build` runs both builds.

`npm run verify:package` packs the npm artifact, installs it into a temporary Vite consumer, and verifies that one JavaScript import emits both the Explorer JavaScript and CSS.

Vite builds the ESM library and CSS. Preact, Signals, and Babylon Lite are externalized.

## Further documentation

- [Changelog](CHANGELOG.md)
- [Babylon Lite 1.10.0 public API inventory](docs/babylon-lite-api-inventory.md)
- [Babylon Lite 1.4.0 migration notes](docs/babylon-lite-1.4.0-migration.md)
