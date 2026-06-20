import type { InspectorRuntime } from "./runtime";
import { InspectorRuntimeContext } from "./runtime";
import { Shell } from "./Shell";

export function App({ runtime, title }: { runtime: InspectorRuntime; title: string }) {
  const { signals } = runtime;
  if (!signals.isOpen.value) return null;
  return <InspectorRuntimeContext.Provider value={runtime}><Shell title={title} /></InspectorRuntimeContext.Provider>;
}
