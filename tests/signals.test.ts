import { expect, it } from "vitest";
import { createInspectorSignals } from "../src/signals/createInspectorSignals";

it("computes selected entity and filters ancestor branches", () => {
  const signals = createInspectorSignals();
  signals.tree.value = [{ id: "root", label: "Scene", kind: "scene", source: {}, capabilities: { editable: false, focusable: false, visibilityToggle: false, serializableSnapshot: true }, children: [
    { id: "mesh", label: "Blue Sphere", kind: "mesh", source: {}, capabilities: { editable: true, focusable: false, visibilityToggle: true, serializableSnapshot: true } }
  ] }];
  signals.selectedEntityId.value = "mesh";
  expect(signals.selectedEntity.value?.label).toBe("Blue Sphere");
  signals.search.value = "blue";
  expect(signals.filteredTree.value[0].children?.[0].id).toBe("mesh");
});
