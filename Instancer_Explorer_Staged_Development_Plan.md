# Instancer Explorer Staged Development Plan

## Goal

Add Instancer support without overloading the main Scene Explorer tree.

The Scene Explorer should remain focused on Babylon Lite scene objects. Instancer data should live in a dedicated Instancer tab/panel, with lightweight entry points from relevant mesh rows.

## Design Direction

Use two extension surfaces:

- **Entity actions**: small contextual actions shown on Scene Explorer rows.
- **Extension panels**: custom tabs/panes hosted by Explorer.

The existing mesh Delete work is the first precedent for this pattern:

- `LiteSceneAdapter.removeEntity()` exposes the adapter-backed operation.
- The `remove-entity` command owns confirmation/user-setting behavior and calls the adapter.
- Scene Explorer renders the command as a compact row action through the generic command row-action descriptor.

Future Instancer row entry points should follow the same command/action pattern instead of adding one-off UI in `SceneExplorer`.

For Instancer:

- Mesh rows that are connected to registered instance sets show an `I` / instances action.
- Clicking the action opens the Instancer panel.
- The Instancer panel focuses the registered set connected to that mesh.
- The Instancer panel groups content by original source mesh/root first, with the relevant registered sets underneath each source.
- Instance rows and set details are shown inside the Instancer panel, not as a giant branch under Scene Explorer.

## Stage 1 - Generic Explorer Extension Hook

Add a generic way for external code to register custom UI panels.

Suggested API:

```ts
showLiteExplorer(context, {
  extensions: [
    instancerExplorer.extension
  ]
});
```

Suggested shape:

```ts
interface LiteExplorerExtension {
  id: string;
  title: string;
  side?: "left" | "right";
  order?: number;
  content: ComponentType;
}
```

Expected behavior:

- Explorer adds extension panels to its existing tab system.
- Extensions can choose left or right side.
- Existing Scene Explorer, Properties, and Tools tabs remain unchanged.
- Extension IDs must be unique.

Initial tests:

- Extension panel appears as a tab.
- Extension panel can be selected.
- Duplicate extension IDs are rejected or reported clearly.

## Stage 2 - Entity Row Actions

Add a hook for custom actions on Scene Explorer entity rows.

Current baseline:

- Scene Explorer can render command-backed row actions through `ExplorerCommand.rowAction`.
- The built-in mesh Delete button uses this path.
- This proves row actions should be command-backed so selected-bar actions, row actions, notifications, confirmation, refresh, and adapter calls can share one execution path.

Suggested API:

```ts
showLiteExplorer(context, {
  entityActions: [
    instancerExplorer.entityAction
  ]
});
```

Suggested shape:

```ts
interface LiteEntityAction {
  id: string;
  label: string;
  icon?: "instances" | "inspect" | "link";
  when(entity: LiteEntity, context: LiteExplorerContext): boolean;
  run(entity: LiteEntity, api: LiteExplorerExtensionApi): void | Promise<void>;
}
```

Suggested extension API:

```ts
interface LiteExplorerExtensionApi {
  openPanel(id: string): void;
  notify(message: string, tone?: "info" | "error"): void;
  refresh(): Promise<void>;
}
```

Instancer usage:

```ts
{
  id: "open-instancer",
  label: "Show instances",
  rowAction: { label: "Show instances", icon: "I" },
  when: (entity) => instancerExplorer.hasSetForEntity(entity),
  run: (entity, api) => {
    instancerExplorer.focusEntity(entity);
    api.openPanel("instancer");
  }
}
```

Expected Scene Explorer behavior:

- Mesh rows with registered instance sets show a compact instances icon.
- Rows without registered instance sets are unchanged.
- Clicking the icon does not select a different scene entity unless explicitly needed.
- Built-in Delete and Instancer `I` row actions use the same rendering and command dispatch path.

Initial tests:

- Action icon appears only for matching entities.
- Clicking action opens the target panel.
- Action receives the clicked entity.

## Stage 3 - Instancer Registry

Create an Instancer registry that apps/examples can populate explicitly.

Reason:

- Stable `InstanceId` values exist at the app/Instancer API layer.
- Babylon Lite thin-instance slots are not stable identity.
- Explorer must not infer stable IDs from mesh hierarchy, pools, or slot indices.

Suggested API:

```ts
const instancerAdapter = createInstancerExplorerAdapter();

instancerAdapter.register(boomboxes);
```

Optional registration config should be reserved for naming and edge cases:

```ts
instancerAdapter.register(boomboxes, {
  id: "boomboxes",
  label: "BoomBoxes"
});
```

Suggested internal record:

```ts
interface InstancerExplorerSet<TMetadata = unknown> {
  id: string;
  label: string;
  set: BaseInstanceSet<TMetadata>;
  kind?: "thin" | "hierarchy" | "vat" | "custom";
  sourceEntityId?: string;
  sourceMesh?: unknown;
  getLabel?: (
    id: InstanceId,
    metadata: TMetadata | undefined,
    slot: number | undefined
  ) => string;
  serializeMetadata?: (
    metadata: TMetadata | undefined,
    id: InstanceId
  ) => unknown;
}
```

Default inference:

- Thin instance set source is `set.mesh`.
- Hierarchy instance set source is `set.root`.
- VAT instance set source is `set.mesh`.
- Set labels can default from the source name or generated set ID.
- Instance labels can default from metadata fields such as `name`, `label`, or `title`, then fall back to `Instance ${Number(id)}`.

Registry responsibilities:

- Store registered sets by stable set ID.
- Validate duplicate set IDs.
- Resolve whether a Scene Explorer entity has related instances.
- Track the focused set for the Instancer panel.
- Group registered sets by original source mesh/root for the Instancer panel.
- Produce panel data from live `set.entries()`.

Initial tests:

- Duplicate set IDs fail clearly.
- Empty registry produces no entity actions.
- Registered set can be resolved from its source entity.
- Removed instances disappear on the next panel refresh.

## Stage 4 - Instancer Panel

Add a dedicated Instancer panel/tab.

Suggested layout:

```text
Instancer
  Original Mesh: BoomBox
    Set: Parked BoomBoxes
      Kind: hierarchy
      Count: 256
      Visible: 240
      Capacity: 512

      Instances
        BoomBox 1
        BoomBox 2
        BoomBox 3

    Set: Animated BoomBoxes
      Kind: vat
      Count: 24
      Visible: 24
      Capacity: 64

  Original Mesh: Tree
    Set: Forest
      Kind: thin
      Count: 1024
```

Panel hierarchy:

- Source/original mesh or root node.
- Registered instance sets belonging to that source.
- Stable instance rows inside each set.

Clicking the Scene Explorer `I` row action should:

- Open the Instancer panel.
- Expand or scroll to the matching source group.
- Focus the relevant registered set.

Set summary fields:

- Set ID
- Label
- Kind
- Count
- Visible count
- Capacity
- Source mesh/entity label, when available

Instance row fields:

- Stable instance ID
- Label
- Current slot
- Visible
- Metadata summary

Instance detail/edit fields:

- Stable ID, read-only
- Current slot, read-only
- Visible, editable
- Position, editable when the set supports it
- Metadata, read-only or serialized through `serializeMetadata`

Expected behavior:

- Opening from a Scene Explorer mesh focuses the matching set.
- If the source has multiple registered sets, show all of them under the source and focus the set chosen by the row action.
- If no set is focused, show a compact empty state.
- If the focused set disappears, show a clear stale/removed state.

Initial tests:

- Panel renders registered set summary.
- Panel lists instances by stable ID.
- Current slot is diagnostic only.
- Visibility edits call `setVisible(id, value)`.
- Position edits call `setPosition(id, value)`.

## Stage 5 - Optional Adapter Bridge

Keep the existing generic adapter composition as a lower-level hook, but do not use it as the primary Instancer UI.

Use cases:

- Non-visual custom scene data that really belongs in the tree.
- Lightweight entity providers without custom panels.
- Backward-compatible composition fallback.

For Instancer, prefer:

- Scene Explorer action icon
- Dedicated Instancer panel

Avoid:

- Adding every instance as a root branch in Scene Explorer by default.
- Creating giant instance lists inside the main scene tree.

## Stage 6 - Picking Integration

Picking is not required for the first Instancer panel version.

Later flow:

- Use existing picking registry to map picked mesh/slot to a registered set.
- Resolve slot to stable `InstanceId`.
- Open Instancer panel.
- Focus the corresponding instance row.

Requirements:

- Reverse map from `BaseInstanceSet` object to registered set ID.
- Reliable slot-to-ID lookup at pick time.
- Graceful handling when the picked slot no longer maps to a live instance.

## Stage 7 - Example Opt-In

Start with examples that already have meaningful instance labels or metadata:

- `boombox-grid`
- `boombox-picker`
- `primitive-box-field`
- `primitive-sphere-cloud`
- `basic-thin-instances`

Each example should opt in locally:

```ts
ctx.instancerExplorer.registerSet({
  id: "tiles",
  label: "Tiles",
  set: tiles,
  kind: "thin",
  sourceMesh: mesh,
  getLabel: (id, metadata) => metadata?.label ?? `Tile ${Number(id)}`
});
```

Do not require all examples to register sets immediately.

## Non-Goals

- Do not overload the Scene Explorer with all instance rows.
- Do not infer stable IDs from thin-instance slots.
- Do not treat slot numbers as persistent entity identity.
- Do not replace the default Babylon Lite Explorer adapter.
- Do not require picking in the first implementation.
- Do not make every example opt in at once.

## Open Questions

- Should extension panels appear on the right side by default, next to Properties and Tools?
- Should entity actions be icon-only, text-only, or icon with tooltip?
- Should the Instancer panel use Explorer property descriptors or its own compact table/editor controls?
- Should the registry live in examples first, or directly in `src/` as public package API?
- How should a registered set link to a Scene Explorer entity: source mesh object identity, Explorer entity ID, or both?
