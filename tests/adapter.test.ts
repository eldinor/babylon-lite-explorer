import { describe, expect, it, vi } from "vitest";
import * as lite from "@babylonjs/lite";
import { createDefaultLiteSceneAdapter } from "../src/adapter/default/createDefaultLiteSceneAdapter";
import { findEntityById } from "../src/signals/treeUtils";
import { fakeScene } from "./helpers";

describe("default adapter", () => {
  it("marks mutable scene entities for live property refresh", async () => {
    const data = fakeScene();
    const tree = await createDefaultLiteSceneAdapter().getSceneTree({ scene: data.scene, engine: {} });
    const scene = tree[0];
    const light = scene.children?.find((item) => item.label === "Nodes")?.children?.find((item) => item.kind === "light");
    const material = scene.children?.find((item) => item.label === "Materials")?.children?.[0];

    expect(scene.meta?.liveProperties).toBe(true);
    expect(light?.meta?.liveProperties).toBe(true);
    expect(material?.meta?.liveProperties).toBe(true);
  });

  it("reports the public animation group count", async () => {
    const data = fakeScene();
    data.scene.animationGroups.push({} as never, {} as never);
    const stats = await createDefaultLiteSceneAdapter().getStats?.({ scene: data.scene, engine: {} });

    expect(stats?.animationGroupCount).toBe(2);
  });

  it("marks scene meshes for live property refresh", async () => {
    const data = fakeScene();
    const tree = await createDefaultLiteSceneAdapter().getSceneTree({ scene: data.scene, engine: {} });
    const mesh = tree[0].children?.find((item) => item.label === "Nodes")?.children?.find((item) => item.kind === "mesh");

    expect(mesh?.meta?.liveProperties).toBe(true);
  });

  it("marks the active camera for live property refresh", async () => {
    const data = fakeScene();
    data.scene.camera = {
      children: [],
      fov: 0.8,
      nearPlane: 0.1,
      farPlane: 100,
      viewport: { x: 0, y: 0, width: 1, height: 1 }
    } as never;
    const tree = await createDefaultLiteSceneAdapter().getSceneTree({ scene: data.scene, engine: {} });
    const camera = tree[0].children?.find((item) => item.label === "Nodes")?.children?.find((item) => item.kind === "camera");

    expect(camera?.meta?.liveProperties).toBe(true);
  });

  it("classifies supported material families from public fields", async () => {
    const data = fakeScene();
    const materials = [
      { name: "PBR", baseColorFactor: [1, 1, 1, 1], metallicFactor: 1, roughnessFactor: 1 },
      { name: "Standard", diffuseColor: [1, 1, 1], specularColor: [1, 1, 1], specularPower: 64 },
      { name: "Node", inputs: {} },
      { name: "Shader", vertexSource: "@vertex fn main() {}", fragmentSource: "@fragment fn main() {}" },
      Object.assign(lite.createPbrMaterial(), { name: "Official empty PBR" }),
      { name: "PBR View", source: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } },
      { name: "Custom" }
    ];
    data.scene.meshes = materials.map((material, index) => ({
      ...data.mesh,
      id: `material-mesh-${index}`,
      name: `Material mesh ${index}`,
      children: [],
      position: { ...data.mesh.position },
      rotation: { ...data.mesh.rotation },
      scaling: { ...data.mesh.scaling },
      material
    })) as typeof data.scene.meshes;
    const context = { scene: data.scene, engine: {} };
    const adapter = createDefaultLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const entities = tree[0].children?.find((item) => item.label === "Materials")?.children ?? [];
    const types = new Map<string, string>();
    for (const entity of entities) {
      const properties = await adapter.getProperties(entity, context);
      types.set(entity.label, String(properties.find((property) => property.path === "$materialType")?.value));
    }
    expect(Object.fromEntries(types)).toEqual({
      PBR: "PBR",
      Standard: "Standard",
      Node: "Node",
      Shader: "Shader",
      "Official empty PBR": "PBR",
      "PBR View": "PBR View",
      Custom: "Undetermined / Custom"
    });
  });

  it("exposes and edits public scene, fog, image-processing, and environment values", async () => {
    const data = fakeScene();
    (data.scene as unknown as { fog: unknown }).fog = { mode: 3, density: 0.1, start: 2, end: 20, color: [0.2, 0.3, 0.4] };
    (data.scene as unknown as { clipPlane: unknown }).clipPlane = [0, 1, 0, -2];
    (data.scene as unknown as { metadata: unknown }).metadata = { author: "Ada", nested: { tag: "demo" } };
    data.scene.shadowGenerators.push({} as never);
    const setSceneImageProcessing = vi.fn(async (scene: lite.SceneContext, update: Partial<lite.ImageProcessingConfig>) => {
      Object.assign((scene as unknown as typeof data.scene).imageProcessing, update);
    });
    const context = { scene: data.scene, engine: {}, lite: { ...lite, setSceneImageProcessing } };
    const adapter = createDefaultLiteSceneAdapter();
    const scene = (await adapter.getSceneTree(context))[0];
    const properties = await adapter.getProperties(scene, context);

    expect(properties.map((property) => property.path)).toEqual(expect.arrayContaining([
      "clearColor",
      "shadowGeneratorCount",
      "fixedDeltaMs",
      "fog.mode",
      "fog.density",
      "fog.start",
      "fog.end",
      "fog.color",
      "clipPlane",
      "imageProcessing.exposure",
      "imageProcessing.contrast",
      "imageProcessing.toneMappingEnabled",
      "imageProcessing.toneMapping",
      "environmentPrimaryColor",
      "envRotationY"
    ]));
    expect(properties.find((property) => property.path === "clipPlane")?.value).toBe("[0.000, 1.000, 0.000, -2.000]");

    expect((await adapter.setProperty?.(scene, "imageProcessing.exposure", 1.5, context))?.ok).toBe(true);
    expect((await adapter.setProperty?.(scene, "imageProcessing.toneMappingEnabled", true, context))?.ok).toBe(true);
    expect((await adapter.setProperty?.(scene, "imageProcessing.toneMapping", "aces", context))?.ok).toBe(true);
    const originalClearColor = data.scene.clearColor;
    expect((await adapter.setProperty?.(scene, "clearColor", [0.2, 0.3, 0.4, 1], context))?.ok).toBe(true);
    expect((await adapter.setProperty?.(scene, "environmentPrimaryColor", [0.4, 0.5, 0.6], context))?.ok).toBe(true);
    expect((await adapter.setProperty?.(scene, "envRotationY", Math.PI, context))?.ok).toBe(true);
    expect((await adapter.setProperty?.(scene, "fixedDeltaMs", 16.667, context))?.ok).toBe(true);
    expect((await adapter.setProperty?.(scene, "fog.mode", "2", context))?.ok).toBe(true);
    expect((await adapter.setProperty?.(scene, "fog.density", 0.025, context))?.ok).toBe(true);
    expect((await adapter.setProperty?.(scene, "fog.color", [0.6, 0.7, 0.8], context))?.ok).toBe(true);
    expect(data.scene.imageProcessing).toMatchObject({ exposure: 1.5, toneMappingEnabled: true, toneMapping: lite.AcesToneMapping });
    expect(setSceneImageProcessing).toHaveBeenCalledWith(data.scene, { exposure: 1.5 });
    expect(setSceneImageProcessing).toHaveBeenCalledWith(data.scene, { toneMappingEnabled: true });
    expect(setSceneImageProcessing).toHaveBeenCalledWith(data.scene, { toneMappingEnabled: true, toneMapping: lite.AcesToneMapping });
    expect(properties.find((property) => property.path === "metadata.author")?.value).toBe("Ada");
    expect(properties.find((property) => property.path === "metadata.nested")?.value).toBe("{\"tag\":\"demo\"}");
    expect(data.scene.clearColor).toBe(originalClearColor);
    expect(data.scene.clearColor).toEqual({ r: 0.2, g: 0.3, b: 0.4, a: 1 });
    expect(data.scene.environmentPrimaryColor).toEqual([0.4, 0.5, 0.6]);
    expect(data.scene.envRotationY).toBe(Math.PI);
    expect(data.scene.fixedDeltaMs).toBe(16.667);
    expect(data.scene.fog).toEqual({ mode: 2, density: 0.025, start: 2, end: 20, color: [0.6, 0.7, 0.8] });
  });

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
    const adapter = createDefaultLiteSceneAdapter();
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
    const adapter = createDefaultLiteSceneAdapter();
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
        camera: {
          ...base, alpha: 0.2, beta: 1, radius: 5, target: { x: 0, y: 0, z: 0 },
          inertia: 0.9, panningInertia: 0.8, angularSensibility: 1000,
          panningSensibility: 50, wheelPrecision: 3, lowerRadiusLimit: 2
        },
        expected: [
          "alpha", "beta", "radius", "target", "inertia", "panningInertia",
          "angularSensibility", "panningSensibility", "wheelPrecision", "lowerRadiusLimit"
        ],
        edits: [["target", [1, 2, 3]], ["radius", 8], ["inertia", 2], ["wheelPrecision", 4]] as const
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
      const adapter = createDefaultLiteSceneAdapter();
      const tree = await adapter.getSceneTree(context);
      const entity = tree[0].children?.find((section) => section.label === "Nodes")?.children?.find((node) => node.kind === "camera")!;
      const paths = (await adapter.getProperties(entity, context)).map((property) => property.path);
      expect(paths).toEqual(expect.arrayContaining(["viewport.width", ...item.expected]));
      for (const [path, value] of item.edits) expect((await adapter.setProperty?.(entity, path, value, context))?.ok).toBe(true);
    }

    expect(cases[0].camera).toMatchObject({ target: { x: 1, y: 2, z: 3 }, radius: 8, inertia: 1, wheelPrecision: 4 });
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
    const tree = await createDefaultLiteSceneAdapter().getSceneTree({ scene: data.scene, engine: {} });
    const nodes = tree[0].children?.find((item) => item.label === "Nodes")?.children;
    const transformRoot = nodes?.find((item) => item.label === "BoomBox root");
    expect(transformRoot?.kind).toBe("transform");
    expect(transformRoot?.children?.map((item) => [item.kind, item.label])).toContainEqual(["mesh", "Sphere"]);
    expect(nodes?.filter((item) => item.label === "Sphere")).toHaveLength(0);
  });

  it("returns descriptors and applies safe public transform edits", async () => {
    const data = fakeScene();
    (data.mesh as unknown as { metadata: unknown }).metadata = { category: "hero", flags: ["selectable"] };
    const context = { scene: data.scene, engine: {} };
    const adapter = createDefaultLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const meshId = tree[0].children?.find((item) => item.label === "Nodes")?.children?.find((item) => item.kind === "mesh")?.id as string;
    const entity = findEntityById(tree, meshId)!;
    const properties = await adapter.getProperties(entity, context);
    expect(properties.some((item) => item.path === "position")).toBe(true);
    expect(properties.find((item) => item.path === "metadata.category")).toMatchObject({ value: "hero", section: "Metadata" });
    expect(properties.find((item) => item.path === "metadata.flags")).toMatchObject({ value: "[\"selectable\"]", section: "Metadata" });
    expect(await adapter.setProperty?.(entity, "position", [3, 4, 5], context)).toEqual({ ok: true, value: undefined });
    expect(data.mesh.position).toMatchObject({ x: 3, y: 4, z: 5 });
    expect(await adapter.getEntitySnapshot?.(entity, context)).toEqual({
      ok: true,
      value: {
        name: "Sphere",
        visible: true,
        position: [3, 4, 5],
        rotation: [0, 0, 0],
        scaling: [1, 1, 1],
        skinned: "No",
        hasMorphTargets: "No",
        "metadata.category": "hero",
        "metadata.flags": "[\"selectable\"]"
      }
    });
    const rejected = await adapter.setProperty?.(entity, "scaling", [1, 0, 1], context);
    expect(rejected?.ok).toBe(false);
    expect(data.mesh.scaling).toMatchObject({ x: 1, y: 1, z: 1 });
  });

  it("reports public mesh skeleton and morph-target state", async () => {
    const data = fakeScene();
    const weights = new Float32Array([0.25, 0.75]);
    Object.assign(data.mesh, {
      skeleton: { boneCount: 18 },
      morphTargets: { count: 2, weights }
    });
    const context = { scene: data.scene, engine: {} };
    const adapter = createDefaultLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const mesh = tree[0].children?.find((item) => item.label === "Nodes")?.children?.find((item) => item.kind === "mesh")!;
    const properties = await adapter.getProperties(mesh, context);

    expect(mesh.meta?.liveProperties).toBe(true);
    expect(Object.fromEntries(properties.filter((property) => property.section === "Deformation").map((property) => [property.path, property.value]))).toEqual({
      skinned: "Yes",
      boneCount: 18,
      hasMorphTargets: "Yes",
      morphTargetCount: 2,
      morphWeights: "[0.25, 0.75]"
    });

    weights.set([0.5, 0.125]);
    expect((await adapter.getProperties(mesh, context)).find((property) => property.path === "morphWeights")?.value).toBe("[0.5, 0.125]");
  });

  it("returns an empty tree for unsupported scene values", async () => {
    expect(await createDefaultLiteSceneAdapter().getSceneTree({ scene: {}, engine: {} })).toEqual([]);
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
    const adapter = createDefaultLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const entity = tree[0].children?.find((item) => item.label === "Nodes")?.children?.find((item) => item.kind === "mesh");

    expect((await adapter.setProperty?.(entity!, "visible", false, context))?.ok).toBe(true);
    expect(data.mesh.visible).toBe(false);
    expect(child.visible).toBe(false);
  });

  it("removes scene entities through the Lite removal API", async () => {
    const data = fakeScene();
    const adapter = createDefaultLiteSceneAdapter();
    const tree = await adapter.getSceneTree({ scene: data.scene, engine: {} });
    const entity = tree[0].children?.find((item) => item.label === "Nodes")?.children?.find((item) => item.kind === "mesh");
    const removeFromScene = vi.fn();

    expect(entity?.capabilities.removable).toBe(true);
    const result = await adapter.removeEntity?.(entity!, {
      scene: data.scene,
      engine: {},
      lite: { removeFromScene } as unknown as import("../src/api/types").LiteExplorerRuntime
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(removeFromScene).toHaveBeenCalledWith(data.scene, data.mesh);
  });

  it("edits verified public PBR factors and clamps channels", async () => {
    const data = fakeScene();
    Object.assign(data.material, { baseColorFactor: [1, 0, 0, 1], metallicFactor: 0.2, roughnessFactor: 0.4, alpha: 1 });
    const context = { scene: data.scene, engine: {} };
    const adapter = createDefaultLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const material = tree[0].children?.find((item) => item.label === "Materials")?.children?.[0];
    expect(material).toBeDefined();
    const properties = await adapter.getProperties(material!, context);
    expect(properties.map((item) => item.path)).toEqual(expect.arrayContaining(["baseColorFactor", "environmentIntensity"]));
    expect((await adapter.setProperty?.(material!, "baseColorFactor", [2, -1, 0.5, 1.5], context))?.ok).toBe(true);
    expect((await adapter.setProperty?.(material!, "environmentIntensity", 1.75, context))?.ok).toBe(true);
    expect((data.material as typeof data.material & { baseColorFactor: number[] }).baseColorFactor).toEqual([1, 0, 0.5, 1]);
    expect(await adapter.getEntitySnapshot?.(material!, context)).toEqual({
      ok: true,
      value: {
        name: "Red",
        baseColorFactor: [1, 0, 0.5, 1],
        metallicFactor: 0.2,
        roughnessFactor: 0.4,
        alpha: 1,
        environmentIntensity: 1.75
      }
    });
  });

  it("exposes and edits public Standard material values", async () => {
    const data = fakeScene();
    Object.assign(data.material, {
      diffuseColor: [1, 0.5, 0.25], alpha: 1, specularColor: [1, 1, 1], specularPower: 64,
      emissiveColor: [0, 0, 0], ambientColor: [0, 0, 0], bumpLevel: 1, ambientTexLevel: 1,
      lightmapLevel: 1, opacityLevel: 1, reflectionLevel: 1
    });
    const context = { scene: data.scene, engine: {} };
    const adapter = createDefaultLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const material = tree[0].children?.find((item) => item.label === "Materials")?.children?.[0]!;
    const properties = await adapter.getProperties(material, context);
    expect(properties.map((item) => item.path)).toEqual(expect.arrayContaining([
      "diffuseColor", "alpha", "specularColor", "specularPower", "emissiveColor", "ambientColor",
      "bumpLevel", "ambientTexLevel", "lightmapLevel", "opacityLevel", "reflectionLevel"
    ]));
    expect((await adapter.setProperty?.(material, "diffuseColor", [0.2, 0.3, 0.4], context))?.ok).toBe(true);
    expect((await adapter.setProperty?.(material, "specularPower", 128, context))?.ok).toBe(true);
    expect((await adapter.setProperty?.(material, "reflectionLevel", 0.5, context))?.ok).toBe(true);
    expect(data.material).toMatchObject({ diffuseColor: [0.2, 0.3, 0.4], specularPower: 128, reflectionLevel: 0.5 });
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
    Object.assign(data.material, {
      baseColorTexture: texture,
      ormTexture: texture,
      anisotropy: { texture },
      sheen: { texture, roughnessTexture: texture },
      subsurface: { translucency: { colorTexture: texture, intensityTexture: texture } }
    });
    const context = { scene: data.scene, engine: {} };
    const adapter = createDefaultLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const textures = tree[0].children?.find((item) => item.label === "Textures")?.children;
    expect(textures).toHaveLength(1);
    expect(textures?.[0].label).toBe("Red / baseColorTexture");
    const properties = await adapter.getProperties(textures![0], context);
    expect(properties.find((item) => item.path === "width")).toMatchObject({ value: 1024, readonly: true });
    const usages = [
      "Red / baseColorTexture", "Red / ormTexture", "Red / sheen.texture",
      "Red / sheen.roughnessTexture", "Red / anisotropy.texture",
      "Red / subsurface.translucency.colorTexture", "Red / subsurface.translucency.intensityTexture"
    ].join(", ");
    expect(properties.find((item) => item.path === "usages")).toMatchObject({ value: usages });
    expect(properties.find((item) => item.path === "invertY")).toMatchObject({ value: true, readonly: true });
    expect(await adapter.getEntitySnapshot?.(textures![0], context)).toEqual({
      ok: true,
      value: {
        usages,
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
      currentTime: 0.7,
      targetedAnimations: [],
      isPlaying: true,
      speedRatio: 1.25,
      loopAnimation: true,
      weight: 1
    } as never);
    const context = { scene: data.scene, engine: {} };
    const adapter = createDefaultLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const animation = tree[0].children?.find((item) => item.label === "Animation Groups")?.children?.[0];

    expect(animation?.label).toBe("Swim");
    expect(await adapter.getProperties(animation!, context)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "name", value: "Swim" }),
      expect.objectContaining({ path: "duration", value: 2.5, readonly: true }),
      expect.objectContaining({ path: "currentTime", value: 0.7, readonly: true }),
      expect.objectContaining({ path: "currentFrame", value: 42, readonly: true }),
      expect.objectContaining({ path: "isPlaying", value: true, readonly: true }),
      expect.objectContaining({ path: "speedRatio", value: 1.25, readonly: true }),
      expect.objectContaining({ path: "loopAnimation", value: true, readonly: true })
    ]));
  });

  it("plays one animation from the start and stops the others", async () => {
    const data = fakeScene();
    const first = { name: "Idle", duration: 2, currentTime: 1, targetedAnimations: [], isPlaying: true, speedRatio: 1, loopAnimation: true, weight: 1 };
    const second = { name: "Swim", duration: 3, currentTime: 2, targetedAnimations: [], isPlaying: false, speedRatio: 1, loopAnimation: true, weight: 1 };
    data.scene.animationGroups.push(first as never, second as never);
    const context = { scene: data.scene, engine: {} };
    const adapter = createDefaultLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const animations = tree[0].children?.find((item) => item.label === "Animation Groups")?.children;
    const idle = animations?.find((item) => item.label === "Idle");
    const animation = animations?.find((item) => item.label === "Swim");

    expect((await adapter.playAnimationGroup?.(animation!, context))?.ok).toBe(true);
    expect(first).toMatchObject({ isPlaying: false, currentTime: 0 });
    expect(second).toMatchObject({ isPlaying: true, currentTime: 0 });
    expect((await adapter.getProperties(idle!, context)).find((item) => item.path === "currentTime")?.value).toBe(0);
    second.currentTime = 0.5;
    expect((await adapter.getProperties(animation!, context)).find((item) => item.path === "currentTime")?.value).toBe(0.5);
    expect((await adapter.stopAnimationGroup?.(animation!, context))?.ok).toBe(true);
    expect(second).toMatchObject({ isPlaying: false, currentTime: 0 });
  });

  it("uses the application Lite runtime for split-module mutations", async () => {
    const data = fakeScene();
    const group = { name: "Host animation", duration: 1, currentTime: 0, targetedAnimations: [], isPlaying: false, speedRatio: 1, loopAnimation: true, weight: 1 };
    data.scene.animationGroups.push(group as never);
    const playAnimation = vi.fn();
    const stopAnimation = vi.fn();
    const context = { scene: data.scene, engine: {}, lite: { ...lite, playAnimation, stopAnimation } };
    const adapter = createDefaultLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const animation = tree[0].children?.find((item) => item.label === "Animation Groups")?.children?.[0];

    expect((await adapter.playAnimationGroup?.(animation!, context))?.ok).toBe(true);
    expect(stopAnimation).toHaveBeenCalledWith(group);
    expect(playAnimation).toHaveBeenCalledWith(group);
    expect((await adapter.stopAnimationGroup?.(animation!, context))?.ok).toBe(true);
    expect(stopAnimation).toHaveBeenCalledTimes(2);
  });

  it("reads live playback from Babylon Lite currentTime", async () => {
    const data = fakeScene();
    const group = { name: "Swim", duration: 3, frameRate: 60, currentTime: 0, targetedAnimations: [], isPlaying: true, speedRatio: 1, loopAnimation: true, weight: 1 };
    data.scene.animationGroups.push(group as never);
    const context = { scene: data.scene, engine: {} };
    const adapter = createDefaultLiteSceneAdapter();
    const tree = await adapter.getSceneTree(context);
    const animation = tree[0].children?.find((item) => item.label === "Animation Groups")?.children?.[0];

    await adapter.getProperties(animation!, context);
    group.currentTime = 0.5;
    const properties = await adapter.getProperties(animation!, context);

    expect(properties.find((item) => item.path === "currentTime")?.value).toBe(0.5);
    expect(properties.find((item) => item.path === "currentFrame")?.value).toBe(30);
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
    const tree = await createDefaultLiteSceneAdapter().getSceneTree({ scene: data.scene, engine: {} });
    expect(tree[0].children?.find((item) => item.label === "Nodes")?.children?.filter((item) => item.kind === "mesh")).toHaveLength(1_000);
  });
});
