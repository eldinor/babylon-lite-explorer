import {
  createBox,
  parseNodeMaterialFromSnippet,
  type EngineContext,
  type Mesh,
} from "@babylonjs/lite";

const graph = {
  blocks: [
    { id: 1, name: "position", customType: "BABYLON.InputBlock", mode: 1, type: 8, outputs: [{ name: "output" }] },
    { id: 2, name: "world", customType: "BABYLON.InputBlock", systemValue: 1, type: 128, outputs: [{ name: "output" }] },
    { id: 3, name: "worldViewProjection", customType: "BABYLON.InputBlock", systemValue: 6, type: 128, outputs: [{ name: "output" }] },
    {
      id: 4,
      name: "World position",
      customType: "BABYLON.TransformBlock",
      complementW: 1,
      complementZ: 0,
      inputs: [
        { name: "vector", targetBlockId: 1, targetConnectionName: "output" },
        { name: "transform", targetBlockId: 2, targetConnectionName: "output" },
      ],
      outputs: [{ name: "output" }],
    },
    {
      id: 5,
      name: "Clip plane",
      customType: "BABYLON.ClipPlanesBlock",
      inputs: [{ name: "worldPosition", targetBlockId: 4, targetConnectionName: "output" }],
      outputs: [],
    },
    {
      id: 6,
      name: "World View Projection",
      customType: "BABYLON.TransformBlock",
      complementW: 1,
      complementZ: 0,
      inputs: [
        { name: "vector", targetBlockId: 1, targetConnectionName: "output" },
        { name: "transform", targetBlockId: 3, targetConnectionName: "output" },
      ],
      outputs: [{ name: "output" }],
    },
    {
      id: 7,
      name: "VertexOutput",
      customType: "BABYLON.VertexOutputBlock",
      inputs: [{ name: "vector", targetBlockId: 6, targetConnectionName: "output" }],
      outputs: [],
    },
    { id: 8, name: "Node color", customType: "BABYLON.InputBlock", mode: 0, type: 16, value: [0.72, 0.22, 1, 1], outputs: [{ name: "output" }] },
    {
      id: 9,
      name: "FragmentOutput",
      customType: "BABYLON.FragmentOutputBlock",
      inputs: [{ name: "rgba", targetBlockId: 8, targetConnectionName: "output" }],
      outputs: [],
    },
  ],
};

export async function createClippedNodeBoxes(engine: EngineContext): Promise<Mesh[]> {
  const material = await parseNodeMaterialFromSnippet(engine, "inline", { json: graph });
  material.name = "Clipped Node Material";

  return Array.from({ length: 4 }, (_, index) => {
    const box = createBox(engine, 1.25);
    box.name = `Clipped Node box ${index + 1}`;
    box.position.x = -4.3;
    box.position.y = 1.55;
    box.position.z = -3 + index * 2.2;
    box.scaling.y = 2.45;
    box.material = material;
    return box;
  });
}
