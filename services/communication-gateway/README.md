# Axi Workstation Communication Gateway

Transport-only communication layer for the six-layer Axi Workstation model.

运行时改动必须遵守仓库 SOP：[`docs/rules/epap-six-layer-sop.md`](../../docs/rules/epap-six-layer-sop.md)。本服务只属于通信层；不得变成 agent runner、memory reader、document retriever 或 physical resource controller。

## Six-layer ownership declaration

| Contract point | Communication Gateway owner |
|---|---|
| Entry | Feishu, MossCoder, cc-connect and WeChat transport adapters enter through gateway HTTP routes. |
| Authority | Route pairing state, transport idempotency/receipt state, envelope normalization and response rendering; business state remains in Control Plane or the provider. |
| Downstream | Authenticated Control Plane communication boundary and channel delivery adapters only. |
| Renderer | Channel-specific Chinese response envelopes, job cards, progress receipts and delivery acknowledgements. |
| Audit | Transport receipt/delivery audit with route, idempotency, job and event cursor references; no project-state ownership. |
| Verification | Communication-gateway unit/API suite, source boundary scan, Control Plane communication contract tests, and `pnpm check:boundaries`. |

The gateway must not read workspace/project state, resolve policy, invoke an
agent or shell, or replace the Control Plane's audit and authorization owner.

## Responsibility

- Accept IM or gateway-specific payloads from Feishu, MossCoder, cc-connect, or future adapters.
- Accept WeChat personal private-chat payloads as a lightweight remote entry.
- Normalize them into the canonical `IMEnvelope` shape.
- Submit long-running normalized envelopes to the authenticated Control Plane communication boundary (`POST /internal/communication/v1/jobs`) and return the accepted job card immediately.
- Keep `POST /communication/messages` only for short/intelligence-compatible control-plane interactions.
- Render returned response envelopes for the target IM product.
- Keep receipts, idempotency, and delivery audit outside the control plane.
- Store communication receipts with `jobId` and `lastDeliveredEventId` so IM updates can be deduplicated.
- Use the configured `AXI_GATEWAY_CONTROL_PLANE_TOKEN` plus a server-derived
  `X-Axi-Subject` for both job submission and progress-event polling; transport
  callers never receive or construct a core bearer token.

## Non-Responsibility

- It does not decide project status, dependencies, workflow ownership, or safety policy.
- It does not read project directories, memory tables, workspace graph files, or physical resource state.
- It does not execute software-layer actions.

MossCoder should use this layer as a full workbench transport. Feishu should use it as an intelligence-station transport with concise Chinese list/table/card rendering. WeChat should use it as a paired private-chat transport and should not bypass pairing.

## HTTP API

- `GET /health`
- `GET /routes`
- `POST /routes/pair/start`
- `POST /routes/pair/confirm`
- `POST /transports/:channel/messages`
- `POST /responses/:channel/send`

## Long-Running Job UX

After pairing, MossCoder and other workbench-style channels receive an immediate Chinese task card containing `jobId`, task type, complexity, risk, current stage, and next update time. The gateway must not wait for `codex_cli` or role agents to finish before responding.

Use `AXI_WORKSTATION_COMMUNICATION_CACHE_DIR` and `AXI_WORKSTATION_CONTROL_PLANE_URL` for new runtime configuration. Legacy `EPAP_*` environment variables and event idempotency keys remain accepted for in-flight compatibility.
