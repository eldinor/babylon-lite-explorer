export type LiteExplorerService = { id: string; start?(): void | Promise<void>; dispose(): void };

export class ServiceContainer {
  private readonly services = new Map<string, LiteExplorerService>();
  register<T extends LiteExplorerService>(service: T): T {
    if (this.services.has(service.id)) throw new Error(`Service already registered: ${service.id}`);
    this.services.set(service.id, service);
    return service;
  }
  get<T extends LiteExplorerService>(id: string): T {
    const service = this.services.get(id);
    if (!service) throw new Error(`Missing service: ${id}`);
    return service as T;
  }
  async start(): Promise<void> { for (const service of this.services.values()) await service.start?.(); }
  dispose(): void { for (const service of [...this.services.values()].reverse()) service.dispose(); this.services.clear(); }
}
