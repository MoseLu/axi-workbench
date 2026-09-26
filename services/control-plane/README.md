# Axi Workstation Control Plane

Local six-layer project control plane for IM-driven status queries and safe registered actions.

运行时改动必须遵守仓库 SOP：[`docs/rules/epap-six-layer-sop.md`](../../docs/rules/epap-six-layer-sop.md)。在该模型中，AGENT 工作必须表示为软件层 `AgentTask`；MEMORY、DOCS、SOUL、HEARTBEAT、audit、tools、files 都是基础服务层能力；物理服务永远不拥有项目。

## Six-layer ownership declaration

| Contract point | Control Plane owner |
|---|---|
| Entry | Authenticated HTTP/API routes and normalized `IMEnvelope` requests enter through `src/server.mjs` and the control-plane surface. |
| Authority | Workspace graph/registry projections, registered action contracts, persisted PolicyDecision records, and the Control Plane job/evidence store. |
| Downstream | Typed schemas, registered command executors, bounded AgentTask runtimes, memory/document adapters, declared physical/external capability references, and an optional external notification-relay enqueue boundary. |
| Renderer | Returns typed snapshots, control responses, Job events, and audit-linked response envelopes; it does not send IM messages directly. |
| Audit | Append-only Workspace Events plus per-job audit/evidence records, retaining actor, subject, object, correlation, policy and result references. |
| Verification | Control-plane unit/API suite (including handoff expiry/notification failure paths), schema and gateway contract suites, `pnpm --filter @axi/workstation-control-plane smoke`, and the six-layer boundary check. |

The declaration is checked against the six-layer SOP before service changes are
merged; a downstream executor cannot become a second project or policy owner.

## IM Roles

- MossCoder is the all-purpose workbench: rich command issuing, work management, and tool-heavy operation.
- Feishu is the intelligence station: concise briefings, status intelligence, progress updates, alerts, and situational awareness.
- WeChat private chat is the lightweight remote entry: paired private commands, approvals, and short status checks.
- cc-connect is the communication gateway: message normalization, routing, receipts, idempotency, and transport integration.

## HTTP API

- `GET /health`
- `GET /snapshot`
- `GET /events?eventType=&actorRef=&objectRef=&since=&afterEventId=&limit=`
- `GET /events/:eventId`
- `POST /authorization/decision`
- `POST /jobs`
- `GET /jobs/:id`
- `GET /jobs/:id/events`
- `GET /jobs/:id/artifacts`
- `POST /jobs/:id/cancel`
- `POST /query`
- `POST /communication/messages`
- `GET /agent-tasks/:id`
- `POST /agent-tasks/:id/cancel`
- `POST /approvals/:id/decision`
- `POST /commands/:id/run`
- `GET /runs/:id`

### Workspace governance snapshot (Phase 0/1)

`GET /snapshot` now includes an optional `governance` projection. It reads the
workspace graph and, when present, the governance registry as separate
declarations and returns stable object identity, declared type, owner,
lifecycle, source-of-truth references, typed relationships, evidence records,
freshness, and unresolved conflicts. The registry is preferred for canonical
identity fields, but conflicting graph/registry values remain visible in
`conflicts` rather than being silently overwritten.

Each governance unit also carries a conservative `health` explanation with a
status (`healthy`, `warning`, `critical`, or `unknown`), a stable reason code,
the supporting evidence references, affected object references, the resolved
owner, and a recommended action code. Without fresh runtime or behavioral
evidence, the projection stays `unknown` instead of claiming that structural
presence proves health.

The top-level `relationships` array contains the source-declared typed edges
and derived `DEPENDS_ON` edges created when a consumer and provider share a
capability or when `consumes` directly names another registered unit. The
`impact` array provides direct and transitive upstream and
downstream references for each governance unit; it is a read model only and
does not rewrite the graph or provider registries.

Graph `docs_entrypoints` are projected as required document objects with a
resolved project-relative path and structural evidence. Current statuses are
`present`, `missing`, or `unknown`; missing or unresolved entries remain
visible in the unit's `documentRefs`, evidence list, warnings, and health
explanation. No freshness or conflict is inferred without a provider policy.

Workspace graph rules and the registry's admission-policy reference are also
projected as read-only rule declarations with scope, priority, owner, source,
and structural status. An unknown owner or a declared rule is not treated as
an executed policy decision.

The existing append-only `audit.jsonl` ledger is also exposed as a normalized
read-only Workspace Event stream. Each event carries an event id/type,
occurred and recorded timestamps, actor/scope/object references, action,
correlation and optional policy/evidence references, result, source and an
immutable retention class. `/events` supports bounded pagination and filters;
malformed lines are ignored and raw audit payloads are never returned. This is
the first Phase 4 activity/audit projection and does not yet replace the
provider-owned ledgers or introduce the planned PostgreSQL event store.

Additional Service or Deployment ledgers may be supplied explicitly through
`AXI_WORKSPACE_EVENT_SOURCES` as a JSON array of `{ "path": "...", "source": "..." }`.
There is no implicit directory scan or guessed neighbor-project path; each
source keeps its own integrity segment before the streams are merged.

### Workspace RBAC readiness (Phase 5)

`evaluateGovernancePolicy` is a read-only policy kernel for typed
Subject/Role/Grant inputs. It applies explicit scope inheritance, validity
windows, deny precedence, and the `require_approval` /
`require_additional_evidence` outcomes, returning matched grants, reasons,
expiry and evidence references. Grant loading and group expansion remain with
the identity/registry owner; an empty or unavailable grant set defaults to
`deny`.

Internal gateway routes require `AXI_GATEWAY_CONTROL_PLANE_TOKEN`. The
development fallback is available only outside production; in production a
missing token or the development default `axi-development-internal-token` is
rejected. This credential fail-closed guard does not replace provider-owned
caller identity or mTLS.

`POST /authorization/decision` evaluates the same kernel against grants loaded
only from the registry's optional `settings.rbac.grants` reference. The route
accepts the subject/resource/action query, never accepts client-supplied
grants, and returns an explicit warning plus `deny` when the owner has not
configured a grant source. Every evaluation also appends a normalized,
server-attributed `policy_decision.evaluated` Workspace Event linking the
caller, governed object, action, policy decision and result.

The registry-owned JSON source is either a grant array or an object with a
`grants` array. Each accepted grant must contain `id`, `subjectRef`, `roleRef`,
`scopeType` (`workspace`/`unit`/`object`), `scopeRef`, `resourceRef`, `action`,
`effect`, and `inheritance`; it may include `priority`, `validFrom`,
`validTo`, `overrides`, `source`, and `evidenceRefs`. Grant IDs must be unique,
validity windows must be forward-moving, and malformed or duplicate entries
are excluded with explicit warnings. A missing `source` is attributed to the
declared grants file path; this preserves provenance without accepting
client-supplied authorization data.

Core controlled writes (`POST /jobs`, job and AgentTask cancellation, approval
decisions and registered command runs) perform the same policy evaluation
immediately after core authentication and before invoking their executor. Any
result other than `allow` is returned as a fail-closed `403` (or `409` for
approval escalation), and the attempted decision remains auditable.

Natural-language execution through `/query` or `/communication/messages` uses
the same gate after intent resolution and before a registered command or
AgentTask is started. Read-only status queries and `dryRun` planning do not
invoke an executor and remain available as read models.

Mobile project jobs, cancellations, approval decisions and approval-scan
decisions use the authenticated device as a server-derived `user:<deviceId>`
subject and pass through the same Grant source after the existing owner-scope
check. A `require_approval` decision may create the pending approval; the
resulting ApprovalRequest and dispatched Job retain the original
`policyDecisionRef`.

Until each provider declares its own TTL, completion declarations use a
30-day default freshness window; structural observations without a provider
TTL remain `not_configured` rather than being presented as verified behavior.

Optional runtime roots are supplied through `AXI_COMMUNICATION_GATEWAY_ROOT`,
`AXI_CC_CONNECT_ROOT`/`CC_CONNECT_HOME`, `AXI_MOBILE_ROOT`,
`AXI_NOTIFY_ROOT`, and `AXI_FLEET_CONSOLE_ROOT`. When they are absent, only
workspace-relative canonical or existing legacy compatibility paths are used;
external paths are reported as `unknown`.

The projection is read-only and does not introduce a database or replace either
owner's source files. An absent registry or an unconfigured external runtime is
reported as `unknown`; it is not converted into a false `missing` result.

### Personal OS project queue

Personal OS v0.1 is a Workbench surface backed by the existing control-plane;
it is not a new provider or a second resource gateway. The public Gateway
maps these authenticated routes to the control-plane process:

- `GET /api/v1/control-plane/personal-os/queue`
- `GET /api/v1/control-plane/personal-os/projects/:projectId`
- `PATCH /api/v1/control-plane/personal-os/projects/:projectId`
- `GET /api/v1/control-plane/personal-os/focus`
- `PUT /api/v1/control-plane/personal-os/focus`

The projection reads project identity and relationships from the workspace
registry/graph, runtime and activity from DevSvc/control-plane sources, and
only reads editable lifecycle metadata, `finishLine`, `usesAxiUi` and focus
state from Personal OS SQLite. Its local database is stored below
`AXI_WORKSTATION_CONTROL_CACHE_DIR` (or the existing control-plane cache
directory) as `personal-os.sqlite`; it does not replace the file-backed jobs,
audit or AgentRun stores.

The API returns a versioned `ProjectQueueItem` projection and a warnings list.
AgentRun data is reduced to safe summaries and never exposes prompts, working
directories, process output, provider credentials or authentication material.
The route/schema reference is openapi/personal-os.v1.yaml; the TypeScript
source of truth is the @axi/workstation-contracts Personal OS entity module.
The control-plane service requires Node.js `>=22.5.0` because it uses the
built-in `node:sqlite` runtime API for the local metadata store.

### Mobile action and cross-surface contract

Browser and mobile clients do not call this process directly. API Gateway is
the public ingress: it maps `/api/v1/mobile/*` to the internal
`/internal/mobile/v1/*` route and adds its service credential; paired-device
bearers are verified here only after that boundary. The Gateway also maps
authenticated Web `/api/v1/handoffs` and `/api/v1/handoffs/:id` requests to
the corresponding `/internal/web/v1/handoffs` routes and supplies the
verified Web subject.

- `POST /mobile/v1/approval-scans/resolve` accepts only an opaque `scanToken`
  from `axi://approval/scan_*` and returns the current object, impact, risk,
  state, permitted decision(s), expiry and `handoffCorrelationId`.
- `POST /mobile/v1/approval-scans/:scanId/decision` accepts only `decision`,
  `idempotencyKey` and `handoffCorrelationId`. It derives every business
  object from the stored scan; a C/D decision creates a Web handoff rather
  than executing on Mobile.
- `GET /api/v1/handoffs?status=<status>&actor=<sourceActorRef>` returns the
  authenticated Web history projection, sorted newest first. Bound records
  are filtered to the verified Web owner subject stored in `sourceOwnerRef`;
  `actor` remains only a filter for the originating Mobile actor reference.
  Unbound legacy records remain visible during migration, while Web identity
  is established by the Gateway session.
- Before opening, completing, or rejecting a handoff linked to an
  `ApprovalRequest`, the Control Plane reloads that approval and requires its
  status to remain `pending`; an overdue pending approval is first persisted
  as `expired` together with its linked handoff; for any other non-pending
  approval, the handoff returns 409, remains unchanged, and an access-denied
  audit event is recorded.
- `GET /api/v1/mobile/handoffs?status=<status>` returns only records created by
  the bearer-authenticated Mobile device; the server supplies the actor filter
  and ignores any caller-supplied actor identity.
- Handoff expiry defaults to 24 hours and may be overridden per Control Plane
  instance with a positive integer `handoffExpiryMs` or the
  `AXI_HANDOFF_EXPIRY_MS` environment variable; the explicit option wins and
  invalid values fall back to the default. Business-specific shorter SLAs
  remain product-owned policy.
- The historical `/mobile/v1/approvals/:id/decision` route is migration-only;
  new clients must use the scan route above.

OIDC web-login confirmation remains an Identity transaction under the
Gateway's `/api/v1/auth/qr/transactions/:id/approve`; it is not a Control
Plane domain approval and never accepts an `axi://approval/*` URI.

## Strict Communication Contract

Axi Workstation follows the strict six-layer model:

- IM layer owns user-facing products only: Feishu is the intelligence station, MossCoder is the all-purpose workbench, WeChat private chat is the lightweight remote entry.
- Communication layer owns transport only: normalize messages, route requests, render replies, handle receipts, idempotency, and audit.
- Control plane never sends IM messages directly.
- Software layer owns projects, services, state, progress, and workflows.
- Base service, physical service, and external capability layers are independent capability/resource layers and do not own projects.

The communication gateway reaches the control plane through the authenticated
`/internal/communication/v1/*` boundary. It supplies its internal credential
and a subject derived from the trusted normalized envelope; it does not receive
or construct a core bearer token.

The communication gateway submits a normalized message:

```json
{
  "envelope": {
    "id": "feishu-message-id",
    "channel": "feishu",
    "conversationId": "feishu-chat-id",
    "senderId": "open-id",
    "text": "当前项目有哪些？",
    "receivedAt": "2026-05-20T00:00:00.000Z"
  }
}
```

Control plane returns a response envelope instead of sending it:

```json
{
  "ignored": false,
  "run": {
    "intent": "list_resources",
    "accepted": true
  },
  "response": {
    "channel": "feishu",
    "conversationId": "feishu-chat-id",
    "text": "**当前项目**...",
    "format": "feishu_markdown",
    "language": "zh-CN",
    "auditId": "control-run-id"
  }
}
```

The communication gateway is responsible for rendering `feishu_markdown` as a Feishu-friendly list, table, or card and for delivering it to the originating session. Transport-specific payloads such as Feishu or cc-connect raw messages are normalized in `services/communication-gateway`; they are not accepted as control-plane business input.

## Long-Running Jobs

IM-originated code/coworker/docs/ops tasks should use `POST /jobs`. The control plane writes a local authoritative job directory under `.cache/epap-control-plane/jobs/<jobId>/` and returns immediately with `accepted + jobId + assessment`.

Each job emits events to `events.jsonl` and `GET /jobs/:id/events`. If execution lasts longer than 30 seconds without a stage transition, the runtime emits a heartbeat event so the IM side can keep the user informed.

Workflow orchestration is handled by LangGraph. The job id is used as the LangGraph `thread_id`; Axi Workstation owns the durable evidence store by writing `job.json`, `events.jsonl`, `plan.json`, `assignments/*.json`, `agent-runs/*.json`, `audit-report.json`, `archive.json`, and `langgraph-state.json` under the job directory. This keeps the v1 runtime recoverable and replayable from local artifacts without giving the communication layer any business authority.

`AXI_WORKSTATION_ROOT`, `AXI_WORKSTATION_CONTROL_CACHE_DIR`, and `AXI_WORKSTATION_ENABLE_CODEX_APP_RUNTIME` are the active environment names. Existing `EPAP_*` values and the `.cache/epap-control-plane` default storage location remain readable during this migration so previously created local artifacts do not disappear.

The current LangGraph graph is:

```text
START
  -> planning
  -> documenting
  -> executing
  -> master_collecting
  -> auditing
  -> passed -> archiving -> END
  -> rejected_rework -> END
```

The v1 workflow runtime uses four roles:

- `master`: plans and coordinates; does not edit files.
- `worker`: executes the assigned scope and self-audits.
- `auditor`: read-only pass/reject review.
- `librarian`: prepares task docs and archives memory/experience summaries.
