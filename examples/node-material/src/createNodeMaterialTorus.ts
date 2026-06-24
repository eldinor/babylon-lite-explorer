import {
  createTorus,
  parseNodeMaterialFromSnippet,
  type EngineContext,
  type Mesh,
} from "@babylonjs/lite";

const graph = {
  blocks: [
    {
      id: 1,
      name: "position",
      customType: "BABYLON.InputBlock",
      mode: 1,
      type: 8,
      outputs: [{ name: "output" }],
    },
    {
      id: 2,
      name: "worldViewProjection",
      customType: "BABYLON.InputBlock",
      systemValue: 6,
      type: 128,
      outputs: [{ name: "output" }],
    },
    {
      id: 3,
      name: "World View Projection",
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
      id: 4,
      name: "VertexOutput",
      customType: "BABYLON.VertexOutputBlock",
      inputs: [{ name: "vector", targetBlockId: 3, targetConnectionName: "output" }],
      outputs: [],
    },
    {
      id: 5,
      name: "Color",
      customType: "BABYLON.InputBlock",
      mode: 0,
      type: 16,
      value: [0.12, 0.55, 1, 1],
      outputs: [{ name: "output" }],
    },
    {
      id: 6,
      name: "FragmentOutput",
      customType: "BABYLON.FragmentOutputBlock",
      inputs: [{ name: "rgba", targetBlockId: 5, targetConnectionName: "output" }],
      outputs: [],
    },
  ],
};

export async function createNodeMaterialTorus(engine: EngineContext): Promise<Mesh> {
  const material = await parseNodeMaterialFromSnippet(engine, "inline", { json: graph });
  material.name = "Blue Node Material";

  const torus = createTorus(engine, { diameter: 2, thickness: 0.55, tessellation: 48 });
  torus.name = "Node Material Torus";
  torus.position.x = -1.2;
  torus.material = material;
  return torus;
}
