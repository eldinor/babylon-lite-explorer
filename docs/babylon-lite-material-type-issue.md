# Expose a public material-family discriminator on `Material`

Verified against `@babylonjs/lite` 1.8.0.

## Description

Babylon Lite materials are plain objects, but the public `Material` interface exposes only `name` and `metadata`; it does not expose their concrete family (`PBR`, `Standard`, `Shader`, or `Node`).

This becomes ambiguous when a material is created without explicit properties:

```ts
const material = createPbrMaterial();
```

The returned object contains no public PBR-specific fields. External tools cannot distinguish it from another object that only satisfies the base `Material` interface without inspecting private implementation fields.

In Lite 1.8.0, the internal group builders carry a `_materialFamily` value (`"pbr"`, `"standard"`, `"shader"`, or `"node"`). However, that value is reachable only through the private `_buildGroup` implementation path and neither field is part of the public `Material` declaration. Treating it as public would therefore couple tools to renderer internals.

A configured material can be identified structurally:

```ts
createPbrMaterial({
  baseColorFactor: [1, 1, 1, 1],
  metallicFactor: 1,
  roughnessFactor: 1,
});
```

However, structural detection fails when optional properties are omitted.

## Use case

Scene explorers, debugging tools, serializers, and application diagnostics need to display the material family while relying exclusively on public APIs.

## Suggested API

Add a stable, read-only discriminator:

```ts
interface Material {
  name?: string;
  metadata?: LiteMetadata;
  readonly materialType: "pbr" | "standard" | "shader" | "node" | "custom";
}
```

Alternatively:

```ts
function getMaterialType(material: Material): MaterialType;
```

Material views could expose `"view"` separately or report the family of their public `source`.

## Expected result

```ts
const material = createPbrMaterial();
console.log(material.materialType); // "pbr"
```

This would prevent external tools from relying on private renderer fields or unreliable property-shape heuristics.
