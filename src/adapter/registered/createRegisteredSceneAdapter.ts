import type { LiteInspectorContext } from "../../api/types";
import type { LiteEntity, LiteEntityCapabilities, LiteEntityKind, LiteSceneAdapter } from "../LiteSceneAdapter";

export type LiteEntityRegistration = {
  id: string;
  kind: LiteEntityKind;
  label: string;
  source: unknown;
  parentId?: string;
  capabilities?: Partial<LiteEntityCapabilities>;
};

const defaults: LiteEntityCapabilities = { editable: false, focusable: false, visibilityToggle: false, serializableSnapshot: false };

export function createRegisteredSceneAdapter(options: {
  getEntities(context: LiteInspectorContext): LiteEntityRegistration[];
  getProperties?: LiteSceneAdapter["getProperties"];
  setProperty?: LiteSceneAdapter["setProperty"];
  getStats?: LiteSceneAdapter["getStats"];
  getEntitySnapshot?: LiteSceneAdapter["getEntitySnapshot"];
}): LiteSceneAdapter {
  return {
    getSceneTree(context) {
      const registrations = options.getEntities(context);
      const ids = new Set<string>();
      const entities = new Map<string, LiteEntity>();
      for (const item of registrations) {
        if (!item.id || ids.has(item.id)) throw new Error(`Registered entity IDs must be unique: ${item.id || "(empty)"}`);
        ids.add(item.id);
        entities.set(item.id, { ...item, capabilities: { ...defaults, ...item.capabilities }, children: [] });
      }
      const roots: LiteEntity[] = [];
      for (const entity of entities.values()) {
        const parent = entity.parentId ? entities.get(entity.parentId) : undefined;
        if (parent) parent.children!.push(entity);
        else roots.push(entity);
      }
      return roots;
    },
    getProperties: options.getProperties ?? ((entity) => [
      { kind: "readonly", path: "$kind", label: "Kind", value: entity.kind, section: "General" },
      { kind: "readonly", path: "$id", label: "ID", value: entity.id, section: "General" }
    ]),
    setProperty: options.setProperty,
    getStats: options.getStats,
    getEntitySnapshot: options.getEntitySnapshot
  };
}
