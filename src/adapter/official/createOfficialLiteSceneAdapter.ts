import type {
  Camera,
  EngineContext,
  LightBase,
  Material,
  Mesh,
  PbrMaterialProps,
  SceneContext,
  SceneNode
} from "@babylonjs/lite";
import type { LiteInspectorContext } from "../../api/types";
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
  let nextId = 1;

  const idFor = (kind: LiteEntityKind, source: object, explicit?: string): string => {
    const existing = objectIds.get(source);
    if (existing) return existing;
    const id = explicit ? `${kind}:${explicit}:${nextId++}` : `${kind}:object:${nextId++}`;
    objectIds.set(source, id);
    entityTypes.set(source, kind);
    return id;
  };

  const makeNode = (node: SceneNode, kind: "mesh" | "transform", seen: Set<object>): LiteEntity => {
    if (seen.has(node)) {
      return { id: idFor(kind, node), label: `${node.name || kind} (cycle)`, kind, source: node, capabilities: none };
    }
    seen.add(node);
    const children = node.children.map((child) => makeNode(child, "transform", seen));
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

  const getSceneTree = (context: LiteInspectorContext): LiteEntity[] => {
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

    if (scene.camera) {
      entityTypes.set(scene.camera, "camera");
      root.children!.push(section("cameras", "Cameras", [{
        id: idFor("camera", scene.camera),
        label: "Active camera",
        kind: "camera",
        source: scene.camera,
        capabilities: { ...none, editable: true }
      }]));
    }

    if (scene.meshes.length) {
      root.children!.push(section("meshes", "Meshes", scene.meshes.map((mesh) => makeNode(mesh, "mesh", new Set()))));
    }
    if (scene.lights.length) {
      root.children!.push(section("lights", "Lights", scene.lights.map((light, index) => {
        entityTypes.set(light, "light");
        return {
          id: idFor("light", light),
          label: `${light.lightType || "Light"} ${index + 1}`,
          kind: "light" as const,
          source: light,
          capabilities: { ...none, editable: true }
        };
      })));
    }

    const materials = [...new Set(scene.meshes.map((mesh) => mesh.material))];
    if (materials.length) root.children!.push(section("materials", "Materials", materials.map(makeMaterial)));

    if (scene.animationGroups.length) {
      root.children!.push(section("animations", "Animation Groups", scene.animationGroups.map((group, index) => {
        entityTypes.set(group, "animationGroup");
        return {
          id: idFor("animationGroup", group),
          label: `Animation group ${index + 1}`,
          kind: "animationGroup" as const,
          source: group,
          capabilities: none
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
      { kind: "readonly", path: "$id", label: "Inspector ID", value: entity.id, section: "General" }
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
        else if (path === "visible" && typeof value === "boolean") node.visible = value;
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

  const getStats = (context: LiteInspectorContext): LiteStats => {
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

  return {
    getSceneTree,
    getProperties,
    setProperty,
    getStats,
    setEntityVisible: async (entity, visible, context) => setProperty(entity, "visible", visible, context),
    getEntitySnapshot: (entity) => ok({ id: entity.id, label: entity.label, kind: entity.kind, properties: getProperties(entity) })
  };
}
