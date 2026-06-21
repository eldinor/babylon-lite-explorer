import type { ExplorerSignals } from "../signals/createExplorerSignals";

export class NotificationService {
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly signals: ExplorerSignals,
    private readonly durationMs = 3000,
    private readonly enabled = true
  ) {}

  push(message: string, tone: "error" | "info" = "error"): void {
    if (!this.enabled) return;
    const item = { id: this.nextId++, tone, message };
    this.signals.notifications.value = [...this.signals.notifications.value.slice(-3), item];
    if (this.durationMs > 0) {
      this.timers.set(item.id, setTimeout(() => this.dismiss(item.id), this.durationMs));
    }
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    this.signals.notifications.value = this.signals.notifications.value.filter((item) => item.id !== id);
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.signals.notifications.value = [];
  }
}
