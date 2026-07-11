# Babylon Lite Explorer User Guide

Babylon Lite Explorer inspects and safely edits Babylon Lite objects available through documented public APIs.

## Scene Explorer

The tree lists the public scene, camera, lights, meshes and transform hierarchy, materials, material textures, and animation groups. Select an item to inspect it.

- Use Search to filter entities by label.
- Use the arrow keys to move through and expand the tree.
- Enable Pick to select a mesh by clicking the canvas. Camera drags are ignored.
- Supported selection actions appear between the panes and status bar.

The Scene Explorer footer links to the User Guide, BabylonPress, and the project repository.

## Properties

Editable controls are shown only for verified public writes. Changes are applied to the scene and then read back through the adapter.

Properties for the selected scene, camera, mesh, transform, light, material, texture, or animation group refresh when application code changes that object outside Explorer.

When animation groups exist, the lowest Properties footer displays their count. Select **Animation Groups N** to open Scene Explorer, clear its filter, expand the relevant branch, select **Animation Groups**, and scroll it into view.

### Scene

Scene properties include clear color, fixed simulation delta, shadow-generator count, fog, clip plane, image-processing exposure and contrast, tone mapping, metadata, environment primary color, and environment Y rotation. Existing fog settings are editable; clip planes and shadow generators are currently diagnostic readouts.

Babylon Lite 1.10.0 exposes `setSceneImageProcessing()` updates for exposure, contrast, tone-mapping enabled state, and the Standard/ACES/Khronos PBR Neutral tone-mapping algorithm. Algorithm changes are visible when the selected algorithm is compiled into a fresh tone-mapped PBR pipeline; switching only the algorithm after a tone-mapped pipeline has already been cached can still reuse the previous shader in the current Lite package.

### Materials

PBR materials expose their factors and environment intensity. Standard materials expose their colors, alpha, specular power, and texture levels. The material family is inferred from documented public fields.

An empty PBR material has no public family discriminator and may therefore appear as **Undetermined / Custom**.

### Mesh deformation

The **Deformation** section reports **Skinned: Yes/No**, **Bone count**, **Morph targets: Yes/No**, **Morph target count**, and **Current weights**. Morph weights refresh while that mesh is selected. Skeletal animation usually deforms vertices through bone matrices without changing the mesh's own position, rotation, or scaling.

### Copying values

The copy button beside a property copies that value. The selection **Copy** action exports a safe public-property snapshot of the selected entity.

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
- Tone-mapping algorithm changes use Babylon Lite 1.10.0 `setSceneImageProcessing()`, but algorithm-only changes can reuse cached PBR WGSL after a tone-mapped pipeline already exists.
- Export Scene is a diagnostic JSON snapshot, not a scene serialization format.
- A custom adapter currently replaces the default adapter instead of extending it.
