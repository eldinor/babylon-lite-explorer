# Node Material example

This note explains how the `node-material` demo scene is built, why its Node Material code is kept separate from the rest of the scene, and what we observed when the Node Material worked in dev but failed in the production demo build.

## Goal

The example shows two meshes:

- a regular orange PBR box
- a blue torus using a Babylon Lite Node Material

The regular box is useful as a control object. If the box appears but the torus does not, the scene, camera, light, engine, and Explorer are working; the problem is isolated to Node Material creation.

## Scene setup

The main scene is built in `examples/node-material/src/main.ts`.

It does the normal Babylon Lite setup:

1. finds the canvas
2. creates the WebGPU engine
3. creates a scene context
4. creates and attaches an arc rotate camera
5. adds a hemispheric light
6. creates a regular PBR box
7. tries to load and add the Node Material torus
8. registers and starts the scene
9. opens Babylon Lite Explorer

The regular box is created with:

```ts
const box = createBox(engine, 1.25);
box.name = "Regular PBR Box";
box.position.x = 1.2;
box.material = createPbrMaterial({
  name: "Regular PBR Material",
  baseColorFactor: [1, 0.25, 0.08, 1],
  metallicFactor: 0.1,
  roughnessFactor: 0.4,
});
addToScene(scene, box);
```

This proves the basic scene renders even if Node Material creation fails.

## Why the Node Material code is dynamically imported

The Node Material part is loaded like this:

```ts
try {
  const { createNodeMaterialTorus } = await import("./createNodeMaterialTorus");
  addToScene(scene, await createNodeMaterialTorus(engine));
} catch (error) {
  console.error("Could not create the Node Material torus.", error);
}
```

This is intentional.

Node Material parsing pulls in more Babylon Lite shader/node code than a normal mesh or PBR material. In a production build, keeping it in a separate async chunk makes the example easier to diagnose:

- if the lazy Node Material chunk loads and works, both meshes appear
- if the lazy chunk loads but material parsing fails, the orange box and Explorer still appear
- if the whole scene fails, the problem is probably not limited to Node Material

So the split is not just an optimization. It is also a safety boundary around experimental or heavier material code.

## Node Material graph

The Node Material graph is defined in `examples/node-material/src/createNodeMaterialTorus.ts`.

It is an inline graph passed to Babylon Lite:

```ts
const material = await parseNodeMaterialFromSnippet(engine, "inline", { json: graph });
material.name = "Blue Node Material";
```

The graph is intentionally minimal. It has:

- `position` input
- `worldViewProjection` system input
- `TransformBlock`
- `VertexOutputBlock`
- constant blue `Color` input
- `FragmentOutputBlock`

In plain words: the vertex shader transforms mesh positions to screen space, and the fragment shader outputs a fixed blue color.

## Mesh creation

After the material is parsed, the example creates a torus and assigns the material:

```ts
const torus = createTorus(engine, { diameter: 2, thickness: 0.55, tessellation: 48 });
torus.name = "Node Material Torus";
torus.position.x = -1.2;
torus.material = material;
return torus;
```

The torus is placed to the left, while the regular PBR box is placed to the right.

## What this example helps test

This scene is useful for checking:

- whether Babylon Lite Node Material parsing works in dev
- whether Node Material parsing works after Vite production build
- whether dynamic chunks are loaded correctly from the deployed demo
- whether Explorer can show a scene even when one optional material path fails

If the orange box appears but the blue torus does not, check the browser console first. The likely failure point is `parseNodeMaterialFromSnippet()` or the dynamically loaded Node Material chunk.

## Why Node Material did not work in the production build

Short version: we do not yet know the exact internal cause. What we know is that the failure is isolated to the Babylon Lite Node Material path, not to the whole scene, WebGPU, routing, or Explorer.

Observed behavior:

- the `node-material` example worked in Vite dev mode
- the same example did not render correctly in the production demo build
- other examples in the same production build worked
- when the Node Material code was removed, the `node-material` scene rendered again and showed the regular orange PBR box
- after adding the orange PBR box beside the Node Material torus, the box became a control object for checking whether the scene itself is alive

That means the important difference is not "this route cannot load" or "the engine cannot render". The important difference is "production build + Node Material parsing/compilation".

The suspected area is:

```ts
const material = await parseNodeMaterialFromSnippet(engine, "inline", { json: graph });
```

or something that this call depends on internally, for example:

- registration of Node Material block classes after bundling
- shader/node compiler code being tree-shaken or moved into a production chunk in a way Babylon Lite does not expect
- a difference between dev ESM execution and production Rollup output
- a missing runtime side effect required by `parseNodeMaterialFromSnippet()`
- a production-only error while compiling or binding the generated shader

The dynamic import was added as a diagnostic and safety step:

```ts
try {
  const { createNodeMaterialTorus } = await import("./createNodeMaterialTorus");
  addToScene(scene, await createNodeMaterialTorus(engine));
} catch (error) {
  console.error("Could not create the Node Material torus.", error);
}
```

This lets the rest of the scene continue even if the Node Material path fails. It also makes the production build easier to inspect: the regular scene entry and the Node Material code are separated into different chunks.

## Notes for Babylon Lite team

This is the issue I would ask the Lite team about:

### Title

`parseNodeMaterialFromSnippet(engine, "inline", { json })` works in Vite dev but fails after production build

### Environment

- package: `@babylonjs/lite`
- version tested: `1.4.0`
- bundler: Vite production build
- app: Babylon Lite Explorer demo
- rendering backend: WebGPU

### Reproduction shape

The scene creates a normal Babylon Lite engine, scene, camera, and light. A regular PBR box renders correctly.

Then it creates a Node Material from an inline graph:

```ts
const material = await parseNodeMaterialFromSnippet(engine, "inline", { json: graph });
```

The graph is very small:

- `InputBlock` for position
- `InputBlock` for world-view-projection system value
- `TransformBlock`
- `VertexOutputBlock`
- constant color `InputBlock`
- `FragmentOutputBlock`

The material is assigned to a torus:

```ts
const torus = createTorus(engine, { diameter: 2, thickness: 0.55, tessellation: 48 });
torus.material = material;
```

### Expected result

The production build should render the regular PBR box and the blue Node Material torus, same as dev mode.

### Actual result

In dev mode the scene works. In the production demo build, the Node Material path prevents the expected Node Material mesh from appearing. Removing the Node Material code makes the scene render again.

### Question

Is `parseNodeMaterialFromSnippet(engine, "inline", { json })` expected to work in a Vite/Rollup production build with `@babylonjs/lite@1.4.0`?

If yes, is there a required import, registration step, side-effect import, or build configuration needed for Node Material blocks/shader compilation to survive production bundling?

If no, what is the recommended public API path for creating a Node Material from an inline graph in a bundled application?
