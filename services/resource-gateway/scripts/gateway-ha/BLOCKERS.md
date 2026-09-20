# gateway-ha — unimplemented HA capabilities (BLOCKERS)

This file is the **authoritative record of capabilities the
`scripts/gateway-ha/` harness does NOT prove**. Anything listed here
is **out of scope** for the lane-verification worktree and must NOT
be claimed in any "production HA" or "high-availability ready"
statement until the corresponding follow-up track ships.

The lane brief for `mm-verification` requires:

> 不要编造当前未实现的 cross-instance coordination、consul/k8s/redis 等能力；
> 只把它们记录成 blocker/后续原子任务。

This document is that record.

## L3 — cross-instance shared state (not proven by this harness)

| Capability | Why it is a blocker | Required follow-up |
| --- | --- | --- |
| Shared breaker state across gateway instances | Each `apps/gateway` process owns its own `CircuitBreaker` map. Killing instance A does not reset instance B's open breakers, and there is no coordination between the two. | GHA-053: externalise breaker state to a shared store (Redis/Postgres). Not started. |
| Shared rate-limit windows across instances | The router's rate limiter (if any) is in-process. Two instances behind a load balancer each get their own budget, so a client can effectively double its rate. | GHA-054: central rate-limit store. Not started. |
| Shared idempotency / cache coalescing across instances | The orchestrator's `VersionedCache` and `CoalescingRegistry` are per-process. The same `cacheKey` will hit instance B's cache on retry even if instance A just filled it. | GHA-053 (same track): shared cache layer. Not started. |
| Cross-instance request id propagation | Each instance mints its own `gw-*-*` request id. A reverse proxy or load balancer that hops between instances will not preserve a client-supplied id across the hop. | GHA-055: edge request id mediation. Not started. |
| Shared session / cookie affinity | The harness does not bind to a session store. A subsequent request routed to a different instance starts cold. | GHA-056: session store. Not started. |

## L3 — instance failover wiring (not proven by this harness)

| Capability | Why it is a blocker | Required follow-up |
| --- | --- | --- |
| Reverse-proxy failover between instances | The harness only proves "instance B keeps serving after A is killed on the same machine". It does NOT prove a load balancer (nginx, envoy, k8s service) actually reroutes traffic to B. | GHA-057: deploy-fidelity harness with nginx/envoy. Not started. |
| Service discovery (consul / k8s DNS / etcd) | The harness uses two fixed loopback ports. Production deployments need a discovery layer; the gateway does not currently register itself with consul / k8s / etcd. | GHA-058: optional `@resource-broker/discovery` package. Not started. |
| Health-check driven load-balancer rotation | `/health/ready` returns 503 while draining, but no LB config in this repo drives that into an actual route-removal decision. | GHA-059: deploy runbook + LB config templates. Not started. |
| Persistent breaker state across gateway restart | When a gateway process restarts, its `CircuitBreaker.openedAt` resets to 0 and the next failure window restarts cold. | GHA-060: persist breaker snapshots. Not started. |

## L4 — production HA (explicitly out of scope)

| Capability | Why it is a blocker | Required follow-up |
| --- | --- | --- |
| Production credentials in the harness | `AXI_DOCS_TOKEN` etc. never enter the harness. Production HA needs a credential rotation policy and a secret manager wiring. | GHA-061: secret-manager integration. Not started. |
| TLS termination at the gateway | The harness binds to plain `http`. Production deployments need TLS + cert rotation. | GHA-062: TLS termination plan. Not started. |
| Authn / authz / CSRF | The harness trusts every loopback caller. Production needs at minimum an authentication layer (mTLS, JWT, or session token) and CSRF for browser callers. | GHA-063: auth surface. Not started. |
| Soak test (long-running failure injection) | The harness runs ~30s. Production SLOs need multi-hour soak with controlled fault injection (latency spikes, breaker flips, partial provider outages). | GHA-064: soak harness. Not started. |
| Operational runbook | On-call response procedures for partial degradation, breaker storms, drain storms, MiniMax CLI failure modes. | GHA-065: ops runbook. Not started. |

## Sandbox-specific limitations (also blockers in this worktree)

| Capability | Why it is a blocker | Required follow-up |
| --- | --- | --- |
| `node:http.Server.listen("127.0.0.1")` returns `EPERM` | The lane-verification worktree's sandbox blocks loopback bind, so the L2/L3 probes cannot actually run here. | None — re-run the harness on a host with normal loopback permission to exercise the 17 probes. The `gateway-handler-contract.test.ts` L1b suite runs in any environment. |
| `node:http.listen("0.0.0.0")` returns `EPERM` | Same as above for LAN bind. | Same. |
| Any non-`EPERM` loopback bind error (`EADDRINUSE`, `EACCES`, unknown) | Treated as a real environment failure, not a sandbox limitation. The `canLoopbackListen` probe surfaces `reason: "env"` and the smoke test fails with a non-zero exit. | None — the harness is correct; the host running it must be fixed (free the port, grant the permission, etc.) before the L2/L3 probes can run. |
| No real upstream providers | The fixture stubs every provider call. | None — by design. |

## What is NOT a blocker

The following are wired and verified at the level this harness
covers; they are **not** blockers for the lane verification result:

* `/health/live`, `/health/ready`, `/metrics` — contract-shaped.
* `/openapi.json`, `/docs` — contract-shaped when
  `@axi/resource-api-docs` is wired; ErrorEnvelope fallback when
  it is not.
* `/routes` — safe projection, no adapter URL / token / secret leak.
* `/gateway/run` — error envelope, drain semantics, request id
  propagation.
* SIGTERM-triggered drain → 503 on `/health/ready`, /health/live
  stays 200.
* No orphan vitest workers after a successful run.
* argv parser rejects bad ports and bad timeouts.

## How to update this list

When a follow-up track ships (e.g. GHA-053), edit the matching row
to point at the merged commit and remove the "Not started" tag. New
blockers discovered during the lane-verification run should be
appended here, never silently absorbed into the harness's claim.
