import { describe, expect, it, vi } from "vitest";
import type { LiteSceneAdapter } from "../src/adapter/LiteSceneAdapter";
import { createPublicSceneSnapshot, loadGlbIntoScene } from "../src/ui/ToolsPanel";

describe("Tools", () => {
  it("loads a GLB Blob and adds the returned asset container to the scene", async () => {
    const file = new Blob([new Uint8Array([0x67, 0x6c, 0x54, 0x46])], { type: "model/gltf-binary" });
    const engine = {} as never;
    const scene = {} as never;
    const asset = { meshes: [], transformNodes: [], lights: [], animationGroups: [] } as never;
    const load = vi.fn(async () => asset);
    const add = vi.fn();

    await loadGlbIntoScene(file, engine, scene, load, add);

    expect(load).toHaveBeenCalledWith(engine, file);
    expect(add).toHaveBeenCalledWith(scene, asset);
  });

  it("exports only public descriptor values in a nested scene snapshot", async () => {
    const child = { id: "mesh:1", label: "Box", kind: "mesh" as const, source: {}, capabilities: { editable: false, focusable: false, visibilityToggle: false, serializableSnapshot: true } };
    const root = { id: "scene:1", label: "Scene", kind: "scene" as const, source: {}, capabilities: child.capabilities, children: [child] };
    const adapter: LiteSceneAdapter = {
      getSceneTree: () => [root],
      getProperties: (entity) => entity.kind === "scene"
        ? [{ kind: "readonly", path: "$id", label: "Explorer ID", value: entity.id }, { kind: "number", path: "meshCount", label: "Meshes", value: 1 }]
        : [{ kind: "text", path: "name", label: "Name", value: "Box" }]
    };

    const snapshot = await createPublicSceneSnapshot([root], adapter, { engine: {}, scene: {} }, "2026-01-01T00:00:00.000Z");

    expect(snapshot).toEqual({
      format: "babylon-lite-explorer-public-scene-snapshot",
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      entities: [{ label: "Scene", kind: "scene", properties: { meshCount: 1 }, children: [{ label: "Box", kind: "mesh", properties: { name: "Box" } }] }]
    });
  });
});
