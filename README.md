# Babylon Lite Explorer

A compact Preact explorer for Babylon Lite. The built-in adapter reads only documented public fields from `@babylonjs/lite`; it never probes underscore-prefixed or otherwise private engine state.

## Install

```bash
npm install babylon-lite-explorer preact @preact/signals
```

Install `@babylonjs/lite` when using the official adapter.

## Use

```ts
import { showLiteExplorer } from "babylon-lite-explorer";
import "babylon-lite-explorer/styles.css";

const explorer = showLiteExplorer(
  { engine, scene, canvas },
  {
    mode: "overlay",
    layout: "single",
    theme: "dark",
    features: { focusSelected: false, canvasPicking: false },
    notificationDurationMs: 3000,
    notificationsEnabled: true,
    keyboardShortcutsEnabled: true
  }
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

Drag the thin divider in Single mode to resize the stacked panes; the proportion is persisted. Split mode docks Scene Explorer at the left edge and Properties at the right, leaving the canvas interactive between them. Selected entities expose only adapter-backed actions, such as visibility and safe snapshot copying. Official-adapter snapshots contain clean public property values without explorer IDs or UI descriptor metadata. Verified public PBR base color, metallic, roughness, and alpha fields are editable when present.

The header switches layout and theme. Keyboard shortcuts are `Ctrl+Shift+L` (layout), `Ctrl+Shift+Y` (theme), `Ctrl+Shift+E` (show/hide), and `Ctrl+Shift+F` (focus scene search). Set `keyboardShortcutsEnabled: false` to disable all of them. Property rows include a copy-value control.

Camera focus is optional and disabled by default. Set `features.focusSelected: true` to expose Focus only for entities whose adapter reports `focusable: true` and implements `focusEntity`.

Canvas picking is also optional. Set `features.canvasPicking: true` to add a Pick toggle to the Scene Explorer header. Picking mode is inactive by default; while active, a short primary-pointer click selects a public scene mesh. Pointer drags are ignored so camera controls keep their normal behavior. Custom adapters can support it through `pickEntityId`.

Notifications dismiss automatically after three seconds. Configure `notificationDurationMs`, or set it to `0` for manual dismissal. Set `notificationsEnabled: false` to disable notifications completely. These options are ready for a future preferences UI.

## Public API coverage

The official adapter currently exposes the public scene camera, meshes, mesh hierarchy, lights, derived materials, and animation groups. It edits documented scene-node transforms and visibility, camera clipping/FOV fields, and documented light fields. See [the audited API inventory](docs/babylon-lite-api-inventory.md).

Textures and entities that Babylon Lite does not publicly enumerate can be supplied explicitly:

```ts
import { createRegisteredSceneAdapter, showLiteExplorer } from "babylon-lite-explorer";

const adapter = createRegisteredSceneAdapter({
  getEntities: () => [{
    id: "app:hero",
    kind: "mesh",
    label: "Hero",
    source: hero,
    capabilities: { editable: false }
  }]
});

showLiteExplorer({ engine, scene, canvas }, { adapter });
```

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Vite builds the ESM library and CSS. Preact, Signals, and Babylon Lite are externalized.
