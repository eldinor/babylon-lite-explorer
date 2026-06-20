import type { InspectorSignals } from "../signals/createInspectorSignals";

export class StatsService {
  private timer: ReturnType<typeof setInterval> | undefined;
  private last = performance.now();

  constructor(private readonly signals: InspectorSignals) {}

  start(): void {
    this.timer = setInterval(() => { void this.sample(); }, 500);
  }

  private async sample(): Promise<void> {
    const now = performance.now();
    const elapsed = now - this.last;
    this.last = now;
    const context = this.signals.context.value;
    const adapter = this.signals.adapter.value;
    if (!context || !adapter?.getStats) return;
    try {
      const stats = await adapter.getStats(context);
      this.signals.stats.value = { ...stats, frameMs: elapsed / Math.max(1, Math.round(elapsed / 16.67)) };
    } catch { /* stats are optional and must not destabilize the inspector */ }
  }

  dispose(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
}
