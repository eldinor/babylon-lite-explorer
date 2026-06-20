export type LiteInspectorService = { id: string; start?(): void | Promise<void>; dispose(): void };

export class ServiceContainer {
  private readonly services = new Map<string, LiteInspectorService>();
  register<T extends LiteInspectorService>(service: T): T {
    if (this.services.has(service.id)) throw new Error(`Service already registered: ${service.id}`);
    this.services.set(service.id, service);
    return service;
  }
  get<T extends LiteInspectorService>(id: string): T {
    const service = this.services.get(id);
    if (!service) throw new Error(`Missing service: ${id}`);
    return service as T;
  }
  async start(): Promise<void> { for (const service of this.services.values()) await service.start?.(); }
  dispose(): void { for (const service of [...this.services.values()].reverse()) service.dispose(); this.services.clear(); }
}
