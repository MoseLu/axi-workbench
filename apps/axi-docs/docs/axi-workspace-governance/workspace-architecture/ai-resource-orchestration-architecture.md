# ai-resource-orchestration Architecture

**Canonical path**: `/Volumes/code/workspace/products/ai-resource-orchestration`
**Owner**: `libu` | **Lifecycle**: `active-local`

---

## 1. Overview

Provider-backed conversational AI orchestration platform. The system routes user intent (image search, document lookup, skill retrieval, project information) through a catalog of typed provider adapters, with cascading fallback chains, circuit breakers, and backpressure controls.

---

## 2. Architecture

```
Browser (workbench)  →  gateway-client.ts (HTTP POST)  →  apps/gateway (Node.js, port 8787)
                                                              │
                              ┌──────────────────────────────┼──────────────────────────────┐
                              │                              │                              │
                        adapters/                      providers.manifest.json          session/, memory/
                        8 adapters                                               REST APIs at /sessions*, /memory*
```

- **In-browser LLM planner**: The workbench ships a planner that runs in the browser, producing structured `ToolCall[]` intent. All provider access flows through the gateway — the browser never constructs adapters directly.
- **Node.js HTTP gateway**: Pure Node.js `http` module (no Express/Fastify), 1630+ lines in `apps/gateway/src/server.ts`. Acts as the single provider access boundary.
- **8 provider adapters**: Each adapter implements a typed `ProviderAdapter` interface. Adapters are instantiated inside the gateway process, never in the browser.

---

## 3. Cascading Search Pattern

Defined in `apps/gateway/src/image-search-cascade.ts`. Three-tier fallback:

```
gallery (ImagePreviewAdapter)
    ↓  miss
web search (MiniMaxTokenPlanWebSearchAdapter)
    ↓  miss / fallback
AI generation (MiniMaxTokenPlanImageAdapter)
```

Every stage records a `provenance` trace entry so the full cascade is auditable in the response.

---

## 4. Components

### `apps/gateway` — HTTP server

| File | Role |
|---|---|
| `src/server.ts` | Pure Node `http` server, 1630+ lines; composition root at bottom |
| `src/routes.ts` | Route table: `/health/live`, `/health/ready`, `/metrics`, `/openapi.json`, `/gateway/run`, `/provider/*`, `/sessions*`, `/memory*` |
| `src/cors.ts` | Allowlist CORS |
| `src/auth.ts` | Bearer token authentication |
| `src/allowlist.ts` | SSRP URL allowlist; startup aborts on violation |
| `src/image-search-cascade.ts` | Three-tier cascading search |

**Security layers**: CORS allowlist → Bearer auth → SSRP allowlist (URL-level) → circuit breaker (request-level).

### `apps/workbench` — Vite/React SPA

| File | Role |
|---|---|
| `src/gateway-client.ts` | Only browser-side provider call path; POSTs planner output to `/gateway/run`; retry, cancellation, `x-request-id` injection |
| `src/memory-client.ts` | REST client for `/memory*` |
| `src/session-client.ts` | REST client for `/sessions*` |
| `src/providers.manifest.json` | Mirror of gateway manifest for compile-time safety |

Browser bundle contains zero secret token names (`grep VITE_AXI_DOCS_TOKEN dist/` → zero results).

### `packages/orchestrator` — GatewayOrchestrator

**Main export**: `GatewayOrchestrator` (`src/gateway/index.ts`)

Per-instance state:
- `breakers: Map<string, CircuitBreaker>` — one per target
- `cache: Map` — legacy mirror over `VersionedCache`
- `backpressure: BackpressureRegistry` — semaphore per route
- `coalescing: CoalescingRegistry` — request coalescing
- `sharedState: SharedStateManager` — Valkey / Postgres / noop

**Circuit Breaker** (`src/gateway/circuit-breaker.ts`):
- Sliding-window (default 20 samples)
- States: `closed → open → half-open → closed/open`
- Half-open invariant: exactly ONE in-flight probe; subsequent callers get `false` from `canPass()` until probe resolves (thundering-herd protection)
- Config: `errorRateThreshold`, `openMs`, `minSamples`

**Backpressure** (`src/gateway/runtime/backpressure.ts`):
- Per-route semaphore with `maxConcurrent`
- `queueTimeoutMs` — wait budget before shedding
- `shedStrategy: "reject"` — returns `rate_limited` code

**Route dispatch** (`src/gateway/dispatch.ts`): manifest → predicate filters → cache → circuit breaker gate → backpressure → adapter → records to breaker + cache.

### `packages/adapters` — 8 adapters

| Adapter | Provider ID | Implementation |
|---|---|---|
| `ImagePreviewAdapter` | `axi-image-preview` | Local gallery search |
| `MiniMaxTokenPlanImageAdapter` | `minimax-tokenplan-image` | AI image generation via MiniMax CLI |
| `MiniMaxTokenPlanWebSearchAdapter` | `minimax-tokenplan-search` | Web search via MiniMax CLI |
| `AxiDocsAdapter` | `axi-docs` | Axi Docs MCP document/skill retrieval |
| `WorkspaceStatusAdapter` | `axi-workspace-status` | Workspace status facts |
| `ProjectInfoAdapter` | `axi-project-info` | Project information |
| `UiLibraryAdapter` | `axi-ui-library` | UI component library search |
| `IconLibraryAdapter` | `axi-icon-library` | Icon library search |

Plus 6 fixture adapters for `VITE_FIXTURE_MODE=true` offline demo.

Common utilities: `fetchWithRedirectLimit` (SSRP protection, max 3 redirects), `createFetchWithTimeout` (8s default, propagates `AbortSignal`), Chinese quantity-word normalization, page size limits (`PAGE_SIZE=12`, `PAGE_MAX=100`).

### `packages/contracts` — Zod schemas

| Schema | Purpose |
|---|---|
| `gatewayRequestSchema` / `gatewayResponseSchema` | HTTP request/response envelope |
| `errorEnvelopeSchema` | Error with `code` enum + `requestId` |
| `gatewayErrorCodeSchema` | 16 error codes: `invalid_request`, `circuit_open`, `provider_timeout`, `rate_limited`, `session_not_found`, etc. |
| `resourceSearchRequestSchema` / `resourceSearchResponseSchema` | Resource search wire format |
| `resourceCandidateSchema` | `{ id, kind, title, preview?, facts, provenance, safety }` |
| `intentSchema` | `{ operation, resourceKinds, constraints, needsClarification }` |
| `plannerResultSchema` | `{ intent, calls, pipeline?, explanation?, clarification? }` |
| `runStateSchema` | 14 states from `idle` to `image-generating` |
| `memoryEntrySchema` / `memoryFileSchema` | Memory MVP on-disk format |
| `sessionRecordSchema` / `sessionAppendEntrySchema` | Session MVP format |

### `packages/memory` — Local JSON-file MVP

Store interface (`src/store.ts`): `readAll()` / `get(id)` / `upsert(entry)` / `delete(id)` / `clear(predicate)` / `export()`.

- Versioned JSON (`schemaVersion: 1`), atomic writes (temp file + rename), in-process mutex serialization.
- Corrupt files moved to `<path>.corrupt.<iso>` instead of being overwritten.
- Cap: 500 entries.
- Submodules: `src/redactor.ts`, `src/ranker.ts`, `src/extractor.ts`, `src/policy.ts`.
- Gateway REST handlers at `/memory*`.

### `packages/session` — Daily session management

Store interface (`src/store.ts`): `list(query?)` / `get(id)` / `createDaily(input)` / `createManual(input)` / `append(id, entry, expectedRevision?)` / `rename` / `archive` / `delete` / `export(id)`.

- Caps: 500 sessions max, 1000 entries per session.
- Versioned JSON, atomic writes, in-process mutex, corrupt-file backup.
- Submodules: `src/helpers.ts` (`generateSessionId`, `titleFromUserText`, `previewFromText`), `src/redactor.ts`, `src/projection.ts`.
- Gateway REST handlers at `/sessions*`.

---

## 5. Provider Manifest

**Source of truth**: `apps/gateway/src/providers.manifest.json`

```json
{
  "manifestVersion": 1,
  "providers": [ /* 7 factory entries */ ],
  "targets": [ /* 14 target entries with weights, timeouts */ ],
  "routes": [ /* 15 route entries with predicates, loadBalancer, cache, retry, backpressure */ ],
  "fallbackChains": [ /* 6 fallback chains */ ]
}
```

**Factory-to-Adapter mapping**:

| Factory | Adapters |
|---|---|
| `image-factory` | `ImagePreviewAdapter`, `MiniMaxTokenPlanImageAdapter` |
| `docs-factory` | `AxiDocsAdapter`, `WorkspaceStatusAdapter` |
| `minimax-factory` | `MiniMaxTokenPlanWebSearchAdapter` |
| `project-factory` | `ProjectInfoAdapter` |
| `ui-factory` | `UiLibraryAdapter` |
| `icon-factory` | `IconLibraryAdapter` |
| `fixture-factory` | 6 fixture adapters |

Route predicates (`src/gateway/predicates.ts`): `by-resource-kind-image`, `by-resource-kind-document`, `by-resource-kind-skill`.

SSRF allowlist: every upstream URL is checked against `src/allowlist.ts` before adapter construction; gateway startup aborts on violation.

---

## 6. Build / Verify

```bash
pnpm install          # install dependencies
pnpm typecheck        # pnpm -r typecheck  (tsc --noEmit)
pnpm test             # pnpm -r test       (vitest run)
pnpm build            # pnpm -r build
pnpm check            # typecheck && test && build  (full verification)

# Per-app
pnpm --filter @resource-broker/gateway dev      # gateway on 127.0.0.1:8787
pnpm --filter @resource-broker/workbench dev    # Vite on 0.0.0.0:5177
```

---

## 7. Why Separate from `axi-workbench`

Documented in `docs/adr/gateway-runtime.md` (ADR-002).

**Problem**: `apps/workbench` previously had two unrelated provider access paths:
1. Browser directly instantiated adapters through Vite dev proxy
2. Vite `configureServer` middleware used `child_process.spawn` for MiniMax

This mixed secret names (`VITE_AXI_DOCS_TOKEN`, `VITE_LLM_API_KEY`) into the browser bundle and made the Vite dev server a required infrastructure bottleneck with no liveness, readiness, or horizontal scalability.

**Decision**: Independent Node gateway service as the single provider access boundary:

```
Browser → gateway-client.ts (HTTP) → apps/gateway → Provider adapters
```

- `apps/workbench` only renders UI; never constructs adapters directly.
- All secrets read server-side via `process.env`.
- Gateway independently startable, testable, and horizontally scalable.
- Tech stack separation: Node.js (gateway) vs Go (axi-workbench) — different domain, different constraints.
