# Apply public scene clip planes to built-in materials

Verified against `@babylonjs/lite` 1.8.0.

## Description

Babylon Lite publicly exposes `SceneContext.clipPlane` and `setClipPlane(scene, plane)`. The helper stores the plane and registers a writer for `scene.clipPlane` in the scene uniform buffer:

```ts
setClipPlane(scene, [0.5, 0.866, 0, -1.2]);
```

However, meshes using built-in PBR materials are not clipped. The same gap exists in the built-in Standard and Shader material paths.

In the published 1.8.0 package, the scene uniform declaration and UBO writer include `clipPlane`, but no PBR, Standard, or Shader material shader references it. The only material implementation that consumes the value is Node Material's `ClipPlanesBlock`.

## Expected result

Built-in materials should discard fragments on the configured side of the public scene plane, or the public API should clearly state which material families support it.

```ts
setClipPlane(scene, [0, 1, 0, -1]);

const mesh = createBox(engine, 2);
mesh.material = createPbrMaterial({
  baseColorFactor: [1, 0, 0, 1],
});
addToScene(scene, mesh);
```

The PBR box should be cut at `y = 1` after scene registration.

## Use case

Section views, CAD/BIM inspection, debugging tools, terrain slicing, and scene explorers need a scene-wide clipping plane that behaves consistently across built-in material families.
