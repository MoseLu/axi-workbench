# Axi Workstation Control Plane

Local six-layer project control plane for IM-driven status queries and safe registered actions.

运行时改动必须遵守仓库 SOP：[`docs/rules/epap-six-layer-sop.md`](../../docs/rules/epap-six-layer-sop.md)。在该模型中，AGENT 工作必须表示为软件层 `AgentTask`；MEMORY、DOCS、SOUL、HEARTBEAT、audit、tools、files 都是基础服务层能力；物理服务永远不拥有项目。

## IM Roles

- MossCoder is the all-purpose workbench: rich command issuing, work management, and tool-heavy operation.
- Feishu is the intelligence station: concise briefings, status intelligence, progress updates, alerts, and situational awareness.
- WeChat private chat is the lightweight remote entry: paired private commands, approvals, and short status checks.
- cc-connect is the communication gateway: message normalization, routing, receipts, idempotency, and transport integration.

## HTTP API

- `GET /health`
- `GET /snapshot`
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

## Strict Communication Contract

Axi Workstation follows the strict six-layer model:

- IM layer owns user-facing products only: Feishu is the intelligence station, MossCoder is the all-purpose workbench, WeChat private chat is the lightweight remote entry.
- Communication layer owns transport only: normalize messages, route requests, render replies, handle receipts, idempotency, and audit.
- Control plane never sends IM messages directly.
- Software layer owns projects, services, state, progress, and workflows.
- Base service, physical service, and external capability layers are independent capability/resource layers and do not own projects.

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
