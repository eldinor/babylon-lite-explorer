import type { PropertyDescriptor } from "../adapter/propertyDescriptors";

export function propertyValueToClipboardText(descriptor: PropertyDescriptor): string {
  const value = descriptor.value;
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}
