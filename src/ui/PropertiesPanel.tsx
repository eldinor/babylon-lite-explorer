import { PropertyEditor } from "./PropertyEditor";
import { useInspectorRuntime } from "./runtime";

export function PropertiesPanel() {
  const { signals } = useInspectorRuntime();
  const entity = signals.selectedEntity.value;
  if (!entity) return <div class="bli-empty">Select an entity to inspect its public properties.</div>;
  const groups = new Map<string, typeof signals.properties.value>();
  for (const descriptor of signals.properties.value) {
    const section = descriptor.section ?? "General";
    groups.set(section, [...(groups.get(section) ?? []), descriptor]);
  }
  return <div class="bli-properties">
    <div class="bli-selection-title">{entity.label}</div>
    {[...groups].map(([section, descriptors]) => <section class="bli-property-section" key={section}>
      <h3>{section}</h3>
      {descriptors.map((descriptor) => <div class="bli-property-row" key={descriptor.path}>
        <label title={descriptor.path}>{descriptor.label}</label>
        <div class="bli-property-control"><PropertyEditor descriptor={descriptor} /></div>
      </div>)}
    </section>)}
  </div>;
}
