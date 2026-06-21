# Babylon Lite Explorer — Agent Build Plan

**Target stack:** Preact + `@preact/signals` + TypeScript + plain CSS.

**Do not use:** React, Fluent UI, Redux, Zustand, Babylon.js Inspector code directly, Babylon.js class assumptions.

**Main goal:** Build a small, embeddable, Babylon Lite-native explorer that borrows the best architectural ideas from Babylon Inspector V2 without copying its heavy UI stack.

---

## 1. What we learned from Inspector V2 UI/CSS

Inspector V2 is not just a property panel. Its UI architecture is a modular tool shell with:

- left and right side panes;
- top and bottom toolbar regions;
- compact and full toolbar modes;
- tabbed side panes;
- pane registration through `shellService.addSidePane()`;
- toolbar registration through `shellService.addToolbarItem()`;
- optional central content registration;
- resizable side panes;
- persisted left/right pane width and height adjustments;
- pane collapse and expand controls;
- docking/undocking support;
- optional `keepMounted` behavior for pane content;
- teaching moments / discoverability helpers for dynamically added extensions;
- standardized pane headers with icon + title;
- property-line components for common explorer controls;
- a top-level tool wrapper that provides theming and shared tool context.

Inspector V2 uses Fluent UI's `makeStyles` and Fluent design tokens for CSS-in-JS styling. The shared UI layer has Fluent primitives and higher-order components such as property lines and panes. The modular shell itself uses Fluent components, Fluent icons, resize-handle helpers, motion components, and ObservableCollection-based registration.

For Babylon Lite Explorer, **do not copy the Fluent implementation**. Instead, copy the interaction model:

- shell service;
- side-pane registration;
- toolbar-item registration;
- property-line pattern;
- compact tool layout;
- controlled lifecycle/disposal;
- resize/persist later;
- extension points later.

The first version should be much smaller.

---

## 2. Babylon Lite-specific design rule

Babylon Lite is data-oriented. Do not assume Babylon.js-style classes, methods, inheritance, or Inspector V1/V2 object model.

The architecture must be:

```txt
Babylon Lite scene data
        ↓
LiteSceneAdapter
        ↓
Preact Signals view model
        ↓
Preact UI
        ↓
adapter.setProperty()
        ↓
Babylon Lite standalone functions / safe data update
```

The adapter is the safety boundary. UI components must never mutate Babylon Lite scene objects directly.

---

## 3. Public API

Implement this API first:

```ts
export type LiteExplorerTheme = "dark" | "light";
export type LiteExplorerMode = "overlay" | "inline";

export type LiteExplorerContext = {
  engine: unknown;
  scene: unknown;
  canvas?: HTMLCanvasElement;
};

export type LiteExplorerOptions = {
  container?: HTMLElement;
  canvas?: HTMLCanvasElement;
  mode?: LiteExplorerMode;
  theme?: LiteExplorerTheme;
  initiallyOpen?: boolean;
  adapter?: LiteSceneAdapter;
  title?: string;
};

export type LiteExplorerHandle = {
  dispose(): void;
  show(): void;
  hide(): void;
  toggle(): void;
  refresh(): void;
};

export function showLiteExplorer(
  context: LiteExplorerContext,
  options?: LiteExplorerOptions
): LiteExplorerHandle;
```

### API requirements

- `showLiteExplorer()` mounts one explorer panel.
- `dispose()` removes DOM, intervals, event listeners, signal effects, and services.
- Multiple explorers must be possible for multiple scenes.
- Do not use global singleton state.
- Do not import optional Babylon Lite modules unless a feature needs them.

---

## 4. Project structure

Create this structure:

```txt
src/
  index.ts

  api/
    showLiteExplorer.ts
    LiteExplorerHandle.ts

  adapter/
    LiteSceneAdapter.ts
    defaultLiteSceneAdapter.ts
    inspectObject.ts
    propertyDescriptors.ts

  core/
    disposable.ts
    ids.ts
    commands.ts
    serviceContainer.ts

  signals/
    createExplorerSignals.ts
    treeUtils.ts

  services/
    shellService.ts
    sceneExplorerService.ts
    propertiesService.ts
    statsService.ts
    commandService.ts

  ui/
    App.tsx
    Shell.tsx
    Toolbar.tsx
    Tabs.tsx
    SplitPane.tsx
    SceneExplorer.tsx
    TreeNode.tsx
    PropertiesPanel.tsx
    PropertyEditor.tsx
    StatsPanel.tsx
    StatusBar.tsx

  ui/controls/
    Button.tsx
    IconButton.tsx
    TextInput.tsx
    NumberInput.tsx
    Checkbox.tsx
    Select.tsx
    ColorInput.tsx

  styles/
    explorer.css

examples/
  basic/
    index.html
    src/main.ts

tests/
  adapter.test.ts
  signals.test.ts
  services.test.ts
  lifecycle.test.ts
```

---

## 5. Package setup

Use Preact and Signals:

```bash
npm install preact @preact/signals
npm install -D typescript vite vitest @testing-library/preact jsdom
```

Package should be ESM-first:

```json
{
  "name": "babylon-lite-explorer",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "peerDependencies": {
    "@babylonjs/lite": "*",
    "preact": "^10.0.0",
    "@preact/signals": "^1.0.0"
  }
}
```

Do not bundle:

- Preact;
- `@preact/signals`;
- Babylon Lite.

---

## 6. Signals architecture

Create one signal store per explorer instance.

```ts
import { signal, computed } from "@preact/signals";

export function createExplorerSignals() {
  const isOpen = signal(true);
  const theme = signal<"dark" | "light">("dark");

  const context = signal<LiteExplorerContext | null>(null);
  const adapter = signal<LiteSceneAdapter | null>(null);

  const sceneVersion = signal(0);
  const selectedEntityId = signal<string | null>(null);

  const tree = signal<LiteEntity[]>([]);
  const properties = signal<PropertyDescriptor[]>([]);

  const search = signal("");
  const expandedIds = signal<Set<string>>(new Set());

  const selectedEntity = computed(() => {
    const id = selectedEntityId.value;
    if (!id) return null;
    return findEntityById(tree.value, id);
  });

  const filteredTree = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return tree.value;
    return filterTree(tree.value, q);
  });

  return {
    isOpen,
    theme,
    context,
    adapter,
    sceneVersion,
    selectedEntityId,
    selectedEntity,
    tree,
    filteredTree,
    properties,
    search,
    expandedIds
  };
}
```

### Rules

- Signals store explorer view-model state, not raw engine state.
- Adapter may hold references to source objects.
- UI may display source data, but must not mutate it directly.
- All writes go through `adapter.setProperty()`.
- After any successful edit, refresh properties and bump `sceneVersion`.
- Do not rebuild the full tree every frame.

---

## 7. Lite scene adapter

This is the most important part of the app.

```ts
export type LiteEntityKind =
  | "scene"
  | "engine"
  | "camera"
  | "mesh"
  | "transform"
  | "light"
  | "material"
  | "texture"
  | "animationGroup"
  | "assetContainer"
  | "frameGraph"
  | "renderTask"
  | "unknown";

export type LiteEntity = {
  id: string;
  label: string;
  kind: LiteEntityKind;
  source: unknown;
  parentId?: string;
  children?: LiteEntity[];
  meta?: Record<string, unknown>;
};

export type LiteStats = {
  fps?: number;
  frameMs?: number;
  gpuFrameTimeMs?: number;
  drawCallCount?: number;
  meshCount?: number;
  lightCount?: number;
  materialCount?: number;
  textureCount?: number;
  surfaceCount?: number;
};

export type LiteSceneAdapter = {
  getSceneTree(context: LiteExplorerContext): LiteEntity[];
  getProperties(entity: LiteEntity, context: LiteExplorerContext): PropertyDescriptor[];
  setProperty?(
    entity: LiteEntity,
    path: string,
    value: unknown,
    context: LiteExplorerContext
  ): void | Promise<void>;
  refresh?(context: LiteExplorerContext): void | Promise<void>;
  getStats?(context: LiteExplorerContext): LiteStats;
  focusEntity?(entity: LiteEntity, context: LiteExplorerContext): void;
  setEntityVisible?(entity: LiteEntity, visible: boolean, context: LiteExplorerContext): void;
};
```

---

## 8. Property descriptor model

Use typed property descriptors. Do not dynamically edit arbitrary object keys.

```ts
export type PropertyDescriptor =
  | {
      kind: "readonly";
      path: string;
      label: string;
      value: string;
      section?: string;
    }
  | {
      kind: "text";
      path: string;
      label: string;
      value: string;
      readonly?: boolean;
      section?: string;
    }
  | {
      kind: "number";
      path: string;
      label: string;
      value: number;
      min?: number;
      max?: number;
      step?: number;
      readonly?: boolean;
      section?: string;
    }
  | {
      kind: "boolean";
      path: string;
      label: string;
      value: boolean;
      readonly?: boolean;
      section?: string;
    }
  | {
      kind: "vector3";
      path: string;
      label: string;
      value: [number, number, number];
      readonly?: boolean;
      section?: string;
    }
  | {
      kind: "color3";
      path: string;
      label: string;
      value: [number, number, number];
      readonly?: boolean;
      section?: string;
    }
  | {
      kind: "color4";
      path: string;
      label: string;
      value: [number, number, number, number];
      readonly?: boolean;
      section?: string;
    };
```

Initial editable properties:

- label / name;
- visible / enabled;
- position;
- rotation;
- scaling;
- light intensity;
- material alpha;
- material base color;
- camera fov.

Editing safeguards:

- Clamp alpha to `0..1`.
- Clamp color channels to `0..1`.
- Clamp light intensity to `>= 0`.
- Prevent scaling from becoming exactly zero unless explicitly allowed.
- If tuple/array values are immutable in Babylon Lite, replace the whole tuple.
- If vector-like objects expose writable `x/y/z`, update those fields only through adapter code.
- If adapter write fails, show a notification and do not update the UI optimistically.

---

## 9. Default adapter strategy

The default adapter must be defensive.

Create helpers:

```ts
function isObject(value: unknown): value is Record<string, unknown>;
function isArray(value: unknown): value is unknown[];
function hasVector3(value: unknown): value is { x: number; y: number; z: number };
function hasTuple3(value: unknown): value is [number, number, number];
function hasTuple4(value: unknown): value is [number, number, number, number];
```

Search common scene collection names:

```ts
const sceneCollectionCandidates = {
  cameras: ["camera", "cameras", "_cameras"],
  meshes: ["meshes", "_meshes", "renderables", "_renderables"],
  lights: ["lights", "_lights"],
  materials: ["materials", "_materials"],
  textures: ["textures", "_textures"],
  animationGroups: ["animationGroups", "_animationGroups"],
  transformNodes: ["transformNodes", "_transformNodes", "nodes", "_nodes"]
};
```

For each candidate:

- if field is an array, convert entries to `LiteEntity`;
- if camera is a single object, wrap it as a single camera entity;
- if collection is missing, skip it;
- do not crash on unsupported features.

Stable ID generation:

```ts
function getEntityId(kind: LiteEntityKind, source: unknown, index: number): string {
  if (isObject(source)) {
    const explicit =
      source.id ??
      source.name ??
      source.label ??
      source.uniqueId ??
      source._id ??
      source._debugId;

    if (typeof explicit === "string" || typeof explicit === "number") {
      return `${kind}:${String(explicit)}`;
    }
  }

  return `${kind}:index:${index}`;
}
```

For object sources without stable IDs, use a `WeakMap<object, string>` inside the adapter instance.

---

## 10. Shell service

Borrow the Inspector V2 shell concept, but implement it with Preact and CSS.

### ShellService API

```ts
export type SidePaneDefinition = {
  key: string;
  title: string;
  side: "left" | "right";
  location?: "top" | "bottom";
  order?: number;
  icon?: ComponentType;
  content: ComponentType;
  keepMounted?: boolean;
};

export type ToolbarItemDefinition = {
  key: string;
  title?: string;
  location: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  order?: number;
  component: ComponentType;
};

export type ShellService = {
  addSidePane(pane: SidePaneDefinition): Disposable;
  addToolbarItem(item: ToolbarItemDefinition): Disposable;
  selectPane(key: string): void;
};
```

### MVP layout

```txt
┌──────────────────────────────────────────────┐
│ Babylon Lite Explorer        ⟳  ◐  ×        │
├───────────────────┬──────────────────────────┤
│ Scene Explorer    │ Properties               │
│                   │                          │
├───────────────────┴──────────────────────────┤
│ FPS  Draws  Meshes  Selected                 │
└──────────────────────────────────────────────┘
```

### V2-inspired features to include immediately

- top toolbar;
- bottom status bar;
- left side pane;
- right side pane;
- tab registration, even if each side has one tab at first;
- `keepMounted` option;
- selected pane state;
- deterministic ordering;
- dispose handle for every pane and toolbar item.

### V2-inspired features to postpone

- pane undocking;
- teaching moments;
- dock remapping;
- vertical split top/bottom panes;
- toolbar overflow menus;
- child windows;
- persisted pane widths;
- resize handles.

---

## 11. CSS plan

Use one CSS file with scoped `.ble-*` classes. Do not inject global styles.

```css
.ble-root {
  --ble-bg: #181818;
  --ble-panel: #202020;
  --ble-panel-2: #252525;
  --ble-border: #383838;
  --ble-text: #eeeeee;
  --ble-muted: #a0a0a0;
  --ble-accent: #4da3ff;
  --ble-danger: #ff5a5a;

  font: 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--ble-text);
  background: var(--ble-bg);
  box-sizing: border-box;
}

.ble-root * {
  box-sizing: border-box;
}

.ble-root[data-theme="light"] {
  --ble-bg: #f5f5f5;
  --ble-panel: #ffffff;
  --ble-panel-2: #eeeeee;
  --ble-border: #cccccc;
  --ble-text: #1a1a1a;
  --ble-muted: #666666;
  --ble-accent: #0067c0;
}
```

### CSS requirements

- Compact density.
- 12px base font.
- Dense rows: 24px tree/property row height.
- Clear focus styles for keyboard navigation.
- Dark theme default.
- Light theme via `data-theme="light"`.
- No global resets outside `.ble-root`.
- Overlay root must use `pointer-events: auto`.
- Canvas behind explorer must remain interactive outside explorer bounds.

### Overlay defaults

```css
.ble-overlay {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 720px;
  height: min(80vh, 640px);
  z-index: 999999;
  border: 1px solid var(--ble-border);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
}
```

---

## 12. UI components

Build this small UI kit:

```txt
Button
IconButton
Tabs
SplitPane
TreeView
TreeNode
PropertyGrid
PropertyRow
TextInput
NumberInput
Checkbox
Select
ColorInput
Toolbar
StatusBar
Panel
```

Do not add a general design system. These controls are explorer-specific.

### Property row pattern

Copy the idea from Inspector V2 shared UI property lines: each row has a label, control, optional copy button, and consistent styling.

```txt
Label                       Control
Position                    [x] [y] [z]
Visible                     [x]
Material                    Red PBR
```

MVP may omit copy buttons, but reserve the layout slot.

---

## 13. Scene Explorer

### Requirements

- Registers itself as a left side pane.
- Shows root scene plus known sections.
- Supports expand/collapse.
- Supports search.
- Clicking an entity sets selected entity ID.
- Selected item is highlighted.
- Empty sections are hidden by default.
- Manual refresh button is visible in toolbar.

### Initial sections

```txt
Scene
Camera / Cameras
Meshes
Lights
Materials
Textures
```

### Later sections

```txt
Animation Groups
Frame Graph
Render Tasks
Physics
Sprites
GUI
Navigation
```

Only add later sections when adapter support exists.

---

## 14. Properties panel

### Requirements

- Registers itself as a right side pane.
- Reads selected entity from signals.
- Calls `adapter.getProperties()`.
- Groups descriptors by `section`.
- Uses typed property editors.
- Shows unsupported values as read-only strings.
- Never crashes on unknown source objects.

### First sections

```txt
General
Transform
Rendering
Material
Camera
Light
Debug
```

### General fields for all entities

```txt
label
kind
id
source type
```

### Entity-specific fields

Mesh-like:

```txt
visible / enabled
position
rotation
scaling
material reference
thin instance count, if present
```

Camera-like:

```txt
position / target
alpha / beta / radius, if present
fov
near / far
```

Light-like:

```txt
intensity
direction
position
color / diffuse
```

Material-like:

```txt
baseColorFactor
metallicFactor
roughnessFactor
alpha
doubleSided / backFaceCulling equivalent
```

---

## 15. Stats service

### Stats type

```ts
export type LiteStats = {
  fps?: number;
  frameMs?: number;
  gpuFrameTimeMs?: number;
  drawCallCount?: number;
  meshCount?: number;
  lightCount?: number;
  materialCount?: number;
  textureCount?: number;
  surfaceCount?: number;
};
```

### Requirements

- Show FPS.
- Show frame time.
- Show draw calls if engine exposes them.
- Show GPU frame time if enabled and available.
- Show mesh/light/material/texture counts from adapter tree.
- Stats can update per frame.
- Tree/properties must not update per frame.
- GPU timing must be opt-in.

---

## 16. Refresh model

Implement refresh modes:

```ts
type RefreshMode = "manual" | "interval" | "beforeRender";
```

Default: `manual`.

Functions:

```ts
function refreshTree(): void {
  const ctx = signals.context.value;
  const adapter = signals.adapter.value;
  if (!ctx || !adapter) return;
  signals.tree.value = adapter.getSceneTree(ctx);
  signals.sceneVersion.value++;
}

function refreshProperties(): void {
  const entity = signals.selectedEntity.value;
  const ctx = signals.context.value;
  const adapter = signals.adapter.value;
  if (!ctx || !adapter || !entity) {
    signals.properties.value = [];
    return;
  }
  signals.properties.value = adapter.getProperties(entity, ctx);
}
```

Selection refresh rule:

- If selected ID still exists after tree refresh, keep it.
- If selected ID disappeared, clear selection.

---

## 17. Minimal service container

Use a small service model now. Do not implement full Inspector V2 extension feeds in the MVP.

```ts
export type Disposable = {
  dispose(): void;
};

export type LiteExplorerService = {
  id: string;
  start(): void | Promise<void>;
  dispose(): void;
};

export class ServiceContainer {
  private services = new Map<string, LiteExplorerService>();

  register(service: LiteExplorerService): void {
    if (this.services.has(service.id)) {
      throw new Error(`Service already registered: ${service.id}`);
    }
    this.services.set(service.id, service);
  }

  get<T extends LiteExplorerService>(id: string): T {
    const service = this.services.get(id);
    if (!service) throw new Error(`Missing service: ${id}`);
    return service as T;
  }

  async start(): Promise<void> {
    for (const service of this.services.values()) {
      await service.start();
    }
  }

  dispose(): void {
    for (const service of [...this.services.values()].reverse()) {
      service.dispose();
    }
    this.services.clear();
  }
}
```

Required MVP services:

```txt
ShellService
SceneExplorerService
PropertiesService
StatsService
CommandService
```

---

## 18. Commands

Add a small command system:

```ts
export type ExplorerCommand = {
  id: string;
  label: string;
  when?: (entity: LiteEntity | null) => boolean;
  run: (entity: LiteEntity | null, context: LiteExplorerContext) => void | Promise<void>;
};
```

Initial commands:

```txt
refresh
clear selection
copy entity JSON
copy property path
toggle visible
focus selected, optional
```

---

## 19. `showLiteExplorer()` implementation flow

The agent should implement in this order:

1. Resolve container:
   - `options.container`, else;
   - `options.canvas.parentElement`, else;
   - `document.body`.
2. Create host div.
3. Add `.ble-root` and `.ble-overlay` classes.
4. Create explorer signals.
5. Set context, adapter, theme, open state.
6. Create service container.
7. Register shell, command, explorer, properties, stats services.
8. Start services.
9. Render Preact app into host.
10. Run initial `refreshTree()`.
11. Return handle.

Dispose must:

- unmount Preact root;
- dispose service container;
- clear timers/effects;
- remove DOM host;
- detach scene/render/canvas listeners;
- become idempotent.

---

## 20. MVP acceptance checklist

MVP is done only when all items pass:

- `showLiteExplorer({ engine, scene, canvas })` mounts an overlay.
- `dispose()` fully removes DOM and listeners.
- Scene Explorer shows scene, camera, meshes, lights, materials where available.
- Search filters tree nodes.
- Expand/collapse works.
- Selecting a tree node updates Properties panel.
- Properties panel shows read-only values.
- Safe editing works for at least one transform property if present.
- Stats bar shows FPS and draw calls if available.
- Manual Refresh rebuilds the tree.
- Empty/unsupported scene does not crash.
- Works with fake scene unit tests.
- Does not import React.
- Does not import Fluent UI.
- Does not poll the full scene every frame.

---

## 21. Tests

### Fake scene test data

```ts
const fakeScene = {
  camera: { name: "Camera", alpha: 0, beta: 1, radius: 4 },
  meshes: [
    {
      name: "Sphere",
      position: { x: 0, y: 1, z: 0 },
      scaling: { x: 1, y: 1, z: 1 },
      material: { name: "Red", baseColorFactor: [1, 0, 0, 1] }
    }
  ],
  lights: [
    {
      name: "Hemi",
      intensity: 1,
      direction: [0, 1, 0]
    }
  ]
};
```

### Required tests

```txt
adapter returns tree
adapter returns properties
selection signal computes selected entity
property edit calls adapter.setProperty
refreshTree preserves selected ID if entity still exists
refreshTree clears selected ID if entity disappears
dispose cleans intervals/effects/listeners
shell addSidePane adds pane
shell addToolbarItem adds item
properties panel handles unknown entity safely
```

---

## 22. Example app

Create `examples/basic` using the real Babylon Lite app flow.

Expected usage:

```ts
import {
  createEngine,
  createSceneContext,
  createArcRotateCamera,
  attachControl,
  createHemisphericLight,
  createSphere,
  createPbrMaterial,
  addToScene,
  registerScene,
  startEngine
} from "@babylonjs/lite";

import { showLiteExplorer } from "babylon-lite-explorer";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

const engine = await createEngine(canvas);
const scene = createSceneContext(engine);

const camera = createArcRotateCamera(
  -Math.PI / 2,
  Math.PI / 2.5,
  4,
  { x: 0, y: 0, z: 0 }
);

scene.camera = camera;
attachControl(camera, canvas, scene);

addToScene(scene, createHemisphericLight([0, 1, 0], 1.0));

const sphere = createSphere(engine, { segments: 16, diameter: 2 });
sphere.material = createPbrMaterial({
  baseColorFactor: [0.9, 0.1, 0.1, 1],
  metallicFactor: 0.1,
  roughnessFactor: 0.4
});

addToScene(scene, sphere);

await registerScene(scene);
await startEngine(engine);

showLiteExplorer({ engine, scene, canvas });
```

---

## 23. Post-MVP backlog

### Phase 2: UI polish

- Resizable panes.
- Persisted pane sizes.
- Keyboard shortcuts.
- Better icons.
- Light/dark toggle.
- Copy buttons in property rows.
- Error boundary around each pane.

### Phase 3: Performance

- Virtualized tree.
- Lazy section expansion.
- Search index.
- Large fake-scene tests: 1,000 / 10,000 / 100,000 entities.
- Throttled refresh.

### Phase 4: Scene interaction

- Picking integration.
- Highlight selected entity.
- Focus selected entity.
- Toggle bounds/wireframe if supported.

### Phase 5: Advanced panels

- Texture preview.
- Material preview.
- JSON viewer.
- Animation controls.
- Frame graph view.
- Render task timing panel.
- GPU timing panel.

### Phase 6: Extension system

Only after MVP is stable:

- service definitions;
- built-in extension registry;
- optional dynamic import;
- custom scene explorer sections;
- custom property sections;
- custom toolbar items;
- extension manager UI.

---

## 24. Things the agent must not forget from Inspector V2

Include now:

- Shell service abstraction.
- Side pane registration.
- Toolbar registration.
- Pane tabs, even if only one tab exists at first.
- Property-line layout pattern.
- Deterministic ordering.
- Dispose handles for every registration.
- Error isolation around panes.
- Manual refresh command.
- Settings placeholders for future UI preferences.

Postpone but design for:

- resize handles;
- persisted pane widths/heights;
- compact/full toolbar mode;
- pane docking/undocking;
- keepMounted behavior;
- extension discoverability;
- virtualized scene tree;
- extension-added panes and toolbar buttons.

Do not include:

- Fluent UI;
- React;
- Fluent CSS-in-JS tokens;
- Inspector V2's full extension feed system;
- teaching moments in MVP;
- child windows in MVP;
- property interception as default;
- full-scene polling every frame.

---

## 25. Final design principle

The Babylon Lite Explorer should feel like Inspector V2 structurally, but not technically:

```txt
Inspector V2 idea        Babylon Lite Explorer implementation
---------------------------------------------------------------
React                    Preact
Fluent UI                Plain scoped CSS
ObservableCollection     Signals
ShellService             Small ShellService
Side panes               Lightweight tabbed panes
Toolbar zones            Lightweight toolbar registry
WatcherService           Manual/signal refresh first
Property lines           Custom PropertyRow
Scene object model       LiteSceneAdapter
Extensions               Post-MVP only
```

The app should stay small, readable, easy to debug, and native to Babylon Lite.
