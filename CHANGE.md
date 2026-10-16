# Behavior / Workflow / Validation Changes

> Root pointer file per `axi-rules` AR-BOOTSTRAP-002.1 (root pointer option).
>
> Canonical detailed log: [`docs/state/CHANGELOG.md`](./docs/state/CHANGELOG.md).
> Active work and current state: [`HANDOFF.md`](./HANDOFF.md).
> Project boundary and read order: [`AGENTS.md`](./AGENTS.md).
>
> 本文件仅保留指针 + 顶层里程碑摘要；详细变更条目请写入 `docs/state/CHANGELOG.md`。

## 顶层里程碑

- **2026-10-16** — **新增根级 `CHANGE.md`（AR-BOOTSTRAP-002 修复）**：2026-10-16 工作区审计发现本仓库缺少 AR-BOOTSTRAP-002 要求的最小文档集项 `CHANGE.md`，且 `INDEX.md` / 根级 `HANDOFF.md` 均在引用它。新增本文件作为指向 `docs/state/CHANGELOG.md` 的根级指针，并按 `axi-pet-desktop` / `axi-agent` 同款约定声明：行为 / workflow / 验证相关变更写 `docs/state/CHANGELOG.md`，活跃工作区状态写 `HANDOFF.md`。本条目不重写已有历史，仅锚定指针文件本身；详细历史请阅读 `docs/state/CHANGELOG.md`。

## 引用规约

- 行为 / workflow / 验证 / 用户可见 / 回滚相关变更 → 写 `docs/state/CHANGELOG.md`，并在本文件追加一行顶层里程碑。
- 当前活跃工作区状态、命令、契约、故障排查与时效 → 写 `HANDOFF.md`；本文件不重复 HANDOFF 内容。
- 完整 diff / 设计决策 / 任务清单 → 写 `docs/specs/<change-id>/`，不要直接堆在 `CHANGE.md` 或 `CHANGELOG.md`。
- 顶层里程碑条目须满足：日期 + 一句话标题 + 一段引用提示，必要时分点列出影响面。

---

**最后更新**：2026-10-16 — 新增根级 `CHANGE.md`（AR-BOOTSTRAP-002 修复）。详细历史见 `docs/state/CHANGELOG.md`，活跃状态见 `HANDOFF.md`。
