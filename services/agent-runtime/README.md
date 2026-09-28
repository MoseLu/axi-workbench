# @axi/agent-runtime

The **only** service in the Axi Workbench monorepo allowed to spawn the
`codex` CLI. Every other service (control-plane, etc.) that needs codex must
talk to this service over HTTP.

## Why

Before PR-6.5B, `services/control-plane/src/control-plane.mjs` called
`spawnSync(codexBin, ...)` directly in two functions:

- `executeAgentTask` (around line 4833)
- `executeRoleAgentRun` (around line 5366)

That is a P0 boundary violation. control-plane is the orchestration plane;
it must not own the only spawning point of a security-critical CLI. PR-6.5B
moves the spawning here and turns the call into an HTTP `fetch`.

## Endpoints

| Method | Path                  | Body                                              | Notes                              |
|--------|-----------------------|---------------------------------------------------|------------------------------------|
| GET    | `/healthz`            | —                                                 | Liveness. Always 200.              |
| GET    | `/readyz`             | —                                                 | Readiness. Reports bind + codexBin. |
| POST   | `/v1/agent/execute`   | `{ prompt, threadId?, sandbox?, timeoutMs? }`     | Spawns codex, returns summary.     |

### Response shape (execute)

```json
{
  "status": "succeeded" | "failed" | "rejected",
  "summary": "...",
  "reply": "last agent_message or null",
  "threadId": "...",
  "finalAnswerCount": 0,
  "exitCode": 0,
  "signal": null,
  "stderr": ""
}
```

Status codes:

- `200` — codex exited 0
- `400` — policy rejected (forbidden flag, BLOCK_PATTERN hit, bad payload)
- `500` — spawn failed or codex exited non-zero

## Environment variables

| Variable                          | Default                          | Purpose                                      |
|-----------------------------------|----------------------------------|----------------------------------------------|
| `AXI_AGENT_RUNTIME_PORT`          | `8094`                           | TCP port                                     |
| `AXI_AGENT_RUNTIME_HOST`          | `127.0.0.1`                      | Fallback bind interface                      |
| `AXI_AGENT_RUNTIME_BIND_HOST`     | `AXI_AGENT_RUNTIME_HOST`         | Bind interface (preferred override)          |
| `AXI_AGENT_RUNTIME_CWD`           | `process.cwd()`                  | Base for default audit log path              |
| `AXI_AGENT_RUNTIME_AUDIT_LOG`     | `<cwd>/.cache/agent-runtime-audit.log` | Audit log path                         |
| `CODEX_BIN`                       | `codex`                          | codex binary (env override)                  |

## Policy

`src/policy.mjs` is the single gate for:

1. `BLOCK_PATTERNS` — destructive ops (`rm -rf`, `git reset --hard`, 生产 部署, ...)
2. `FORBIDDEN_CODEX_FLAGS` — `--dangerously-bypass-approvals`,
   `--no-approvals`, `--ask-for-approval=never`
3. approval_policy override — caller may not change `approval_policy="never"`

Every accept / reject / completed event is appended to the audit log
(`src/audit.mjs`).

## Verification

```bash
# unit tests
pnpm --filter @axi/agent-runtime test

# manual smoke
node services/agent-runtime/src/server.mjs &
curl -s http://127.0.0.1:8094/healthz
curl -s http://127.0.0.1:8094/readyz
curl -s -X POST http://127.0.0.1:8094/v1/agent/execute \
  -H 'content-type: application/json' \
  -d '{"prompt":"echo hello"}'
```

## Deployment ordering

`control-plane` requires `agent-runtime` to be reachable before it starts.
The default URL is `http://127.0.0.1:8094`. control-plane refuses to start if
`AXI_AGENT_RUNTIME_URL` is unreachable (same pattern as PR-6 Q1).

In `docker-compose.backend.yml`, agent-runtime must be listed **before**
control-plane with a healthcheck.
