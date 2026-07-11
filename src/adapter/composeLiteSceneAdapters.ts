import type { LiteExplorerContext } from "../api/types";
import type { LiteEntity, LiteSceneAdapter, LiteStats } from "./LiteSceneAdapter";
import { fail, ok } from "./LiteSceneAdapter";

function visitEntities(entities: LiteEntity[], visit: (entity: LiteEntity) => void): void {
  for (const entity of entities) {
    visit(entity);
    if (entity.children?.length) visitEntities(entity.children, visit);
  }
}

function ownerFor(entity: LiteEntity, owners: Map<string, LiteSceneAdapter>): LiteSceneAdapter | null {
  return owners.get(entity.id) ?? null;
}

function mergeStats(items: LiteStats[]): LiteStats {
  const merged: LiteStats = {};
  for (const stats of items) {
    for (const [key, value] of Object.entries(stats) as [keyof LiteStats, number][]) {
      if (typeof value !== "number") continue;
      merged[key] = key === "fps" || key === "frameMs" || key === "gpuFrameTimeMs"
        ? merged[key] ?? value
        : (merged[key] ?? 0) + value;
    }
  }
  return merged;
}

export function composeLiteSceneAdapters(adapters: readonly LiteSceneAdapter[]): LiteSceneAdapter {
  const owners = new Map<string, LiteSceneAdapter>();

  return {
    async getSceneTree(context: LiteExplorerContext) {
      owners.clear();
      const tree: LiteEntity[] = [];
      for (const adapter of adapters) {
        const roots = await adapter.getSceneTree(context);
        visitEntities(roots, (entity) => {
          const existing = owners.get(entity.id);
          if (existing && existing !== adapter) throw new Error(`Duplicate Explorer entity ID "${entity.id}" across composed adapters.`);
          owners.set(entity.id, adapter);
        });
        tree.push(...roots);
      }
      return tree;
    },

    async getProperties(entity, context) {
      const owner = ownerFor(entity, owners);
      return owner ? owner.getProperties(entity, context) : [];
    },

    async setProperty(entity, path, value, context) {
      const owner = ownerFor(entity, owners);
      return owner?.setProperty ? owner.setProperty(entity, path, value, context) : fail("unsupported", "This entity is read-only.");
    },

    async refresh(context) {
      for (const adapter of adapters) {
        const result = await adapter.refresh?.(context);
        if (result && !result.ok) return result;
      }
      return ok();
    },

    async getStats(context) {
      const stats: LiteStats[] = [];
      for (const adapter of adapters) {
        const item = await adapter.getStats?.(context);
        if (item) stats.push(item);
      }
      return mergeStats(stats);
    },

    async focusEntity(entity, context) {
      const owner = ownerFor(entity, owners);
      return owner?.focusEntity ? owner.focusEntity(entity, context) : fail("unsupported", "This entity cannot be focused.");
    },

    async setEntityVisible(entity, visible, context) {
      const owner = ownerFor(entity, owners);
      return owner?.setEntityVisible ? owner.setEntityVisible(entity, visible, context) : fail("unsupported", "This entity has no visibility toggle.");
    },

    async removeEntity(entity, context) {
      const owner = ownerFor(entity, owners);
      return owner?.removeEntity ? owner.removeEntity(entity, context) : fail("unsupported", "This entity cannot be removed.");
    },

    async playAnimationGroup(entity, context) {
      const owner = ownerFor(entity, owners);
      return owner?.playAnimationGroup ? owner.playAnimationGroup(entity, context) : fail("unsupported", "This entity is not an animation group.");
    },

    async stopAnimationGroup(entity, context) {
      const owner = ownerFor(entity, owners);
      return owner?.stopAnimationGroup ? owner.stopAnimationGroup(entity, context) : fail("unsupported", "This entity is not an animation group.");
    },

    async getEntitySnapshot(entity, context) {
      const owner = ownerFor(entity, owners);
      return owner?.getEntitySnapshot ? owner.getEntitySnapshot(entity, context) : fail("unsupported", "This entity has no snapshot.");
    },

    async pickEntityId(x, y, context) {
      let lastFailure: ReturnType<typeof fail> | null = null;
      for (const adapter of adapters) {
        if (!adapter.pickEntityId) continue;
        const result = await adapter.pickEntityId(x, y, context);
        if (result.ok && result.value) return result;
        if (!result.ok) lastFailure = result;
      }
      return lastFailure ?? ok(null);
    },

    dispose() {
      owners.clear();
    }
  };
}
