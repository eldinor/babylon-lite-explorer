# Instancer Adapter

The Instancer adapter adds a dedicated **Instancer** tab for applications that use `@litools/instancer`. It keeps the regular Scene Explorer focused on real scene objects while letting users inspect, pick, edit, reset, and export registered instance sets.

## Setup

Create one adapter, register each set, and pass it through `adapters`.

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
  {
    adapters: [instancerAdapter],
    features: { canvasPicking: true },
    userSettings: {
      picking: { enabled: true },
      instancer: { pickMode: "instance" },
    },
  },
);
```

`register(set)` should be called with the Instancer set object. The adapter derives the original/source mesh from the set shape and uses metadata labels when available.

## Scene Explorer Integration

Registered source meshes stay in the normal Scene Explorer. If a mesh has registered Instancer sets, its row shows an `I` action. Clicking it opens the **Instancer** tab focused on that source.

The Instancer tab has its own tree:

- Source/original meshes are top-level parents.
- Registered sets appear under each source.
- Stable instance rows appear under each set.

Selecting an Instancer source or set shows a clickable **Source** property. Clicking the source name selects the real mesh in Scene Explorer.

## Pick Mode

Enable canvas picking with `features.canvasPicking: true`. The Pick toggle is off by default unless `userSettings.picking.enabled` is true.

Instancer pick mode is controlled by:

```ts
userSettings: {
  instancer: { pickMode: "instance" },
}
```

Modes:

- `"instance"` selects the stable Instancer instance row and switches to the Instancer tab.
- `"source"` lets the normal Scene Explorer picker select the source mesh.

If the Instancer adapter is not registered at all, Explorer picking selects the source mesh as usual.

Users can change this live from the footer gear in **User Settings > Instancer**.

## Editable Properties

The adapter exposes only operations supported by the registered set:

| Property | Required set API |
| --- | --- |
| Visible | `getVisible(id)`, `setVisible(id, visible)` |
| Position | `getPosition(id)`, `setPosition(id, position)` |
| Rotation | `getMatrix(id)`, `setTransform(id, { rotationEuler })` |
| Scaling | `getMatrix(id)` plus `setScale(id, scale)` or `setTransform(id, { scale })` |
| Color | `getColor(id)`, `setColor(id, color)` |
| VAT clip | `getClip(id)` |
| Metadata | `metadata`, `getMetadata(id)`, or `serializeMetadata` |

Babylon Lite thin-instance color is multiplied with the source material color. For visible color edits, use neutral source materials such as white PBR or Standard-style materials.

## Save Set

Selecting a set shows **Save Set** in the selected-entity action bar. It opens choices for:

- **Copy JSON**
- **Copy Instancer Code**
- **Download JSON**
- **App Save**, enabled when the set was registered with `saveSet`

Applications can also export directly:

```ts
const snapshot = instancerAdapter.exportSet(redBoxes);
```

The snapshot includes:

- Set id, label, kind, count, visible count, and capacity
- Source mesh label and public source transform
- Stable instance ids and current slots
- Labels, visibility, position, derived Euler rotation, derived scale
- Optional colors, VAT clips, matrices, and serialized metadata

The top-level snapshot `id` is Explorer/application identity for the registered set. It is not used by `@litools/instancer` to recreate instances. Recreated instances receive new Instancer ids, so generated code keeps an old-to-new id map:

```ts
const restoredIds = new Map<number, number>();

for (const placement of placements) {
  const id = instancerSet.create(placement.transform, placement.metadata);
  restoredIds.set(placement.id, id);
  if (placement.color) instancerSet.setColor?.(id, placement.color);
  if (placement.visible !== undefined) instancerSet.setVisible(id, placement.visible);
}
```

## Reset

The adapter captures a baseline snapshot when each set is registered.

- **Reset** restores the selected live instance from the registration-time baseline.
- **Reset Set** restores all live instances in the selected set.

Reset restores values through the set write APIs. It does not recreate instances that application code removed after registration.

## Register Options

```ts
instancerAdapter.register(set, {
  id: "red-boxes",
  label: "Red Boxes",
  getLabel: (id, metadata, slot) => metadata?.label ?? `Instance ${id}`,
  serializeMetadata: (metadata, id) => metadata,
  saveSet: async (snapshot) => {
    await saveSnapshot(snapshot);
  },
});
```

Options:

| Option | Purpose |
| --- | --- |
| `id` | Stable Explorer/application id for this registered set |
| `label` | Display label for the set |
| `getLabel` | Custom instance label resolver |
| `serializeMetadata` | Converts metadata before showing/exporting it |
| `saveSet` | Optional application save callback used by **App Save** |

## Example

The repository includes a complete example in `examples/instancer-adapter`. It registers two colored thin-instance sets, starts Pick enabled, shows source links, and demonstrates Save Set export choices.
