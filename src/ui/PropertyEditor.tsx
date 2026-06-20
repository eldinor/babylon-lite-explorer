import { useEffect, useState } from "preact/hooks";
import type { PropertyDescriptor } from "../adapter/propertyDescriptors";
import { useInspectorRuntime } from "./runtime";

export function PropertyEditor({ descriptor }: { descriptor: PropertyDescriptor }) {
  const { refresh } = useInspectorRuntime();
  if (descriptor.kind === "readonly" || descriptor.readonly) return <span class="bli-readonly" title={String(descriptor.value)}>{String(descriptor.value)}</span>;
  if (descriptor.kind === "boolean") return <input type="checkbox" checked={descriptor.value} onChange={(event) => void refresh.setProperty(descriptor, event.currentTarget.checked)} />;
  if (descriptor.kind === "vector3" || descriptor.kind === "color3" || descriptor.kind === "color4") return <TupleEditor descriptor={descriptor} />;
  if (descriptor.kind === "number") return <ScalarEditor descriptor={descriptor} />;
  return <TextEditor descriptor={descriptor} />;
}

function TextEditor({ descriptor }: { descriptor: Extract<PropertyDescriptor, { kind: "text" }> }) {
  const { refresh } = useInspectorRuntime();
  const [value, setValue] = useState(descriptor.value);
  useEffect(() => setValue(descriptor.value), [descriptor.value]);
  const commit = () => { if (value !== descriptor.value) void refresh.setProperty(descriptor, value); };
  return <input type="text" value={value} onInput={(event) => setValue(event.currentTarget.value)} onBlur={commit} onKeyDown={(event) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { setValue(descriptor.value); event.currentTarget.blur(); }
  }} />;
}

function ScalarEditor({ descriptor }: { descriptor: Extract<PropertyDescriptor, { kind: "number" }> }) {
  const { refresh } = useInspectorRuntime();
  const [value, setValue] = useState(String(descriptor.value));
  useEffect(() => setValue(String(descriptor.value)), [descriptor.value]);
  const commit = () => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed !== descriptor.value) void refresh.setProperty(descriptor, parsed);
    else setValue(String(descriptor.value));
  };
  return <input type="number" value={value} min={descriptor.min} max={descriptor.max} step={descriptor.step} onInput={(event) => setValue(event.currentTarget.value)} onBlur={commit} onKeyDown={(event) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { setValue(String(descriptor.value)); event.currentTarget.blur(); }
  }} />;
}

function TupleEditor({ descriptor }: { descriptor: Extract<PropertyDescriptor, { kind: "vector3" | "color3" | "color4" }> }) {
  const { refresh } = useInspectorRuntime();
  const [values, setValues] = useState(() => descriptor.value.map(String));
  useEffect(() => setValues(descriptor.value.map(String)), [descriptor.value]);
  const commit = () => {
    const tuple = values.map(Number);
    if (tuple.every(Number.isFinite)) void refresh.setProperty(descriptor, tuple);
    else setValues(descriptor.value.map(String));
  };
  return <div class="bli-tuple">{values.map((value, index) => <input key={index} aria-label={`${descriptor.label} ${"XYZW"[index]}`} type="number" step="0.01" value={value} onInput={(event) => {
    const next = [...values]; next[index] = event.currentTarget.value; setValues(next);
  }} onBlur={commit} onKeyDown={(event) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { setValues(descriptor.value.map(String)); event.currentTarget.blur(); }
  }} />)}</div>;
}
