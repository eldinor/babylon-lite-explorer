import type { ExplorerSignals } from "../signals/createExplorerSignals";
import type { NotificationService } from "./notificationService";
import type { RefreshController } from "./refreshController";

type PointerStart = { x: number; y: number };

export class PickingService {
  private readonly pointers = new Map<number, PointerStart>();
  private generation = 0;
  private started = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly signals: ExplorerSignals,
    private readonly refresh: RefreshController,
    private readonly notifications: NotificationService
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || (event.pointerType !== "touch" && event.button !== 0)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const start = this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;
    const rect = this.canvas.getBoundingClientRect();
    void this.pick(event.clientX - rect.left, event.clientY - rect.top);
  };

  private readonly onPointerCancel = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
  };

  private async pick(x: number, y: number): Promise<void> {
    const request = ++this.generation;
    const adapter = this.signals.adapter.value;
    const context = this.signals.context.value;
    if (!adapter?.pickEntityId || !context) return;
    try {
      const result = await adapter.pickEntityId(x, y, context);
      if (!this.started || request !== this.generation) return;
      if (!result.ok) { this.notifications.push(result.message); return; }
      await this.refresh.select(result.value);
    } catch (error) {
      if (this.started && request === this.generation) this.notifications.push(error instanceof Error ? error.message : "Canvas picking failed.");
    }
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.generation++;
    this.pointers.clear();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
  }

  dispose(): void { this.stop(); }
}
