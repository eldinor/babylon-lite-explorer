import type { LiteSceneAdapter } from "../adapter/LiteSceneAdapter";

export type LiteExplorerTheme = "dark" | "light";
export type LiteExplorerMode = "overlay" | "inline";
export type LiteExplorerLayout = "single" | "split";

export type LiteExplorerFeatures = {
  /** Expose adapter-backed camera focus controls. Disabled by default. */
  focusSelected?: boolean;
  /** Select entities by clicking the canvas. Disabled by default. */
  canvasPicking?: boolean;
};

export type LiteExplorerContext = {
  engine: unknown;
  scene: unknown;
  canvas?: HTMLCanvasElement;
};

export type LiteExplorerOptions = {
  container?: HTMLElement;
  canvas?: HTMLCanvasElement;
  mode?: LiteExplorerMode;
  /** Compact panel layout. Defaults to `single`. */
  layout?: LiteExplorerLayout;
  theme?: LiteExplorerTheme;
  initiallyOpen?: boolean;
  adapter?: LiteSceneAdapter;
  features?: LiteExplorerFeatures;
  /** Notification auto-dismiss delay in milliseconds. Defaults to 3000; use 0 for manual dismissal. */
  notificationDurationMs?: number;
  /** Disable all explorer notifications. Defaults to true. */
  notificationsEnabled?: boolean;
  title?: string;
};

export type LiteExplorerHandle = {
  readonly ready: Promise<void>;
  dispose(): void;
  show(): void;
  hide(): void;
  toggle(): void;
  refresh(): Promise<void>;
};
