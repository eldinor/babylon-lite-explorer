import { signal } from "@preact/signals";
import { createGpuPicker, disposePicker, pickAsync, type GpuPicker } from "@babylonjs/lite";
import type { LiteEntity, LiteSceneAdapter } from "../LiteSceneAdapter";
import { fail, ok } from "../LiteSceneAdapter";
import type { PropertyDescriptor } from "../propertyDescriptors";
import { useExplorerRuntime } from "../../ui/runtime";

export type InstancerEntryLike<TMetadata = unknown> = {
  id: number;
  slot: number;
  metadata?: TMetadata;
};

export type InstancerSetLike<TMetadata = unknown> = {
  count: number;
  capacity: number;
  visibleCount: number;
  mesh?: unknown;
  root?: unknown;
  pool?: unknown;
  set?: unknown;
  clips?: unknown;
  entries(): Iterable<InstancerEntryLike<TMetadata>>;
  getMetadata?(id: number): TMetadata | undefined;
  getVisible?(id: number): boolean;
  setVisible?(id: number, visible: boolean): void;
  getMatrix?(id: number): ArrayLike<number>;
  getPosition?(id: number): ArrayLike<number>;
  setPosition?(id: number, position: readonly [number, number, number]): void;
  setTransform?(id: number, transform: {
    position?: readonly [number, number, number];
    rotationEuler?: readonly [number, number, number];
    scale?: readonly [number, number, number] | number;
  }): void;
  setScale?(id: number, scale: readonly [number, number, number] | number): void;
  getColor?(id: number): ArrayLike<number>;
  setColor?(id: number, color: readonly [number, number, number, number]): void;
  getClip?(id: number): string | undefined;
};

export type InstancerInstanceSnapshot<TMetadata = unknown> = {
  id: number;
  slot: number;
  label: string;
  visible?: boolean;
  position?: readonly [number, number, number];
  rotationEuler?: readonly [number, number, number];
  scale?: readonly [number, number, number];
  color?: readonly [number, number, number, number];
  clip?: string;
  matrix?: readonly number[];
  metadata?: TMetadata;
};

export type InstancerSetSnapshot<TMetadata = unknown> = {
  id: string;
  label: string;
  kind: "thin" | "hierarchy" | "vat" | "custom";
  sourceLabel: string;
  count: number;
  visibleCount: number;
  capacity: number;
  instances: InstancerInstanceSnapshot<TMetadata>[];
};

export type InstancerRegisterOptions<TMetadata = unknown> = {
  id?: string;
  label?: string;
  getLabel?: (id: number, metadata: TMetadata | undefined, slot: number | undefined) => string;
  serializeMetadata?: (metadata: TMetadata | undefined, id: number) => unknown;
  saveSet?: (snapshot: InstancerSetSnapshot<unknown>) => void | Promise<void>;
};

export type InstancerExplorerAdapter = LiteSceneAdapter & {
  register<TMetadata = unknown>(set: InstancerSetLike<TMetadata>, options?: InstancerRegisterOptions<TMetadata>): void;
  exportSet<TMetadata = unknown>(set: InstancerSetLike<TMetadata>): InstancerSetSnapshot<unknown>;
};

type RecordItem = {
  id: string;
  label: string;
  kind: "thin" | "hierarchy" | "vat" | "custom";
  source: unknown;
  sourceLabel: string;
  set: InstancerSetLike;
  getLabel?: (id: number, metadata: unknown, slot: number | undefined) => string;
  serializeMetadata?: (metadata: unknown, id: number) => unknown;
  saveSet?: (snapshot: InstancerSetSnapshot<unknown>) => void | Promise<void>;
  transformCache: Map<number, {
    rotationEuler?: readonly [number, number, number];
    scale?: readonly [number, number, number];
  }>;
};

type InstanceSource = {
  record: RecordItem;
  id: number;
};

const readonlyCapabilities = { editable: false, focusable: false, visibilityToggle: false, serializableSnapshot: true };
const instanceCapabilities = { editable: true, focusable: false, visibilityToggle: true, serializableSnapshot: true };

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function getName(source: unknown): string | undefined {
  return isObject(source) && typeof source.name === "string" && source.name.trim() ? source.name : undefined;
}

function inferKind(set: InstancerSetLike): RecordItem["kind"] {
  if ("clips" in set && "set" in set) return "vat";
  if ("root" in set && "pool" in set) return "hierarchy";
  if ("mesh" in set) return "thin";
  return "custom";
}

function inferSource(set: InstancerSetLike, kind: RecordItem["kind"]): unknown {
  if (kind === "hierarchy" && "root" in set) return set.root;
  if ("mesh" in set) return set.mesh;
  return set;
}

function defaultInstanceLabel(id: number, metadata: unknown): string {
  if (isObject(metadata)) {
    for (const key of ["name", "label", "title"]) {
      const value = metadata[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return `Instance ${id}`;
}

function metadataSummary(value: unknown): string {
  if (value === undefined) return "";
  try { return JSON.stringify(value); }
  catch { return String(value); }
}

function isInstanceSource(value: unknown): value is InstanceSource {
  return isObject(value) && "record" in value && "id" in value && typeof value.id === "number";
}

function tuple3(value: ArrayLike<number> | undefined): readonly [number, number, number] | undefined {
  if (!value || value.length < 3) return undefined;
  return [Number(value[0]), Number(value[1]), Number(value[2])];
}

function tuple4(value: ArrayLike<number> | undefined): readonly [number, number, number, number] | undefined {
  if (!value || value.length < 4) return undefined;
  return [Number(value[0]), Number(value[1]), Number(value[2]), Number(value[3])];
}

function matrixValues(value: ArrayLike<number> | undefined): number[] | undefined {
  if (!value || value.length < 16) return undefined;
  const matrix = Array.from(value, Number).slice(0, 16);
  return matrix.every(Number.isFinite) ? matrix : undefined;
}

function decomposeMatrix(value: ArrayLike<number> | undefined): { rotationEuler: readonly [number, number, number]; scale: readonly [number, number, number] } | undefined {
  const matrix = matrixValues(value);
  if (!matrix) return undefined;
  const sx = Math.hypot(matrix[0], matrix[1], matrix[2]);
  const sy = Math.hypot(matrix[4], matrix[5], matrix[6]);
  const sz = Math.hypot(matrix[8], matrix[9], matrix[10]);
  if (!sx || !sy || !sz) return { rotationEuler: [0, 0, 0], scale: [sx, sy, sz] };
  const r00 = matrix[0] / sx;
  const r10 = matrix[1] / sx;
  const r20 = matrix[2] / sx;
  const r21 = matrix[6] / sy;
  const r22 = matrix[10] / sz;
  const cy = Math.hypot(r00, r10);
  const rotationEuler: readonly [number, number, number] = cy > 1e-6
    ? [Math.atan2(r21, r22), Math.atan2(-r20, cy), Math.atan2(r10, r00)]
    : [Math.atan2(-matrix[9] / sz, matrix[5] / sy), Math.atan2(-r20, cy), 0];
  return { rotationEuler, scale: [sx, sy, sz] };
}

function isFiniteTuple3(value: unknown): value is readonly [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((part) => typeof part === "number" && Number.isFinite(part));
}

function isFiniteTuple4(value: unknown): value is readonly [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every((part) => typeof part === "number" && Number.isFinite(part));
}

export function createInstancerExplorerAdapter(): InstancerExplorerAdapter {
  const records: RecordItem[] = [];
  const setIds = new WeakMap<object, string>();
  const objectIds = new WeakMap<object, number>();
  const pickers = new Map<GpuPicker, (picker: GpuPicker) => void>();
  const pickerByScene = new WeakMap<object, GpuPicker>();
  const version = signal(0);
  const expandedIds = signal<ReadonlySet<string>>(new Set());
  let nextObjectId = 1;

  const bump = () => { version.value += 1; };
  const objectKey = (value: unknown): string => {
    if (!isObject(value)) return String(value);
    let id = objectIds.get(value);
    if (!id) {
      id = nextObjectId++;
      objectIds.set(value, id);
    }
    return String(id);
  };
  const sourceEntityId = (source: unknown) => `instancer:source:${objectKey(source)}`;
  const setEntityId = (record: RecordItem) => `instancer:set:${record.id}`;
  const instanceEntityId = (record: RecordItem, id: number) => `instancer:set:${record.id}:instance:${id}`;
  const readMetadata = (record: RecordItem, entry: InstancerEntryLike) => record.set.getMetadata?.(entry.id) ?? entry.metadata;
  const readEntry = (record: RecordItem, id: number) => [...record.set.entries()].find((entry) => entry.id === id);
  const readEntryBySlot = (record: RecordItem, slot: number) => [...record.set.entries()].find((entry) => entry.slot === slot);
  const instanceLabel = (record: RecordItem, entry: InstancerEntryLike) => {
    const metadata = readMetadata(record, entry);
    return record.getLabel?.(entry.id, metadata, entry.slot) ?? defaultInstanceLabel(entry.id, metadata);
  };
  const findBySceneEntity = (entity: LiteEntity | null) => records.filter((record) => entity && record.source === entity.source);
  const findRecordBySetEntity = (entity: LiteEntity) => records.find((record) => setEntityId(record) === entity.id);
  const buildSnapshot = (record: RecordItem): InstancerSetSnapshot<unknown> => ({
    id: record.id,
    label: record.label,
    kind: record.kind,
    sourceLabel: record.sourceLabel,
    count: record.set.count,
    visibleCount: record.set.visibleCount,
    capacity: record.set.capacity,
    instances: [...record.set.entries()].sort((a, b) => a.id - b.id).map((entry) => {
      const metadata = readMetadata(record, entry);
      const position = tuple3(record.set.getPosition?.(entry.id));
      const matrix = matrixValues(record.set.getMatrix?.(entry.id));
      const transform = decomposeMatrix(matrix);
      const cachedTransform = record.transformCache.get(entry.id);
      const color = tuple4(record.set.getColor?.(entry.id));
      const clip = record.set.getClip?.(entry.id);
      return {
        id: entry.id,
        slot: entry.slot,
        label: instanceLabel(record, entry),
        visible: record.set.getVisible?.(entry.id),
        ...(position ? { position } : {}),
        ...(transform || cachedTransform ? {
          ...(cachedTransform?.rotationEuler ?? transform?.rotationEuler ? { rotationEuler: cachedTransform?.rotationEuler ?? transform!.rotationEuler } : {}),
          ...(cachedTransform?.scale ?? transform?.scale ? { scale: cachedTransform?.scale ?? transform!.scale } : {})
        } : {}),
        ...(color ? { color } : {}),
        ...(clip ? { clip } : {}),
        ...(matrix ? { matrix } : {}),
        metadata: record.serializeMetadata?.(metadata, entry.id) ?? metadata
      };
    })
  });

  const buildEntities = (): LiteEntity[] => {
    const groups = [...new Map(records.map((record) => [record.source, records.filter((item) => item.source === record.source)]))];
    return groups.map(([source, group]) => ({
      id: sourceEntityId(source),
      label: group[0].sourceLabel,
      kind: "mesh",
      source,
      capabilities: readonlyCapabilities,
      meta: { instancer: "source" },
      children: group.map((record) => ({
        id: setEntityId(record),
        label: record.label,
        kind: "unknown",
        source: record,
        parentId: sourceEntityId(source),
        capabilities: readonlyCapabilities,
        meta: { instancer: "set" },
        children: [...record.set.entries()].sort((a, b) => a.id - b.id).map((entry) => ({
          id: instanceEntityId(record, entry.id),
          label: instanceLabel(record, entry),
          kind: "unknown",
          source: { record, id: entry.id },
          parentId: setEntityId(record),
          capabilities: instanceCapabilities,
          meta: { instancer: "instance" }
        }))
      }))
    }));
  };

  const focusSceneEntity = (entity: LiteEntity) => {
    const related = findBySceneEntity(entity);
    if (!related.length) return;
    expandedIds.value = new Set([sourceEntityId(related[0].source), ...related.map(setEntityId)]);
    bump();
  };

  const Panel = () => {
    const { signals, refresh } = useExplorerRuntime();
    version.value;
    const selectedId = signals.selectedEntityId.value;
    const entities = buildEntities();
    const toggle = (id: string) => {
      const next = new Set(expandedIds.value);
      if (next.has(id)) next.delete(id); else next.add(id);
      expandedIds.value = next;
    };
    const select = async (entity: LiteEntity) => {
      if (entity.children?.length) {
        expandedIds.value = new Set([...expandedIds.value, entity.id]);
      }
      await refresh.refreshTree();
      await refresh.select(entity.id);
    };
    const Row = ({ entity, level = 0 }: { entity: LiteEntity; level?: number }) => {
      const hasChildren = !!entity.children?.length;
      const expanded = expandedIds.value.has(entity.id);
      const selected = selectedId === entity.id;
      return <>
        <div class={`ble-instancer-tree-row${selected ? " is-selected" : ""}`} style={{ paddingLeft: `${level * 14 + 4}px` }}>
          <button class="ble-tree-toggle" type="button" aria-label={expanded ? "Collapse" : "Expand"} disabled={!hasChildren} onClick={() => toggle(entity.id)}>{hasChildren ? (expanded ? "▾" : "▸") : ""}</button>
          <button class="ble-instancer-tree-label" type="button" onClick={() => void select(entity)}>{entity.label}</button>
        </div>
        {hasChildren && expanded ? entity.children!.map((child) => <Row entity={child} level={level + 1} key={child.id} />) : null}
      </>;
    };
    return <div class="ble-instancer-panel">
      {entities.length ? <div class="ble-instancer-tree" role="tree" aria-label="Instancer entities">{entities.map((entity) => <Row entity={entity} key={entity.id} />)}</div> : <div class="ble-empty">No Instancer sets are registered.</div>}
    </div>;
  };

  return {
    register(set, options = {}) {
      const asObject = set as object;
      const existing = setIds.get(asObject);
      if (existing) throw new Error(`Instancer set already registered: ${existing}`);
      const kind = inferKind(set);
      const source = inferSource(set, kind);
      const sourceLabel = getName(source) ?? `${kind} source ${records.length + 1}`;
      const id = options.id ?? `${kind}:${objectKey(set)}`;
      if (records.some((record) => record.id === id)) throw new Error(`Instancer set id already registered: ${id}`);
      const label = options.label ?? sourceLabel;
      setIds.set(asObject, id);
      records.push({
        id,
        label,
        kind,
        source,
        sourceLabel,
        set: set as InstancerSetLike,
        getLabel: options.getLabel as RecordItem["getLabel"],
        serializeMetadata: options.serializeMetadata as RecordItem["serializeMetadata"],
        saveSet: options.saveSet,
        transformCache: new Map()
      });
      bump();
    },

    exportSet(set) {
      const id = setIds.get(set as object);
      const record = id ? records.find((item) => item.id === id) : undefined;
      if (!record) throw new Error("Instancer set is not registered.");
      return buildSnapshot(record);
    },

    getSceneTree: () => [],

    getExtensionEntities: () => buildEntities(),

    getProperties(entity) {
      if (entity.meta?.instancer === "source") {
        const group = records.filter((record) => record.source === entity.source);
        return [
          { kind: "readonly", path: "source", label: "Source", value: entity.label, section: "Instancer" },
          { kind: "readonly", path: "setCount", label: "Sets", value: String(group.length), section: "Instancer" },
          { kind: "readonly", path: "instanceCount", label: "Instances", value: String(group.reduce((sum, record) => sum + record.set.count, 0)), section: "Instancer" }
        ];
      }
      if (entity.meta?.instancer === "set") {
        const record = findRecordBySetEntity(entity);
        if (!record) return [];
        return [
          { kind: "readonly", path: "label", label: "Label", value: record.label, section: "Instancer" },
          { kind: "readonly", path: "kind", label: "Kind", value: record.kind, section: "Instancer" },
          { kind: "readonly", path: "count", label: "Count", value: String(record.set.count), section: "Instancer" },
          { kind: "readonly", path: "visibleCount", label: "Visible", value: String(record.set.visibleCount), section: "Instancer" },
          { kind: "readonly", path: "capacity", label: "Capacity", value: String(record.set.capacity), section: "Instancer" },
          { kind: "readonly", path: "source", label: "Source", value: record.sourceLabel, section: "Instancer" }
        ];
      }
      if (entity.meta?.instancer === "instance" && isInstanceSource(entity.source)) {
        const { record, id } = entity.source;
        const entry = readEntry(record, id);
        if (!entry) return [];
        const metadata = readMetadata(record, entry);
        const properties: PropertyDescriptor[] = [
          { kind: "readonly", path: "id", label: "Instance ID", value: String(id), section: "Instancer" },
          { kind: "readonly", path: "slot", label: "Current slot", value: String(entry.slot), section: "Instancer" }
        ];
        const visible = record.set.getVisible?.(id);
        if (visible !== undefined) properties.push({ kind: "boolean", path: "visible", label: "Visible", value: visible, section: "Instancer" });
        const position = tuple3(record.set.getPosition?.(id));
        if (position) {
          properties.push({ kind: "vector3", path: "position", label: "Position", value: position, section: "Transform" });
        }
        const transform = decomposeMatrix(record.set.getMatrix?.(id));
        const cachedTransform = record.transformCache.get(id);
        if (transform) {
          const rotationEuler = cachedTransform?.rotationEuler ?? transform.rotationEuler;
          const scale = cachedTransform?.scale ?? transform.scale;
          if (record.set.setTransform) {
            properties.push({ kind: "vector3", path: "rotationEuler", label: "Rotation", value: rotationEuler, section: "Transform" });
          } else {
            properties.push({ kind: "readonly", path: "rotationEuler", label: "Rotation", value: rotationEuler.map((part) => part.toFixed(3)).join(", "), section: "Transform" });
          }
          if (record.set.setScale || record.set.setTransform) {
            properties.push({ kind: "vector3", path: "scale", label: "Scaling", value: scale, section: "Transform" });
          } else {
            properties.push({ kind: "readonly", path: "scale", label: "Scaling", value: scale.map((part) => part.toFixed(3)).join(", "), section: "Transform" });
          }
        }
        const color = tuple4(record.set.getColor?.(id));
        if (color) {
          properties.push(record.set.setColor
            ? { kind: "color4", path: "color", label: "Color", value: color, section: "Instancer" }
            : { kind: "readonly", path: "color", label: "Color", value: color.map((part) => part.toFixed(3)).join(", "), section: "Instancer" });
        }
        const clip = record.set.getClip?.(id);
        if (clip) properties.push({ kind: "readonly", path: "clip", label: "Clip", value: clip, section: "Instancer" });
        properties.push({ kind: "readonly", path: "metadata", label: "Metadata", value: metadataSummary(record.serializeMetadata?.(metadata, id) ?? metadata), section: "Metadata" });
        return properties;
      }
      return [];
    },

    setProperty(entity, path, value) {
      if (entity.meta?.instancer !== "instance" || !isInstanceSource(entity.source)) return fail("unsupported", "This Instancer entity is read-only.");
      const { record, id } = entity.source;
      if (path === "visible") {
        if (!record.set.setVisible) return fail("unsupported", "This instance set does not expose visibility writes.");
        record.set.setVisible(id, Boolean(value));
        bump();
        return ok();
      }
      if (path === "position") {
        if (!record.set.setPosition) return fail("unsupported", "This instance set does not expose position writes.");
        if (!isFiniteTuple3(value)) return fail("invalid", "Position must be a vector3.");
        record.set.setPosition(id, value);
        bump();
        return ok();
      }
      if (path === "rotationEuler") {
        if (!record.set.setTransform) return fail("unsupported", "This instance set does not expose transform writes.");
        if (!isFiniteTuple3(value)) return fail("invalid", "Rotation must be a vector3.");
        const current = decomposeMatrix(record.set.getMatrix?.(id));
        const cached = record.transformCache.get(id);
        const position = tuple3(record.set.getPosition?.(id));
        const scale = cached?.scale ?? current?.scale;
        record.set.setTransform(id, {
          ...(position ? { position } : {}),
          rotationEuler: value,
          ...(scale ? { scale } : {})
        });
        record.transformCache.set(id, { ...cached, rotationEuler: value });
        bump();
        return ok();
      }
      if (path === "scale") {
        if (!isFiniteTuple3(value)) return fail("invalid", "Scaling must be a vector3.");
        const cached = record.transformCache.get(id);
        if (record.set.setScale) {
          record.set.setScale(id, value);
        } else if (record.set.setTransform) {
          const current = decomposeMatrix(record.set.getMatrix?.(id));
          const position = tuple3(record.set.getPosition?.(id));
          record.set.setTransform(id, {
            ...(position ? { position } : {}),
            ...(cached?.rotationEuler ?? current?.rotationEuler ? { rotationEuler: cached?.rotationEuler ?? current!.rotationEuler } : {}),
            scale: value
          });
        } else {
          return fail("unsupported", "This instance set does not expose scaling writes.");
        }
        record.transformCache.set(id, { ...cached, scale: value });
        bump();
        return ok();
      }
      if (path === "color") {
        if (!record.set.setColor) return fail("unsupported", "This instance set does not expose color writes.");
        if (!isFiniteTuple4(value)) return fail("invalid", "Color must be a color4.");
        record.set.setColor(id, value);
        bump();
        return ok();
      }
      return fail("unsupported", "This Instancer property is read-only.");
    },

    setEntityVisible(entity, visible) {
      if (!isInstanceSource(entity.source) || !entity.source.record.set.setVisible) return fail("unsupported", "This instance has no visibility toggle.");
      entity.source.record.set.setVisible(entity.source.id, visible);
      bump();
      return ok();
    },

    async pickEntityId(x, y, context) {
      if (!isObject(context.scene)) return ok(null);
      try {
        let picker = pickerByScene.get(context.scene);
        if (!picker) {
          picker = (context.lite?.createGpuPicker ?? createGpuPicker)(context.scene as unknown as Parameters<typeof createGpuPicker>[0]);
          pickerByScene.set(context.scene, picker);
          pickers.set(picker, context.lite?.disposePicker ?? disposePicker);
        }
        const result = await (context.lite?.pickAsync ?? pickAsync)(picker, x, y);
        if (!result.hit || !result.pickedMesh || result.thinInstanceIndex < 0) return ok(null);
        for (const record of records) {
          if (record.source !== result.pickedMesh) continue;
          const entry = readEntryBySlot(record, result.thinInstanceIndex);
          if (!entry) continue;
          expandedIds.value = new Set([sourceEntityId(record.source), setEntityId(record)]);
          bump();
          return ok(instanceEntityId(record, entry.id));
        }
        return ok(null);
      } catch (error) {
        return fail("failed", error instanceof Error ? error.message : "Instancer picking failed.");
      }
    },

    getExplorerExtensions: () => ({
      panes: [{ key: "instancer", title: "Instancer", side: "left", order: 20, content: Panel, keepMounted: true }],
      commands: [{
        id: "open-instancer",
        label: "Show instances",
        when: (entity) => findBySceneEntity(entity).length > 0,
        rowAction: { label: "Show instances", icon: "I" },
        run: (entity, _context, api) => {
          if (entity) focusSceneEntity(entity);
          api.openPanel("instancer");
          void api.refresh();
        }
      }, {
        id: "save-instancer-set",
        label: "Save Set",
        when: (entity) => !!entity && entity.meta?.instancer === "set" && !!findRecordBySetEntity(entity)?.saveSet,
        run: async (entity, _context, api) => {
          if (!entity) return;
          const record = findRecordBySetEntity(entity);
          if (!record?.saveSet) return;
          await record.saveSet(buildSnapshot(record));
          api.notify(`Saved ${record.label}`, "info");
        }
      }]
    }),

    getEntitySnapshot: (entity) => ok({ id: entity.id, label: entity.label, kind: entity.meta?.instancer ?? "instancer" }),

    dispose: () => {
      for (const [picker, dispose] of pickers) dispose(picker);
      pickers.clear();
      records.length = 0;
      bump();
    }
  };
}
