# Babylon Lite agent plan: runtime tone-mapping updates

## Goal

Implement a public, scene-level API in the Babylon Lite fork that changes `toneMappingEnabled` and `toneMappingType` after scene registration and rebuilds every affected PBR rendering path without recreating the scene.

Target the current Lite fork API corresponding to `@babylonjs/lite` 1.8.0. Re-audit paths and names if the fork has moved ahead.

## Problem to reproduce first

PBR group construction currently reads:

```ts
scene.imageProcessing.toneMappingEnabled
scene.imageProcessing.toneMappingType
```

while `buildPbrRenderables()` composes its shader implementation. Its returned `rebuildSingle` closure retains that composition. `rebuildMaterial()` invokes the retained closure, so rebuilding individual materials cannot switch Standard/ACES or enable/disable tone mapping.

Add a failing integration test before implementation:

1. Create a scene with a factor-only PBR material.
2. Register the scene with tone mapping enabled and `"standard"`.
3. Change it through the proposed public API to `"aces"`.
4. Verify a new PBR pipeline/shader composition is built and used.
5. Repeat for enabled → disabled and disabled → enabled.

Do not test only the public object values; assert the effective renderer configuration or rendered output.

## Recommended public API

Prefer a focused async API:

```ts
export interface SceneImageProcessingUpdate {
  exposure?: number;
  contrast?: number;
  toneMappingEnabled?: boolean;
  toneMappingType?: "standard" | "aces";
}

export async function setSceneImageProcessing(
  scene: SceneContext,
  update: SceneImageProcessingUpdate,
): Promise<void>;
```

Rationale:

- ACES code is dynamically imported, so the operation can require asynchronous work.
- Exposure and contrast remain UBO-only updates.
- Compile-time tone-mapping changes are handled in one documented path.
- Callers do not need to know which material families or frame-graph tasks require rebuilding.

Keep direct mutation available only if backward compatibility requires it, but document that compile-time fields become effective at runtime through `setSceneImageProcessing()`.

## Implementation plan

### 1. Separate runtime values from the compile signature

In the PBR renderer, derive a small immutable signature:

```ts
type PbrSceneShaderConfig = {
  toneMappingEnabled: boolean;
  toneMappingType: "standard" | "aces";
  fogEnabled: boolean;
  environmentEnabled: boolean;
};
```

Use the signature as the explicit input to shader composition. Avoid allowing closures to capture scattered mutable scene fields implicitly.

Likely fork files:

- `src/material/pbr/pbr-renderable.ts`
- `src/material/pbr/pbr-material.ts`
- PBR composer/template modules

### 2. Add a scene-local PBR group rebuild

Implement an internal async operation that rebuilds the complete PBR group for one scene from `scene._groups`, rather than calling the old per-mesh `rebuildSingle` closure.

The operation must:

1. Find the scene's PBR material group, including material views that use the PBR builder.
2. Build the replacement group with the new scene shader signature.
3. Dispose old per-mesh PBR resources only after the replacement build succeeds.
4. Replace the affected main-scene renderables and uniform updater without duplicating either.
5. Preserve render order.
6. Increment the appropriate renderable/material versions.
7. Rebuild frame-graph task bindings that retained old PBR renderables.

Do not solve this by resetting a module-global builder closure. The PBR group builder is shared, and mutable `_rebuildSingle` state can leak between multiple registered scenes. Store rebuild state per scene/group or return it from the group build and register it on scene-owned state.

Likely fork files:

- `src/scene/scene-core.ts`
- `src/material/material-rebuild.ts`
- `src/scene/scene-material-swap.ts`
- `src/frame-graph/*` where tasks retain renderables/bindings

### 3. Implement `setSceneImageProcessing()`

Behavior:

- Validate all supplied values before mutation.
- Apply `exposure` and `contrast` without pipeline rebuilding.
- Normalize absent `toneMappingType` to `"standard"` consistently.
- Compare the old and new compile signature.
- If the compile signature is unchanged, return without rebuilding.
- If the scene is not built/registered yet, update the configuration only; initial registration will consume it.
- If the scene is built, await the scene-local PBR rebuild.
- If rebuilding fails, restore the previous public configuration and keep the old renderables usable.

The call should be safe when the scene contains no PBR meshes.

### 4. Cover all retained rendering paths

Audit more than `scene._renderables`:

- default scene render task;
- explicit render tasks with mesh lists;
- material views;
- shadow/depth/geometry views where tone mapping should not be injected;
- multiple surfaces or scenes sharing an engine;
- material swaps after the update;
- meshes added after the update.

Tone mapping belongs in the color output path. Confirm that shadow, depth, normal, and geometry outputs remain unaffected.

### 5. Preserve tree shaking

ACES WGSL must remain absent from bundles that never enable ACES.

Verify:

- Standard-only scene does not eagerly import ACES helpers.
- Calling the API with `toneMappingType: "aces"` dynamically loads ACES support.
- Switching back to Standard does not require retaining stale ACES pipeline objects beyond normal GPU cache behavior.

## Required tests

### Unit tests

- update validation and normalization;
- no-op update does not rebuild;
- exposure/contrast-only update does not rebuild;
- pre-registration update does not build early;
- failed rebuild rolls back public state;
- empty/non-PBR scene succeeds.

### Renderer integration tests

- Standard → ACES;
- ACES → Standard;
- disabled → Standard;
- disabled → ACES;
- enabled → disabled;
- factor-only `createPbrMaterial()`;
- textured PBR;
- PBR material view;
- two scenes on one engine with different tone-mapping modes;
- material swap and mesh addition after a runtime update;
- shadow-enabled scene;
- explicit frame-graph render task if supported by the test harness.

### Visual/parity test

Render the same high-dynamic-range PBR scene before and after switching Standard/ACES. Assert that:

- pixels change after the awaited API call;
- switching back reproduces the original result within the test tolerance;
- the change appears on the first frame rendered after the promise resolves.

## Documentation changes in the Lite fork

- Document which image-processing fields are UBO-time versus pipeline-time.
- Add a runtime switching example.
- State that callers must await tone-mapping changes.
- Update API reports and changelog.
- If direct assignment remains supported syntactically, explain why the setter API is required for an already-built scene.

## Acceptance criteria

- A registered PBR scene visibly switches between disabled, Standard, and ACES tone mapping without scene recreation.
- The public promise resolves only when the next render uses the new configuration.
- No private fields are required by applications or tools.
- Two scenes can use different modes without cross-scene builder contamination.
- Existing material rebuild, swap, shadow, and frame-graph tests remain green.
- Standard-only bundles retain their existing tree-shaking behavior.

## Out of scope

- General post-processing architecture redesign.
- Automatic observation of arbitrary direct mutations to `scene.imageProcessing`.
- Changing exposure or contrast into compile-time options.
- Adding tone mapping to non-color passes.

## Suggested execution order

1. Add failing effective-render tests.
2. Introduce the explicit PBR scene shader signature.
3. Remove module-global/per-scene rebuild ambiguity.
4. Implement atomic scene-local PBR group replacement.
5. Add and export `setSceneImageProcessing()`.
6. Rebuild retained frame-graph bindings.
7. Complete multi-scene, material-view, shadow, and visual tests.
8. Update docs, API report, and changelog.
