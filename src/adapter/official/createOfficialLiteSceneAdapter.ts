import {
  playAnimation,
  setSubtreeVisible,
  stopAnimation,
  type AnimationGroup,
  type Camera,
  type EngineContext,
  type GpuPicker,
  type LightBase,
  type Material,
  type Mesh,
  type PbrMaterialProps,
  type SceneContext,
  type SceneNode,
  type Texture2D
} from "@babylonjs/lite";
import type { LiteExplorerContext } from "../../api/types";
import type { PropertyDescriptor } from "../propertyDescriptors";
import {
  fail,
  ok,
  type LiteEntity,
  type LiteEntityCapabilities,
  type LiteEntityKind,
  type LiteSceneAdapter,
  type LiteStats
} from "../LiteSceneAdapter";

const none: LiteEntityCapabilities = {
  editable: false,
  focusable: false,
  visibilityToggle: false,
  serializableSnapshot: true
};

function isPublicScene(value: unknown): value is SceneContext {
  if (!value || typeof value !== "object") return false;
  const scene = value as Partial<SceneContext>;
  return Array.isArray(scene.meshes) && Array.isArray(scene.lights) && Array.isArray(scene.animationGroups) && "camera" in scene;
}

function isPublicEngine(value: unknown): value is EngineContext {
  return !!value && typeof value === "object" && typeof (value as Partial<EngineContext>).drawCallCount === "number";
}

function isPublicSceneNode(value: unknown): value is SceneNode {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<SceneNode>;
  return typeof node.name === "string"
    && Array.isArray(node.children)
    && !!node.position && typeof node.position.x === "number"
    && !!node.rotation && typeof node.rotation.x === "number"
    && !!node.scaling && typeof node.scaling.x === "number";
}

function isPublicTexture2D(value: unknown): value is Texture2D {
  if (!value || typeof value !== "object") return false;
  const texture = value as Partial<Texture2D>;
  return typeof texture.width === "number"
    && typeof texture.height === "number"
    && "texture" in texture
    && "view" in texture
    && "sampler" in texture;
}

type TextureUsage = { slot: string; texture: Texture2D };

const directTextureSlots = [
  "baseColorTexture", "normalTexture", "ormTexture", "emissiveTexture",
  "specGlossTexture", "occlusionTexture", "metallicReflectanceTexture", "reflectanceTexture",
  "diffuseTexture", "bumpTexture", "specularTexture", "ambientTexture",
  "lightmapTexture", "opacityTexture", "reflectionTexture"
] as const;

function collectPublicMaterialTextures(material: Material): TextureUsage[] {
  const record = material as Material & Record<string, unknown>;
  const usages: TextureUsage[] = [];
  const add = (slot: string, value: unknown) => { if (isPublicTexture2D(value)) usages.push({ slot, texture: value }); };
  for (const slot of directTextureSlots) add(slot, record[slot]);

  const nested = (key: string): Record<string, unknown> | null => {
    const value = record[key];
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  };
  const clearCoat = nested("clearCoat");
  if (clearCoat) {
    add("clearCoat.texture", clearCoat.texture);
    add("clearCoat.roughnessTexture", clearCoat.roughnessTexture);
    add("clearCoat.bumpTexture", clearCoat.bumpTexture);
  }
  const sheen = nested("sheen");
  if (sheen) add("sheen.texture", sheen.texture);
  const iridescence = nested("iridescence");
  if (iridescence) {
    add("iridescence.texture", iridescence.texture);
    add("iridescence.thicknessTexture", iridescence.thicknessTexture);
  }
  const subsurface = nested("subsurface");
  if (subsurface) {
    const thickness = subsurface.thickness && typeof subsurface.thickness === "object" ? subsurface.thickness as Record<string, unknown> : null;
    const refraction = subsurface.refraction && typeof subsurface.refraction === "object" ? subsurface.refraction as Record<string, unknown> : null;
    if (thickness) add("subsurface.thickness.texture", thickness.texture);
    if (refraction) add("subsurface.refraction.texture", refraction.texture);
  }
  return usages;
}

function asTuple3(value: { x: number; y: number; z: number }): readonly [number, number, number] {
  return [value.x, value.y, value.z];
}

function section(id: string, label: string, children: LiteEntity[]): LiteEntity {
  return { id: `section:${id}`, label, kind: "unknown", source: null, children, capabilities: none };
}

type PublicPbrMaterial = Material & Partial<Pick<PbrMaterialProps,
  "baseColorFactor" | "metallicFactor" | "roughnessFactor" | "alpha" | "doubleSided"
>>;

function isPublicPbrMaterial(material: Material): material is PublicPbrMaterial {
  return "baseColorFactor" in material || "metallicFactor" in material || "roughnessFactor" in material;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function createOfficialLiteSceneAdapter(): LiteSceneAdapter {
  const objectIds = new WeakMap<object, string>();
  const entityTypes = new WeakMap<object, LiteEntityKind>();
  const animationClocks = new WeakMap<AnimationGroup, { time: number; publicTime: number; sampledAt: number; wasPlaying: boolean }>();
  let nextId = 1;
  const pickers = new Set<GpuPicker>();
  const pickerByScene = new WeakMap<object, GpuPicker>();
  let disposePickerPublic: ((picker: GpuPicker) => void) | undefined;

  const getAnimationTime = (group: AnimationGroup): number => {
    const now = performance.now();
    const publicTime = group.currentFrame;
    let clock = animationClocks.get(group);
    if (!clock) {
      clock = { time: publicTime, publicTime, sampledAt: now, wasPlaying: group.isPlaying };
      animationClocks.set(group, clock);
      return publicTime;
    }
    if (publicTime !== clock.publicTime) {
      clock.time = publicTime;
    } else if (group.isPlaying && clock.wasPlaying) {
      clock.time += ((now - clock.sampledAt) / 1000) * group.speedRatio;
      if (group.duration > 0) {
        clock.time = group.loopAnimation
          ? ((clock.time % group.duration) + group.duration) % group.duration
          : Math.min(group.duration, Math.max(0, clock.time));
      }
    }
    clock.publicTime = publicTime;
    clock.sampledAt = now;
    clock.wasPlaying = group.isPlaying;
    return clock.time;
  };

  const idFor = (kind: LiteEntityKind, source: object, explicit?: string): string => {
    const existing = objectIds.get(source);
    if (existing) return existing;
    const id = explicit ? `${kind}:${explicit}:${nextId++}` : `${kind}:object:${nextId++}`;
    objectIds.set(source, id);
    entityTypes.set(source, kind);
    return id;
  };

  const makeNode = (node: SceneNode, kind: "mesh" | "transform", seen: Set<object>, meshSources?: ReadonlySet<object>): LiteEntity => {
    if (seen.has(node)) {
      return { id: idFor(kind, node), label: `${node.name || kind} (cycle)`, kind, source: node, capabilities: none };
    }
    seen.add(node);
    const children = node.children.map((child) => makeNode(child, meshSources?.has(child) ? "mesh" : "transform", seen, meshSources));
    seen.delete(node);
    return {
      id: idFor(kind, node, kind === "mesh" ? (node as Mesh).id : undefined),
      label: node.name || (kind === "mesh" ? "Unnamed mesh" : "Unnamed transform"),
      kind,
      source: node,
      children: children.length ? children : undefined,
      capabilities: { editable: true, focusable: false, visibilityToggle: kind === "mesh", serializableSnapshot: true }
    };
  };

  const makeMaterial = (material: Material): LiteEntity => ({
    id: idFor("material", material),
    label: material.name || "Unnamed material",
    kind: "material",
    source: material,
    capabilities: { ...none, editable: isPublicPbrMaterial(material) }
  });

  const getSceneTree = (context: LiteExplorerContext): LiteEntity[] => {
    if (!isPublicScene(context.scene)) return [];
    const scene = context.scene;
    entityTypes.set(scene, "scene");
    const root: LiteEntity = {
      id: idFor("scene", scene),
      label: "Scene",
      kind: "scene",
      source: scene,
      capabilities: none,
      children: []
    };

    const meshSources = new Set<object>(scene.meshes);
    const discoveredSceneNodes = new Set<SceneNode>(scene.meshes);
    for (const mesh of scene.meshes) {
      let parent: unknown = mesh.parent;
      const visited = new Set<object>();
      while (isPublicSceneNode(parent) && !visited.has(parent)) {
        visited.add(parent);
        discoveredSceneNodes.add(parent);
        parent = parent.parent;
      }
    }
    const externalNodeOwners = new Set<object>(scene.lights);
    if (scene.camera) externalNodeOwners.add(scene.camera);
    const nodes: LiteEntity[] = [];

    if (scene.camera) {
      entityTypes.set(scene.camera, "camera");
      const cameraChildren = scene.camera.children.map((child) => makeNode(child, meshSources.has(child) ? "mesh" : "transform", new Set(), meshSources));
      nodes.push({
        id: idFor("camera", scene.camera),
        label: "Active camera",
        kind: "camera",
        source: scene.camera,
        children: cameraChildren.length ? cameraChildren : undefined,
        capabilities: { ...none, editable: true }
      });
    }

    if (scene.lights.length) {
      nodes.push(...scene.lights.map((light, index) => {
        entityTypes.set(light, "light");
        const lightChildren = light.children.map((child) => makeNode(child, meshSources.has(child) ? "mesh" : "transform", new Set(), meshSources));
        return {
          id: idFor("light", light),
          label: `${light.lightType || "Light"} ${index + 1}`,
          kind: "light" as const,
          source: light,
          children: lightChildren.length ? lightChildren : undefined,
          capabilities: { ...none, editable: true }
        };
      }));
    }
    const rootSceneNodes = [...discoveredSceneNodes].filter((node) => {
      const parent = node.parent;
      return !parent || (!discoveredSceneNodes.has(parent as SceneNode) && !externalNodeOwners.has(parent));
    });
    nodes.push(...rootSceneNodes.map((node) => makeNode(node, meshSources.has(node) ? "mesh" : "transform", new Set(), meshSources)));
    if (nodes.length) root.children!.push(section("nodes", "Nodes", nodes));

    const materials = [...new Set(scene.meshes.map((mesh) => mesh.material))];
    if (materials.length) root.children!.push(section("materials", "Materials", materials.map(makeMaterial)));

    const textureUsages = new Map<Texture2D, string[]>();
    for (const material of materials) {
      const materialLabel = material.name || "Unnamed material";
      for (const usage of collectPublicMaterialTextures(material)) {
        const labels = textureUsages.get(usage.texture) ?? [];
        labels.push(`${materialLabel} / ${usage.slot}`);
        textureUsages.set(usage.texture, labels);
      }
    }
    if (textureUsages.size) {
      root.children!.push(section("textures", "Textures", [...textureUsages].map(([texture, usages]) => ({
        id: idFor("texture", texture),
        label: usages[0],
        kind: "texture" as const,
        source: texture,
        capabilities: none,
        meta: { usages }
      }))));
    }

    if (scene.animationGroups.length) {
      root.children!.push(section("animations", "Animation Groups", scene.animationGroups.map((group, index) => {
        entityTypes.set(group, "animationGroup");
        return {
          id: idFor("animationGroup", group),
          label: group.name || `Animation group ${index + 1}`,
          kind: "animationGroup" as const,
          source: group,
          capabilities: { ...none, animationPlayback: true }
        };
      })));
    }
    return [root];
  };

  const nodeProperties = (node: SceneNode): PropertyDescriptor[] => [
    { kind: "text", path: "name", label: "Name", value: node.name, section: "General" },
    { kind: "boolean", path: "visible", label: "Visible", value: node.visible !== false, section: "Rendering" },
    { kind: "vector3", path: "position", label: "Position", value: asTuple3(node.position), section: "Transform" },
    { kind: "vector3", path: "rotation", label: "Rotation", value: asTuple3(node.rotation), section: "Transform" },
    { kind: "vector3", path: "scaling", label: "Scaling", value: asTuple3(node.scaling), section: "Transform" }
  ];

  const getProperties = (entity: LiteEntity): PropertyDescriptor[] => {
    const source = entity.source;
    const base: PropertyDescriptor[] = [
      { kind: "readonly", path: "$kind", label: "Kind", value: entity.kind, section: "General" },
      { kind: "readonly", path: "$id", label: "Explorer ID", value: entity.id, section: "General" }
    ];
    if (!source || typeof source !== "object") return base;
    const knownKind = entityTypes.get(source);
    if (knownKind === "mesh" || knownKind === "transform") return [...base, ...nodeProperties(source as SceneNode)];
    if (knownKind === "camera") {
      const camera = source as Camera;
      return [...base,
        { kind: "number", path: "fov", label: "Field of view", value: camera.fov, min: 0.01, max: Math.PI, step: 0.01, section: "Camera" },
        { kind: "number", path: "nearPlane", label: "Near plane", value: camera.nearPlane, min: 0.0001, step: 0.01, section: "Camera" },
        { kind: "number", path: "farPlane", label: "Far plane", value: camera.farPlane, min: 0.001, step: 1, section: "Camera" }
      ];
    }
    if (knownKind === "light") {
      const light = source as LightBase & { intensity?: number; direction?: SceneNode["position"]; position?: SceneNode["position"] };
      const values: PropertyDescriptor[] = [...base, { kind: "readonly", path: "lightType", label: "Type", value: light.lightType, section: "Light" }];
      if (typeof light.intensity === "number") values.push({ kind: "number", path: "intensity", label: "Intensity", value: light.intensity, min: 0, step: 0.05, section: "Light" });
      if (light.position) values.push({ kind: "vector3", path: "position", label: "Position", value: asTuple3(light.position), section: "Light" });
      if (light.direction) values.push({ kind: "vector3", path: "direction", label: "Direction", value: asTuple3(light.direction), section: "Light" });
      return values;
    }
    if (knownKind === "material") {
      const material = source as Material;
      const values: PropertyDescriptor[] = [
        ...base,
        { kind: "text", path: "name", label: "Name", value: material.name ?? "", section: "Material" }
      ];
      if (isPublicPbrMaterial(material)) {
        if (material.baseColorFactor) values.push({ kind: "color4", path: "baseColorFactor", label: "Base color", value: [...material.baseColorFactor], section: "Material" });
        if (typeof material.metallicFactor === "number") values.push({ kind: "number", path: "metallicFactor", label: "Metallic", value: material.metallicFactor, min: 0, max: 1, step: 0.01, section: "Material" });
        if (typeof material.roughnessFactor === "number") values.push({ kind: "number", path: "roughnessFactor", label: "Roughness", value: material.roughnessFactor, min: 0, max: 1, step: 0.01, section: "Material" });
        if (typeof material.alpha === "number") values.push({ kind: "number", path: "alpha", label: "Alpha", value: material.alpha, min: 0, max: 1, step: 0.01, section: "Material" });
        if (typeof material.doubleSided === "boolean") values.push({ kind: "boolean", path: "doubleSided", label: "Double sided", value: material.doubleSided, section: "Material", readonly: true });
      }
      return values;
    }
    if (knownKind === "texture") {
      const texture = source as Texture2D;
      const usages = Array.isArray(entity.meta?.usages) ? entity.meta.usages.filter((value): value is string => typeof value === "string") : [];
      return [...base,
        { kind: "readonly", path: "usages", label: "Used by", value: usages.join(", "), section: "Texture" },
        { kind: "number", path: "width", label: "Width", value: texture.width, readonly: true, section: "Texture" },
        { kind: "number", path: "height", label: "Height", value: texture.height, readonly: true, section: "Texture" },
        { kind: "number", path: "uScale", label: "U scale", value: texture.uScale ?? 1, readonly: true, section: "UV Transform" },
        { kind: "number", path: "vScale", label: "V scale", value: texture.vScale ?? 1, readonly: true, section: "UV Transform" },
        { kind: "number", path: "uOffset", label: "U offset", value: texture.uOffset ?? 0, readonly: true, section: "UV Transform" },
        { kind: "number", path: "vOffset", label: "V offset", value: texture.vOffset ?? 0, readonly: true, section: "UV Transform" },
        { kind: "number", path: "uAng", label: "UV rotation", value: texture.uAng ?? 0, readonly: true, section: "UV Transform" },
        { kind: "boolean", path: "invertY", label: "Invert Y", value: texture.invertY ?? false, readonly: true, section: "UV Transform" }
      ];
    }
    if (knownKind === "animationGroup") {
      const group = source as AnimationGroup;
      const frameRate = group.frameRate ?? 60;
      const currentTime = getAnimationTime(group);
      return [...base,
        { kind: "readonly", path: "name", label: "Name", value: group.name, section: "Animation" },
        { kind: "number", path: "duration", label: "Duration", value: group.duration, readonly: true, section: "Animation" },
        { kind: "number", path: "currentTime", label: "Current time", value: Number(currentTime.toFixed(2)), readonly: true, step: 0.01, section: "Playback" },
        { kind: "number", path: "currentFrame", label: "Current frame", value: Math.round(currentTime * frameRate), readonly: true, section: "Playback" },
        { kind: "boolean", path: "isPlaying", label: "Playing", value: group.isPlaying, readonly: true, section: "Playback" },
        { kind: "number", path: "speedRatio", label: "Speed ratio", value: group.speedRatio, readonly: true, section: "Playback" },
        { kind: "boolean", path: "loopAnimation", label: "Loop", value: group.loopAnimation, readonly: true, section: "Playback" }
      ];
    }
    if (knownKind === "scene") {
      const scene = source as SceneContext;
      return [...base,
        { kind: "readonly", path: "meshCount", label: "Meshes", value: String(scene.meshes.length), section: "Scene" },
        { kind: "readonly", path: "lightCount", label: "Lights", value: String(scene.lights.length), section: "Scene" }
      ];
    }
    return base;
  };

  const setProperty: LiteSceneAdapter["setProperty"] = async (entity, path, value, context) => {
    const source = entity.source;
    if (!source || typeof source !== "object") return fail("unsupported", "This entity has no editable public source.");
    const kind = entityTypes.get(source);
    try {
      if (kind === "mesh" || kind === "transform") {
        const node = source as SceneNode;
        if (path === "name" && typeof value === "string") node.name = value;
        else if (path === "visible" && typeof value === "boolean") setSubtreeVisible(node, value);
        else if ((path === "position" || path === "rotation" || path === "scaling") && Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) {
          const tuple = value as [number, number, number];
          if (path === "scaling" && tuple.some((part) => part === 0)) return fail("invalid", "Scaling components cannot be exactly zero.");
          node[path].set(tuple[0], tuple[1], tuple[2]);
        } else return fail("invalid", `Invalid value for ${path}.`);
        return ok();
      }
      if (kind === "camera" && ["fov", "nearPlane", "farPlane"].includes(path) && typeof value === "number" && Number.isFinite(value)) {
        const camera = source as Camera;
        if (path === "fov") camera.fov = Math.min(Math.PI, Math.max(0.01, value));
        if (path === "nearPlane") camera.nearPlane = Math.max(0.0001, value);
        if (path === "farPlane") camera.farPlane = Math.max(camera.nearPlane + 0.0001, value);
        return ok();
      }
      if (kind === "light") {
        const light = source as LightBase & { intensity?: number; direction?: SceneNode["position"]; position?: SceneNode["position"] };
        if (path === "intensity" && typeof value === "number" && "intensity" in light) light.intensity = Math.max(0, value);
        else if ((path === "direction" || path === "position") && Array.isArray(value) && value.length === 3 && light[path]) light[path]!.set(Number(value[0]), Number(value[1]), Number(value[2]));
        else return fail("invalid", `Invalid value for ${path}.`);
        return ok();
      }
      if (kind === "material") {
        const material = source as Material;
        if (path === "name" && typeof value === "string") { material.name = value; return ok(); }
        if (!isPublicPbrMaterial(material)) return fail("unsupported", "Only verified public PBR fields are editable.");
        if (path === "baseColorFactor" && Array.isArray(value) && value.length === 4 && value.every(Number.isFinite)) {
          material.baseColorFactor = [clamp01(Number(value[0])), clamp01(Number(value[1])), clamp01(Number(value[2])), clamp01(Number(value[3]))];
        } else if ((path === "metallicFactor" || path === "roughnessFactor" || path === "alpha") && typeof value === "number" && Number.isFinite(value)) {
          material[path] = clamp01(value);
        } else {
          return fail("invalid", `Invalid value for ${path}.`);
        }
        const { markMaterialUboDirty } = await import("@babylonjs/lite");
        markMaterialUboDirty(material);
        return ok();
      }
      return fail("unsupported", "This property is read-only in the official adapter.");
    } catch (error) {
      return fail("failed", error instanceof Error ? error.message : "The public API write failed.");
    }
  };

  const getStats = (context: LiteExplorerContext): LiteStats => {
    const stats: LiteStats = {};
    if (isPublicEngine(context.engine)) {
      stats.drawCallCount = context.engine.drawCallCount;
      if (context.engine.gpuFrameTimeMs > 0) stats.gpuFrameTimeMs = context.engine.gpuFrameTimeMs;
      stats.surfaceCount = context.engine.surfaces.length;
    }
    if (isPublicScene(context.scene)) {
      stats.meshCount = context.scene.meshes.length;
      stats.lightCount = context.scene.lights.length;
      stats.materialCount = new Set(context.scene.meshes.map((mesh) => mesh.material)).size;
    }
    return stats;
  };

  const playAnimationGroup: NonNullable<LiteSceneAdapter["playAnimationGroup"]> = (entity, context) => {
    if (!isPublicScene(context.scene)) return fail("unsupported", "Animation playback requires a public Babylon Lite SceneContext.");
    const source = entity.source;
    if (!source || typeof source !== "object" || entityTypes.get(source) !== "animationGroup") return fail("unsupported", "This entity is not an animation group.");
    const selected = source as AnimationGroup;
    if (!context.scene.animationGroups.includes(selected)) return fail("unsupported", "This animation group does not belong to the current scene.");
    const now = performance.now();
    for (const group of context.scene.animationGroups) {
      stopAnimation(group);
      animationClocks.set(group, { time: 0, publicTime: 0, sampledAt: now, wasPlaying: false });
    }
    playAnimation(selected);
    animationClocks.set(selected, { time: 0, publicTime: 0, sampledAt: now, wasPlaying: true });
    return ok();
  };

  const stopAnimationGroup: NonNullable<LiteSceneAdapter["stopAnimationGroup"]> = (entity, context) => {
    if (!isPublicScene(context.scene)) return fail("unsupported", "Animation playback requires a public Babylon Lite SceneContext.");
    const source = entity.source;
    if (!source || typeof source !== "object" || entityTypes.get(source) !== "animationGroup") return fail("unsupported", "This entity is not an animation group.");
    const selected = source as AnimationGroup;
    if (!context.scene.animationGroups.includes(selected)) return fail("unsupported", "This animation group does not belong to the current scene.");
    stopAnimation(selected);
    animationClocks.set(selected, { time: 0, publicTime: 0, sampledAt: performance.now(), wasPlaying: false });
    return ok();
  };

  const pickEntityId: NonNullable<LiteSceneAdapter["pickEntityId"]> = async (x, y, context) => {
    if (!isPublicScene(context.scene)) return fail("unsupported", "Canvas picking requires a public Babylon Lite SceneContext.");
    try {
      const lite = await import("@babylonjs/lite");
      let picker = pickerByScene.get(context.scene);
      if (!picker) {
        picker = lite.createGpuPicker(context.scene);
        pickerByScene.set(context.scene, picker);
        pickers.add(picker);
      }
      disposePickerPublic = lite.disposePicker;
      const result = await lite.pickAsync(picker, x, y);
      if (!result.hit || !result.pickedMesh) return ok(null);
      return ok(objectIds.get(result.pickedMesh) ?? null);
    } catch (error) {
      return fail("failed", error instanceof Error ? error.message : "Canvas picking failed.");
    }
  };

  const getEntitySnapshot: NonNullable<LiteSceneAdapter["getEntitySnapshot"]> = (entity) => {
    const snapshot: Record<string, unknown> = {};
    for (const descriptor of getProperties(entity)) {
      if (!descriptor.path.startsWith("$")) snapshot[descriptor.path] = descriptor.value;
    }
    return ok(snapshot);
  };

  return {
    getSceneTree,
    getProperties,
    setProperty,
    getStats,
    pickEntityId,
    setEntityVisible: async (entity, visible, context) => setProperty(entity, "visible", visible, context),
    playAnimationGroup,
    stopAnimationGroup,
    getEntitySnapshot,
    dispose() {
      if (disposePickerPublic) for (const picker of pickers) disposePickerPublic(picker);
      pickers.clear();
    }
  };
}
