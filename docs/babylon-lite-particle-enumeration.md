# Babylon Lite particle enumeration audit

Audited on 2026-07-10 against `@babylonjs/lite@1.9.0`.

## Summary

Babylon Lite 1.9.0 includes public particle runtime support, but it does not expose a public scene-level particle collection. Explorer cannot auto-discover particle systems from `SceneContext` without reading private renderable/update lists or receiving application-retained particle objects.

## Public particle support

The installed package publicly exports particle APIs:

```ts
parseNodeParticleSetFromSnippet(engine, scene, snippetId, options)
registerNodeParticleSet(scene, set, options)
animateParticleSystem(system, scaledRatio)
startParticleSystem(system)
stopParticleSystem(system)
createParticleBillboard(system)
syncParticleBillboard(system, billboard)
```

It also exposes public types including:

```ts
NodeParticleSet
ParticleSystem
Particle
ParseNodeParticleOptions
RegisterNodeParticleOptions
```

The intended flow is:

```txt
Node Particle Editor graph -> NodeParticleSet -> ParticleSystem[] -> billboard renderer -> scene registration
```

## Registration behavior

`registerNodeParticleSet(scene, set)` loops over `set.systems`. For each particle system it:

1. Creates a camera-facing billboard system with `createParticleBillboard(system)`.
2. Registers that billboard with `addFacingBillboardSystem(scene, billboard)`.
3. Optionally starts emission with `startParticleSystem(system)`.
4. Registers an `onBeforeRender()` callback that calls `animateParticleSystem()` and `syncParticleBillboard()`.

The billboard path ultimately registers deferred scene renderables, but the particle system itself is not added to a public `SceneContext` collection.

## Missing public scene enumeration

`SceneContext` in Lite 1.9.0 publicly exposes scene collections such as:

```ts
camera
lights
meshes
animationGroups
shadowGenerators
```

It does not expose:

```ts
particleSystems
nodeParticleSets
billboardSystems
spriteSystems
```

The particle registration path stores work through scene update/render internals such as before-render callbacks and deferred renderables. Explorer intentionally does not inspect those internals.

## Explorer behavior

The default adapter should not claim automatic particle discovery from a scene.

Good future integration options:

- Add adapter composition so applications can provide retained `NodeParticleSet` or `ParticleSystem` objects alongside default scene entities.
- Add an Explorer tool that loads a Node Particle snippet and retains the returned `NodeParticleSet` as an Explorer-known app-owned entity.
- Display app-provided particle systems read-only first: name, capacity, emit rate, alive particle count, target stop duration, running/stopped state, and texture presence.

Until Babylon Lite exposes a public scene collection for registered particle systems, scene-only particle enumeration is not available.
