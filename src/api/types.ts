import type { LiteSceneAdapter } from "../adapter/LiteSceneAdapter";

export type LiteExplorerRuntime = Pick<typeof import("@babylonjs/lite"),
  | "AcesToneMapping"
  | "addToScene"
  | "createGpuPicker"
  | "disposePicker"
  | "loadGltf"
  | "markMaterialUboDirty"
  | "NeutralToneMapping"
  | "pickAsync"
  | "playAnimation"
  | "setFog"
  | "setSceneImageProcessing"
  | "setSubtreeVisible"
  | "StandardToneMapping"
  | "stopAnimation"
>;

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
  /**
   * The application's Babylon Lite module namespace. Pass this when Explorer and
   * the scene can resolve separate module instances, such as CDN/playground use.
   */
  lite?: LiteExplorerRuntime;
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
  /** Enable global explorer keyboard shortcuts. Defaults to true. */
  keyboardShortcutsEnabled?: boolean;
  /** User Guide URL opened by the footer help icon. */
  userGuideUrl?: string;
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
