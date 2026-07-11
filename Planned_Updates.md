# Planned Updates

This roadmap covers only `babylon-lite-explorer`. Changes to Babylon Lite itself are out of scope and will be adopted after they are published by the Lite team.

## Next

### Metadata viewer

- Display public `metadata` on scene nodes, materials, and animation groups.
- Format `metadata.gltf.extras` as readable, copyable JSON.
- Keep metadata read-only in the default adapter.
- Handle cyclic or unsupported values without stringifying source objects directly.
- Add adapter and UI tests.

### Animation details

- Display `targetedAnimations` for each animation group.
- Show target name, animated property, data type, key count, and frame range where publicly available.
- Display animation-mask mode and retained target names.
- Keep playback targets and masks read-only initially.
- Add coverage using an animated GLB and adapter fixtures.

### Morph-weight editing

- Replace the read-only combined weight string with one numeric control per morph target.
- Apply changes through public `setMorphTargetWeights()`.
- Validate finite values and preserve the complete weight array on each edit.
- Keep live refresh while the mesh is selected.
- Add runtime and adapter tests.

## Later

### Fog controls

- Add an explicit Enable Fog action for scenes where `scene.fog` is `null`.
- Add Disable Fog when Babylon Lite exposes a documented removal path or after verified runtime behavior.
- Retain `setFog()` for all enabled-fog writes.

### Material plugin diagnostics

- Show plugin name, enabled state, priority, and defines.
- Display declared uniforms and samplers as read-only diagnostics.
- Do not mutate pipeline-affecting plugin state until a safe public rebuild workflow is verified.

### GPU timing controls

- Add an opt-in GPU timing toggle.
- Clearly distinguish browser frame interval, CPU timing, total GPU frame time, and render-task GPU timing.
- Avoid enabling GPU timing automatically.
- Handle unsupported devices without errors.

### Texture UV editing

- Track every discovered material usage of each texture.
- Edit public UV scale, offset, angle, and `invertY` only where supported.
- Rebuild every consuming material after build-time texture-field changes.
- Warn when complete usage tracking cannot be guaranteed.
- Keep source previews unavailable until Babylon Lite exposes public source or readback data.

### Shadow diagnostics

- Continue showing the public shadow-generator count.
- Show light/caster relationships only when reachable through public objects retained by the application.
- Do not inspect opaque `ShadowGenerator` internals.

### Adapter composition

- Allow registered application entities to extend the default adapter instead of replacing it.
- Preserve stable identity and capability boundaries across composed adapters.
- Use composition for application-retained environments, particle sets, frame-graph tasks, and other non-enumerable public objects.

## External API follow-up

These are not implementation tasks in this repository:

- PBR and Standard clip-plane rendering support.
- Public cache-safe PBR tone-mapping algorithm updates after scene registration.
- Public material-family discriminator.
- Public environment enumeration and texture source/readback metadata.
- Public particle-system enumeration for scene-registered particle sets.
- Public frame-graph task enumeration.

When a new Babylon Lite release provides one of these capabilities:

1. Upgrade the dependency and lockfile.
2. Re-audit the installed declarations and implementation.
3. Update `docs/babylon-lite-api-inventory.md`.
4. Replace the corresponding Explorer limitation with a public-API implementation.
5. Add focused regression tests and a demo scene where appropriate.

## Maintenance

- Keep the default adapter free of underscore-prefixed Babylon Lite fields.
- Run typecheck, tests, npm build, and demo build before release.
- Keep examples deployable under both local development and relative production base paths.
- Update the user guide whenever editable behavior or a public-API limitation changes.
