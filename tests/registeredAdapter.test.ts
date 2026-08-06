import { describe, expect, it, vi } from "vitest";
import { createRegisteredSceneAdapter } from "../src/adapter/registered/createRegisteredSceneAdapter";

const context = { scene: {}, engine: {} };
const texture = (extra: Record<string, unknown> = {}) => ({
  width: 256, height: 128, texture: {}, view: {}, sampler: {},
  uScale: 2, vOffset: 0.25, invertY: true, ...extra
});

describe("registered scene adapter textures", () => {
  it.each([
    ["texture2d", "Texture2D"],
    ["dynamic", "Dynamic Texture2D"],
    ["html", "HTML Texture2D"]
  ] as const)("classifies an explicitly registered %s texture", async (textureType, label) => {
    const adapter = createRegisteredSceneAdapter({
      getEntities: () => [{ id: textureType, kind: "texture", label, source: texture(), textureType }]
    });
    const [entity] = await adapter.getSceneTree(context);
    expect(await adapter.getProperties(entity, context)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "$textureType", value: label }),
      expect.objectContaining({ path: "width", value: 256 }),
      expect.objectContaining({ path: "uScale", value: 2 }),
      expect.objectContaining({ path: "invertY", value: true })
    ]));
  });

  it("auto-detects array textures and exposes layers", async () => {
    const adapter = createRegisteredSceneAdapter({
      getEntities: () => [{ id: "array", kind: "texture", label: "Array", source: texture({ layers: 6 }) }]
    });
    const [entity] = await adapter.getSceneTree(context);
    expect(await adapter.getProperties(entity, context)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "$textureType", value: "Texture2D Array" }),
      expect.objectContaining({ path: "layers", value: 6 })
    ]));
  });

  it("honors an explicit generic override for a source with layers", async () => {
    const adapter = createRegisteredSceneAdapter({
      getEntities: () => [{ id: "generic", kind: "texture", label: "Generic", source: texture({ layers: 2 }), textureType: "texture2d" }]
    });
    const [entity] = await adapter.getSceneTree(context);
    const properties = await adapter.getProperties(entity, context);
    expect(properties).toContainEqual(expect.objectContaining({ path: "$textureType", value: "Texture2D" }));
    expect(properties.some((property) => property.path === "layers")).toBe(false);
  });

  it("rejects invalid texture classifications", async () => {
    const nonTexture = createRegisteredSceneAdapter({
      getEntities: () => [{ id: "mesh", kind: "mesh", label: "Mesh", source: texture(), textureType: "dynamic" }]
    });
    expect(() => nonTexture.getSceneTree(context)).toThrow("only valid for texture entities");

    const missingShape = createRegisteredSceneAdapter({
      getEntities: () => [{ id: "dynamic", kind: "texture", label: "Dynamic", source: {}, textureType: "dynamic" }]
    });
    expect(() => missingShape.getSceneTree(context)).toThrow("public Texture2D shape");

    const invalidArray = createRegisteredSceneAdapter({
      getEntities: () => [{ id: "array", kind: "texture", label: "Array", source: texture({ layers: 0 }), textureType: "array" }]
    });
    expect(() => invalidArray.getSceneTree(context)).toThrow("positive integer layers");
  });

  it("keeps generic registrations and custom property providers unchanged", async () => {
    const getProperties = vi.fn(() => [{ kind: "readonly" as const, path: "custom", label: "Custom", value: "yes" }]);
    const custom = createRegisteredSceneAdapter({
      getEntities: () => [{ id: "html", kind: "texture", label: "HTML", source: texture(), textureType: "html" }],
      getProperties
    });
    const [customEntity] = await custom.getSceneTree(context);
    expect(await custom.getProperties(customEntity, context)).toEqual([{ kind: "readonly", path: "custom", label: "Custom", value: "yes" }]);

    const generic = createRegisteredSceneAdapter({ getEntities: () => [{ id: "unknown", kind: "texture", label: "Unknown", source: {} }] });
    const [genericEntity] = await generic.getSceneTree(context);
    expect((await generic.getProperties(genericEntity, context)).map((property) => property.path)).toEqual(["$kind", "$id"]);
  });
});
