import type { ComponentType } from "preact";
import type { LiteEntity } from "../adapter/LiteSceneAdapter";
import type { LiteExplorerContext } from "./types";

export type LiteExplorerExtensionApi = {
  openPanel(id: string): void;
  notify(message: string, tone?: "error" | "info"): void;
  refresh(): Promise<void>;
};

export type LiteExplorerPane = {
  key: string;
  title: string;
  side?: "left" | "right";
  order?: number;
  content: ComponentType;
  keepMounted?: boolean;
};

export type LiteExplorerCommand = {
  id: string;
  label: string;
  when?: (entity: LiteEntity | null) => boolean;
  rowAction?: {
    label?: string;
    icon: string;
    tone?: "default" | "danger";
  };
  run: (entity: LiteEntity | null, context: LiteExplorerContext, api: LiteExplorerExtensionApi) => void | Promise<void>;
};

export type LiteExplorerExtensionRegistration = {
  panes?: readonly LiteExplorerPane[];
  commands?: readonly LiteExplorerCommand[];
};
