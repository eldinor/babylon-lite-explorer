import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { ExplorerSignals } from "../signals/createExplorerSignals";
import type { LiteExplorerInstancerPickMode, LiteExplorerLayout, LiteExplorerTheme } from "../api/types";
import type { NotificationService } from "../services/notificationService";
import type { CommandService } from "../services/commandService";
import type { RefreshController } from "../services/refreshController";
import type { ShellService } from "../services/shellService";

export type ExplorerRuntime = {
  signals: ExplorerSignals;
  refresh: RefreshController;
  notifications: NotificationService;
  commands: CommandService;
  shell: ShellService;
  userGuideUrl: string;
  setLayout(layout: LiteExplorerLayout): void;
  setTheme(theme: LiteExplorerTheme): void;
  setPickingActive(active: boolean): void;
  setConfirmEntityRemoval(active: boolean): void;
  setInstancerPickMode(mode: LiteExplorerInstancerPickMode): void;
  hide(): void;
  dispose(): void;
};

export const ExplorerRuntimeContext = createContext<ExplorerRuntime | null>(null);

export function useExplorerRuntime(): ExplorerRuntime {
  const runtime = useContext(ExplorerRuntimeContext);
  if (!runtime) throw new Error("Explorer runtime is unavailable.");
  return runtime;
}
