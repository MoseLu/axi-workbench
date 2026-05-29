import { createControlPlane } from "./control-plane.mjs";

const controlPlane = createControlPlane();
const snapshot = controlPlane.snapshot();

if (!snapshot.resources.length) {
  throw new Error("control-plane snapshot is empty");
}

console.log(JSON.stringify({
  resources: snapshot.resources.length,
  layers: snapshot.resources.reduce((acc, resource) => {
    acc[resource.layer] = (acc[resource.layer] || 0) + 1;
    return acc;
  }, {}),
}, null, 2));
