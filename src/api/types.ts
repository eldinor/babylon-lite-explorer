import type { LiteSceneAdapter } from "../adapter/LiteSceneAdapter";

export type LiteInspectorTheme = "dark" | "light";
export type LiteInspectorMode = "overlay" | "inline";
export type LiteInspectorLayout = "single" | "split";

export type LiteInspectorContext = {
  engine: unknown;
  scene: unknown;
  canvas?: HTMLCanvasElement;
};

export type LiteInspectorOptions = {
  container?: HTMLElement;
  canvas?: HTMLCanvasElement;
  mode?: LiteInspectorMode;
  /** Compact panel layout. Defaults to `single`. */
  layout?: LiteInspectorLayout;
  theme?: LiteInspectorTheme;
  initiallyOpen?: boolean;
  adapter?: LiteSceneAdapter;
  title?: string;
};

export type LiteInspectorHandle = {
  readonly ready: Promise<void>;
  dispose(): void;
  show(): void;
  hide(): void;
  toggle(): void;
  refresh(): Promise<void>;
};
