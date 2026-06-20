import { describe, expect, it } from "vitest";
import { propertyValueToClipboardText } from "../src/ui/propertyClipboard";

describe("property value clipboard formatting", () => {
  it("copies scalar values as plain text", () => {
    expect(propertyValueToClipboardText({ kind: "text", path: "name", label: "Name", value: "Sphere" })).toBe("Sphere");
    expect(propertyValueToClipboardText({ kind: "number", path: "alpha", label: "Alpha", value: 0.5 })).toBe("0.5");
    expect(propertyValueToClipboardText({ kind: "boolean", path: "visible", label: "Visible", value: false })).toBe("false");
  });

  it("copies tuple values as JSON", () => {
    expect(propertyValueToClipboardText({ kind: "vector3", path: "position", label: "Position", value: [1, 2, 3] })).toBe("[1,2,3]");
    expect(propertyValueToClipboardText({ kind: "color4", path: "color", label: "Color", value: [1, 0.5, 0, 1] })).toBe("[1,0.5,0,1]");
  });
});
