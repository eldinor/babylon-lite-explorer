import type { LiteEntity } from "../adapter/LiteSceneAdapter";

export function findEntityById(tree: readonly LiteEntity[], id: string): LiteEntity | null {
  for (const entity of tree) {
    if (entity.id === id) return entity;
    const found = entity.children ? findEntityById(entity.children, id) : null;
    if (found) return found;
  }
  return null;
}

export function findEntityPath(tree: readonly LiteEntity[], id: string): LiteEntity[] | null {
  for (const entity of tree) {
    if (entity.id === id) return [entity];
    const childPath = entity.children ? findEntityPath(entity.children, id) : null;
    if (childPath) return [entity, ...childPath];
  }
  return null;
}

export function filterTree(tree: readonly LiteEntity[], query: string): LiteEntity[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...tree];
  const visit = (entity: LiteEntity): LiteEntity | null => {
    const children = entity.children?.map(visit).filter((value): value is LiteEntity => value !== null) ?? [];
    if (entity.label.toLocaleLowerCase().includes(normalized) || children.length) {
      return { ...entity, children: children.length ? children : undefined };
    }
    return null;
  };
  return tree.map(visit).filter((value): value is LiteEntity => value !== null);
}
