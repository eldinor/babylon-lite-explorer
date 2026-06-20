import { describe, expect, it } from "vitest";
import { createOfficialLiteSceneAdapter } from "../src/adapter/official/createOfficialLiteSceneAdapter";
import { findEntityById } from "../src/signals/treeUtils";
import { fakeScene } from "./helpers";

describe("official adapter", () => {
  it("enumerates only the public scene collections", async () => {
    const data = fakeScene();
    const adapter = createOfficialLiteSceneAdapter();
    const tree = await adapter.getSceneTree({ scene: data.scene, engine: {} });
    expect(tree[0].children?.map((item) => item.label)).toEqual(["Meshes", "Lights", "Materials"]);
    expect(tree[0].children?.[0].children?.[0].label).toBe("Sphere");
  });

  it("keeps IDs stable and disambiguates duplicate labels", async () => {
    const data = fakeScene();
    const duplicate = { ...data.mesh, id: undefined, position: { ...data.mesh.position }, name: "Sphere" };
    data.scene.meshes.push(duplicate as unknown as typeof data.mesh);
    const adapter = createOfficialLiteSceneAdapter();
    const first = await adapter.getSceneTree({ scene: data.scene, engine: {} });
    const second = await adapter.getSceneTree({ scene: data.scene, engine: {} });
    const firstIds = first[0].children?.[0].children?.map((item) => item.id);
    const secondIds = second[0].children?.[0].children?.map((item) => item.id);
    expect(new Set(firstIds).size).toBe(2);
    expect(secondIds).toEqual(firstIds);
  });

  it("returns descriptors and applies safe public transform edits", async () => {
    const data = fakeScene();
    const context = { scene: data.scene, engine: {} };
    const adapter = createOfficialLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const meshId = tree[0].children?.[0].children?.[0].id as string;
    const entity = findEntityById(tree, meshId)!;
    const properties = await adapter.getProperties(entity, context);
    expect(properties.some((item) => item.path === "position")).toBe(true);
    expect(await adapter.setProperty?.(entity, "position", [3, 4, 5], context)).toEqual({ ok: true, value: undefined });
    expect(data.mesh.position).toMatchObject({ x: 3, y: 4, z: 5 });
    const rejected = await adapter.setProperty?.(entity, "scaling", [1, 0, 1], context);
    expect(rejected?.ok).toBe(false);
    expect(data.mesh.scaling).toMatchObject({ x: 1, y: 1, z: 1 });
  });

  it("returns an empty tree for unsupported scene values", async () => {
    expect(await createOfficialLiteSceneAdapter().getSceneTree({ scene: {}, engine: {} })).toEqual([]);
  });

  it("edits verified public PBR factors and clamps channels", async () => {
    const data = fakeScene();
    Object.assign(data.material, { baseColorFactor: [1, 0, 0, 1], metallicFactor: 0.2, roughnessFactor: 0.4, alpha: 1 });
    const context = { scene: data.scene, engine: {} };
    const adapter = createOfficialLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const material = tree[0].children?.find((item) => item.label === "Materials")?.children?.[0];
    expect(material).toBeDefined();
    const properties = await adapter.getProperties(material!, context);
    expect(properties.map((item) => item.path)).toContain("baseColorFactor");
    expect((await adapter.setProperty?.(material!, "baseColorFactor", [2, -1, 0.5, 1.5], context))?.ok).toBe(true);
    expect((data.material as typeof data.material & { baseColorFactor: number[] }).baseColorFactor).toEqual([1, 0, 0.5, 1]);
  });

  it("handles a larger public mesh collection", async () => {
    const data = fakeScene();
    data.scene.meshes = Array.from({ length: 1_000 }, (_, index) => ({
      ...data.mesh,
      id: `mesh-${index}`,
      name: `Mesh ${index}`,
      children: [],
      position: { ...data.mesh.position },
      rotation: { ...data.mesh.rotation },
      scaling: { ...data.mesh.scaling }
    }));
    const tree = await createOfficialLiteSceneAdapter().getSceneTree({ scene: data.scene, engine: {} });
    expect(tree[0].children?.find((item) => item.label === "Meshes")?.children).toHaveLength(1_000);
  });
});
