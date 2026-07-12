export type PropertyBase = {
  path: string;
  label: string;
  section?: string;
  readonly?: boolean;
};

export type PropertyDescriptor =
  | (PropertyBase & { kind: "readonly"; value: string })
  | (PropertyBase & { kind: "entityRef"; value: string; source: unknown })
  | (PropertyBase & { kind: "text"; value: string })
  | (PropertyBase & { kind: "select"; value: string; options: readonly { value: string; label: string }[] })
  | (PropertyBase & { kind: "number"; value: number; min?: number; max?: number; step?: number })
  | (PropertyBase & { kind: "boolean"; value: boolean })
  | (PropertyBase & { kind: "vector3"; value: readonly [number, number, number] })
  | (PropertyBase & { kind: "color3"; value: readonly [number, number, number] })
  | (PropertyBase & { kind: "color4"; value: readonly [number, number, number, number] });
