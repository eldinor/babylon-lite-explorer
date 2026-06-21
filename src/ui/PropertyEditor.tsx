import { useEffect, useState } from "preact/hooks";
import type { PropertyDescriptor } from "../adapter/propertyDescriptors";
import { useExplorerRuntime } from "./runtime";

export function PropertyEditor({ descriptor }: { descriptor: PropertyDescriptor }) {
  const { refresh } = useExplorerRuntime();
  if (descriptor.kind === "readonly" || descriptor.readonly) return <span class="ble-readonly" title={String(descriptor.value)}>{String(descriptor.value)}</span>;
  if (descriptor.kind === "boolean") return <input type="checkbox" checked={descriptor.value} onChange={(event) => void refresh.setProperty(descriptor, event.currentTarget.checked)} />;
  if (descriptor.kind === "vector3" || descriptor.kind === "color3" || descriptor.kind === "color4") return <TupleEditor descriptor={descriptor} />;
  if (descriptor.kind === "number") return <ScalarEditor descriptor={descriptor} />;
  return <TextEditor descriptor={descriptor} />;
}

function TextEditor({ descriptor }: { descriptor: Extract<PropertyDescriptor, { kind: "text" }> }) {
  const { refresh } = useExplorerRuntime();
  const [value, setValue] = useState(descriptor.value);
  useEffect(() => setValue(descriptor.value), [descriptor.value]);
  return <input type="text" value={value} onInput={(event) => {
    const next = event.currentTarget.value;
    setValue(next);
    if (next !== descriptor.value) void refresh.setProperty(descriptor, next);
  }} onKeyDown={(event) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { setValue(descriptor.value); void refresh.setProperty(descriptor, descriptor.value); event.currentTarget.blur(); }
  }} />;
}

function ScalarEditor({ descriptor }: { descriptor: Extract<PropertyDescriptor, { kind: "number" }> }) {
  const { refresh } = useExplorerRuntime();
  const [value, setValue] = useState(String(descriptor.value));
  useEffect(() => setValue(String(descriptor.value)), [descriptor.value]);
  return <input type="number" value={value} min={descriptor.min} max={descriptor.max} step={descriptor.step} onInput={(event) => {
    const next = event.currentTarget.value;
    setValue(next);
    const parsed = Number(next);
    if (next !== "" && Number.isFinite(parsed) && parsed !== descriptor.value) void refresh.setProperty(descriptor, parsed);
  }} onKeyDown={(event) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { setValue(String(descriptor.value)); void refresh.setProperty(descriptor, descriptor.value); event.currentTarget.blur(); }
  }} />;
}

function TupleEditor({ descriptor }: { descriptor: Extract<PropertyDescriptor, { kind: "vector3" | "color3" | "color4" }> }) {
  const { refresh } = useExplorerRuntime();
  const [values, setValues] = useState(() => descriptor.value.map(String));
  useEffect(() => setValues(descriptor.value.map(String)), [descriptor.value]);
  return <div class="ble-tuple">{values.map((value, index) => <input key={index} aria-label={`${descriptor.label} ${"XYZW"[index]}`} type="number" step="0.01" value={value} onInput={(event) => {
    const next = [...values];
    next[index] = event.currentTarget.value;
    setValues(next);
    const tuple = next.map(Number);
    if (next.every((part) => part !== "") && tuple.every(Number.isFinite)) void refresh.setProperty(descriptor, tuple);
  }} onKeyDown={(event) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { setValues(descriptor.value.map(String)); void refresh.setProperty(descriptor, [...descriptor.value]); event.currentTarget.blur(); }
  }} />)}</div>;
}
