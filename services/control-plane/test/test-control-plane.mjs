import { createControlPlane as createRawControlPlane, evaluateGovernancePolicy } from "../src/control-plane.mjs";

export { evaluateGovernancePolicy };

// Low-level orchestration tests explicitly opt out of the production
// execution precondition; the dedicated enforcement test opts back in.
export function createControlPlane(options = {}) {
  return createRawControlPlane({
    enforceExecutionPolicy: options.enforceExecutionPolicy ?? false,
    ...options,
  });
}
