import type { PropertyDescriptor } from "../adapter/propertyDescriptors";
import type { ExplorerSignals } from "../signals/createExplorerSignals";
import { findEntityById, findEntityPath } from "../signals/treeUtils";
import type { NotificationService } from "./notificationService";

export class RefreshController {
  private generation = 0;
  private disposed = false;
  private readonly propertyWrites = new Map<string, Promise<boolean>>();

  constructor(private readonly signals: ExplorerSignals, private readonly notifications: NotificationService) {}

  async refreshTree(): Promise<void> {
    const request = ++this.generation;
    const context = this.signals.context.value;
    const adapter = this.signals.adapter.value;
    if (!context || !adapter || this.disposed) return;
    this.signals.isRefreshingTree.value = true;
    try {
      const tree = await adapter.getSceneTree(context);
      if (this.disposed || request !== this.generation) return;
      this.signals.tree.value = tree;
      this.signals.sceneVersion.value++;
      const selected = this.signals.selectedEntityId.value;
      if (selected && !findEntityById(tree, selected)) this.signals.selectedEntityId.value = null;
      await this.refreshProperties(request);
    } catch (error) {
      if (!this.disposed && request === this.generation) this.notifications.push(error instanceof Error ? error.message : "Scene refresh failed.");
    } finally {
      if (!this.disposed && request === this.generation) this.signals.isRefreshingTree.value = false;
    }
  }

  async select(id: string | null): Promise<void> {
    this.signals.selectedEntityId.value = id;
    if (id) {
      const path = findEntityPath(this.signals.tree.value, id);
      if (path?.length) {
        const expanded = new Set(this.signals.expandedIds.value);
        for (const ancestor of path.slice(0, -1)) expanded.add(ancestor.id);
        this.signals.expandedIds.value = expanded;
      }
    }
    const request = ++this.generation;
    await this.refreshProperties(request);
  }

  async refreshProperties(request = ++this.generation): Promise<void> {
    const context = this.signals.context.value;
    const adapter = this.signals.adapter.value;
    const entity = this.signals.selectedEntity.value;
    if (!context || !adapter || !entity) {
      this.signals.properties.value = [];
      return;
    }
    const selectedId = entity.id;
    this.signals.isRefreshingProperties.value = true;
    try {
      const properties = await adapter.getProperties(entity, context);
      if (!this.disposed && request === this.generation && this.signals.selectedEntityId.value === selectedId) this.signals.properties.value = properties;
    } catch (error) {
      if (!this.disposed && request === this.generation) this.notifications.push(error instanceof Error ? error.message : "Property refresh failed.");
    } finally {
      if (!this.disposed && request === this.generation) this.signals.isRefreshingProperties.value = false;
    }
  }

  setProperty(descriptor: PropertyDescriptor, value: unknown): Promise<boolean> {
    const context = this.signals.context.value;
    const adapter = this.signals.adapter.value;
    const entity = this.signals.selectedEntity.value;
    if (!context || !adapter?.setProperty || !entity || this.disposed) return Promise.resolve(false);
    const key = `${entity.id}\u0000${descriptor.path}`;
    const previous = this.propertyWrites.get(key) ?? Promise.resolve(true);
    const queued = previous.then(
      () => this.performPropertyWrite(entity, descriptor, value, context, adapter.setProperty!),
      () => this.performPropertyWrite(entity, descriptor, value, context, adapter.setProperty!)
    );
    this.propertyWrites.set(key, queued);
    void queued.finally(() => {
      if (this.propertyWrites.get(key) === queued) this.propertyWrites.delete(key);
    });
    return queued;
  }

  private async performPropertyWrite(
    entity: NonNullable<ExplorerSignals["selectedEntity"]["value"]>,
    descriptor: PropertyDescriptor,
    value: unknown,
    context: NonNullable<ExplorerSignals["context"]["value"]>,
    write: NonNullable<NonNullable<ExplorerSignals["adapter"]["value"]>["setProperty"]>
  ): Promise<boolean> {
    if (this.disposed) return false;
    try {
      const result = await write(entity, descriptor.path, value, context);
      if (!result.ok) { this.notifications.push(result.message); return false; }
      if (descriptor.path === "name") await this.refreshTree();
      else if (this.signals.selectedEntityId.value === entity.id) await this.refreshProperties();
      this.signals.sceneVersion.value++;
      return true;
    } catch (error) {
      this.notifications.push(error instanceof Error ? error.message : "Property update failed.");
      return false;
    }
  }

  dispose(): void { this.disposed = true; this.generation++; this.propertyWrites.clear(); }
}
