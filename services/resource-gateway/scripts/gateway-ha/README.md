# gateway-ha — local two-instance HA smoke harness

`scripts/gateway-ha/` is the **lane-verification** deliverable for the
gateway HA track. It provides a **repeatable, side-effect-free** smoke
run that proves two independent `apps/gateway` Node processes can be
spawned, probed, and torn down on loopback without depending on any
real upstream provider, the MiniMax CLI, or any other external state.

The harness is **not** a production deploy. It only proves the
runtime contract that lives inside `apps/gateway`: liveness,
readiness, metrics, request id propagation, draining, and that one
process can keep serving while another is killed.

## What lives here

```
scripts/gateway-ha/
├── gateway-ha.mjs                          # the harness (CLI entry)
├── gateway-server-fixture.test.ts           # vitest fixture: one in-process gateway
├── gateway-handler-contract.test.ts         # vitest L1b: listener-free contract tests
├── handler-contract.vitest.config.ts        # vitest config for the L1b fixture
├── gateway-ha.test.mjs                      # node --test suite for the harness itself
├── BLOCKERS.md                              # unimplemented L3/L4 surface
├── vitest.config.ts                         # vitest config (workspace aliases)
└── README.md                                # this file
```

The harness **never** writes to disk outside its own log file (when
`--log-file` is supplied), **never** invokes a real provider, **never**
logs a secret, and **never** inspects the workspace tree. SIGINT,
SIGTERM, and the overall timeout always tear down spawned children
before the harness exits.

## Running it

```bash
node scripts/gateway-ha/gateway-ha.mjs --help
node scripts/gateway-ha/gateway-ha.mjs --port-a 8787 --port-b 8788
```

Or run the `node --test` suite that exercises the harness end-to-end:

```bash
node --test scripts/gateway-ha/gateway-ha.test.mjs
```

Both invocations are non-destructive.

## Probes

The harness always runs the following probes in order:

| # | Probe | What it proves |
|---|---|---|
| 01 | instance A `/health/live` → 200 | process up |
| 02 | instance B `/health/live` → 200 | process up |
| 03 | instance A `/health/ready` → 200 | composition root up |
| 04 | instance B `/health/ready` → 200 | composition root up |
| 05 | instance A `/metrics` → 200 + contract shape | counters live |
| 06 | instance B `/metrics` → 200 + contract shape | counters live |
| 07 | instance A mints `x-request-id` | request id round-trip |
| 08 | instance B echoes `x-request-id` | request id round-trip |
| 09 | instance A `/gateway/run` → non-5xx (stub) | HTTP edge stable |
| 10 | instance A `/openapi.json` → OpenAPI contract or ErrorEnvelope | auto docs wired |
| 11 | instance A `/docs` → text/html or ErrorEnvelope | auto docs wired |
| 12 | instance A `/routes` → safe projection (no url/token/path leak) | handler redaction |
| 13 | instance A `/metrics` → no token/url/path leak | handler redaction |
| 14 | instance A `/health/ready` → 503 while draining | drain semantics |
| 15 | instance B `/health/ready` → 200 after A drained | survivor |
| 16 | instance B `/health/live` → 200 after A drained | survivor |
| 17 | instance B `/gateway/run` → non-5xx after A drained | survivor serves |

The drain probe is what bridges L2 ("two HTTP surfaces wired") to
L3 ("killing one instance keeps the other alive"). It is the
**only** L3 evidence this harness is able to prove on a single
machine: GHA-053 (cross-instance breaker / rate-limit / cache
coalescing) is a separate track that requires a shared store and
**is not** asserted here.

## Evidence levels

| Level | Source | Status |
|---|---|---|
| L1 (gateway unit tests) | `apps/gateway/test/` | pre-existing, unchanged |
| L1b (handler contract) | `scripts/gateway-ha/gateway-handler-contract.test.ts` | listener-free: registry parity, /routes redaction, /metrics breaker no-leak, config redaction, /openapi + /docs auto-docs |
| L2 (real HTTP wiring) | this harness | exercised above |
| L3 (two-instance shared state) | requires GHA-053 store | **not proven** here |
| L4 (production HA) | deploy / soak | explicitly **out of scope** |

A successful run reports `probes: 17 (pass=17 fail=0)` and exits 0.
A failure prints the failing probe name and a detail line, then
exits 1. Usage errors (bad flags) exit 2.

## Cleaning up

The harness installs SIGINT, SIGTERM, an overall timeout, and
`process.on("uncaughtException" | "unhandledRejection")` hooks that
all funnel through a single `cleanup()` helper. The helper sends
SIGTERM to every spawned child, escalates to SIGKILL after a 2 s
grace window, then issues a `pkill -f vitest` sweep and a process
group `kill` to absorb any detached workers. The fixture itself
also installs SIGINT/SIGTERM handlers and shuts down its server
cleanly on either signal.

The `node --test` smoke case in `gateway-ha.test.mjs` runs the
harness end-to-end and then re-asserts that **no** vitest worker is
left behind, so a regression on cleanup is caught immediately.

## What the harness does NOT do

* It does **not** exercise real providers. The fixture routes every
  call through an in-process stub so the smoke does not need
  AxiDocs, image-preview, MiniMax, or any other upstream.
* It does **not** verify shared cache, breaker, or rate-limit
  semantics across instances. Those belong to GHA-053.
* It does **not** verify production-like networking, TLS, or
  reverse-proxy behaviour. That belongs to a separate
  deployment-fidelity track.

## Sandbox-restricted environments

The smoke tier can only soft-pass when the loopback bind fails with
the *single* code `EPERM` (the standard sandbox mode). Any other
listen error (for example `EADDRINUSE`, `EACCES`, or an unknown
code) is treated as a real environment failure and **fails** the
test with a non-zero exit — it is never silently re-labelled
`eperm-blocked`.

When the bind returns `EPERM`, the harness cannot bind the two
fixture processes. In that environment:

* `gateway-handler-contract.test.ts` still passes — it never calls
  `.listen()` and only asserts the contract surface.
* `gateway-ha.test.mjs` detects the EPERM and reports it as a
  non-fatal `eperm-blocked` evidence tier rather than a generic
  failure. Re-running the same test on a host that allows loopback
  listen will exercise the 17 probes above.

## Failure modes

| Symptom | Likely cause |
|---|---|
| `instance A never became live` | port already in use, or `pnpm install` not run for this worktree |
| `draining returned 503, got 200` | the fixture's signal handler did not run; check that `pool: "threads"` is set in `vitest.config.ts` |
| orphan `node (vitest 1)` workers | a previous run was SIGKILLed; run `pkill -f vitest` once |
