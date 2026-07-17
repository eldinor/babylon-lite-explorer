import { createFreeCamera } from "@babylonjs/lite";
import type { BaseInstanceSet, VatCharacterSet } from "@litools/instancer";
import { describe, expect, it, vi } from "vitest";
import { createInstancerExplorerAdapter } from "../src/adapter/instancer/createInstancerExplorerAdapter";

const matrixAt = (x: number, y = 0, z = 0) => new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  x, y, z, 1
]);

describe("Instancer 0.3 adapter", () => {
  it("uses official slot lookup and hierarchy child meshes for rigid picking", async () => {
    const childMesh = { name: "Hierarchy child" };
    const root = { name: "Robot root" };
    const entries = vi.fn(() => [{ id: 7, slot: 3, metadata: { label: "Robot 7" } }]);
    const getIdForSlot = vi.fn((slot: number) => slot === 3 ? 7 : undefined);
    const set = {
      count: 1,
      capacity: 8,
      visibleCount: 1,
      root,
      pool: { meshes: [childMesh] },
      entries,
      has: (id: number) => id === 7,
      getSlot: (id: number) => id === 7 ? 3 : undefined,
      getIdForSlot,
      getMetadata: () => ({ label: "Robot 7" }),
      getVisible: () => true,
      getVisibleOrUndefined: () => true,
      getMatrix: () => matrixAt(0),
      getMatrixOrUndefined: () => matrixAt(0),
      getPosition: () => new Float32Array([0, 0, 0]),
      setVisible: vi.fn(),
      setTransform: vi.fn(),
      setScale: vi.fn()
    } as unknown as BaseInstanceSet<{ label: string }> & { root: unknown; pool: { meshes: unknown[] } };
    const adapter = createInstancerExplorerAdapter();
    adapter.register(set, { label: "Robots" });

    const result = await adapter.pickEntityId?.(10, 20, {
      engine: {},
      scene: {},
      lite: {
        createGpuPicker: vi.fn(() => ({})),
        disposePicker: vi.fn(),
        pickAsync: vi.fn(async () => ({ hit: true, pickedMesh: childMesh, thinInstanceIndex: 3 }))
      } as never
    });

    expect(result).toEqual({ ok: true, value: expect.stringContaining(":instance:7") });
    expect(getIdForSlot).toHaveBeenCalledWith(3);
    expect(entries).toHaveBeenCalledTimes(1); // registration snapshot only; picking does not scan entries
  });

  it("normalizes VatCharacterSet through primary data and synchronized wrapper writes", async () => {
    const root = { name: "Samba character" };
    const primaryMesh = { name: "Body" };
    const secondaryMesh = { name: "Hair" };
    const primary = {
      count: 1,
      capacity: 4,
      visibleCount: 1,
      mesh: primaryMesh,
      entries: () => [{ id: 11, slot: 0, metadata: { label: "Dancer" } }],
      has: (id: number) => id === 11,
      getSlot: () => 0,
      getIdForSlot: () => 11,
      getMetadata: () => ({ label: "Dancer" }),
      getVisible: () => true,
      getVisibleOrUndefined: () => true,
      getMatrix: () => matrixAt(0),
      getMatrixOrUndefined: () => matrixAt(0),
      getPosition: () => new Float32Array([0, 0, 0]),
      setVisible: vi.fn(),
      setTransform: vi.fn(),
      setScale: vi.fn(),
      setColor: vi.fn(),
      getColor: () => new Float32Array([1, 1, 1, 1])
    };
    const setVisible = vi.fn();
    const setTransform = vi.fn();
    const play = vi.fn(() => true);
    const setClip = vi.fn(() => true);
    const character = {
      root,
      primary,
      secondaryParts: [{ mesh: secondaryMesh }],
      clips: { Dance: { fromRow: 0, frameCount: 60, fps: 30 }, Idle: { fromRow: 60, frameCount: 30, fps: 30 } },
      activeClip: "Dance",
      timeSeconds: 0,
      count: 1,
      capacity: 4,
      visibleCount: 1,
      has: (id: number) => id === 11,
      getVisible: () => true,
      setVisible,
      getMatrix: () => matrixAt(0),
      setMatrix: vi.fn(),
      setTransform,
      play,
      setClip,
      getPlaybackSample: () => ({ clip: "Dance", timeSeconds: 0, offsetSeconds: 0, fps: 30, frame: 0, nextFrame: 1, alpha: 0 })
    } as unknown as VatCharacterSet<{ label: string }>;
    const adapter = createInstancerExplorerAdapter();
    adapter.register(character, { label: "Dancers" });

    expect(adapter.exportSet(character)).toMatchObject({
      kind: "vat-character",
      sourceLabel: "Samba character",
      instances: [{ id: 11, label: "Dancer", clip: "Dance", metadata: { label: "Dancer" } }]
    });
    const sourceEntity = (await adapter.getExtensionEntities?.({ engine: {}, scene: {} }) ?? [])[0];
    const setEntity = sourceEntity?.children?.[0];
    const instance = setEntity?.children?.[0];
    const animations = setEntity?.children?.find((entity) => entity.meta?.instancer === "animations");
    expect(instance).toBeDefined();
    expect(animations?.children?.map((entity) => entity.label)).toEqual(["Dance", "Idle"]);

    expect(await adapter.getProperties(setEntity!, { engine: {}, scene: {} })).toContainEqual(expect.objectContaining({
      kind: "select",
      path: "activeClip",
      value: "Dance"
    }));
    await adapter.setProperty?.(setEntity!, "activeClip", "Idle", { engine: {}, scene: {} });
    await adapter.setProperty?.(instance!, "clip", "Idle", { engine: {}, scene: {} });
    expect(play).toHaveBeenCalledWith("Idle");
    expect(setClip).toHaveBeenCalledWith(11, "Idle");

    await adapter.setProperty?.(instance!, "rotationEuler", [0.2, 0, 0], { engine: {}, scene: {} });
    await adapter.setEntityVisible?.(instance!, false, { engine: {}, scene: {} });
    expect(setTransform).toHaveBeenCalledWith(11, expect.objectContaining({ rotationEuler: [0.2, 0, 0] }));
    expect(setVisible).toHaveBeenCalledWith(11, false);
    expect(primary.setTransform).not.toHaveBeenCalled();
    expect(primary.setColor).not.toHaveBeenCalled();
  });

  it("uses nearest visible projected centers for VAT logical picking", async () => {
    const mesh = { name: "VAT body", boundMin: [-1, 0, -1], boundMax: [1, 4, 1] };
    const entries = [{ id: 1, slot: 0 }, { id: 2, slot: 1 }, { id: 3, slot: 2 }];
    const matrices = new Map([[1, matrixAt(0)], [2, matrixAt(2)], [3, matrixAt(0.1)]]);
    const set = {
      count: 3,
      capacity: 4,
      visibleCount: 2,
      mesh,
      set: {},
      clips: { Idle: {} },
      entries: () => entries,
      has: (id: number) => matrices.has(id),
      getSlot: (id: number) => id - 1,
      getIdForSlot: (slot: number) => slot + 1,
      getVisible: (id: number) => id !== 3,
      getVisibleOrUndefined: (id: number) => id !== 3,
      getMatrix: (id: number) => matrices.get(id)!,
      getMatrixOrUndefined: (id: number) => matrices.get(id),
      getPosition: (id: number) => matrices.get(id)!.slice(12, 15),
      setVisible: vi.fn(),
      setTransform: vi.fn(),
      setScale: vi.fn(),
      getClip: () => "Idle"
    } as unknown as BaseInstanceSet & { mesh: unknown; set: unknown; clips: unknown };
    const adapter = createInstancerExplorerAdapter();
    adapter.register(set);
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 100;
    const camera = createFreeCamera({ x: 0, y: 2, z: -10 }, { x: 0, y: 2, z: 0 });
    const runtime = {
      createGpuPicker: vi.fn(() => ({})),
      disposePicker: vi.fn(),
      pickAsync: vi.fn(async () => ({ hit: false, pickedMesh: null, thinInstanceIndex: -1 }))
    } as never;

    const result = await adapter.pickEntityId?.(100, 50, { engine: {}, scene: { camera }, canvas, lite: runtime });
    expect(result).toEqual({ ok: true, value: expect.stringContaining(":instance:1") });
    expect(await adapter.pickEntityId?.(100, 50, { engine: {}, scene: { camera: null }, canvas, lite: runtime }))
      .toEqual({ ok: true, value: null });
  });
});
