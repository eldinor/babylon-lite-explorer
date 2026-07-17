# Babylon Lite Explorer User Guide

Babylon Lite Explorer inspects and safely edits Babylon Lite objects available through documented public APIs.

## Scene Explorer

The tree lists the public scene, camera, lights, meshes and transform hierarchy, materials, material textures, and animation groups. Select an item to inspect it.

- Use Search to filter entities by label.
- Use the arrow keys to move through and expand the tree.
- Enable Pick to select a mesh by clicking the canvas. Camera drags are ignored. Registered Instancer thin instances can also be selected by Pick when the adapter can map Babylon Lite's `thinInstanceIndex` back to a stable instance entry.
- Supported selection actions appear between the panes and status bar.
- Meshes can be deleted from the selected-entity bar or the red row action. Set `confirmEntityRemoval: true` or `userSettings.deletion.confirmEntityRemoval: true` to ask before deletion; the default is `false`. Transform node, light, and camera deletion is not shown until Babylon Lite exposes an official public removal API for those entity types.

The Scene Explorer footer opens User Settings from the gear button and links to the User Guide, BabylonPress, and the project repository.

## Properties

Editable controls are shown only for verified public writes. Changes are applied to the scene and then read back through the adapter.

Properties for the selected scene, camera, mesh, transform, light, material, texture, or animation group refresh when application code changes that object outside Explorer.

When animation groups exist, the lowest Properties footer displays their count. Select **Animation Groups N** to open Scene Explorer, clear its filter, expand the relevant branch, select **Animation Groups**, and scroll it into view.

### Scene

Scene properties include clear color, fixed simulation delta, shadow-generator count, fog, clip plane, image-processing exposure and contrast, tone mapping, metadata, environment primary color, and environment Y rotation. Existing fog settings are editable; clip planes and shadow generators are currently diagnostic readouts.

Babylon Lite 1.11.0 exposes `setSceneImageProcessing()` updates for exposure, contrast, tone-mapping enabled state, and the Standard/ACES/Khronos PBR Neutral tone-mapping algorithm. Algorithm changes are visible when the selected algorithm is compiled into a fresh tone-mapped PBR pipeline; switching only the algorithm after a tone-mapped pipeline has already been cached can still reuse the previous shader in the current Lite package.

### Materials

PBR and Standard materials are supported through their documented public fields. PBR materials expose their factors and environment intensity. Standard materials expose their colors, alpha, specular power, and texture levels. The material family is inferred from documented public fields.

Babylon Lite 1.11.0 exposes official material-family detection, so even an otherwise empty PBR material is identified as **PBR**.

### Mesh deformation

The **Deformation** section reports **Skinned: Yes/No**, **Bone count**, **Morph targets: Yes/No**, **Morph target count**, and **Current weights**. Morph weights refresh while that mesh is selected. Skeletal animation usually deforms vertices through bone matrices without changing the mesh's own position, rotation, or scaling.

### Copying values

The copy button beside a property copies that value. The selection **Copy** action exports a safe public-property snapshot of the selected entity.

## Instancer

Applications can add an Instancer tab with `createInstancerExplorerAdapter()` and explicit `instancerAdapter.register(set)` calls. Install the optional `@litools/instancer@^0.3.1` peer for official thin, hierarchy, VAT, and multi-part VAT character support. Scene Explorer stays focused on scene objects; registered sources get an `I` row action that opens the Instancer tab. See the [Instancer Adapter guide](instancer-adapter.md) for setup and API details.

The Instancer tab is a tree:

- Source/original mesh rows are parents.
- Registered sets appear under their source.
- Stable instance rows appear under each set.
- VAT sets include an **Animations** branch with inline Play/Pause controls.

Selecting a source, set, or instance updates the Properties panel. Source properties are clickable and select the real mesh in Scene Explorer. Instance visibility, position, rotation, scaling, color, VAT clip, and metadata are shown or edited only when the registered set exposes the needed public methods.

For VAT sets, select the set to change the shared active clip, expand **Animations** to inspect available clips, and use the inline action to play or pause. Pause requires the application to connect the adapter's playback callbacks to the same state that guards its VAT `update()` call. Animation groups consumed only for VAT baking should be removed from `scene.animationGroups`; ordinary non-Instancer animation groups remain in Scene Explorer.

See [VAT Character and Sword Instancer Example](instancer-vat-example.md) for a complete end-user setup.

When Pick is enabled, Instancer pick mode controls what canvas clicks select. `"instance"` selects the stable instance row and switches to the Instancer tab. `"source"` selects the source mesh through the normal Scene Explorer picker. Without a registered Instancer adapter, Explorer picking selects the source mesh.

Selecting a set shows **Save Set** in the selected-entity action bar. The action opens choices to copy JSON, copy Instancer placement code, download JSON, or call the app's optional `saveSet` callback. **Reset** restores a selected instance from the registration-time baseline, and **Reset Set** restores all live instances in the selected set. Reset does not recreate instances removed by application code after registration.

## Tools

### Upload GLB

**Upload GLB** loads a self-contained local `.glb` through Babylon Lite and adds its asset container to the current scene.

### Export Scene

**Export Scene** downloads a JSON inspection snapshot containing the public values visible to the Explorer. It is not a `.babylon` or GLB file and cannot reconstruct the scene. Babylon Lite does not currently expose a public scene serializer.

## Status bar statistics

**FPS** and **Frame interval** are calculated from the average time between browser `requestAnimationFrame` callbacks, sampled over 500 ms. They reflect display refresh and VSync as well as application load; neither is CPU or GPU render duration. For example, `6.9 ms` is approximately 145 FPS.

**GPU** is shown separately only when Babylon Lite GPU timing is enabled and reports a positive measurement. The Explorer does not enable GPU timing automatically. Draw, mesh, and light values come from the current Babylon Lite engine and scene.

## Layouts and themes

**Single** stacks Scene Explorer above the right-side Properties and Tools tabs. Drag the divider to resize the panes.

**Split** docks Scene Explorer at the left and Properties or Tools at the right, leaving the canvas interactive between them.

Dark and light themes, the selected layout, and the Single divider position are stored locally in the browser.

## User Settings

Open the footer gear to change live Explorer settings. The modal currently exposes theme, layout, Pick, delete confirmation, and an adapter-specific **Instancer** section for Instancer pick mode. Future custom adapter settings should follow the same titled-section pattern.

Initial settings can be supplied with `userSettings`:

```ts
showLiteExplorer(context, {
  features: { canvasPicking: true },
  userSettings: {
    picking: { enabled: false },
    deletion: { confirmEntityRemoval: false },
    instancer: { pickMode: "instance" },
    ui: { theme: "dark", layout: "single" },
  },
});
```

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+L` | Switch layout |
| `Ctrl+Shift+Y` | Switch theme |
| `Ctrl+Shift+E` | Show or hide Explorer |
| `Ctrl+Shift+F` | Focus scene search |
| `Escape` | Clear selection while focus is inside Explorer |

Keyboard shortcuts can be disabled with `keyboardShortcutsEnabled: false`.

## Environment textures

Babylon Lite's environment loaders return a public `EnvironmentTextures` object, but `SceneContext` has no public environment-texture field, presence flag, or general texture collection. The Explorer therefore cannot determine from the scene alone whether an environment is loaded.

The default adapter intentionally does not inspect private state such as `_envTextures`. Applications can retain the value returned by `loadEnvironment()`, but adding that object alongside automatically discovered entities requires the planned adapter-composition support.

Environment intensity is a per-PBR-material property rather than a scene-level setting.

## Current limitations

- The default adapter never reads underscore-prefixed or otherwise private Babylon Lite state.
- Environment textures cannot be discovered from the public scene.
- Original texture URLs and preview pixels are not retained through the current public texture API.
- Empty PBR materials cannot be reliably distinguished from custom empty materials.
- Tone-mapping algorithm changes use Babylon Lite 1.11.0 `setSceneImageProcessing()`, but algorithm-only changes can reuse cached PBR WGSL after a tone-mapped pipeline already exists.
- Export Scene is a diagnostic JSON snapshot, not a scene serialization format.
- A custom adapter currently replaces the default adapter instead of extending it.
