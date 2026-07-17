import {
  AcesToneMapping,
  createGpuPicker,
  disposePicker,
  getMaterialFamily,
  isPbrMaterial,
  isStandardMaterial,
  markMaterialUboDirty,
  NeutralToneMapping,
  pickAsync,
  playAnimation,
  removeFromScene,
  setFog,
  setSceneImageProcessing,
  setSubtreeVisible,
  StandardToneMapping,
  stopAnimation,
  type AnimationGroup,
  type ArcRotateCamera,
  type Camera,
  type EngineContext,
  type FreeCamera,
  type FogConfig,
  type GeospatialCamera,
  type GpuPicker,
  type LightBase,
  type Material,
  type Mesh,
  type PbrMaterialProps,
  type SceneContext,
  type SceneNode,
  type StandardMaterialProps,
  type Texture2D,
  type ToneMapping
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

const sceneCapabilities: LiteEntityCapabilities = { ...none, editable: true };
const removableMeshCapabilities: LiteEntityCapabilities = { ...none, editable: true, visibilityToggle: true, removable: true };

type RemovableLiteEntity = Mesh | SceneNode | LightBase | Camera;

function isPublicScene(value: unknown): value is SceneContext {
  if (!value || typeof value !== "object") return false;
  const scene = value as Partial<SceneContext>;
  return Array.isArray(scene.meshes) && Array.isArray(scene.lights) && Array.isArray(scene.animationGroups) && "camera" in scene;
}

function countSceneCameras(scene: SceneContext): number {
  return scene.camera ? 1 : 0;
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
  if (sheen) {
    add("sheen.texture", sheen.texture);
    add("sheen.roughnessTexture", sheen.roughnessTexture);
  }
  const anisotropy = nested("anisotropy");
  if (anisotropy) add("anisotropy.texture", anisotropy.texture);
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
    const translucency = subsurface.translucency && typeof subsurface.translucency === "object" ? subsurface.translucency as Record<string, unknown> : null;
    if (translucency) {
      add("subsurface.translucency.colorTexture", translucency.colorTexture);
      add("subsurface.translucency.intensityTexture", translucency.intensityTexture);
    }
  }
  return usages;
}

function asTuple3(value: { x: number; y: number; z: number }): readonly [number, number, number] {
  return [value.x, value.y, value.z];
}

function isNumberTuple(value: unknown, length: 3 | 4): value is number[] {
  return Array.isArray(value) && value.length === length && value.every((part) => typeof part === "number" && Number.isFinite(part));
}

function isVec3(value: unknown): value is { x: number; y: number; z: number } {
  if (!value || typeof value !== "object") return false;
  const vector = value as Record<string, unknown>;
  return typeof vector.x === "number" && typeof vector.y === "number" && typeof vector.z === "number";
}

function isArcRotateCamera(camera: Camera): camera is ArcRotateCamera {
  const value = camera as Camera & Record<string, unknown>;
  return typeof value.alpha === "number" && typeof value.beta === "number"
    && typeof value.radius === "number" && isVec3(value.target)
    && typeof value.inertia === "number" && typeof value.panningInertia === "number";
}

function isFreeCamera(camera: Camera): camera is FreeCamera {
  const value = camera as Camera & Record<string, unknown>;
  return isVec3(value.position) && isVec3(value.target)
    && typeof value.speed === "number" && typeof value.angularSensitivity === "number"
    && typeof value.inertia === "number";
}

function isGeospatialCamera(camera: Camera): camera is GeospatialCamera {
  const value = camera as Camera & Record<string, unknown>;
  return isVec3(value.center) && typeof value.yaw === "number" && typeof value.pitch === "number"
    && typeof value.radius === "number" && isVec3(value.position) && isVec3(value.upVector)
    && !!value.limits && typeof value.limits === "object";
}

function setVector(target: { x: number; y: number; z: number }, value: readonly [number, number, number]): void {
  const observable = target as typeof target & { set?: (x: number, y: number, z: number) => void };
  if (typeof observable.set === "function") observable.set(value[0], value[1], value[2]);
  else Object.assign(target, { x: value[0], y: value[1], z: value[2] });
}

function section(id: string, label: string, children: LiteEntity[]): LiteEntity {
  return { id: `section:${id}`, label, kind: "unknown", source: null, children, capabilities: none };
}

type PublicPbrMaterial = Material & Partial<Pick<PbrMaterialProps,
  "baseColorFactor" | "metallicFactor" | "roughnessFactor" | "alpha" | "doubleSided" | "environmentIntensity"
>>;

function isPublicPbrMaterial(material: Material): material is PublicPbrMaterial {
  return isPbrMaterial(material)
    || "baseColorFactor" in material
    || "metallicFactor" in material
    || "roughnessFactor" in material;
}

type PublicStandardMaterial = Material & Partial<Pick<StandardMaterialProps,
  "diffuseColor" | "alpha" | "specularColor" | "specularPower" | "emissiveColor" | "ambientColor"
  | "bumpLevel" | "ambientTexLevel" | "lightmapLevel" | "opacityLevel" | "reflectionLevel"
>>;

function isPublicStandardMaterial(material: Material): material is PublicStandardMaterial {
  if (isStandardMaterial(material)) return true;
  const value = material as Material & Record<string, unknown>;
  return Array.isArray(value.diffuseColor) && Array.isArray(value.specularColor) && typeof value.specularPower === "number";
}

function getPublicMaterialType(material: Material, visited = new Set<object>()): string {
  if (visited.has(material)) return "Material View";
  visited.add(material);
  const value = material as Material & Record<string, unknown>;
  if (value.source && typeof value.source === "object") {
    const sourceType = getPublicMaterialType(value.source as Material, visited);
    return `${sourceType} View`;
  }
  const family = getMaterialFamily(material);
  if (family === "pbr") return "PBR";
  if (family === "standard") return "Standard";
  if (family === "node") return "Node";
  if (family === "shader") return "Shader";
  if (value.inputs && typeof value.inputs === "object") return "Node";
  if (typeof value.vertexSource === "string" && typeof value.fragmentSource === "string") return "Shader";
  if (isPublicPbrMaterial(material)) return "PBR";
  if (isPublicStandardMaterial(material)) return "Standard";
  return "Undetermined / Custom";
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function getToneMappingId(toneMapping: ToneMapping | undefined): string {
  return toneMapping?.id ?? "standard";
}

const toneMappingOptions = [
  { value: "standard", label: "Standard" },
  { value: "aces", label: "ACES" },
  { value: "neutral", label: "Khronos PBR Neutral" }
] as const;

function getToneMappingById(id: string, runtime?: LiteExplorerContext["lite"]): ToneMapping | null {
  if (id === "standard") return runtime?.StandardToneMapping ?? StandardToneMapping;
  if (id === "aces") return runtime?.AcesToneMapping ?? AcesToneMapping;
  if (id === "neutral") return runtime?.NeutralToneMapping ?? NeutralToneMapping;
  return null;
}

function formatMetadataValue(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function metadataProperties(source: object): PropertyDescriptor[] {
  const metadata = (source as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  return Object.entries(metadata as Record<string, unknown>).map(([key, value]) => ({
    kind: "readonly",
    path: `metadata.${key}`,
    label: key,
    value: formatMetadataValue(value),
    section: "Metadata"
  }));
}

export function createDefaultLiteSceneAdapter(): LiteSceneAdapter {
  const objectIds = new WeakMap<object, string>();
  const entityTypes = new WeakMap<object, LiteEntityKind>();
  let nextId = 1;
  const pickers = new Map<GpuPicker, (picker: GpuPicker) => void>();
  const pickerByScene = new WeakMap<object, GpuPicker>();

  const getAnimationTime = (group: AnimationGroup): number => group.currentTime;

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
      capabilities: kind === "mesh" ? removableMeshCapabilities : { ...none, editable: true },
      meta: { liveProperties: true }
    };
  };

  const makeMaterial = (material: Material): LiteEntity => ({
    id: idFor("material", material),
    label: material.name || "Unnamed material",
    kind: "material",
    source: material,
    capabilities: { ...none, editable: isPublicPbrMaterial(material) },
    meta: { liveProperties: true }
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
      capabilities: sceneCapabilities,
      children: [],
      meta: { liveProperties: true }
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
        capabilities: { ...none, editable: true },
        meta: { liveProperties: true }
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
          capabilities: { ...none, editable: true },
          meta: { liveProperties: true }
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
        meta: { usages, liveProperties: true }
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

  const meshDeformationProperties = (mesh: Mesh): PropertyDescriptor[] => {
    const skeleton = mesh.skeleton;
    const morphTargets = mesh.morphTargets;
    const values: PropertyDescriptor[] = [
      { kind: "readonly", path: "skinned", label: "Skinned", value: skeleton ? "Yes" : "No", section: "Deformation" },
      { kind: "readonly", path: "hasMorphTargets", label: "Morph targets", value: morphTargets ? "Yes" : "No", section: "Deformation" }
    ];
    if (skeleton) values.splice(1, 0, { kind: "number", path: "boneCount", label: "Bone count", value: skeleton.boneCount, readonly: true, section: "Deformation" });
    if (morphTargets) {
      values.push(
        { kind: "number", path: "morphTargetCount", label: "Morph target count", value: morphTargets.count, readonly: true, section: "Deformation" },
        { kind: "readonly", path: "morphWeights", label: "Current weights", value: `[${Array.from(morphTargets.weights, (weight) => Number(weight.toFixed(4))).join(", ")}]`, section: "Deformation" }
      );
    }
    return values;
  };

  const cameraProperties = (camera: Camera): PropertyDescriptor[] => {
    const values: PropertyDescriptor[] = [
      { kind: "number", path: "fov", label: "Field of view", value: camera.fov, min: 0.01, max: Math.PI, step: 0.01, section: "Camera" },
      { kind: "number", path: "nearPlane", label: "Near plane", value: camera.nearPlane, min: 0.0001, step: 0.01, section: "Camera" },
      { kind: "number", path: "farPlane", label: "Far plane", value: camera.farPlane, min: 0.001, step: 1, section: "Camera" }
    ];
    if (camera.viewport) {
      values.push(
        { kind: "number", path: "viewport.x", label: "X", value: camera.viewport.x, min: 0, max: 1, step: 0.01, section: "Viewport" },
        { kind: "number", path: "viewport.y", label: "Y", value: camera.viewport.y, min: 0, max: 1, step: 0.01, section: "Viewport" },
        { kind: "number", path: "viewport.width", label: "Width", value: camera.viewport.width, min: 0, max: 1, step: 0.01, section: "Viewport" },
        { kind: "number", path: "viewport.height", label: "Height", value: camera.viewport.height, min: 0, max: 1, step: 0.01, section: "Viewport" }
      );
    }
    if (isArcRotateCamera(camera)) {
      values.unshift({ kind: "readonly", path: "$cameraType", label: "Type", value: "Arc rotate", section: "Camera" });
      values.push(
        { kind: "number", path: "alpha", label: "Alpha", value: camera.alpha, step: 0.01, section: "Orbit" },
        { kind: "number", path: "beta", label: "Beta", value: camera.beta, step: 0.01, section: "Orbit" },
        { kind: "number", path: "radius", label: "Radius", value: camera.radius, min: 0.0001, step: 0.1, section: "Orbit" },
        { kind: "vector3", path: "target", label: "Target", value: asTuple3(camera.target), section: "Orbit" },
        { kind: "number", path: "inertia", label: "Inertia", value: camera.inertia, min: 0, max: 1, step: 0.01, section: "Controls" },
        { kind: "number", path: "panningInertia", label: "Panning inertia", value: camera.panningInertia, min: 0, max: 1, step: 0.01, section: "Controls" },
        { kind: "number", path: "angularSensibility", label: "Angular sensibility", value: camera.angularSensibility, min: 0.0001, step: 1, section: "Controls" },
        { kind: "number", path: "panningSensibility", label: "Panning sensibility", value: camera.panningSensibility, min: 0.0001, step: 1, section: "Controls" },
        { kind: "number", path: "wheelPrecision", label: "Wheel precision", value: camera.wheelPrecision, min: 0.0001, step: 0.1, section: "Controls" }
      );
      const limits = [
        ["lowerAlphaLimit", "Minimum alpha"], ["upperAlphaLimit", "Maximum alpha"],
        ["lowerBetaLimit", "Minimum beta"], ["upperBetaLimit", "Maximum beta"],
        ["lowerRadiusLimit", "Minimum radius"], ["upperRadiusLimit", "Maximum radius"]
      ] as const;
      for (const [path, label] of limits) if (typeof camera[path] === "number") {
        values.push({ kind: "number", path, label, value: camera[path]!, step: 0.01, section: "Limits" });
      }
    } else if (isFreeCamera(camera)) {
      values.unshift({ kind: "readonly", path: "$cameraType", label: "Type", value: "Free", section: "Camera" });
      values.push(
        { kind: "vector3", path: "position", label: "Position", value: asTuple3(camera.position), section: "Transform" },
        { kind: "vector3", path: "target", label: "Target", value: asTuple3(camera.target), section: "Transform" },
        { kind: "number", path: "speed", label: "Speed", value: camera.speed, min: 0, step: 0.1, section: "Controls" },
        { kind: "number", path: "angularSensitivity", label: "Angular sensitivity", value: camera.angularSensitivity, min: 0.0001, step: 1, section: "Controls" },
        { kind: "number", path: "inertia", label: "Inertia", value: camera.inertia, min: 0, max: 1, step: 0.01, section: "Controls" }
      );
    } else if (isGeospatialCamera(camera)) {
      values.unshift({ kind: "readonly", path: "$cameraType", label: "Type", value: "Geospatial", section: "Camera" });
      values.push(
        { kind: "vector3", path: "center", label: "Center", value: asTuple3(camera.center), section: "Orbit" },
        { kind: "number", path: "yaw", label: "Yaw", value: camera.yaw, step: 0.01, section: "Orbit" },
        { kind: "number", path: "pitch", label: "Pitch", value: camera.pitch, step: 0.01, section: "Orbit" },
        { kind: "number", path: "radius", label: "Radius", value: camera.radius, min: 0.0001, step: 1, section: "Orbit" },
        { kind: "vector3", path: "position", label: "Position", value: asTuple3(camera.position), readonly: true, section: "Derived" },
        { kind: "vector3", path: "upVector", label: "Up vector", value: asTuple3(camera.upVector), readonly: true, section: "Derived" }
      );
      const limits = [
        ["radiusMin", "Minimum radius"], ["radiusMax", "Maximum radius"],
        ["pitchMin", "Minimum pitch"], ["pitchMax", "Maximum pitch"],
        ["yawMin", "Minimum yaw"], ["yawMax", "Maximum yaw"]
      ] as const;
      for (const [path, label] of limits) if (Number.isFinite(camera.limits[path])) {
        values.push({ kind: "number", path: `limits.${path}`, label, value: camera.limits[path], step: 0.01, section: "Limits" });
      }
    } else {
      values.unshift({ kind: "readonly", path: "$cameraType", label: "Type", value: "Camera", section: "Camera" });
    }
    return values;
  };

  const getProperties = (entity: LiteEntity): PropertyDescriptor[] => {
    const source = entity.source;
    const base: PropertyDescriptor[] = [
      { kind: "readonly", path: "$kind", label: "Kind", value: entity.kind, section: "General" },
      { kind: "readonly", path: "$id", label: "Explorer ID", value: entity.id, section: "General" }
    ];
    if (!source || typeof source !== "object") return base;
    const metadata = metadataProperties(source);
    const knownKind = entityTypes.get(source);
    if (knownKind === "mesh") return [...base, ...nodeProperties(source as Mesh), ...meshDeformationProperties(source as Mesh), ...metadata];
    if (knownKind === "transform") return [...base, ...nodeProperties(source as SceneNode), ...metadata];
    if (knownKind === "camera") {
      const camera = source as Camera;
      return [...base, ...cameraProperties(camera), ...metadata];
    }
    if (knownKind === "light") {
      const light = source as LightBase & { intensity?: number; direction?: SceneNode["position"]; position?: SceneNode["position"] };
      const values: PropertyDescriptor[] = [...base, { kind: "readonly", path: "lightType", label: "Type", value: light.lightType, section: "Light" }];
      if (typeof light.intensity === "number") values.push({ kind: "number", path: "intensity", label: "Intensity", value: light.intensity, min: 0, step: 0.05, section: "Light" });
      if (light.position) values.push({ kind: "vector3", path: "position", label: "Position", value: asTuple3(light.position), section: "Light" });
      if (light.direction) values.push({ kind: "vector3", path: "direction", label: "Direction", value: asTuple3(light.direction), section: "Light" });
      values.push(...metadata);
      return values;
    }
    if (knownKind === "material") {
      const material = source as Material;
      const values: PropertyDescriptor[] = [
        ...base,
        { kind: "readonly", path: "$materialType", label: "Type", value: getPublicMaterialType(material), section: "Material" },
        { kind: "text", path: "name", label: "Name", value: material.name ?? "", section: "Material" }
      ];
      if (isPublicPbrMaterial(material)) {
        if (material.baseColorFactor) values.push({ kind: "color4", path: "baseColorFactor", label: "Base color", value: [...material.baseColorFactor], section: "Material" });
        if (typeof material.metallicFactor === "number") values.push({ kind: "number", path: "metallicFactor", label: "Metallic", value: material.metallicFactor, min: 0, max: 1, step: 0.01, section: "Material" });
        if (typeof material.roughnessFactor === "number") values.push({ kind: "number", path: "roughnessFactor", label: "Roughness", value: material.roughnessFactor, min: 0, max: 1, step: 0.01, section: "Material" });
        if (typeof material.alpha === "number") values.push({ kind: "number", path: "alpha", label: "Alpha", value: material.alpha, min: 0, max: 1, step: 0.01, section: "Material" });
        values.push({ kind: "number", path: "environmentIntensity", label: "Environment intensity", value: material.environmentIntensity ?? 1, min: 0, step: 0.01, section: "Environment" });
        if (typeof material.doubleSided === "boolean") values.push({ kind: "boolean", path: "doubleSided", label: "Double sided", value: material.doubleSided, section: "Material", readonly: true });
      }
      if (isPublicStandardMaterial(material)) {
        if (material.diffuseColor) values.push({ kind: "color3", path: "diffuseColor", label: "Diffuse color", value: [...material.diffuseColor], section: "Material" });
        if (typeof material.alpha === "number") values.push({ kind: "number", path: "alpha", label: "Alpha", value: material.alpha, min: 0, max: 1, step: 0.01, section: "Material" });
        if (material.specularColor) values.push({ kind: "color3", path: "specularColor", label: "Specular color", value: [...material.specularColor], section: "Material" });
        if (typeof material.specularPower === "number") values.push({ kind: "number", path: "specularPower", label: "Specular power", value: material.specularPower, min: 0, step: 1, section: "Material" });
        if (material.emissiveColor) values.push({ kind: "color3", path: "emissiveColor", label: "Emissive color", value: [...material.emissiveColor], section: "Material" });
        if (material.ambientColor) values.push({ kind: "color3", path: "ambientColor", label: "Ambient color", value: [...material.ambientColor], section: "Material" });
        const textureLevels = [
          ["bumpLevel", "Bump level"], ["ambientTexLevel", "Ambient level"], ["lightmapLevel", "Lightmap level"],
          ["opacityLevel", "Opacity level"], ["reflectionLevel", "Reflection level"]
        ] as const;
        for (const [path, label] of textureLevels) if (typeof material[path] === "number") {
          values.push({ kind: "number", path, label, value: material[path], min: 0, step: 0.01, section: "Texture Levels" });
        }
      }
      values.push(...metadata);
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
        { kind: "boolean", path: "invertY", label: "Invert Y", value: texture.invertY ?? false, readonly: true, section: "UV Transform" },
        ...metadata
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
        { kind: "boolean", path: "loopAnimation", label: "Loop", value: group.loopAnimation, readonly: true, section: "Playback" },
        ...metadata
      ];
    }
    if (knownKind === "scene") {
      const scene = source as SceneContext;
      const values: PropertyDescriptor[] = [...base,
        { kind: "readonly", path: "meshCount", label: "Meshes", value: String(scene.meshes.length), section: "Scene" },
        { kind: "readonly", path: "lightCount", label: "Lights", value: String(scene.lights.length), section: "Scene" },
        { kind: "readonly", path: "shadowGeneratorCount", label: "Shadow generators", value: String(scene.shadowGenerators.length), section: "Scene" },
        { kind: "number", path: "fixedDeltaMs", label: "Fixed delta (ms)", value: scene.fixedDeltaMs, min: 0, step: 0.01, section: "Scene" }
      ];
      const clearColor = scene.clearColor;
      if ([clearColor.r, clearColor.g, clearColor.b, clearColor.a].every((part) => typeof part === "number" && Number.isFinite(part))) {
        values.push({ kind: "color4", path: "clearColor", label: "Clear color", value: [clearColor.r, clearColor.g, clearColor.b, clearColor.a], section: "Scene" });
      }
      const imageProcessing = scene.imageProcessing;
      if (typeof imageProcessing.exposure === "number") values.push({ kind: "number", path: "imageProcessing.exposure", label: "Exposure", value: imageProcessing.exposure, min: 0, step: 0.01, section: "Image Processing" });
      if (typeof imageProcessing.contrast === "number") values.push({ kind: "number", path: "imageProcessing.contrast", label: "Contrast", value: imageProcessing.contrast, min: 0, step: 0.01, section: "Image Processing" });
      if (typeof imageProcessing.toneMappingEnabled === "boolean") values.push({ kind: "boolean", path: "imageProcessing.toneMappingEnabled", label: "Tone mapping", value: imageProcessing.toneMappingEnabled, section: "Image Processing" });
      values.push({
        kind: "select",
        path: "imageProcessing.toneMapping",
        label: "Tone mapping type",
        value: getToneMappingId(imageProcessing.toneMapping),
        options: toneMappingOptions,
        section: "Image Processing"
      });
      if (isNumberTuple(scene.environmentPrimaryColor, 3)) values.push({ kind: "color3", path: "environmentPrimaryColor", label: "Environment primary color", value: [...scene.environmentPrimaryColor], section: "Environment" });
      if (typeof scene.envRotationY === "number") values.push({ kind: "number", path: "envRotationY", label: "Environment Y rotation", value: scene.envRotationY, step: 0.01, section: "Environment" });
      if (scene.fog) {
        values.push(
          { kind: "select", path: "fog.mode", label: "Mode", value: String(scene.fog.mode), options: [
            { value: "0", label: "Disabled" }, { value: "1", label: "Exponential" },
            { value: "2", label: "Exponential squared" }, { value: "3", label: "Linear" }
          ], section: "Fog" },
          { kind: "number", path: "fog.density", label: "Density", value: scene.fog.density, min: 0, step: 0.001, section: "Fog" },
          { kind: "number", path: "fog.start", label: "Start", value: scene.fog.start, step: 0.1, section: "Fog" },
          { kind: "number", path: "fog.end", label: "End", value: scene.fog.end, step: 0.1, section: "Fog" },
          { kind: "color3", path: "fog.color", label: "Color", value: [...scene.fog.color], section: "Fog" }
        );
      } else {
        values.push({ kind: "readonly", path: "fog", label: "Fog", value: "Disabled", section: "Fog" });
      }
      values.push({
        kind: "readonly",
        path: "clipPlane",
        label: "Clip plane",
        value: scene.clipPlane ? `[${scene.clipPlane.map((part) => part.toFixed(3)).join(", ")}]` : "Disabled",
        section: "Clipping"
      });
      values.push(...metadata);
      return values;
    }
    return base;
  };

  const setProperty: LiteSceneAdapter["setProperty"] = async (entity, path, value, context) => {
    const source = entity.source;
    if (!source || typeof source !== "object") return fail("unsupported", "This entity has no editable public source.");
    const kind = entityTypes.get(source);
    try {
      if (kind === "scene") {
        const scene = source as SceneContext;
        if (path === "clearColor" && isNumberTuple(value, 4)) {
          // Babylon Lite's default render task retains this object from scene creation.
          // Mutate it in place so the renderer observes edits made by the Explorer.
          scene.clearColor.r = clamp01(value[0]);
          scene.clearColor.g = clamp01(value[1]);
          scene.clearColor.b = clamp01(value[2]);
          scene.clearColor.a = clamp01(value[3]);
        } else if (path === "fixedDeltaMs" && typeof value === "number" && Number.isFinite(value)) {
          scene.fixedDeltaMs = Math.max(0, value);
        } else if (path.startsWith("fog.") && scene.fog) {
          const fog: FogConfig = { ...scene.fog, color: [...scene.fog.color] };
          if (path === "fog.mode" && typeof value === "string" && ["0", "1", "2", "3"].includes(value)) fog.mode = Number(value) as FogConfig["mode"];
          else if (path === "fog.density" && typeof value === "number" && Number.isFinite(value)) fog.density = Math.max(0, value);
          else if (path === "fog.start" && typeof value === "number" && Number.isFinite(value)) fog.start = value;
          else if (path === "fog.end" && typeof value === "number" && Number.isFinite(value)) fog.end = value;
          else if (path === "fog.color" && isNumberTuple(value, 3)) fog.color = [clamp01(value[0]), clamp01(value[1]), clamp01(value[2])];
          else return fail("invalid", `Invalid value for ${path}.`);
          (context.lite?.setFog ?? setFog)(scene, fog);
        } else if (path === "imageProcessing.exposure" && typeof value === "number" && Number.isFinite(value)) {
          await (context.lite?.setSceneImageProcessing ?? setSceneImageProcessing)(scene, { exposure: Math.max(0, value) });
        } else if (path === "imageProcessing.contrast" && typeof value === "number" && Number.isFinite(value)) {
          await (context.lite?.setSceneImageProcessing ?? setSceneImageProcessing)(scene, { contrast: Math.max(0, value) });
        } else if (path === "imageProcessing.toneMappingEnabled" && typeof value === "boolean") {
          await (context.lite?.setSceneImageProcessing ?? setSceneImageProcessing)(scene, { toneMappingEnabled: value });
        } else if (path === "imageProcessing.toneMapping" && typeof value === "string") {
          const toneMapping = getToneMappingById(value, context.lite);
          if (!toneMapping) return fail("invalid", `Invalid value for ${path}.`);
          await (context.lite?.setSceneImageProcessing ?? setSceneImageProcessing)(scene, { toneMappingEnabled: true, toneMapping });
        } else if (path === "environmentPrimaryColor" && isNumberTuple(value, 3)) {
          scene.environmentPrimaryColor = [clamp01(value[0]), clamp01(value[1]), clamp01(value[2])];
        } else if (path === "envRotationY" && typeof value === "number" && Number.isFinite(value)) {
          scene.envRotationY = value;
        } else {
          return fail("invalid", `Invalid value for ${path}.`);
        }
        return ok();
      }
      if (kind === "mesh" || kind === "transform") {
        const node = source as SceneNode;
        if (path === "name" && typeof value === "string") node.name = value;
        else if (path === "visible" && typeof value === "boolean") (context.lite?.setSubtreeVisible ?? setSubtreeVisible)(node, value);
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
      if (kind === "camera") {
        const camera = source as Camera;
        if (path.startsWith("viewport.") && camera.viewport && typeof value === "number" && Number.isFinite(value)) {
          const field = path.slice("viewport.".length);
          if (field !== "x" && field !== "y" && field !== "width" && field !== "height") return fail("invalid", `Invalid value for ${path}.`);
          camera.viewport[field] = clamp01(value);
          return ok();
        }
        if (isArcRotateCamera(camera)) {
          if ((path === "alpha" || path === "beta") && typeof value === "number" && Number.isFinite(value)) camera[path] = value;
          else if (path === "radius" && typeof value === "number" && Number.isFinite(value)) camera.radius = Math.max(0.0001, value);
          else if (path === "target" && Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) camera.target = { x: value[0], y: value[1], z: value[2] };
          else if ((path === "inertia" || path === "panningInertia") && typeof value === "number" && Number.isFinite(value)) camera[path] = clamp01(value);
          else if ((path === "angularSensibility" || path === "panningSensibility" || path === "wheelPrecision")
            && typeof value === "number" && Number.isFinite(value)) camera[path] = Math.max(0.0001, value);
          else if (["lowerAlphaLimit", "upperAlphaLimit", "lowerBetaLimit", "upperBetaLimit", "lowerRadiusLimit", "upperRadiusLimit"].includes(path)
            && typeof value === "number" && Number.isFinite(value)) {
            (camera as ArcRotateCamera & Record<string, number | undefined>)[path] = value;
          } else return fail("invalid", `Invalid value for ${path}.`);
          return ok();
        }
        if (isFreeCamera(camera)) {
          if ((path === "position" || path === "target") && Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) {
            setVector(camera[path], value as [number, number, number]);
          } else if (path === "speed" && typeof value === "number" && Number.isFinite(value)) camera.speed = Math.max(0, value);
          else if (path === "angularSensitivity" && typeof value === "number" && Number.isFinite(value)) camera.angularSensitivity = Math.max(0.0001, value);
          else if (path === "inertia" && typeof value === "number" && Number.isFinite(value)) camera.inertia = clamp01(value);
          else return fail("invalid", `Invalid value for ${path}.`);
          return ok();
        }
        if (isGeospatialCamera(camera)) {
          if (path === "center" && Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) camera.center = { x: value[0], y: value[1], z: value[2] };
          else if ((path === "yaw" || path === "pitch") && typeof value === "number" && Number.isFinite(value)) camera[path] = value;
          else if (path === "radius" && typeof value === "number" && Number.isFinite(value)) camera.radius = Math.max(0.0001, value);
          else if (path.startsWith("limits.") && typeof value === "number" && Number.isFinite(value)) {
            const field = path.slice("limits.".length);
            if (!(["radiusMin", "radiusMax", "pitchMin", "pitchMax", "yawMin", "yawMax"] as string[]).includes(field)) return fail("invalid", `Invalid value for ${path}.`);
            (camera.limits as unknown as Record<string, number>)[field] = value;
          } else return fail("invalid", `Invalid value for ${path}.`);
          return ok();
        }
        return fail("unsupported", "This camera property is not available on a recognized public camera type.");
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
        if (isPublicPbrMaterial(material)) {
          if (path === "baseColorFactor" && isNumberTuple(value, 4)) {
            material.baseColorFactor = [clamp01(value[0]), clamp01(value[1]), clamp01(value[2]), clamp01(value[3])];
          } else if ((path === "metallicFactor" || path === "roughnessFactor" || path === "alpha") && typeof value === "number" && Number.isFinite(value)) {
            material[path] = clamp01(value);
          } else if (path === "environmentIntensity" && typeof value === "number" && Number.isFinite(value)) {
            material.environmentIntensity = Math.max(0, value);
          } else {
            return fail("invalid", `Invalid value for ${path}.`);
          }
        } else if (isPublicStandardMaterial(material)) {
          if ((path === "diffuseColor" || path === "specularColor" || path === "emissiveColor" || path === "ambientColor") && isNumberTuple(value, 3)) {
            material[path] = [clamp01(value[0]), clamp01(value[1]), clamp01(value[2])];
          } else if (path === "alpha" && typeof value === "number" && Number.isFinite(value)) {
            material.alpha = clamp01(value);
          } else if (path === "specularPower" && typeof value === "number" && Number.isFinite(value)) {
            material.specularPower = Math.max(0, value);
          } else if ((path === "bumpLevel" || path === "ambientTexLevel" || path === "lightmapLevel" || path === "opacityLevel" || path === "reflectionLevel")
            && typeof value === "number" && Number.isFinite(value)) {
            material[path] = Math.max(0, value);
          } else {
            return fail("invalid", `Invalid value for ${path}.`);
          }
        } else {
          return fail("unsupported", "This material has no verified editable public family.");
        }
        (context.lite?.markMaterialUboDirty ?? markMaterialUboDirty)(material);
        return ok();
      }
      return fail("unsupported", "This property is read-only in the default adapter.");
    } catch (error) {
      return fail("failed", error instanceof Error ? error.message : "The public API write failed.");
    }
  };

  const removeEntity: NonNullable<LiteSceneAdapter["removeEntity"]> = async (entity, context) => {
    if (!isPublicScene(context.scene)) return fail("unsupported", "Entity removal requires a public Babylon Lite SceneContext.");
    if (!entity.source || typeof entity.source !== "object") return fail("unsupported", "This entity has no removable public source.");
    if (entity.kind !== "mesh" && entity.kind !== "transform" && entity.kind !== "light" && entity.kind !== "camera") {
      return fail("unsupported", "This entity cannot be removed from the scene.");
    }
    if (entity.kind === "camera" && context.scene.camera === entity.source && countSceneCameras(context.scene) <= 1) {
      return fail("invalid", "Cannot remove the only camera.");
    }
    try {
      const remove = (context.lite?.removeFromScene ?? removeFromScene) as (scene: SceneContext, source: RemovableLiteEntity) => void;
      remove(context.scene, entity.source as RemovableLiteEntity);
      return ok();
    } catch (error) {
      return fail("failed", error instanceof Error ? error.message : "Entity removal failed.");
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
      stats.animationGroupCount = context.scene.animationGroups.length;
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
    for (const group of context.scene.animationGroups) {
      (context.lite?.stopAnimation ?? stopAnimation)(group);
    }
    (context.lite?.playAnimation ?? playAnimation)(selected);
    return ok();
  };

  const stopAnimationGroup: NonNullable<LiteSceneAdapter["stopAnimationGroup"]> = (entity, context) => {
    if (!isPublicScene(context.scene)) return fail("unsupported", "Animation playback requires a public Babylon Lite SceneContext.");
    const source = entity.source;
    if (!source || typeof source !== "object" || entityTypes.get(source) !== "animationGroup") return fail("unsupported", "This entity is not an animation group.");
    const selected = source as AnimationGroup;
    if (!context.scene.animationGroups.includes(selected)) return fail("unsupported", "This animation group does not belong to the current scene.");
    (context.lite?.stopAnimation ?? stopAnimation)(selected);
    return ok();
  };

  const pickEntityId: NonNullable<LiteSceneAdapter["pickEntityId"]> = async (x, y, context) => {
    if (!isPublicScene(context.scene)) return fail("unsupported", "Canvas picking requires a public Babylon Lite SceneContext.");
    try {
      let picker = pickerByScene.get(context.scene);
      if (!picker) {
        picker = (context.lite?.createGpuPicker ?? createGpuPicker)(context.scene);
        pickerByScene.set(context.scene, picker);
        pickers.set(picker, context.lite?.disposePicker ?? disposePicker);
      }
      const result = await (context.lite?.pickAsync ?? pickAsync)(picker, x, y);
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
    removeEntity,
    playAnimationGroup,
    stopAnimationGroup,
    getEntitySnapshot,
    dispose() {
      for (const [picker, dispose] of pickers) dispose(picker);
      pickers.clear();
    }
  };
}
