# Babylon Lite Inspector

A compact Preact inspector for Babylon Lite. The built-in adapter reads only documented public fields from `@babylonjs/lite`; it never probes underscore-prefixed or otherwise private engine state.

## Install

```bash
npm install @babylonjs/lite-inspector preact @preact/signals
```

Install `@babylonjs/lite` when using the official adapter.

## Use

```ts
import { showLiteInspector } from "@babylonjs/lite-inspector";
import "@babylonjs/lite-inspector/styles.css";

const inspector = showLiteInspector(
  { engine, scene, canvas },
  { mode: "overlay", layout: "single", theme: "dark" }
);

await inspector.ready;

// Later:
inspector.refresh();
inspector.hide();
inspector.show();
inspector.dispose();
```

Each call owns independent state. `dispose()` is idempotent. Caller-provided adapters remain caller-owned and are not disposed by the inspector.

`layout: "single"` is the compact default and stacks Properties beneath Scene Explorer at the top-right. Use `layout: "split"` for simultaneous side-by-side columns at the top-left.

Drag the thin divider in Single mode to resize the stacked panes; the proportion is persisted. Split mode docks Scene Explorer at the left edge and Properties at the right, leaving the canvas interactive between them. Selected entities expose only adapter-backed actions, such as visibility and safe snapshot copying. Verified public PBR base color, metallic, roughness, and alpha fields are editable when present.

## Public API coverage

The official adapter currently exposes the public scene camera, meshes, mesh hierarchy, lights, derived materials, and animation groups. It edits documented scene-node transforms and visibility, camera clipping/FOV fields, and documented light fields. See [the audited API inventory](docs/babylon-lite-api-inventory.md).

Textures and entities that Babylon Lite does not publicly enumerate can be supplied explicitly:

```ts
import { createRegisteredSceneAdapter, showLiteInspector } from "@babylonjs/lite-inspector";

const adapter = createRegisteredSceneAdapter({
  getEntities: () => [{
    id: "app:hero",
    kind: "mesh",
    label: "Hero",
    source: hero,
    capabilities: { editable: false }
  }]
});

showLiteInspector({ engine, scene, canvas }, { adapter });
```

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Vite builds the ESM library and CSS. Preact, Signals, and Babylon Lite are externalized.
