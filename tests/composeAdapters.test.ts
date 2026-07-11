import { describe, expect, it, vi } from "vitest";
import { composeLiteSceneAdapters } from "../src/adapter/composeLiteSceneAdapters";
import type { LiteEntity, LiteSceneAdapter } from "../src/adapter/LiteSceneAdapter";
import type { PropertyDescriptor } from "../src/adapter/propertyDescriptors";

const capabilities = { editable: false, focusable: false, visibilityToggle: false, serializableSnapshot: false };

function entity(id: string, label = id): LiteEntity {
  return { id, label, kind: "unknown", source: {}, capabilities };
}

describe("composeLiteSceneAdapters", () => {
  it("concatenates roots and routes properties to the owning adapter", async () => {
    const firstEntity = entity("first");
    const secondEntity = entity("second");
    const firstProperties: PropertyDescriptor[] = [{ kind: "readonly", path: "owner", label: "Owner", value: "first" }];
    const secondProperties: PropertyDescriptor[] = [{ kind: "readonly", path: "owner", label: "Owner", value: "second" }];
    const first: LiteSceneAdapter = {
      getSceneTree: () => [firstEntity],
      getProperties: vi.fn(() => firstProperties)
    };
    const secondGetProperties = vi.fn(() => secondProperties);
    const second: LiteSceneAdapter = {
      getSceneTree: () => [secondEntity],
      getProperties: secondGetProperties
    };
    const adapter = composeLiteSceneAdapters([first, second]);
    const context = { scene: {}, engine: {} };

    expect((await adapter.getSceneTree(context)).map((item) => item.id)).toEqual(["first", "second"]);
    expect(await adapter.getProperties(secondEntity, context)).toEqual(secondProperties);
    expect(secondGetProperties).toHaveBeenCalledWith(secondEntity, context);
  });

  it("rejects duplicate entity IDs across adapters", async () => {
    const first: LiteSceneAdapter = { getSceneTree: () => [entity("duplicate")], getProperties: () => [] };
    const second: LiteSceneAdapter = { getSceneTree: () => [entity("duplicate")], getProperties: () => [] };
    const adapter = composeLiteSceneAdapters([first, second]);

    await expect(adapter.getSceneTree({ scene: {}, engine: {} })).rejects.toThrow('Duplicate Explorer entity ID "duplicate" across composed adapters.');
  });
});
