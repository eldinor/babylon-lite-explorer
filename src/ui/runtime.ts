import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { InspectorSignals } from "../signals/createInspectorSignals";
import type { LiteInspectorLayout, LiteInspectorTheme } from "../api/types";
import type { NotificationService } from "../services/notificationService";
import type { CommandService } from "../services/commandService";
import type { RefreshController } from "../services/refreshController";
import type { ShellService } from "../services/shellService";

export type InspectorRuntime = {
  signals: InspectorSignals;
  refresh: RefreshController;
  notifications: NotificationService;
  commands: CommandService;
  shell: ShellService;
  setLayout(layout: LiteInspectorLayout): void;
  setTheme(theme: LiteInspectorTheme): void;
  setPickingActive(active: boolean): void;
  close(): void;
};

export const InspectorRuntimeContext = createContext<InspectorRuntime | null>(null);

export function useInspectorRuntime(): InspectorRuntime {
  const runtime = useContext(InspectorRuntimeContext);
  if (!runtime) throw new Error("Inspector runtime is unavailable.");
  return runtime;
}
