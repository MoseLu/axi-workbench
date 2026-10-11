# tools/axi-app-cli/ docs inventory — M18 Status

**Audit wave**: M18-doc-audit (2026-10-11)
**Finding ID**: M18-45

## Status: ALL 40 .md FILES RETAINED — DISTINGUISHED SCAFFOLD vs PROJECT DOCS

`tools/axi-app-cli/` carries **41 .md files** (40 project docs + 1 this manifest), most with 2026-05-29 mtime. Per M18 instruction: "distinguish scaffold payload from project docs; keep scaffold, mark docs obsolete if unused".

### Scaffold payload (15 files) — RETAIN

`packages/*/README.md` files are the **scaffold template payload** that `create-axi-app` reads to write into newly scaffolded apps. Removing them would break the scaffolder.

| Path | Role |
|------|------|
| `packages/scaffold-kit/README.md` (+`.zh-CN.md`) | Scaffold module contracts |
| `packages/scaffold-registry/README.md` (+`.zh-CN.md`) | Layered module registry |
| `packages/scaffold-runtime/README.md` (+`.zh-CN.md`) | CLI runtime / sync / doctor |
| `packages/foundation-web/README.md` (+`.zh-CN.md`) | Web shell / branding / template |
| `packages/foundation-api/README.md` | Flask baseline + sample API |
| `packages/foundation-design/README.md` | Token package / Style Dictionary |
| `packages/foundation-ops/README.md` (+`.zh-CN.md`) | Workspace / docs / governance modules |
| `packages/feature-theme/README.md` | Theme runtime + preset modules |
| `packages/feature-ui/README.md` | UI feature module scaffold |
| `packages/feature-hooks/README.md` | Hooks feature module scaffold |
| `packages/feature-experimental/README.md` | Experimental feature module scaffold |

### Project docs (24 files) — RETAIN (actively referenced)

`docs/` and `apps/cli/AGENTS.md` are **project-owned documentation**, not scaffold payload. Sub-tree `AGENTS.md` (parent) and `apps/cli/AGENTS.md` reference them; deleting would orphan scope markers.

| Path | Role |
|------|------|
| `AGENTS.md`, `AGENTS.zh-CN.md` | Subtree parent AGENTS |
| `README.md` | Repo-level entry |
| `CHANGELOG.md`, `TODO.md`, `MILESTONE.md` | Status docs |
| `apps/cli/AGENTS.md`, `apps/cli/README.md` | CLI app subtree notes |
| `docs/architecture/*` (6 files) | Package boundaries, runtime lifecycle, v1 plan |
| `docs/brand/README.md` | Brand / CLI surface spec |
| `docs/product/*` (3 files) | v1 PRD, product principles, command UX |
| `docs/research/claude-code-sourcemap-analysis.md` | Research / context |
| `docs/todo/release-governance.md`, `docs/todo/runtime-hardening.md` | Outstanding work |

### Why retained

- Scaffold payload (`packages/*/README.md`) is read by `create-axi-app` template engine.
- Project docs (`docs/`, `apps/cli/`) are referenced by `apps/cli/AGENTS.md`, `AGENTS.md`, and the cli runtime decisions (package-boundaries, runtime-lifecycle, capability-package-standard, module-contribution-schema are load-bearing).
- 2026-05-29 mtime reflects a synchronized snapshot; staleness is owner-discretion, not M18-scope.

Added 2026-10-11 by fix-agent-4 (M18 doc-cleanup wave).
