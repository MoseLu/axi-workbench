# ADR Router — AXI Workbench

This directory holds Architecture Decision Records (ADRs) for the
`workbench/axi-workbench` project.

## Active ADRs

| ADR | Title | Status | Date |
| --- | --- | --- | --- |
| [ADR-0001](./0001-zitadel-gin-platform-core.md) | ZITADEL 中央身份、Gin 网关与模块化 Go 核心 | 已接受 (Accepted) | 2026-08-07 |
| [ADR-0002](./0002-personal-os-project-queue.md) | Personal OS v0.1 归属 Workbench 与项目队列优先 | 已接受 (Accepted) | 2026-09-01 |

Auxiliary files in this directory:

- [`README.md`](./README.md) — ADR index table (auto-rendered).
- [`template.md`](./template.md) — copy-this starting template for new ADRs.

## Format

Workbench ADRs use a 4-digit zero-padded number (`ADR-0001`, `ADR-0002`, …) and
a Chinese-language bullet-style front-matter that differs from the
`foundation/` partition convention:

- Title: `# ADR-NNNN: <decision title>`
- Front-matter (bold bullet list): `- **日期**:` / `- **状态**:` / `- **决策者**:` / `- **Supersedes**:` / `- **Related ADRs**:`
- Body sections: `## 背景` / `## 决策` / `## 考虑的备选方案` / `## 影响`

Status values: `提议中` → `已接受` → `已废弃` (Proposed / Accepted / Deprecated).

This 4-digit numbering and Chinese format is intentional: it predates the
`foundation/` ADR convention and keeps the original Workbench history
self-contained. The Workbench project does **not** participate in the
ADR-010..019 Rust migration numbering — that range is reserved for
`foundation/`-partition Rust migrations under ADR-010.

## How to Add an ADR

1. Copy [`template.md`](./template.md) as the starting skeleton.
2. Bump to the next 4-digit id (`0003`, `0004`, …); pick a kebab-case slug.
3. Set `- **状态**: 提议中`; flip to `已接受` once the decision lands.
4. Add a row to the **Active ADRs** table above **and** the
   [`README.md`](./README.md) index table.
5. If this ADR supersedes a prior one, set `- **Supersedes**:` and update
   the superseded entry's status.

## References

- Canonical ADR convention: [`/Volumes/code/workspace/foundation/axi-rules/docs/adr/`](../../../../foundation/axi-rules/docs/adr/) (foundation/ partition)
- Workbench-specific ADR convention: [`template.md`](./template.md) (this directory)
- Workspace rule router: [`/Volumes/code/workspace/foundation/axi-rules/INDEX.md`](../../../../foundation/axi-rules/INDEX.md)
- Workspace ADR index: [`/Volumes/code/workspace/foundation/workspace-governance/docs/adr/`](../../../../foundation/workspace-governance/docs/adr/) (governance-level ADRs ADR-001..009)