export function observable(x: number, y: number, z: number) {
  return { x, y, z, set(nx: number, ny: number, nz: number) { this.x = nx; this.y = ny; this.z = nz; } };
}

export function fakeScene() {
  const material = { name: "Red" };
  const mesh = {
    id: "sphere-id",
    name: "Sphere",
    children: [],
    position: observable(0, 1, 0),
    rotation: observable(0, 0, 0),
    rotationQuaternion: { ...observable(0, 0, 0), w: 1 },
    scaling: observable(1, 1, 1),
    parent: null,
    worldMatrix: { length: 16 },
    worldMatrixVersion: 1,
    visible: true,
    material,
    receiveShadows: false
  };
  const light = {
    lightType: "hemispheric",
    children: [],
    parent: null,
    worldMatrix: { length: 16 },
    worldMatrixVersion: 1,
    direction: observable(0, 1, 0),
    intensity: 1,
    diffuseColor: [1, 1, 1],
    specularColor: [1, 1, 1],
    groundColor: [0, 0, 0]
  };
  return {
    scene: {
      camera: null,
      meshes: [mesh],
      lights: [light],
      animationGroups: [],
      clearColor: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
      imageProcessing: { exposure: 1, contrast: 1, toneMappingEnabled: false, toneMappingType: "standard" as const },
      environmentPrimaryColor: [0.1, 0.1, 0.2] as [number, number, number],
      envRotationY: 0,
      fog: null,
      clipPlane: null,
      shadowGenerators: [],
      fixedDeltaMs: 0
    },
    mesh,
    light,
    material
  };
}
