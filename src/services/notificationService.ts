import type { InspectorSignals } from "../signals/createInspectorSignals";

export class NotificationService {
  private nextId = 1;
  constructor(private readonly signals: InspectorSignals) {}

  push(message: string, tone: "error" | "info" = "error"): void {
    const item = { id: this.nextId++, tone, message };
    this.signals.notifications.value = [...this.signals.notifications.value.slice(-3), item];
  }

  dismiss(id: number): void {
    this.signals.notifications.value = this.signals.notifications.value.filter((item) => item.id !== id);
  }
}
