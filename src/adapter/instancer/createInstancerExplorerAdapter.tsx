import { signal } from "@preact/signals";
import { createGpuPicker, disposePicker, getViewProjectionMatrix, pickAsync, type Camera, type GpuPicker } from "@babylonjs/lite";
import type { BaseInstanceSet, InstanceId, VatCharacterSet, VatInstanceSet } from "@litools/instancer";
import type { LiteEntity, LiteSceneAdapter } from "../LiteSceneAdapter";
import { fail, ok } from "../LiteSceneAdapter";
import type { PropertyDescriptor } from "../propertyDescriptors";
import { useExplorerRuntime } from "../../ui/runtime";

/** @deprecated Use `InstanceEntry` from `@litools/instancer`. */
export type InstancerEntryLike<TMetadata = unknown> = {
  id: number;
  slot: number;
  metadata?: TMetadata;
};

/**
 * Legacy structural Instancer facade.
 * @deprecated Register an `InstancerSupportedSet` from `@litools/instancer` instead.
 */
export type InstancerSetLike<TMetadata = unknown> = {
  count: number;
  capacity: number;
  visibleCount: number;
  mesh?: unknown;
  root?: unknown;
  pool?: unknown;
  set?: unknown;
  clips?: unknown;
  activeClip?: string;
  timeSeconds?: number;
  entries(): Iterable<InstancerEntryLike<TMetadata>>;
  has?(id: number): boolean;
  getSlot?(id: number): number | undefined;
  getIdForSlot?(slot: number): number | undefined;
  getMetadata?(id: number): TMetadata | undefined;
  getVisible?(id: number): boolean;
  getVisibleOrUndefined?(id: number): boolean | undefined;
  setVisible?(id: number, visible: boolean): void;
  trySetVisible?(id: number, visible: boolean): boolean;
  getMatrix?(id: number): ArrayLike<number>;
  getMatrixOrUndefined?(id: number): ArrayLike<number> | undefined;
  getPosition?(id: number): ArrayLike<number>;
  setPosition?(id: number, position: readonly [number, number, number]): void;
  trySetPosition?(id: number, position: readonly [number, number, number]): boolean;
  setTransform?(id: number, transform: {
    position?: readonly [number, number, number];
    rotationEuler?: readonly [number, number, number];
    scale?: readonly [number, number, number] | number;
  }): void;
  trySetTransform?(id: number, transform: {
    position?: readonly [number, number, number];
    rotationEuler?: readonly [number, number, number];
    scale?: readonly [number, number, number] | number;
  }): boolean;
  setScale?(id: number, scale: readonly [number, number, number] | number): void;
  trySetScale?(id: number, scale: readonly [number, number, number] | number): boolean;
  getColor?(id: number): ArrayLike<number>;
  setColor?(id: number, color: readonly [number, number, number, number]): void;
  getClip?(id: number): string | undefined;
  getPlaybackSample?(id: number): { clip: string } | undefined;
  play?(clip: string): boolean;
  setClip?(id: number, clip: string | undefined): boolean;
};

/** Official Instancer set shapes supported by the adapter. */
export type InstancerSupportedSet<TMetadata = unknown> =
  | BaseInstanceSet<TMetadata>
  | VatInstanceSet<TMetadata>
  | VatCharacterSet<TMetadata>;

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

export type InstancerSourceSnapshot = {
  label: string;
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scaling?: readonly [number, number, number];
};

export type InstancerSetSnapshot<TMetadata = unknown> = {
  id: string;
  label: string;
  kind: "thin" | "hierarchy" | "vat" | "vat-character" | "custom";
  sourceLabel: string;
  source: InstancerSourceSnapshot;
  count: number;
  visibleCount: number;
  capacity: number;
  instances: InstancerInstanceSnapshot<TMetadata>[];
};

export type InstancerRegisterOptions<TMetadata = unknown, TId extends number = number> = {
  id?: string;
  label?: string;
  getLabel?: (id: TId, metadata: TMetadata | undefined, slot: number | undefined) => string;
  serializeMetadata?: (metadata: TMetadata | undefined, id: TId) => unknown;
  saveSet?: (snapshot: InstancerSetSnapshot<unknown>) => void | Promise<void>;
  /** Read whether the application's VAT update loop is paused. */
  getPlaybackPaused?: () => boolean;
  /** Pause or resume the application's VAT update loop. Enables inline clip Play/Pause controls. */
  setPlaybackPaused?: (paused: boolean) => void;
};

export interface InstancerExplorerAdapter extends LiteSceneAdapter {
  register<TMetadata = unknown>(set: InstancerSupportedSet<TMetadata>, options?: InstancerRegisterOptions<TMetadata, InstanceId>): void;
  /** @deprecated Register an official `InstancerSupportedSet` instead. */
  register<TMetadata = unknown>(set: InstancerSetLike<TMetadata>, options?: InstancerRegisterOptions<TMetadata>): void;
  exportSet<TMetadata = unknown>(set: InstancerSupportedSet<TMetadata>): InstancerSetSnapshot<unknown>;
  /** @deprecated Export an official `InstancerSupportedSet` instead. */
  exportSet<TMetadata = unknown>(set: InstancerSetLike<TMetadata>): InstancerSetSnapshot<unknown>;
}

type RecordItem = {
  id: string;
  label: string;
  kind: "thin" | "hierarchy" | "vat" | "vat-character" | "custom";
  source: unknown;
  sourceLabel: string;
  set: InstancerSetLike;
  writeSet: InstancerSetLike;
  colorSet?: InstancerSetLike;
  pickSources: readonly unknown[];
  pickCenter: readonly [number, number, number];
  official: boolean;
  getLabel?: (id: number, metadata: unknown, slot: number | undefined) => string;
  serializeMetadata?: (metadata: unknown, id: number) => unknown;
  saveSet?: (snapshot: InstancerSetSnapshot<unknown>) => void | Promise<void>;
  getPlaybackPaused?: () => boolean;
  setPlaybackPaused?: (paused: boolean) => void;
  baseline?: InstancerSetSnapshot<unknown>;
  transformCache: Map<number, {
    rotationEuler?: readonly [number, number, number];
    scale?: readonly [number, number, number];
  }>;
};

type InstanceSource = {
  record: RecordItem;
  id: number;
};

type VatClipSource = {
  record: RecordItem;
  clip: string;
};

const readonlyCapabilities = { editable: false, focusable: false, visibilityToggle: false, serializableSnapshot: true };
const instanceCapabilities = { editable: true, focusable: false, visibilityToggle: true, serializableSnapshot: true };

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function hasFunction(value: unknown, key: string): boolean {
  return isObject(value) && typeof value[key] === "function";
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

function isVatCharacterSet(value: unknown): value is VatCharacterSet<unknown> {
  return isObject(value)
    && isObject(value.primary)
    && Array.isArray(value.secondaryParts)
    && "root" in value
    && hasFunction(value, "getPlaybackSample");
}

function isOfficialSet(value: unknown): boolean {
  return hasFunction(value, "has")
    && hasFunction(value, "getSlot")
    && hasFunction(value, "getIdForSlot")
    && hasFunction(value, "entries");
}

function poolMeshes(value: unknown): readonly unknown[] {
  if (!isObject(value) || !isObject(value.pool) || !Array.isArray(value.pool.meshes)) return [];
  return value.pool.meshes;
}

function boundsCenter(sources: readonly unknown[]): readonly [number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const source of sources) {
    if (!isObject(source) || !Array.isArray(source.boundMin) || !Array.isArray(source.boundMax)) continue;
    const [x0, y0, z0] = source.boundMin.map(Number);
    const [x1, y1, z1] = source.boundMax.map(Number);
    if (![x0, y0, z0, x1, y1, z1].every(Number.isFinite)) continue;
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    minZ = Math.min(minZ, z0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
    maxZ = Math.max(maxZ, z1);
  }
  return Number.isFinite(minX) ? [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5] : [0, 0, 0];
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

function isVatClipSource(value: unknown): value is VatClipSource {
  return isObject(value) && "record" in value && "clip" in value && typeof value.clip === "string";
}

function vatClips(record: RecordItem): Record<string, { fromRow?: number; frameCount?: number; fps?: number }> {
  return isObject(record.writeSet.clips)
    ? record.writeSet.clips as Record<string, { fromRow?: number; frameCount?: number; fps?: number }>
    : {};
}

function tuple3(value: ArrayLike<number> | undefined): readonly [number, number, number] | undefined {
  if (!value || value.length < 3) return undefined;
  return [Number(value[0]), Number(value[1]), Number(value[2])];
}

function tuple4(value: ArrayLike<number> | undefined): readonly [number, number, number, number] | undefined {
  if (!value || value.length < 4) return undefined;
  return [Number(value[0]), Number(value[1]), Number(value[2]), Number(value[3])];
}

function vector3Field(source: unknown, field: "position" | "rotation" | "scaling"): readonly [number, number, number] | undefined {
  if (!isObject(source)) return undefined;
  const value = source[field];
  if (!isObject(value)) return undefined;
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  return [x, y, z].every(Number.isFinite) ? [x, y, z] : undefined;
}

function matrixValues(value: ArrayLike<number> | undefined): number[] | undefined {
  if (!value || value.length < 16) return undefined;
  const matrix = Array.from(value, Number).slice(0, 16);
  return matrix.every(Number.isFinite) ? matrix : undefined;
}

function decomposeMatrix(value: ArrayLike<number> | undefined): { rotationEuler: readonly [number, number, number]; scale: readonly [number, number, number] } | undefined {
  const matrix = matrixValues(value);
  if (!matrix) return undefined;
  const cleanZero = (part: number) => Math.abs(part) < 1e-12 ? 0 : part;
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
  return { rotationEuler: rotationEuler.map(cleanZero) as unknown as readonly [number, number, number], scale: [sx, sy, sz] };
}

function isFiniteTuple3(value: unknown): value is readonly [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((part) => typeof part === "number" && Number.isFinite(part));
}

function isFiniteTuple4(value: unknown): value is readonly [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every((part) => typeof part === "number" && Number.isFinite(part));
}

type NormalizedSet = Pick<RecordItem, "kind" | "source" | "set" | "writeSet" | "colorSet" | "pickSources" | "pickCenter" | "official">;

function asLegacySet(value: unknown): InstancerSetLike {
  return value as InstancerSetLike;
}

function normalizeSet(value: InstancerSupportedSet<unknown> | InstancerSetLike): NormalizedSet {
  if (isVatCharacterSet(value)) {
    const primary = asLegacySet(value.primary);
    const pickSources = [value.primary.mesh, ...value.secondaryParts.map((part) => part.mesh)];
    return {
      kind: "vat-character",
      source: value.root,
      set: primary,
      writeSet: asLegacySet(value),
      pickSources,
      pickCenter: boundsCenter(pickSources),
      official: true
    };
  }
  const set = asLegacySet(value);
  const kind = inferKind(set);
  const source = inferSource(set, kind);
  const picks = kind === "hierarchy" ? poolMeshes(set) : set.mesh ? [set.mesh] : [];
  return {
    kind,
    source,
    set,
    writeSet: set,
    ...(kind === "vat" || kind === "thin" ? { colorSet: set } : {}),
    pickSources: picks,
    pickCenter: boundsCenter(picks),
    official: isOfficialSet(set)
  };
}

function projectWorldToScreen(
  position: readonly [number, number, number],
  viewProjection: ArrayLike<number>,
  width: number,
  height: number
): { x: number; y: number } | undefined {
  const [x, y, z] = position;
  const clipX = Number(viewProjection[0] ?? 0) * x + Number(viewProjection[4] ?? 0) * y + Number(viewProjection[8] ?? 0) * z + Number(viewProjection[12] ?? 0);
  const clipY = Number(viewProjection[1] ?? 0) * x + Number(viewProjection[5] ?? 0) * y + Number(viewProjection[9] ?? 0) * z + Number(viewProjection[13] ?? 0);
  const clipW = Number(viewProjection[3] ?? 0) * x + Number(viewProjection[7] ?? 0) * y + Number(viewProjection[11] ?? 0) * z + Number(viewProjection[15] ?? 0);
  if (Math.abs(clipW) < 1e-6) return undefined;
  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;
  if (ndcX < -1.1 || ndcX > 1.1 || ndcY < -1.1 || ndcY > 1.1) return undefined;
  return { x: (ndcX + 1) * 0.5 * width, y: (1 - ndcY) * 0.5 * height };
}

function transformPoint(matrix: ArrayLike<number>, point: readonly [number, number, number]): readonly [number, number, number] {
  const [x, y, z] = point;
  return [
    Number(matrix[0] ?? 0) * x + Number(matrix[4] ?? 0) * y + Number(matrix[8] ?? 0) * z + Number(matrix[12] ?? 0),
    Number(matrix[1] ?? 0) * x + Number(matrix[5] ?? 0) * y + Number(matrix[9] ?? 0) * z + Number(matrix[13] ?? 0),
    Number(matrix[2] ?? 0) * x + Number(matrix[6] ?? 0) * y + Number(matrix[10] ?? 0) * z + Number(matrix[14] ?? 0),
  ];
}

export function createInstancerExplorerAdapter(): InstancerExplorerAdapter {
  const records: RecordItem[] = [];
  const setIds = new WeakMap<object, string>();
  const objectIds = new WeakMap<object, number>();
  const pickers = new Map<GpuPicker, (picker: GpuPicker) => void>();
  const pickerByScene = new WeakMap<object, GpuPicker>();
  const version = signal(0);
  const expandedIds = signal<ReadonlySet<string>>(new Set());
  const exportDialogRecordId = signal<string | null>(null);
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
  const animationsEntityId = (record: RecordItem) => `instancer:set:${record.id}:animations`;
  const clipEntityId = (record: RecordItem, clip: string) => `${animationsEntityId(record)}:${encodeURIComponent(clip)}`;
  const readMetadata = (record: RecordItem, entry: InstancerEntryLike) => record.set.getMetadata?.(entry.id) ?? entry.metadata;
  const readEntry = (record: RecordItem, id: number): InstancerEntryLike | undefined => {
    if (record.official && record.set.has && record.set.getSlot) {
      if (!record.set.has(id)) return undefined;
      const slot = record.set.getSlot(id);
      return slot === undefined ? undefined : { id, slot, metadata: record.set.getMetadata?.(id) };
    }
    return [...record.set.entries()].find((entry) => entry.id === id);
  };
  const readEntryBySlot = (record: RecordItem, slot: number): InstancerEntryLike | undefined => {
    if (record.official && record.set.getIdForSlot) {
      const id = record.set.getIdForSlot(slot);
      return id === undefined ? undefined : readEntry(record, id);
    }
    return [...record.set.entries()].find((entry) => entry.slot === slot);
  };
  const readMatrix = (record: RecordItem, id: number) => record.set.getMatrixOrUndefined?.(id) ?? record.set.getMatrix?.(id);
  const readVisible = (record: RecordItem, id: number) => record.writeSet.getVisibleOrUndefined?.(id) ?? record.writeSet.getVisible?.(id);
  const readClip = (record: RecordItem, id: number) => record.writeSet.getClip?.(id) ?? record.writeSet.getPlaybackSample?.(id)?.clip;
  const writeTransform = (record: RecordItem, id: number, transform: Parameters<NonNullable<InstancerSetLike["setTransform"]>>[1]) => {
    if (record.writeSet.trySetTransform) return record.writeSet.trySetTransform(id, transform);
    if (!record.writeSet.setTransform) return false;
    record.writeSet.setTransform(id, transform);
    return true;
  };
  const instanceLabel = (record: RecordItem, entry: InstancerEntryLike) => {
    const metadata = readMetadata(record, entry);
    return record.getLabel?.(entry.id, metadata, entry.slot) ?? defaultInstanceLabel(entry.id, metadata);
  };
  const findBySceneEntity = (entity: LiteEntity | null) => records.filter((record) => entity && record.source === entity.source);
  const findRecordBySetEntity = (entity: LiteEntity) => records.find((record) => setEntityId(record) === entity.id);
  const buildSourceSnapshot = (record: RecordItem): InstancerSourceSnapshot => ({
    label: record.sourceLabel,
    ...(vector3Field(record.source, "position") ? { position: vector3Field(record.source, "position") } : {}),
    ...(vector3Field(record.source, "rotation") ? { rotation: vector3Field(record.source, "rotation") } : {}),
    ...(vector3Field(record.source, "scaling") ? { scaling: vector3Field(record.source, "scaling") } : {})
  });
  const buildSnapshot = (record: RecordItem): InstancerSetSnapshot<unknown> => ({
    id: record.id,
    label: record.label,
    kind: record.kind,
    sourceLabel: record.sourceLabel,
    source: buildSourceSnapshot(record),
    count: record.set.count,
    visibleCount: record.set.visibleCount,
    capacity: record.set.capacity,
    instances: [...record.set.entries()].sort((a, b) => a.id - b.id).map((entry) => {
      const metadata = readMetadata(record, entry);
      const position = tuple3(record.set.getPosition?.(entry.id));
      const matrix = matrixValues(readMatrix(record, entry.id));
      const transform = decomposeMatrix(matrix);
      const cachedTransform = record.transformCache.get(entry.id);
      const color = tuple4(record.colorSet?.getColor?.(entry.id));
      const clip = readClip(record, entry.id);
      return {
        id: entry.id,
        slot: entry.slot,
        label: instanceLabel(record, entry),
        visible: readVisible(record, entry.id),
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
  const safeFileName = (label: string) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "instancer-set";
  const codeIdentifier = (label: string) => `${safeFileName(label).replace(/-([a-z0-9])/g, (_match: string, part: string) => part.toUpperCase()) || "instancerSet"}Placements`;
  const snapshotJson = (snapshot: InstancerSetSnapshot<unknown>) => JSON.stringify(snapshot, null, 2);
  const snapshotCode = (snapshot: InstancerSetSnapshot<unknown>) => {
    const identifier = codeIdentifier(snapshot.label);
    const placements = snapshot.instances.map((instance) => ({
      id: instance.id,
      transform: {
        ...(instance.position ? { position: instance.position } : {}),
        ...(instance.rotationEuler ? { rotationEuler: instance.rotationEuler } : {}),
        ...(instance.scale ? { scale: instance.scale } : {})
      },
      ...(instance.color ? { color: instance.color } : {}),
      ...(instance.visible !== undefined ? { visible: instance.visible } : {}),
      ...(instance.clip ? { clip: instance.clip } : {}),
      ...(instance.metadata !== undefined ? { metadata: instance.metadata } : {})
    }));
    const createExpression = snapshot.kind === "vat" || snapshot.kind === "vat-character"
      ? "instancerSet.create({ transform: placement.transform, metadata: placement.metadata, ...(placement.clip ? { clip: placement.clip } : {}) })"
      : "instancerSet.create(placement.transform, placement.metadata)";
    return `const ${identifier} = ${JSON.stringify(placements, null, 2)};

const restoredIds = new Map<number, number>();

for (const placement of ${identifier}) {
  const id = ${createExpression};
  restoredIds.set(placement.id, id);
  if (placement.color) instancerSet.setColor?.(id, placement.color);
  if (placement.visible !== undefined) instancerSet.setVisible(id, placement.visible);
}
`;
  };
  const restoreInstance = (record: RecordItem, snapshot: InstancerInstanceSnapshot<unknown>) => {
    if (!readEntry(record, snapshot.id)) return false;
    if (record.writeSet.setTransform && (snapshot.position || snapshot.rotationEuler || snapshot.scale)) {
      const transform = {
        ...(snapshot.position ? { position: snapshot.position } : {}),
        ...(snapshot.rotationEuler ? { rotationEuler: snapshot.rotationEuler } : {}),
        ...(snapshot.scale ? { scale: snapshot.scale } : {})
      };
      if (record.writeSet.trySetTransform) {
        if (!record.writeSet.trySetTransform(snapshot.id, transform)) return false;
      } else {
        record.writeSet.setTransform(snapshot.id, transform);
      }
    } else {
      if (snapshot.position && record.writeSet.setPosition) record.writeSet.setPosition(snapshot.id, snapshot.position);
      if (snapshot.scale && record.writeSet.setScale) record.writeSet.setScale(snapshot.id, snapshot.scale);
    }
    if (snapshot.visible !== undefined && record.writeSet.setVisible) {
      if (record.writeSet.trySetVisible) record.writeSet.trySetVisible(snapshot.id, snapshot.visible);
      else record.writeSet.setVisible(snapshot.id, snapshot.visible);
    }
    if (snapshot.color && record.colorSet?.setColor) record.colorSet.setColor(snapshot.id, snapshot.color);
    record.transformCache.delete(snapshot.id);
    return true;
  };
  const resetInstance = (record: RecordItem, id: number) => {
    const baseline = record.baseline?.instances.find((instance) => instance.id === id);
    return baseline ? restoreInstance(record, baseline) : false;
  };
  const resetSet = (record: RecordItem) => {
    let restored = 0;
    for (const instance of record.baseline?.instances ?? []) {
      if (restoreInstance(record, instance)) restored++;
    }
    return restored;
  };

  const buildEntities = (): LiteEntity[] => {
    const groups = [...new Map(records.map((record) => [record.source, records.filter((item) => item.source === record.source)]))];
    return groups.map(([source, group]) => ({
      id: sourceEntityId(source),
      label: group[0].sourceLabel,
      kind: "mesh",
      source,
      capabilities: readonlyCapabilities,
      meta: { instancer: "source" },
      children: group.map((record): LiteEntity => {
        const children: LiteEntity[] = [...record.set.entries()].sort((a, b) => a.id - b.id).map((entry) => ({
          id: instanceEntityId(record, entry.id),
          label: instanceLabel(record, entry),
          kind: "unknown",
          source: { record, id: entry.id },
          parentId: setEntityId(record),
          capabilities: instanceCapabilities,
          meta: { instancer: "instance" }
        }));
        const clips = Object.keys(vatClips(record));
        if (clips.length) {
          children.push({
            id: animationsEntityId(record),
            label: "Animations",
            kind: "unknown",
            source: record,
            parentId: setEntityId(record),
            capabilities: readonlyCapabilities,
            meta: { instancer: "animations" },
            children: clips.map((clip) => ({
              id: clipEntityId(record, clip),
              label: clip,
              kind: "animationGroup",
              source: { record, clip },
              parentId: animationsEntityId(record),
              capabilities: readonlyCapabilities,
              meta: { instancer: "animation" }
            }))
          });
        }
        return {
          id: setEntityId(record),
          label: record.label,
          kind: "unknown",
          source: record,
          parentId: sourceEntityId(source),
          capabilities: readonlyCapabilities,
          meta: { instancer: "set" },
          children
        };
      })
    }));
  };

  const focusSceneEntity = (entity: LiteEntity) => {
    const related = findBySceneEntity(entity);
    if (!related.length) return;
    expandedIds.value = new Set([sourceEntityId(related[0].source), ...related.map(setEntityId)]);
    bump();
  };

  const Panel = () => {
    const { signals, refresh, notifications } = useExplorerRuntime();
    version.value;
    const selectedId = signals.selectedEntityId.value;
    const entities = buildEntities();
    const exportRecord = exportDialogRecordId.value ? records.find((record) => record.id === exportDialogRecordId.value) : undefined;
    const copyText = async (text: string, message: string) => {
      try {
        await navigator.clipboard.writeText(text);
        notifications.push(message, "info");
      } catch {
        notifications.push("Could not write to the clipboard.");
      }
    };
    const downloadJson = (record: RecordItem) => {
      const snapshot = buildSnapshot(record);
      const blob = new Blob([snapshotJson(snapshot)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeFileName(record.label)}.instances.json`;
      link.click();
      URL.revokeObjectURL(url);
      notifications.push(`Downloaded ${record.label} JSON`, "info");
    };
    const runAppSave = async (record: RecordItem) => {
      if (!record.saveSet) return;
      try {
        await record.saveSet(buildSnapshot(record));
        notifications.push(`Saved ${record.label}`, "info");
        exportDialogRecordId.value = null;
      } catch (error) {
        notifications.push(error instanceof Error ? error.message : `Could not save ${record.label}.`);
      }
    };
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
      const animation = isVatClipSource(entity.source) ? entity.source : undefined;
      const paused = animation?.record.getPlaybackPaused?.() ?? false;
      const active = !!animation && animation.record.writeSet.activeClip === animation.clip;
      const showPause = active && !paused && !!animation?.record.setPlaybackPaused;
      const togglePlayback = async () => {
        if (!animation) return;
        if (showPause) {
          animation.record.setPlaybackPaused?.(true);
        } else {
          if (!animation.record.writeSet.play?.(animation.clip)) {
            notifications.push(`Could not play VAT clip: ${animation.clip}`);
            return;
          }
          animation.record.setPlaybackPaused?.(false);
        }
        bump();
        await refresh.refreshProperties();
      };
      return <>
        <div class={`ble-instancer-tree-row${selected ? " is-selected" : ""}`} style={{ paddingLeft: `${level * 14 + 4}px` }}>
          <button class="ble-tree-toggle" type="button" aria-label={expanded ? "Collapse" : "Expand"} disabled={!hasChildren} onClick={() => toggle(entity.id)}>{hasChildren ? (expanded ? "▾" : "▸") : ""}</button>
          <button class="ble-instancer-tree-label" type="button" onClick={() => void select(entity)}>{entity.label}</button>
          {animation ? <button
            class="ble-tree-action"
            type="button"
            title={`${showPause ? "Pause" : "Play"} ${animation.clip}`}
            aria-label={`${showPause ? "Pause" : "Play"} ${animation.clip}`}
            onClick={() => void togglePlayback()}
          >{showPause ? "Ⅱ" : "▶"}</button> : null}
        </div>
        {hasChildren && expanded ? entity.children!.map((child) => <Row entity={child} level={level + 1} key={child.id} />) : null}
      </>;
    };
    return <div class="ble-instancer-panel">
      {entities.length ? <div class="ble-instancer-tree" role="tree" aria-label="Instancer entities">{entities.map((entity) => <Row entity={entity} key={entity.id} />)}</div> : <div class="ble-empty">No Instancer sets are registered.</div>}
      {exportRecord && <div class="ble-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) exportDialogRecordId.value = null; }}>
        <section class="ble-modal ble-instancer-export-modal" role="dialog" aria-modal="true" aria-labelledby="ble-instancer-export-title">
          <header class="ble-modal-header">
            <h2 id="ble-instancer-export-title">Save {exportRecord.label}</h2>
            <button type="button" aria-label="Close Instancer export" onClick={() => { exportDialogRecordId.value = null; }}>x</button>
          </header>
          <div class="ble-export-actions">
            <button type="button" onClick={() => void copyText(snapshotJson(buildSnapshot(exportRecord)), `Copied ${exportRecord.label} JSON`)}>Copy JSON</button>
            <button type="button" onClick={() => void copyText(snapshotCode(buildSnapshot(exportRecord)), `Copied ${exportRecord.label} Instancer code`)}>Copy Instancer Code</button>
            <button type="button" onClick={() => downloadJson(exportRecord)}>Download JSON</button>
            <button type="button" disabled={!exportRecord.saveSet} onClick={() => void runAppSave(exportRecord)}>App Save</button>
          </div>
        </section>
      </div>}
    </div>;
  };

  return {
    register(set, options = {}) {
      const asObject = set as object;
      const existing = setIds.get(asObject);
      if (existing) throw new Error(`Instancer set already registered: ${existing}`);
      const normalized = normalizeSet(set as InstancerSupportedSet<unknown> | InstancerSetLike);
      const sourceLabel = getName(normalized.source) ?? `${normalized.kind} source ${records.length + 1}`;
      const id = options.id ?? `${normalized.kind}:${objectKey(set)}`;
      if (records.some((record) => record.id === id)) throw new Error(`Instancer set id already registered: ${id}`);
      const label = options.label ?? sourceLabel;
      setIds.set(asObject, id);
      const record: RecordItem = {
        id,
        label,
        ...normalized,
        sourceLabel,
        getLabel: options.getLabel as RecordItem["getLabel"],
        serializeMetadata: options.serializeMetadata as RecordItem["serializeMetadata"],
        saveSet: options.saveSet,
        getPlaybackPaused: options.getPlaybackPaused,
        setPlaybackPaused: options.setPlaybackPaused,
        transformCache: new Map()
      };
      record.baseline = buildSnapshot(record);
      records.push(record);
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
          { kind: "entityRef", path: "source", label: "Source", value: entity.label, source: entity.source, section: "Instancer" },
          { kind: "readonly", path: "setCount", label: "Sets", value: String(group.length), section: "Instancer" },
          { kind: "readonly", path: "instanceCount", label: "Instances", value: String(group.reduce((sum, record) => sum + record.set.count, 0)), section: "Instancer" }
        ];
      }
      if (entity.meta?.instancer === "set") {
        const record = findRecordBySetEntity(entity);
        if (!record) return [];
        const properties: PropertyDescriptor[] = [
          { kind: "readonly", path: "label", label: "Label", value: record.label, section: "Instancer" },
          { kind: "readonly", path: "kind", label: "Kind", value: record.kind, section: "Instancer" },
          { kind: "readonly", path: "count", label: "Count", value: String(record.set.count), section: "Instancer" },
          { kind: "readonly", path: "visibleCount", label: "Visible", value: String(record.set.visibleCount), section: "Instancer" },
          { kind: "readonly", path: "capacity", label: "Capacity", value: String(record.set.capacity), section: "Instancer" },
          { kind: "entityRef", path: "source", label: "Source", value: record.sourceLabel, source: record.source, section: "Instancer" }
        ];
        const clips = Object.keys(vatClips(record));
        if (clips.length) {
          properties.push({
            kind: record.writeSet.play ? "select" : "readonly",
            path: "activeClip",
            label: "Active clip",
            value: record.writeSet.activeClip ?? clips[0],
            ...(record.writeSet.play ? { options: clips.map((clip) => ({ value: clip, label: clip })) } : {}),
            section: "Animation"
          } as PropertyDescriptor);
          if (typeof record.writeSet.timeSeconds === "number") {
            properties.push({ kind: "number", path: "timeSeconds", label: "Time", value: record.writeSet.timeSeconds, step: 0.01, readonly: true, section: "Animation" });
          }
        }
        return properties;
      }
      if (entity.meta?.instancer === "animation" && isVatClipSource(entity.source)) {
        const { record, clip } = entity.source;
        const value = vatClips(record)[clip];
        if (!value) return [];
        const properties: PropertyDescriptor[] = [
          { kind: "readonly", path: "name", label: "Clip", value: clip, section: "Animation" },
          { kind: "boolean", path: "active", label: "Active", value: record.writeSet.activeClip === clip, readonly: true, section: "Animation" }
        ];
        if (typeof value.frameCount === "number") properties.push({ kind: "number", path: "frameCount", label: "Frames", value: value.frameCount, readonly: true, section: "Animation" });
        if (typeof value.fps === "number") properties.push({ kind: "number", path: "fps", label: "FPS", value: value.fps, readonly: true, section: "Animation" });
        if (typeof value.frameCount === "number" && typeof value.fps === "number" && value.fps > 0) {
          properties.push({ kind: "number", path: "duration", label: "Duration", value: value.frameCount / value.fps, step: 0.01, readonly: true, section: "Animation" });
        }
        return properties;
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
        const visible = readVisible(record, id);
        if (visible !== undefined) properties.push({ kind: "boolean", path: "visible", label: "Visible", value: visible, section: "Instancer" });
        const matrix = readMatrix(record, id);
        const position = tuple3(record.set.getPosition?.(id)) ?? tuple3(matrix ? [matrix[12], matrix[13], matrix[14]] : undefined);
        if (position) {
          properties.push({ kind: "vector3", path: "position", label: "Position", value: position, section: "Transform" });
        }
        const transform = decomposeMatrix(matrix);
        const cachedTransform = record.transformCache.get(id);
        if (transform) {
          const rotationEuler = cachedTransform?.rotationEuler ?? transform.rotationEuler;
          const scale = cachedTransform?.scale ?? transform.scale;
          if (record.writeSet.setTransform) {
            properties.push({ kind: "vector3", path: "rotationEuler", label: "Rotation", value: rotationEuler, section: "Transform" });
          } else {
            properties.push({ kind: "readonly", path: "rotationEuler", label: "Rotation", value: rotationEuler.map((part) => part.toFixed(3)).join(", "), section: "Transform" });
          }
          if (record.writeSet.setScale || record.writeSet.setTransform) {
            properties.push({ kind: "vector3", path: "scale", label: "Scaling", value: scale, section: "Transform" });
          } else {
            properties.push({ kind: "readonly", path: "scale", label: "Scaling", value: scale.map((part) => part.toFixed(3)).join(", "), section: "Transform" });
          }
        }
        const color = tuple4(record.colorSet?.getColor?.(id));
        if (color) {
          properties.push(record.colorSet?.setColor
            ? { kind: "color4", path: "color", label: "Color", value: color, section: "Instancer" }
            : { kind: "readonly", path: "color", label: "Color", value: color.map((part) => part.toFixed(3)).join(", "), section: "Instancer" });
        }
        const clip = readClip(record, id);
        if (clip) {
          const clips = Object.keys(vatClips(record));
          properties.push(record.writeSet.setClip && clips.length
            ? { kind: "select", path: "clip", label: "Clip", value: clip, options: clips.map((name) => ({ value: name, label: name })), section: "Animation" }
            : { kind: "readonly", path: "clip", label: "Clip", value: clip, section: "Animation" });
        }
        properties.push({ kind: "readonly", path: "metadata", label: "Metadata", value: metadataSummary(record.serializeMetadata?.(metadata, id) ?? metadata), section: "Metadata" });
        return properties;
      }
      return [];
    },

    setProperty(entity, path, value) {
      if (entity.meta?.instancer === "set") {
        const record = findRecordBySetEntity(entity);
        if (!record || path !== "activeClip" || typeof value !== "string" || !record.writeSet.play) {
          return fail("unsupported", "This Instancer set property is read-only.");
        }
        if (!(value in vatClips(record))) return fail("invalid", `Unknown VAT clip: ${value}`);
        if (!record.writeSet.play(value)) return fail("failed", `Could not play VAT clip: ${value}`);
        bump();
        return ok();
      }
      if (entity.meta?.instancer !== "instance" || !isInstanceSource(entity.source)) return fail("unsupported", "This Instancer entity is read-only.");
      const { record, id } = entity.source;
      if (!readEntry(record, id)) return fail("failed", "This instance no longer exists.");
      if (path === "visible") {
        if (!record.writeSet.setVisible) return fail("unsupported", "This instance set does not expose visibility writes.");
        if (record.writeSet.trySetVisible && !record.writeSet.trySetVisible(id, Boolean(value))) return fail("failed", "This instance no longer exists.");
        if (!record.writeSet.trySetVisible) record.writeSet.setVisible(id, Boolean(value));
        bump();
        return ok();
      }
      if (path === "position") {
        if (!isFiniteTuple3(value)) return fail("invalid", "Position must be a vector3.");
        if (record.writeSet.setPosition) {
          if (record.writeSet.trySetPosition && !record.writeSet.trySetPosition(id, value)) return fail("failed", "This instance no longer exists.");
          if (!record.writeSet.trySetPosition) record.writeSet.setPosition(id, value);
        } else if (record.writeSet.setTransform) {
          const current = decomposeMatrix(readMatrix(record, id));
          const cached = record.transformCache.get(id);
          if (!writeTransform(record, id, {
            position: value,
            ...(cached?.rotationEuler ?? current?.rotationEuler ? { rotationEuler: cached?.rotationEuler ?? current!.rotationEuler } : {}),
            ...(cached?.scale ?? current?.scale ? { scale: cached?.scale ?? current!.scale } : {})
          })) return fail("failed", "This instance no longer exists.");
        } else {
          return fail("unsupported", "This instance set does not expose position writes.");
        }
        bump();
        return ok();
      }
      if (path === "rotationEuler") {
        if (!record.writeSet.setTransform) return fail("unsupported", "This instance set does not expose transform writes.");
        if (!isFiniteTuple3(value)) return fail("invalid", "Rotation must be a vector3.");
        const currentMatrix = readMatrix(record, id);
        const current = decomposeMatrix(currentMatrix);
        const cached = record.transformCache.get(id);
        const position = tuple3(record.set.getPosition?.(id)) ?? tuple3(currentMatrix ? [currentMatrix[12], currentMatrix[13], currentMatrix[14]] : undefined);
        const scale = cached?.scale ?? current?.scale;
        if (!writeTransform(record, id, {
          ...(position ? { position } : {}),
          rotationEuler: value,
          ...(scale ? { scale } : {})
        })) return fail("failed", "This instance no longer exists.");
        record.transformCache.set(id, { ...cached, rotationEuler: value });
        bump();
        return ok();
      }
      if (path === "scale") {
        if (!isFiniteTuple3(value)) return fail("invalid", "Scaling must be a vector3.");
        const cached = record.transformCache.get(id);
        if (record.writeSet.setScale) {
          if (record.writeSet.trySetScale && !record.writeSet.trySetScale(id, value)) return fail("failed", "This instance no longer exists.");
          if (!record.writeSet.trySetScale) record.writeSet.setScale(id, value);
        } else if (record.writeSet.setTransform) {
          const currentMatrix = readMatrix(record, id);
          const current = decomposeMatrix(currentMatrix);
          const position = tuple3(record.set.getPosition?.(id)) ?? tuple3(currentMatrix ? [currentMatrix[12], currentMatrix[13], currentMatrix[14]] : undefined);
          if (!writeTransform(record, id, {
            ...(position ? { position } : {}),
            ...(cached?.rotationEuler ?? current?.rotationEuler ? { rotationEuler: cached?.rotationEuler ?? current!.rotationEuler } : {}),
            scale: value
          })) return fail("failed", "This instance no longer exists.");
        } else {
          return fail("unsupported", "This instance set does not expose scaling writes.");
        }
        record.transformCache.set(id, { ...cached, scale: value });
        bump();
        return ok();
      }
      if (path === "color") {
        if (!record.colorSet?.setColor) return fail("unsupported", "This instance set does not expose color writes.");
        if (!isFiniteTuple4(value)) return fail("invalid", "Color must be a color4.");
        record.colorSet.setColor(id, value);
        bump();
        return ok();
      }
      if (path === "clip") {
        if (typeof value !== "string" || !(value in vatClips(record))) return fail("invalid", "Select a known VAT clip.");
        if (!record.writeSet.setClip?.(id, value)) return fail("failed", "This instance no longer exists or the clip is unavailable.");
        bump();
        return ok();
      }
      return fail("unsupported", "This Instancer property is read-only.");
    },

    setEntityVisible(entity, visible) {
      if (!isInstanceSource(entity.source) || !entity.source.record.writeSet.setVisible) return fail("unsupported", "This instance has no visibility toggle.");
      if (!readEntry(entity.source.record, entity.source.id)) return fail("failed", "This instance no longer exists.");
      if (entity.source.record.writeSet.trySetVisible && !entity.source.record.writeSet.trySetVisible(entity.source.id, visible)) return fail("failed", "This instance no longer exists.");
      if (!entity.source.record.writeSet.trySetVisible) entity.source.record.writeSet.setVisible(entity.source.id, visible);
      bump();
      return ok();
    },

    async pickEntityId(x, y, context) {
      if (!isObject(context.scene)) return ok(null);
      if (context.explorer?.userSettings?.instancerPickMode === "source") return ok(null);
      try {
        let picker = pickerByScene.get(context.scene);
        if (!picker) {
          picker = (context.lite?.createGpuPicker ?? createGpuPicker)(context.scene as unknown as Parameters<typeof createGpuPicker>[0]);
          pickerByScene.set(context.scene, picker);
          pickers.set(picker, context.lite?.disposePicker ?? disposePicker);
        }
        const result = await (context.lite?.pickAsync ?? pickAsync)(picker, x, y);
        if (result.hit && result.pickedMesh && result.thinInstanceIndex >= 0) {
          for (const record of records) {
            if (record.kind === "vat" || record.kind === "vat-character" || !record.pickSources.includes(result.pickedMesh)) continue;
            const entry = readEntryBySlot(record, result.thinInstanceIndex);
            if (!entry) continue;
            expandedIds.value = new Set([sourceEntityId(record.source), setEntityId(record)]);
            bump();
            return ok(instanceEntityId(record, entry.id));
          }
        }

        const vatRecords = records.filter((record) => record.kind === "vat" || record.kind === "vat-character");
        const canvas = context.canvas;
        const camera = context.scene.camera;
        if (!vatRecords.length || !canvas || !isObject(camera)) return ok(null);
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || canvas.width;
        const height = rect.height || canvas.height;
        if (!width || !height) return ok(null);
        const viewProjection = getViewProjectionMatrix(camera as unknown as Camera, width / height);
        let nearest: { record: RecordItem; id: number; distanceSquared: number } | undefined;
        for (const record of vatRecords) {
          for (const entry of record.set.entries()) {
            if (readVisible(record, entry.id) === false) continue;
            const matrix = readMatrix(record, entry.id);
            const position = matrix ? transformPoint(matrix, record.pickCenter) : undefined;
            if (!position) continue;
            const screen = projectWorldToScreen(position, viewProjection, width, height);
            if (!screen) continue;
            const dx = x - screen.x;
            const dy = y - screen.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared > 24 * 24 || nearest && nearest.distanceSquared <= distanceSquared) continue;
            nearest = { record, id: entry.id, distanceSquared };
          }
        }
        if (nearest) {
          expandedIds.value = new Set([sourceEntityId(nearest.record.source), setEntityId(nearest.record)]);
          bump();
          return ok(instanceEntityId(nearest.record, nearest.id));
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
        id: "reset-instancer-instance",
        label: "Reset Instance",
        when: (entity) => !!entity && entity.meta?.instancer === "instance" && isInstanceSource(entity.source) && !!entity.source.record.baseline,
        run: async (entity, _context, api) => {
          if (!entity || !isInstanceSource(entity.source)) return;
          const { record, id } = entity.source;
          if (!resetInstance(record, id)) {
            api.notify(`Could not reset ${entity.label}.`);
            return;
          }
          api.notify(`Reset ${entity.label}`, "info");
          await api.refresh();
        }
      }, {
        id: "reset-instancer-set",
        label: "Reset Set",
        when: (entity) => !!entity && entity.meta?.instancer === "set" && !!findRecordBySetEntity(entity)?.baseline,
        run: async (entity, _context, api) => {
          if (!entity) return;
          const record = findRecordBySetEntity(entity);
          if (!record) return;
          const restored = resetSet(record);
          api.notify(`Reset ${record.label} (${restored} instances)`, "info");
          await api.refresh();
        }
      }, {
        id: "save-instancer-set",
        label: "Save Set",
        when: (entity) => !!entity && entity.meta?.instancer === "set",
        run: async (entity, _context, api) => {
          if (!entity) return;
          const record = findRecordBySetEntity(entity);
          if (!record) return;
          exportDialogRecordId.value = record.id;
          api.openPanel("instancer");
          bump();
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
