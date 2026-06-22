import { describe, expect, it, vi } from "vitest";
import { createOfficialLiteSceneAdapter } from "../src/adapter/official/createOfficialLiteSceneAdapter";
import { findEntityById } from "../src/signals/treeUtils";
import { fakeScene } from "./helpers";

describe("official adapter", () => {
  it("enumerates only the public scene collections", async () => {
    const data = fakeScene();
    (data.scene as { camera: unknown }).camera = {
      fov: 0.8,
      nearPlane: 0.1,
      farPlane: 100,
      children: [],
      worldMatrix: { length: 16 },
      worldMatrixVersion: 1
    };
    const adapter = createOfficialLiteSceneAdapter();
    const tree = await adapter.getSceneTree({ scene: data.scene, engine: {} });
    expect(tree[0].children?.map((item) => item.label)).toEqual(["Nodes", "Materials"]);
    const nodes = tree[0].children?.find((item) => item.label === "Nodes")?.children;
    expect(nodes?.map((item) => item.kind)).toEqual(["camera", "light", "mesh"]);
    expect(nodes?.find((item) => item.kind === "mesh")?.label).toBe("Sphere");
  });

  it("keeps IDs stable and disambiguates duplicate labels", async () => {
    const data = fakeScene();
    const duplicate = { ...data.mesh, id: undefined, position: { ...data.mesh.position }, name: "Sphere" };
    data.scene.meshes.push(duplicate as unknown as typeof data.mesh);
    const adapter = createOfficialLiteSceneAdapter();
    const first = await adapter.getSceneTree({ scene: data.scene, engine: {} });
    const second = await adapter.getSceneTree({ scene: data.scene, engine: {} });
    const firstIds = first[0].children?.find((item) => item.label === "Nodes")?.children?.filter((item) => item.kind === "mesh").map((item) => item.id);
    const secondIds = second[0].children?.find((item) => item.label === "Nodes")?.children?.filter((item) => item.kind === "mesh").map((item) => item.id);
    expect(new Set(firstIds).size).toBe(2);
    expect(secondIds).toEqual(firstIds);
  });

  it("exposes and edits public properties for each camera type", async () => {
    const base = {
      fov: 0.8,
      nearPlane: 0.1,
      farPlane: 100,
      viewport: { x: 0, y: 0, width: 1, height: 1 },
      children: [],
      worldMatrix: { length: 16 },
      worldMatrixVersion: 1,
      parent: null
    };
    const cases = [
      {
        camera: { ...base, alpha: 0.2, beta: 1, radius: 5, target: { x: 0, y: 0, z: 0 }, inertia: 0.9, panningInertia: 0.8, lowerRadiusLimit: 2 },
        expected: ["alpha", "beta", "radius", "target", "inertia", "panningInertia", "lowerRadiusLimit"],
        edits: [["target", [1, 2, 3]], ["radius", 8], ["inertia", 2]] as const
      },
      {
        camera: { ...base, position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 }, speed: 2, angularSensitivity: 2000, inertia: 0.9 },
        expected: ["position", "target", "speed", "angularSensitivity", "inertia"],
        edits: [["position", [4, 5, 6]], ["speed", 3]] as const
      },
      {
        camera: {
          ...base,
          center: { x: 10, y: 0, z: 0 }, yaw: 0, pitch: 0.5, radius: 20,
          position: { x: 30, y: 0, z: 0 }, upVector: { x: 1, y: 0, z: 0 },
          limits: { planetRadius: 10, radiusMin: 11, radiusMax: 50, pitchMin: 0, pitchMax: 1.5, yawMin: -Infinity, yawMax: Infinity, pitchDisabledRadiusScale: null }
        },
        expected: ["center", "yaw", "pitch", "radius", "position", "upVector", "limits.radiusMin", "limits.pitchMax"],
        edits: [["center", [0, 10, 0]], ["yaw", 1], ["limits.radiusMin", 12]] as const
      }
    ];

    for (const item of cases) {
      const data = fakeScene();
      (data.scene as { camera: unknown }).camera = item.camera;
      const context = { scene: data.scene, engine: {} };
      const adapter = createOfficialLiteSceneAdapter();
      const tree = await adapter.getSceneTree(context);
      const entity = tree[0].children?.find((section) => section.label === "Nodes")?.children?.find((node) => node.kind === "camera")!;
      const paths = (await adapter.getProperties(entity, context)).map((property) => property.path);
      expect(paths).toEqual(expect.arrayContaining(["viewport.width", ...item.expected]));
      for (const [path, value] of item.edits) expect((await adapter.setProperty?.(entity, path, value, context))?.ok).toBe(true);
    }

    expect(cases[0].camera).toMatchObject({ target: { x: 1, y: 2, z: 3 }, radius: 8, inertia: 1 });
    expect(cases[1].camera).toMatchObject({ position: { x: 4, y: 5, z: 6 }, speed: 3 });
    expect(cases[2].camera).toMatchObject({ center: { x: 0, y: 10, z: 0 }, yaw: 1, limits: { radiusMin: 12 } });
  });

  it("reconstructs public transform ancestors above scene meshes", async () => {
    const data = fakeScene();
    const root = {
      name: "BoomBox root",
      children: [data.mesh],
      position: { ...data.mesh.position },
      rotation: { ...data.mesh.rotation },
      rotationQuaternion: { ...data.mesh.rotationQuaternion },
      scaling: { ...data.mesh.scaling },
      parent: null,
      worldMatrix: { length: 16 },
      worldMatrixVersion: 1
    };
    data.mesh.parent = root as unknown as typeof data.mesh.parent;
    const tree = await createOfficialLiteSceneAdapter().getSceneTree({ scene: data.scene, engine: {} });
    const nodes = tree[0].children?.find((item) => item.label === "Nodes")?.children;
    const transformRoot = nodes?.find((item) => item.label === "BoomBox root");
    expect(transformRoot?.kind).toBe("transform");
    expect(transformRoot?.children?.map((item) => [item.kind, item.label])).toContainEqual(["mesh", "Sphere"]);
    expect(nodes?.filter((item) => item.label === "Sphere")).toHaveLength(0);
  });

  it("returns descriptors and applies safe public transform edits", async () => {
    const data = fakeScene();
    const context = { scene: data.scene, engine: {} };
    const adapter = createOfficialLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const meshId = tree[0].children?.find((item) => item.label === "Nodes")?.children?.find((item) => item.kind === "mesh")?.id as string;
    const entity = findEntityById(tree, meshId)!;
    const properties = await adapter.getProperties(entity, context);
    expect(properties.some((item) => item.path === "position")).toBe(true);
    expect(await adapter.setProperty?.(entity, "position", [3, 4, 5], context)).toEqual({ ok: true, value: undefined });
    expect(data.mesh.position).toMatchObject({ x: 3, y: 4, z: 5 });
    expect(await adapter.getEntitySnapshot?.(entity, context)).toEqual({
      ok: true,
      value: {
        name: "Sphere",
        visible: true,
        position: [3, 4, 5],
        rotation: [0, 0, 0],
        scaling: [1, 1, 1]
      }
    });
    const rejected = await adapter.setProperty?.(entity, "scaling", [1, 0, 1], context);
    expect(rejected?.ok).toBe(false);
    expect(data.mesh.scaling).toMatchObject({ x: 1, y: 1, z: 1 });
  });

  it("returns an empty tree for unsupported scene values", async () => {
    expect(await createOfficialLiteSceneAdapter().getSceneTree({ scene: {}, engine: {} })).toEqual([]);
  });

  it("updates render visibility through the public subtree API", async () => {
    const data = fakeScene();
    const child = {
      ...data.mesh,
      id: "child-id",
      name: "Child",
      children: [],
      position: { ...data.mesh.position },
      rotation: { ...data.mesh.rotation },
      scaling: { ...data.mesh.scaling },
      parent: data.mesh,
      visible: true
    };
    data.mesh.children.push(child as never);
    const context = { scene: data.scene, engine: {} };
    const adapter = createOfficialLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const entity = tree[0].children?.find((item) => item.label === "Nodes")?.children?.find((item) => item.kind === "mesh");

    expect((await adapter.setProperty?.(entity!, "visible", false, context))?.ok).toBe(true);
    expect(data.mesh.visible).toBe(false);
    expect(child.visible).toBe(false);
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
    expect(await adapter.getEntitySnapshot?.(material!, context)).toEqual({
      ok: true,
      value: {
        name: "Red",
        baseColorFactor: [1, 0, 0.5, 1],
        metallicFactor: 0.2,
        roughnessFactor: 0.4,
        alpha: 1
      }
    });
  });

  it("derives and deduplicates public material textures", async () => {
    const data = fakeScene();
    const texture = {
      texture: {},
      view: {},
      sampler: {},
      width: 1024,
      height: 512,
      uScale: 2,
      vOffset: 0.25,
      invertY: true
    };
    Object.assign(data.material, { baseColorTexture: texture, ormTexture: texture });
    const context = { scene: data.scene, engine: {} };
    const adapter = createOfficialLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const textures = tree[0].children?.find((item) => item.label === "Textures")?.children;
    expect(textures).toHaveLength(1);
    expect(textures?.[0].label).toBe("Red / baseColorTexture");
    const properties = await adapter.getProperties(textures![0], context);
    expect(properties.find((item) => item.path === "width")).toMatchObject({ value: 1024, readonly: true });
    expect(properties.find((item) => item.path === "usages")).toMatchObject({ value: "Red / baseColorTexture, Red / ormTexture" });
    expect(properties.find((item) => item.path === "invertY")).toMatchObject({ value: true, readonly: true });
    expect(await adapter.getEntitySnapshot?.(textures![0], context)).toEqual({
      ok: true,
      value: {
        usages: "Red / baseColorTexture, Red / ormTexture",
        width: 1024,
        height: 512,
        uScale: 2,
        vScale: 1,
        uOffset: 0,
        vOffset: 0.25,
        uAng: 0,
        invertY: true
      }
    });
  });

  it("uses public animation names and exposes playback properties", async () => {
    const data = fakeScene();
    data.scene.animationGroups.push({
      name: "Swim",
      duration: 2.5,
      currentFrame: 42,
      isPlaying: true,
      speedRatio: 1.25,
      loopAnimation: true,
      weight: 1
    } as never);
    const context = { scene: data.scene, engine: {} };
    const adapter = createOfficialLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const animation = tree[0].children?.find((item) => item.label === "Animation Groups")?.children?.[0];

    expect(animation?.label).toBe("Swim");
    expect(await adapter.getProperties(animation!, context)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "name", value: "Swim" }),
      expect.objectContaining({ path: "duration", value: 2.5, readonly: true }),
      expect.objectContaining({ path: "currentTime", value: 42, readonly: true }),
      expect.objectContaining({ path: "currentFrame", value: 2520, readonly: true }),
      expect.objectContaining({ path: "isPlaying", value: true, readonly: true }),
      expect.objectContaining({ path: "speedRatio", value: 1.25, readonly: true }),
      expect.objectContaining({ path: "loopAnimation", value: true, readonly: true })
    ]));
  });

  it("plays one animation from the start and stops the others", async () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1_000);
    const data = fakeScene();
    const first = { name: "Idle", duration: 2, currentFrame: 1, isPlaying: true, speedRatio: 1, loopAnimation: true, weight: 1 };
    const second = { name: "Swim", duration: 3, currentFrame: 2, isPlaying: false, speedRatio: 1, loopAnimation: true, weight: 1 };
    data.scene.animationGroups.push(first as never, second as never);
    const context = { scene: data.scene, engine: {} };
    const adapter = createOfficialLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const animations = tree[0].children?.find((item) => item.label === "Animation Groups")?.children;
    const idle = animations?.find((item) => item.label === "Idle");
    const animation = animations?.find((item) => item.label === "Swim");

    expect((await adapter.playAnimationGroup?.(animation!, context))?.ok).toBe(true);
    expect(first).toMatchObject({ isPlaying: false, currentFrame: 0 });
    expect(second).toMatchObject({ isPlaying: true, currentFrame: 0 });
    now.mockReturnValue(1_500);
    expect((await adapter.getProperties(idle!, context)).find((item) => item.path === "currentTime")?.value).toBe(0);
    expect((await adapter.getProperties(animation!, context)).find((item) => item.path === "currentTime")?.value).toBe(0.5);
    expect((await adapter.stopAnimationGroup?.(animation!, context))?.ok).toBe(true);
    expect(second).toMatchObject({ isPlaying: false, currentFrame: 0 });
    now.mockRestore();
  });

  it("tracks live playback when Babylon Lite leaves public currentFrame at zero", async () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1_000);
    const data = fakeScene();
    const group = { name: "Swim", duration: 3, frameRate: 60, currentFrame: 0, isPlaying: true, speedRatio: 1, loopAnimation: true, weight: 1 };
    data.scene.animationGroups.push(group as never);
    const context = { scene: data.scene, engine: {} };
    const adapter = createOfficialLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const animation = tree[0].children?.find((item) => item.label === "Animation Groups")?.children?.[0];

    await adapter.getProperties(animation!, context);
    now.mockReturnValue(1_500);
    const properties = await adapter.getProperties(animation!, context);

    expect(properties.find((item) => item.path === "currentTime")?.value).toBe(0.5);
    expect(properties.find((item) => item.path === "currentFrame")?.value).toBe(30);
    now.mockRestore();
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
    expect(tree[0].children?.find((item) => item.label === "Nodes")?.children?.filter((item) => item.kind === "mesh")).toHaveLength(1_000);
  });
});
