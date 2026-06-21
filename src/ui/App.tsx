import type { ExplorerRuntime } from "./runtime";
import { ExplorerRuntimeContext } from "./runtime";
import { Shell } from "./Shell";

export function App({ runtime, title }: { runtime: ExplorerRuntime; title: string }) {
  const { signals } = runtime;
  if (!signals.isOpen.value) return null;
  return <ExplorerRuntimeContext.Provider value={runtime}><Shell title={title} /></ExplorerRuntimeContext.Provider>;
}
