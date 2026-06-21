# Babylon Lite Explorer — Official API-Only Build Plan

**Target stack:** Preact, `@preact/signals`, TypeScript, and scoped plain CSS.

**Target package:** `@babylonjs/lite` (verify the installed version before implementation; npm reported `1.2.0` on 2026-06-20).

**Main goal:** Build a small, embeddable explorer for Babylon Lite that adopts the useful interaction patterns of Inspector V2 while depending only on documented Babylon Lite exports and public application data.

---

## 1. Non-negotiable API policy

The explorer must use official Babylon Lite APIs only.

It must not:

- read underscore-prefixed fields such as `_meshes`, `_nodes`, or `_id`;
- depend on undocumented object layouts;
- identify entities through constructor names or `instanceof` checks unless those types and checks are documented public API;
- call methods that are absent from the public TypeScript declarations;
- copy code from Babylon.js Inspector V1 or V2;
- assume Babylon.js class semantics in Babylon Lite;
- use reflection to discover arbitrary scene keys;
- make arbitrary source-object properties editable.

Runtime shape checks are allowed only for values already obtained through a documented API or explicitly supplied by the host application. Their purpose is validation and safe rendering, not discovery of hidden engine state.

If a feature cannot be implemented through the public API, the default adapter must report it as unsupported. It must not fall back to private fields.

---

## 2. Mandatory API inventory gate

Before implementing the adapter, inspect the declarations shipped with the exact installed version of `@babylonjs/lite` and record the supported public surface in:

```txt
docs/babylon-lite-api-inventory.md
```

For every explorer feature, record:

| Feature | Public export or public field | Read | Write | Enumeration | Notes |
|---|---|---:|---:|---:|---|
| Scene identity | To verify | — | — | — | Do not guess |
| Cameras | To verify | — | — | — | |
| Meshes/surfaces | To verify | — | — | — | |
| Lights | To verify | — | — | — | |
| Materials | To verify | — | — | — | |
| Textures | Material `Texture2D` slots and public `Texture2D` metadata | Yes, metadata only | No reliable runtime write path in 1.2.0 | Derived from mesh materials | No source URL/image, pixel readback, or preview; UV fields and `invertY` remain read-only |
| Transforms | To verify | — | — | — | |
| Visibility | To verify | — | — | — | |
| Statistics | To verify | — | — | — | |
| Focus/highlight | To verify | — | — | — | |

Rules for this inventory:

1. The installed package declarations are the version-specific source of truth.
2. Official Babylon Lite documentation and repository source may clarify behavior, but implementation must remain within exported/public declarations.
3. Every default-adapter read or write must link to an inventory entry in a code comment or test name.
4. Features without verified public support remain disabled.
5. Upgrading Babylon Lite requires rerunning this audit and adapter compatibility tests.

This gate prevents the implementation plan from turning speculative example APIs into accidental dependencies.

---

## 3. Architecture

```txt
Documented Babylon Lite API       Host-provided explicit entities
             │                                │
             └──────────────┬─────────────────┘
                            ↓
                    LiteSceneAdapter
                 (capability boundary)
                            ↓
                 per-instance signals/store
                            ↓
                        Preact UI
                            ↓
                    adapter operations
                            ↓
              documented API or host callback
```

The UI never reads or mutates Babylon Lite objects directly. It receives normalized entity and property descriptors from an adapter.

There is no generic reflective fallback adapter.

Two supported adapter paths exist:

1. `createOfficialLiteSceneAdapter()` uses only verified Babylon Lite public APIs.
2. A caller supplies a custom adapter or explicit entity registry for application-owned data that the official API cannot enumerate.

---

## 4. Public API

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
  readonly ready: Promise<void>;
  dispose(): void;
  show(): void;
  hide(): void;
  toggle(): void;
  refresh(): Promise<void>;
};

export function showLiteExplorer(
  context: LiteExplorerContext,
  options?: LiteExplorerOptions
): LiteExplorerHandle;
```

Requirements:

- Each call creates an independent explorer instance.
- No global singleton state.
- `dispose()` is idempotent and removes all owned resources.
- Asynchronous startup and initial refresh are represented by `handle.ready`.
- No Babylon Lite feature module is imported unless the verified adapter feature needs it.
- `overlay` and `inline` behavior are both defined and tested.

### Explicit entity registration

If public Babylon Lite APIs do not enumerate a category, applications may explicitly provide it without exposing engine internals:

```ts
export type LiteEntityRegistration = {
  id: string;
  kind: LiteEntityKind;
  label: string;
  source: unknown;
  parentId?: string;
  capabilities?: Partial<LiteEntityCapabilities>;
};

export function createRegisteredSceneAdapter(options: {
  getEntities(context: LiteExplorerContext): LiteEntityRegistration[];
  getProperties?: LiteSceneAdapter["getProperties"];
  setProperty?: LiteSceneAdapter["setProperty"];
}): LiteSceneAdapter;
```

The host owns these registrations. The explorer does not discover additional fields on their source objects.

---

## 5. Adapter contract

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
  | "frameGraph"
  | "renderTask"
  | "unknown";

export type LiteEntityCapabilities = {
  editable: boolean;
  focusable: boolean;
  visibilityToggle: boolean;
  serializableSnapshot: boolean;
};

export type LiteEntity = {
  id: string;
  label: string;
  kind: LiteEntityKind;
  source: unknown;
  parentId?: string;
  children?: LiteEntity[];
  capabilities: LiteEntityCapabilities;
  meta?: Readonly<Record<string, unknown>>;
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

export type AdapterResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; code: "unsupported" | "invalid" | "failed"; message: string };

export type LiteSceneAdapter = {
  getSceneTree(context: LiteExplorerContext): LiteEntity[] | Promise<LiteEntity[]>;
  getProperties(
    entity: LiteEntity,
    context: LiteExplorerContext
  ): PropertyDescriptor[] | Promise<PropertyDescriptor[]>;
  setProperty?(
    entity: LiteEntity,
    path: string,
    value: unknown,
    context: LiteExplorerContext
  ): AdapterResult | Promise<AdapterResult>;
  refresh?(context: LiteExplorerContext): AdapterResult | Promise<AdapterResult>;
  getStats?(context: LiteExplorerContext): LiteStats | Promise<LiteStats>;
  focusEntity?(
    entity: LiteEntity,
    context: LiteExplorerContext
  ): AdapterResult | Promise<AdapterResult>;
  setEntityVisible?(
    entity: LiteEntity,
    visible: boolean,
    context: LiteExplorerContext
  ): AdapterResult | Promise<AdapterResult>;
  getEntitySnapshot?(
    entity: LiteEntity,
    context: LiteExplorerContext
  ): AdapterResult<unknown> | Promise<AdapterResult<unknown>>;
  dispose?(): void;
};
```

Adapter rules:

- Capabilities are explicit; the UI does not infer them from object shape.
- Unsupported operations return `{ ok: false, code: "unsupported" }`.
- Expected validation errors return results rather than throwing.
- Unexpected adapter exceptions are caught at the controller boundary and converted into notifications.
- “Copy entity JSON” uses `getEntitySnapshot()` and never stringifies `entity.source` directly.

---

## 6. Stable identity

Entity IDs must remain stable across refreshes and must be unique within one explorer.

Priority:

1. A documented public stable identifier verified in the API inventory.
2. An explicit ID supplied by the host registration.
3. A per-adapter `WeakMap<object, string>` identity for public objects already supplied to the adapter.

Do not use names alone as IDs. Duplicate names are valid. Do not use collection indices unless the source is a non-object value and the adapter documents that selection cannot survive reordering.

The adapter must detect ID collisions and deterministically disambiguate them while emitting a development warning.

---

## 7. Property descriptors and edits

Use a closed descriptor union. The UI must not enumerate arbitrary keys.

```ts
type PropertyBase = {
  path: string;
  label: string;
  section?: string;
  readonly?: boolean;
};

export type PropertyDescriptor =
  | (PropertyBase & { kind: "readonly"; value: string })
  | (PropertyBase & { kind: "text"; value: string })
  | (PropertyBase & {
      kind: "number";
      value: number;
      min?: number;
      max?: number;
      step?: number;
    })
  | (PropertyBase & { kind: "boolean"; value: boolean })
  | (PropertyBase & { kind: "vector3"; value: readonly [number, number, number] })
  | (PropertyBase & { kind: "color3"; value: readonly [number, number, number] })
  | (PropertyBase & { kind: "color4"; value: readonly [number, number, number, number] });
```

Only properties with verified public write support may be editable in the official adapter.

Safeguards:

- clamp alpha and color channels to `0..1`;
- clamp light intensity to `>= 0`;
- reject exactly-zero scaling unless verified API behavior permits it;
- perform tuple replacement or documented setter calls according to the public API;
- commit text/number/vector edits on blur or Enter;
- cancel edits on Escape;
- do not update canonical descriptor state optimistically;
- show a notification when a write is rejected or fails;
- after success, refresh the selected entity’s properties and increment `sceneVersion`.

---

## 8. Per-instance state

```ts
export function createExplorerSignals() {
  const isOpen = signal(true);
  const theme = signal<LiteExplorerTheme>("dark");
  const context = signal<LiteExplorerContext | null>(null);
  const adapter = signal<LiteSceneAdapter | null>(null);

  const sceneVersion = signal(0);
  const selectedEntityId = signal<string | null>(null);
  const tree = signal<LiteEntity[]>([]);
  const properties = signal<PropertyDescriptor[]>([]);
  const stats = signal<LiteStats>({});

  const search = signal("");
  const expandedIds = signal<ReadonlySet<string>>(new Set());
  const notifications = signal<ExplorerNotification[]>([]);
  const isRefreshingTree = signal(false);
  const isRefreshingProperties = signal(false);

  // Computed values omitted here.
}
```

Never mutate a `Set` stored in a signal. Replace it:

```ts
const next = new Set(expandedIds.value);
next.add(id);
expandedIds.value = next;
```

Signals contain normalized view-model state, not raw engine state. Raw references remain behind the adapter/entity boundary.

---

## 9. Refresh controller

Use one refresh controller per explorer to coordinate tree, selection, properties, and races.

```ts
type RefreshMode = "manual" | "interval" | "beforeRender";
```

MVP default: `manual`.

Rules:

- Tree and properties never refresh every frame.
- Statistics may sample independently at a throttled rate.
- Each async tree/property request receives a generation number.
- A result commits only if it is still the newest request for the current adapter, context, and selected entity.
- Tree refresh preserves selection when the stable ID remains.
- Tree refresh clears selection and properties when the ID disappears.
- Concurrent manual refresh requests coalesce where practical.
- Disposal invalidates all outstanding generations.
- `beforeRender` mode is implemented only if a documented public lifecycle hook exists.

---

## 10. Shell and services

Keep Inspector V2’s registration idea, but use a small implementation.

```ts
export type SidePaneDefinition = {
  key: string;
  title: string;
  side: "left" | "right";
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
```

MVP services:

- `ShellService`: pane and toolbar registration;
- `CommandService`: commands and availability;
- `RefreshController`: adapter reads, writes, reconciliation, and races;
- `StatsService`: optional throttled statistics;
- `NotificationService`: bounded user-visible errors and status messages.

Scene Explorer and Properties remain UI components/controllers unless they develop independent lifecycle requirements. Avoid creating services solely to mirror Inspector V2.

Every registration returns an idempotent disposable. Registrations use deterministic ordering by `(order, key)`.

---

## 11. User interface

MVP layout:

```txt
┌────────────────────────────────────────────────────┐
│ Babylon Lite Explorer          Refresh  Hide  ×   │
├──────────────────────┬─────────────────────────────┤
│ Scene Explorer       │ Properties                  │
│ Search               │                             │
│ Tree                 │ Typed property rows         │
├──────────────────────┴─────────────────────────────┤
│ FPS  Frame  Draws  Counts  Selected                │
└────────────────────────────────────────────────────┘
```

Build only explorer-specific controls:

```txt
Button, IconButton, Tabs, TreeView, TreeNode, PropertyGrid,
PropertyRow, TextInput, NumberInput, Checkbox, ColorInput,
Toolbar, StatusBar, Panel, NotificationRegion
```

Requirements:

- tab registration exists even with one pane per side;
- pane content is isolated by an error boundary;
- property rows have consistent label/control columns;
- unsupported capabilities are absent or visibly disabled with an explanation;
- empty official-API results show a useful message directing users to explicit registration/custom adapters;
- no UI code examines source-object keys.

### Accessibility

- Tree uses appropriate tree/treeitem semantics.
- Arrow keys navigate and expand/collapse tree items.
- Tabs implement tablist/tab/tabpanel semantics.
- Icon-only buttons have accessible names.
- Every input has a programmatic label.
- Focus styles are clearly visible.
- Escape cancels property editing; closing restores focus when possible.
- Notifications use an appropriate live region without repeatedly announcing stats.

---

## 12. Overlay and inline modes

### Overlay

- Mount into `options.container`, otherwise `canvas.parentElement`, otherwise `document.body`.
- Position relative to the resolved container deliberately.
- If the explorer temporarily changes an owned style such as container positioning, record and restore the exact previous value on disposal.
- Explorer bounds receive pointer input; the canvas remains interactive elsewhere.

### Inline

- Participate in normal layout.
- Fill the provided container’s available width and height.
- Do not use absolute positioning, overlay shadow, or overlay z-index.
- If no usable container is supplied, mount to `document.body` with an explicit minimum size.

---

## 13. Styling and packaging

Use scoped `.ble-*` classes in one CSS entry file. No global resets outside `.ble-root`.

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
```

Package principles:

- ESM-first;
- Preact and Signals remain peer dependencies and are not bundled;
- Babylon Lite remains an optional peer if custom/registered adapters can operate without importing it;
- CSS imports must not be tree-shaken.

```json
{
  "type": "module",
  "sideEffects": ["**/*.css"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css"
  }
}
```

Do not bundle Preact, Signals, or Babylon Lite.

---

## 14. Commands

```ts
export type ExplorerCommand = {
  id: string;
  label: string;
  when?: (entity: LiteEntity | null) => boolean;
  run: (
    entity: LiteEntity | null,
    context: LiteExplorerContext
  ) => void | Promise<void>;
};
```

Initial commands:

- refresh;
- clear selection;
- copy adapter-provided entity snapshot;
- copy property path;
- toggle visible, only when capability and adapter operation exist;
- focus selected, only when capability and adapter operation exist.

Clipboard failures must be reported. Commands must not bypass adapter capabilities.

---

## 15. Lifecycle

`showLiteExplorer()` flow:

1. Resolve and validate the mount container.
2. Create the host element and mode-specific classes.
3. Create per-instance signals and generation guards.
4. Create or accept the adapter.
5. Register services and built-in shell content.
6. Render the Preact app.
7. Start services.
8. Perform the initial tree refresh.
9. Resolve `handle.ready`.

`dispose()` must:

- become a no-op after its first call;
- invalidate outstanding async work;
- stop timers and documented render hooks;
- dispose registrations and services in reverse order;
- call `adapter.dispose()` when owned by this explorer;
- unmount Preact;
- remove the host DOM node;
- restore any container styles changed by the explorer;
- tolerate the host/container already being removed.

A caller-owned adapter is not disposed unless the API explicitly transfers ownership. Record this rule in the public documentation.

---

## 16. Project structure

```txt
src/
  index.ts
  api/
    showLiteExplorer.ts
    types.ts
  adapter/
    LiteSceneAdapter.ts
    official/
      createOfficialLiteSceneAdapter.ts
      capabilities.ts
      entityIdentity.ts
    registered/
      createRegisteredSceneAdapter.ts
    propertyDescriptors.ts
  core/
    disposable.ts
    serviceContainer.ts
  signals/
    createExplorerSignals.ts
    treeUtils.ts
  services/
    shellService.ts
    commandService.ts
    refreshController.ts
    statsService.ts
    notificationService.ts
  ui/
    App.tsx
    Shell.tsx
    SceneExplorer.tsx
    TreeNode.tsx
    PropertiesPanel.tsx
    PropertyEditor.tsx
    StatusBar.tsx
    ErrorBoundary.tsx
    NotificationRegion.tsx
    controls/
  styles/
    explorer.css
docs/
  babylon-lite-api-inventory.md
examples/
  basic/
  registered-entities/
tests/
  adapter/
  signals/
  services/
  lifecycle/
  ui/
```

---

## 17. Implementation phases

### Phase 0: Verify the dependency

- Create package/build/test setup.
- Inventory the installed Babylon Lite public declarations.
- Identify which categories can be publicly enumerated.
- Identify verified public read/write operations.
- Add a test or static check rejecting underscore-prefixed access in the official adapter.

### Phase 1: Small vertical slice

- Mount and dispose one explorer.
- Create the official adapter skeleton and registered adapter.
- Display a stable read-only tree.
- Select an entity and display read-only descriptors.
- Implement one verified safe edit, if the public API supports it.
- Handle an empty or unsupported public scene without crashing.

Do not build statistics or a large shell abstraction until this slice works against a real Babylon Lite example.

### Phase 2: MVP shell

- Pane and toolbar registration.
- Search and expand/collapse.
- Typed editors and notifications.
- Manual refresh and race protection.
- Commands guarded by capabilities.
- Accessibility behaviors.

### Phase 3: Verified statistics

- Add FPS/frame time only through documented APIs or explorer-owned timing.
- Add draw/GPU metrics only when official APIs explicitly expose them.
- Sample at a throttled rate independently from tree/property rendering.

### Post-MVP

- resizable and persisted pane sizes;
- keyboard shortcuts;
- virtualized large trees;
- picking/highlighting through verified APIs;
- previews and advanced panels;
- extension registry;
- optional advanced Babylon Lite feature adapters.

---

## 18. Test requirements

### Official API policy

- official adapter imports only public package entry points;
- official adapter contains no underscore-prefixed property access;
- unsupported categories return empty/unsupported results rather than probing;
- UI never reads entity source keys;
- each supported operation maps to the API inventory.

### Adapter and identity

- duplicate labels produce distinct stable IDs;
- collection reordering preserves selection;
- registered entities require unique explicit IDs;
- cyclic source objects are never blindly serialized;
- unsupported edits return a visible nonfatal result;
- rejected async writes do not alter canonical property state;
- frozen tuples/read-only values remain safe.

### Refresh and state

- selection is preserved when its ID remains;
- selection clears when its ID disappears;
- stale property responses cannot replace a newer selection;
- stale tree responses cannot replace a newer refresh;
- expanded-ID updates replace the `Set` value;
- tree/properties do not poll every frame.

### Lifecycle

- two explorers operate independently;
- repeated disposal is safe;
- disposal stops timers/hooks/effects;
- disposal during async startup is safe;
- externally removed containers are tolerated;
- modified container styles are restored exactly.

### UI

- empty official API support shows guidance rather than an empty unexplained panel;
- property panel isolates unknown adapter output;
- pane error boundaries prevent full-explorer crashes;
- tree, tabs, buttons, inputs, and notifications meet the defined keyboard/ARIA behavior.

---

## 19. MVP acceptance checklist

- `showLiteExplorer({ engine, scene, canvas })` mounts without private API access.
- The exact supported Babylon Lite public API is documented in the inventory.
- `handle.ready` resolves after initial startup or rejects with an actionable error.
- `dispose()` fully and idempotently cleans owned resources.
- Officially enumerable entities appear in Scene Explorer.
- Non-enumerable categories can be supplied through explicit registration.
- Search, expand/collapse, and stable selection work.
- Properties are descriptor-driven and read-only by default.
- At least one edit works only if backed by a verified public operation.
- Adapter failures produce notifications and do not corrupt displayed state.
- Manual refresh reconciles stable selection and rejects stale results.
- Statistics show only metrics available through documented APIs or explorer-owned measurement.
- Empty and partially supported scenes do not crash.
- Two simultaneous explorers work independently.
- No React, Fluent UI, private fields, reflective discovery, or full-scene per-frame polling.

---

## 20. Final design principle

```txt
Inspector V2 idea         Babylon Lite Explorer implementation
----------------------------------------------------------------
React                     Preact
Fluent UI                 Scoped plain CSS
Observable collections    Per-instance Signals
Shell service             Small registration service
Property lines            Typed PropertyRow components
Scene object model        Official API-only adapter
Fallback reflection       Not allowed
Missing enumeration       Explicit host registration
Watcher service           Manual, coordinated refresh first
Extensions                Post-MVP
```

The explorer should be honest about what the public API exposes. A smaller explorer with explicit limitations is preferable to a seemingly capable explorer coupled to private engine internals.

For Babylon Lite 1.2.0 textures, this means listing public dimensions, usage, and UV metadata without editable controls or previews. `invertY` is consumed during upload, and UV-transform shader features are fixed by loader-time flags that the public API cannot add or invalidate after material creation.
