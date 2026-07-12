import type { LiteSceneAdapter } from "../adapter/LiteSceneAdapter";
import type { LiteExplorerCommand, LiteExplorerPane } from "./extensions";

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
  | "removeFromScene"
  | "setFog"
  | "setSceneImageProcessing"
  | "setSubtreeVisible"
  | "StandardToneMapping"
  | "stopAnimation"
>;

export type LiteExplorerTheme = "dark" | "light";
export type LiteExplorerMode = "overlay" | "inline";
export type LiteExplorerLayout = "single" | "split";
export type LiteExplorerInstancerPickMode = "instance" | "source";

export type LiteExplorerFeatures = {
  /** Expose adapter-backed camera focus controls. Disabled by default. */
  focusSelected?: boolean;
  /** Select entities by clicking the canvas. Disabled by default. */
  canvasPicking?: boolean;
};

export type LiteExplorerUserSettings = {
  picking?: {
    /** Initial Pick toggle state when canvas picking is available. Defaults to false. */
    enabled?: boolean;
  };
  deletion?: {
    /** Ask before removing entities. Defaults to false. */
    confirmEntityRemoval?: boolean;
  };
  instancer?: {
    /** Registered Instancer picks resolve to stable instances by default. */
    pickMode?: LiteExplorerInstancerPickMode;
  };
  ui?: {
    theme?: LiteExplorerTheme;
    layout?: LiteExplorerLayout;
    keyboardShortcutsEnabled?: boolean;
    notificationsEnabled?: boolean;
    notificationDurationMs?: number;
  };
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
  /** Additional adapters appended after the default adapter, or after `adapter` when provided. */
  adapters?: readonly LiteSceneAdapter[];
  /** Custom panes appended to the Explorer tab system. */
  panes?: readonly LiteExplorerPane[];
  /** Custom command-backed actions, including optional row actions. */
  commands?: readonly LiteExplorerCommand[];
  features?: LiteExplorerFeatures;
  /** Initial user-facing settings. Top-level legacy options still work. */
  userSettings?: LiteExplorerUserSettings;
  /** Notification auto-dismiss delay in milliseconds. Defaults to 3000; use 0 for manual dismissal. */
  notificationDurationMs?: number;
  /** Disable all explorer notifications. Defaults to true. */
  notificationsEnabled?: boolean;
  /** Ask before removing entities. Defaults to false. */
  confirmEntityRemoval?: boolean;
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
