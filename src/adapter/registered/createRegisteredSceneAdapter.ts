import type { LiteExplorerContext } from "../../api/types";
import type { PropertyDescriptor } from "../propertyDescriptors";
import type { LiteEntity, LiteEntityCapabilities, LiteEntityKind, LiteSceneAdapter } from "../LiteSceneAdapter";

export type LiteRegisteredTextureType = "texture2d" | "dynamic" | "html" | "array";

export type LiteEntityRegistration = {
  id: string;
  kind: LiteEntityKind;
  label: string;
  source: unknown;
  parentId?: string;
  capabilities?: Partial<LiteEntityCapabilities>;
  /** Explicit runtime classification for registered textures. Dynamic and HTML textures require this hint. */
  textureType?: LiteRegisteredTextureType;
};

const defaults: LiteEntityCapabilities = { editable: false, focusable: false, visibilityToggle: false, serializableSnapshot: false };

function isTexture2DSource(source: unknown): source is Record<string, unknown> & { width: number; height: number } {
  if (!source || typeof source !== "object") return false;
  const value = source as Record<string, unknown>;
  return typeof value.width === "number" && typeof value.height === "number"
    && "texture" in value && "view" in value && "sampler" in value;
}

function validLayers(source: unknown): number | null {
  if (!source || typeof source !== "object") return null;
  const layers = (source as Record<string, unknown>).layers;
  return typeof layers === "number" && Number.isInteger(layers) && layers > 0 ? layers : null;
}

function textureLabel(type: LiteRegisteredTextureType): string {
  if (type === "dynamic") return "Dynamic Texture2D";
  if (type === "html") return "HTML Texture2D";
  if (type === "array") return "Texture2D Array";
  return "Texture2D";
}

function defaultProperties(entity: LiteEntity): PropertyDescriptor[] {
  const base: PropertyDescriptor[] = [
    { kind: "readonly", path: "$kind", label: "Kind", value: entity.kind, section: "General" },
    { kind: "readonly", path: "$id", label: "ID", value: entity.id, section: "General" }
  ];
  const type = entity.meta?.registeredTextureType;
  if (entity.kind !== "texture" || typeof type !== "string" || !isTexture2DSource(entity.source)) return base;
  const texture = entity.source;
  const values: PropertyDescriptor[] = [
    { kind: "readonly", path: "$textureType", label: "Type", value: textureLabel(type as LiteRegisteredTextureType), section: "Texture" },
    { kind: "number", path: "width", label: "Width", value: texture.width, readonly: true, section: "Texture" },
    { kind: "number", path: "height", label: "Height", value: texture.height, readonly: true, section: "Texture" }
  ];
  if (type === "array") values.push({ kind: "number", path: "layers", label: "Layers", value: validLayers(texture)!, readonly: true, section: "Texture" });
  const numericFields = [
    ["uScale", "U scale"], ["vScale", "V scale"], ["uOffset", "U offset"], ["vOffset", "V offset"], ["uAng", "UV rotation"]
  ] as const;
  for (const [path, label] of numericFields) if (typeof texture[path] === "number") {
    values.push({ kind: "number", path, label, value: texture[path], readonly: true, section: "UV Transform" });
  }
  if (typeof texture.invertY === "boolean") values.push({ kind: "boolean", path: "invertY", label: "Invert Y", value: texture.invertY, readonly: true, section: "UV Transform" });
  return [...base, ...values];
}

export function createRegisteredSceneAdapter(options: {
  getEntities(context: LiteExplorerContext): LiteEntityRegistration[];
  getProperties?: LiteSceneAdapter["getProperties"];
  setProperty?: LiteSceneAdapter["setProperty"];
  getStats?: LiteSceneAdapter["getStats"];
  getEntitySnapshot?: LiteSceneAdapter["getEntitySnapshot"];
  pickEntity?: LiteSceneAdapter["pickEntity"];
  pickEntityId?: LiteSceneAdapter["pickEntityId"];
  focusEntity?: LiteSceneAdapter["focusEntity"];
  setEntityVisible?: LiteSceneAdapter["setEntityVisible"];
}): LiteSceneAdapter {
  return {
    getSceneTree(context) {
      const registrations = options.getEntities(context);
      const ids = new Set<string>();
      const entities = new Map<string, LiteEntity>();
      for (const item of registrations) {
        if (!item.id || ids.has(item.id)) throw new Error(`Registered entity IDs must be unique: ${item.id || "(empty)"}`);
        if (item.textureType && item.kind !== "texture") throw new Error(`Texture classification is only valid for texture entities: ${item.id}`);
        if (item.textureType && !isTexture2DSource(item.source)) throw new Error(`Registered texture source must expose the public Texture2D shape: ${item.id}`);
        if (item.textureType === "array" && validLayers(item.source) === null) throw new Error(`Registered array texture must expose a positive integer layers value: ${item.id}`);
        const registeredTextureType = item.kind === "texture" && isTexture2DSource(item.source)
          ? item.textureType ?? (validLayers(item.source) !== null ? "array" : "texture2d")
          : undefined;
        ids.add(item.id);
        const { textureType: _textureType, ...registration } = item;
        entities.set(item.id, {
          ...registration,
          capabilities: { ...defaults, ...item.capabilities },
          children: [],
          meta: registeredTextureType ? { registeredTextureType } : undefined
        });
      }
      const roots: LiteEntity[] = [];
      for (const entity of entities.values()) {
        const parent = entity.parentId ? entities.get(entity.parentId) : undefined;
        if (parent) parent.children!.push(entity);
        else roots.push(entity);
      }
      return roots;
    },
    getProperties: options.getProperties ?? defaultProperties,
    setProperty: options.setProperty,
    getStats: options.getStats,
    getEntitySnapshot: options.getEntitySnapshot,
    pickEntity: options.pickEntity,
    pickEntityId: options.pickEntityId,
    focusEntity: options.focusEntity,
    setEntityVisible: options.setEntityVisible
  };
}
