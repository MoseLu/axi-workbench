# Axi Docs — Error & Post-mortem Record (ERROR)

> This file records **Root Cause Analysis (RCA) and post-mortem** entries for
> structural defects observed in `axi-docs` and the workspace projects it
> mirrors. The goal is to keep a code-independent, traceable outlet for
> "why this was changed". Each entry must be self-contained and link to the
> corresponding code, tests, PR, or commit.

---

## Maintenance Conventions

### Trigger Scenarios

Open a new entry when any of the following happens:

- Cross-project governance defects (naming drift, directory mis-attribution,
  registry inconsistency);
- The same error pattern repeats across more than one working session / PR;
- The fix touches structural bugs such as "read/write path mismatch" or
  "ghost directories / files";
- The fix requires new **long-lived guard tests** to lock down the correct
  behaviour.

### Severity Levels

| Level | Meaning | Typical symptom | Disposition |
|-------|---------|-----------------|-------------|
| `P0 — Must-fix` | Caused production capability loss, data loss, security risk, or a blocked critical workflow. | Tools can't read logs, builds fail, security holes, config drift. | Fix within the current working session; must add a guard test. |
| `P1 — Strongly recommended` | Caused capability degradation, observability regression, or cross-project UX inconsistency. | Logs unreadable, docs stale, naming messy but non-blocking. | Queue for the next sprint; may skip a guard test but must state the handling plan. |
| `P2 — Empirical observation` | No actual failure triggered yet, but a latent risk has been identified. | Complexity growing, conventions undocumented, regression coverage missing. | Register as a "what will bite us eventually" reminder. |

### Per-entry Format

Each entry must include five sections: Symptom, Root Cause, Fix, Guard (if
any), Lessons, Related. Even P2 observational entries must include the
"Lessons" section.

### Not Recorded Here

One-shot unit / E2E failures, user input errors, network blips, third-party
transient unavailability — those go to their respective runtime logs, not
the ERROR pool.

### Status

`open` / `fixed` / `accepted-as-limitation`. Entries in `open` status must
list "pending action" and "expected handling window" at the end.

### Numbering

`<YYYY-MM-DD>-<two-digit sequence>` (per-day increment). When the same entry
escalates in severity (e.g. P2 → P1), keep the original number and append
`[upgraded from P2 on YYYY-MM-DD]`; do **not** open a new entry.

---

## Index

| Level | Number | Title | Affected Project | Status | Date |
|-------|--------|-------|------------------|--------|------|
| P0 | [2026-06-11-01](#2026-06-11-01) | ielts-vocab mac-app log directory singular/plural drift and read/write mismatch | `products/ielts-vocab` | fixed | 2026-06-11 |

---

## P0 — Must-fix

<a id="2026-06-11-01"></a>

### 2026-06-11-01 — ielts-vocab mac-app log directory singular/plural drift and read/write mismatch

**Severity**: P0 (caused MCP `get_logs` tool to return empty for runtime logs)
**Status**: fixed
**Affected project**: `products/ielts-vocab` (the "IELTS Vocabulary" entry
in `WORKSPACE_INDEX.md`)

#### Symptom

- Running `bash scripts/run-mac-local-app.sh preview` (or `dev`) does write
  the Mac desktop app's stdout / stderr to
  `logs/runtime/mac-app/preview.*.log`;
- but reading through the `get_logs` tool exposed by
  `packages/mac-bridge-mcp/server.py` always returns empty content;
- additionally, a **project-external ghost copy** was found at
  `/Volumes/code/projects/ielts-vocab/logs/runtime/mac-app/`, carrying
  preview logs from late May and early June.

#### Root Cause

The same log directory was referred to by **two different names** in two
different code paths within ielts-vocab:

| Role | Path | File |
|------|------|------|
| Writer (launcher / Swift / bash) | `logs/runtime/mac-app/` (singular) | `scripts/run-mac-local-app.sh:252, 372, 459, 460, 498` |
| Reader (MCP bridge) | `logs/runtime/mac-apps/` (plural) | `packages/mac-bridge-mcp/server.py:31` |

The plural `mac-apps` was a historical typo: the `IELTS_MAC_LOCAL_APP_DIR`
default had been written as `…/mac-apps`. The launcher was later corrected
to `mac-app`, but the MCP reader side never caught up.

The ghost directory at `/Volumes/code/projects/ielts-vocab/...` came from
an earlier batch of preview runs whose cwd was `/Volumes/code/projects`.
Swift picks up the absolute path through `IELTS_LOCAL_APP_ROOT` in
`run.conf`, but before that was filled in the relative path landed under
the cwd. The current launcher is fixed; new preview runs no longer produce
ghost directories.

#### Fix

1. **Code**: Changed `MAC_APP_LOG_DIR` in
   `packages/mac-bridge-mcp/server.py:31` to `…/mac-app` to match the
   launcher writer path; also flipped the `.app` bundle default output
   directory in `scripts/run-mac-local-app.sh:89` to singular `mac-app` so
   the script is internally self-consistent.
2. **Disk**: Moved `logs/runtime/microservices-mac/` (production path,
   42 `*.err.log` / `*.out.log` / `*.pid` files) to
   `logs/runtime/app-services-mac/` via the agreed alignment scheme, with
   matching edits to `start-microservices.sh:39, 85` and `server.py:32`.
3. **Cleanup**: Deleted the orphan
   `logs/runtime/mac-apps/雅思词汇{开发,预览}版.app/` directories (legacy
   plural `.app` bundles, 1.8M × 2; `ps` confirmed no related process
   running).
4. **Guards**: Added two tests in
   `backend/tests/test_mac_local_app_launcher.py` to lock down the
   read/write consistency and to assert `app-services-mac` is the only
   referenced app-service directory name:
   - `test_mac_local_app_launcher_keeps_vite_inside_generated_app_bundle`
     parses the `MAC_APP_LOG_DIR = REPO_ROOT / …` expression and asserts
     the joined path ends with `logs/runtime/mac-app`.
   - `test_microservice_log_dir_aligns_with_app_services_mac` parses
     `MICROSERVICE_LOG_DIR` via `re + exec` and asserts the joined path
     ends with `logs/runtime/app-services-mac`; also uses
     `assert 'logs/runtime/microservices-mac' not in launcher` to forbid
     the old name from coming back.

#### Lessons

- **Read and write sides must share one directory constant**, not each
  write its own string. Any future change to a "path constant" must grep
  the MCP server, the launcher, and the docs in one pass.
- **Scripts that write logs should explicitly `cd "${root}"` or inject an
  absolute path**, avoiding dependence on caller cwd. The ielts-vocab
  launcher injecting `IELTS_LOCAL_APP_ROOT` through `run.conf` is the
  correct pattern and should be reused by every script that spawns child
  processes.
- **Negative tests ("not in" assertions) cost almost nothing and pay off
  enormously**. The two guards total < 30 lines. Future typos
  (`mac-app` → `mac-apps`) or regressions
  (`app-services-mac` → `microservices-mac`) will trip CI immediately with
  a clear `f'expected …, got {dir!r}'` message.
- **Scanning the whole workspace for "directory name drift" should be a
  periodic inspection item**. This pass scanned 13,299 source files and
  found only one real instance in ielts-vocab; but the May 31 orphan
  `mac-apps/` directory shows the pattern has happened historically more
  than once.

#### Related

- `products/ielts-vocab/scripts/run-mac-local-app.sh`
- `products/ielts-vocab/start-microservices.sh`
- `products/ielts-vocab/packages/mac-bridge-mcp/server.py`
- `products/ielts-vocab/backend/tests/test_mac_local_app_launcher.py`
- `WORKSPACE_INDEX.md` "IELTS Vocabulary" row

---

## P1 — Strongly recommended

> No entries at this level yet.
>
> Candidate directions:
> - The `app/` build output (`dist/`) keeps growing in size, but there is
>   no per-page / per-chunk size tracking in place.
> - Bilingual document sync in `docs/content/{en,zh}/` still relies on
>   manual inspection; no automated diff guard.
>
> When any of the above (or comparable observability issues) materialise,
> open a new entry under this section per the Maintenance Conventions.

---

## P2 — Empirical observation

> No entries at this level yet.
>
> Candidate directions:
> - The cwd-dependency of startup scripts (`start-*.sh`) has not been
>   audited holistically; some still use the `${root}/...` pattern that
>   relies on the caller having `cd`'d to the project root.
> - The workspace lacks an authoritative "directory naming convention"
>   document. The differences (mac-app vs mac-apps, services-mac vs
>   app-services-mac) were reconciled ad hoc, with no single source of
>   truth.
>
> When a pattern is identified that "won't bite us today but will
> eventually", open a new entry under this section and document its
> trigger condition (e.g. "next time a new engineer joins the project").