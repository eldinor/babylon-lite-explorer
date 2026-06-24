import type { ExplorerSignals } from "../signals/createExplorerSignals";

export class StatsService {
  private timer: ReturnType<typeof setInterval> | undefined;
  private frameHandle: number | undefined;
  private previousFrameTime: number | undefined;
  private frameTimeTotal = 0;
  private frameCount = 0;
  private sampling = false;

  constructor(private readonly signals: ExplorerSignals) {}

  start(): void {
    if (this.timer) return;
    if (typeof requestAnimationFrame === "function") this.frameHandle = requestAnimationFrame(this.onFrame);
    this.timer = setInterval(() => { void this.sample(); }, 500);
  }

  private readonly onFrame = (time: number) => {
    if (this.previousFrameTime !== undefined) {
      const elapsed = time - this.previousFrameTime;
      if (elapsed > 0 && elapsed < 1000) {
        this.frameTimeTotal += elapsed;
        this.frameCount++;
      }
    }
    this.previousFrameTime = time;
    this.frameHandle = requestAnimationFrame(this.onFrame);
  };

  private async sample(): Promise<void> {
    if (this.sampling) return;
    const context = this.signals.context.value;
    const adapter = this.signals.adapter.value;
    if (!context || !adapter?.getStats) return;
    this.sampling = true;
    const measuredFrameMs = this.frameCount ? this.frameTimeTotal / this.frameCount : undefined;
    this.frameTimeTotal = 0;
    this.frameCount = 0;
    try {
      const stats = await adapter.getStats(context);
      this.signals.stats.value = measuredFrameMs === undefined ? stats : { ...stats, frameMs: measuredFrameMs };
    } catch { /* stats are optional and must not destabilize the explorer */ }
    finally { this.sampling = false; }
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.frameHandle !== undefined && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.frameHandle);
    this.timer = undefined;
    this.frameHandle = undefined;
    this.previousFrameTime = undefined;
    this.frameTimeTotal = 0;
    this.frameCount = 0;
  }
}
