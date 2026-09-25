// services/control-plane/src/observability-events.mjs
//
// Phase 1.6: thin re-export over `@axi/observability-events`. The
// foundation package owns the normalized envelope contract and the
// transport (HTTP POST + JSONL outbox fallback). This module keeps
// the original workbench API surface (`emitObservabilityEvent`,
// `commitEvent`) so existing call sites in `server.mjs` and
// `commit-ledger/api-routes.mjs` continue to work without changes.
// New code should import from `@axi/observability-events` directly.

import {
  commitRecorded as _commitRecorded,
  emitEvent as _emitEvent,
  projectUpdatedEvent,
  serviceHealthChangedEvent,
  verificationCompletedEvent,
  warningEvent,
  workspaceSyncEvent,
} from '../../../../../foundation/axi-observability/node/packages/observability-events/src/index.mjs';

export async function emitObservabilityEvent(event) {
  return _emitEvent(event);
}

export function commitEvent(record) {
  return _commitRecorded({ record });
}

export {
  projectUpdatedEvent,
  serviceHealthChangedEvent,
  verificationCompletedEvent,
  warningEvent,
  workspaceSyncEvent,
};