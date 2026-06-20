import type { LiteInspectorContext } from "../api/types";
import type { PropertyDescriptor } from "./propertyDescriptors";

export type LiteEntityKind =
  | "scene"
  | "engine"
  | "camera"
  | "mesh"
  | "transform"
  | "light"
  | "material"
  | "texture"
  | "animationGroup"
  | "frameGraph"
  | "renderTask"
  | "unknown";

export type LiteEntityCapabilities = {
  editable: boolean;
  focusable: boolean;
  visibilityToggle: boolean;
  serializableSnapshot: boolean;
};

export type LiteEntity = {
  id: string;
  label: string;
  kind: LiteEntityKind;
  source: unknown;
  parentId?: string;
  children?: LiteEntity[];
  capabilities: LiteEntityCapabilities;
  meta?: Readonly<Record<string, unknown>>;
};

export type LiteStats = {
  fps?: number;
  frameMs?: number;
  gpuFrameTimeMs?: number;
  drawCallCount?: number;
  meshCount?: number;
  lightCount?: number;
  materialCount?: number;
  textureCount?: number;
  surfaceCount?: number;
};

export type AdapterResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; code: "unsupported" | "invalid" | "failed"; message: string };

export const ok = <T = void>(value: T = undefined as T): AdapterResult<T> => ({ ok: true, value });
export const fail = (code: "unsupported" | "invalid" | "failed", message: string): AdapterResult<never> => ({ ok: false, code, message });

export type LiteSceneAdapter = {
  getSceneTree(context: LiteInspectorContext): LiteEntity[] | Promise<LiteEntity[]>;
  getProperties(entity: LiteEntity, context: LiteInspectorContext): PropertyDescriptor[] | Promise<PropertyDescriptor[]>;
  setProperty?(entity: LiteEntity, path: string, value: unknown, context: LiteInspectorContext): AdapterResult | Promise<AdapterResult>;
  refresh?(context: LiteInspectorContext): AdapterResult | Promise<AdapterResult>;
  getStats?(context: LiteInspectorContext): LiteStats | Promise<LiteStats>;
  focusEntity?(entity: LiteEntity, context: LiteInspectorContext): AdapterResult | Promise<AdapterResult>;
  setEntityVisible?(entity: LiteEntity, visible: boolean, context: LiteInspectorContext): AdapterResult | Promise<AdapterResult>;
  getEntitySnapshot?(entity: LiteEntity, context: LiteInspectorContext): AdapterResult<unknown> | Promise<AdapterResult<unknown>>;
  pickEntityId?(x: number, y: number, context: LiteInspectorContext): AdapterResult<string | null> | Promise<AdapterResult<string | null>>;
  dispose?(): void;
};
