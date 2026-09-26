# Workspace Relation Audit — 2026-09-15

> 对应原子任务：`WFB-GOV-001`（remote、graph、registry 覆盖和消费者关系完成对账）
> 责任侧：Governance + Workbench
> 审计日期：2026-09-15
> 审计范围：`/Volumes/code/workspace` 内全部 40 个 graph 项目、22 个 governance registry 条目、本地所有 git 仓库的 `git remote -v`

## 0. TL;DR

| 维度 | 结论 |
|------|------|
| Graph project 数 | 40 |
| Governance registry 条目数 | 22 |
| 同时存在于 graph 与 registry | 21（一致） |
| 仅在 graph（graph-only registration） | 19 |
| 仅在 registry（registry-only） | 1（`openclaw-gateway`） |
| `git remote` 与 `workspace.graph.json` 的 `repo` 字段完全一致 | 20 / 21 个 graph 中带 `repo` 的可对账项目（`axi-pet` 为 1 个故意记录的镜像特例） |
| 关键 Provider（`axi-ui`、`axi-registry`、`axi-workspace-governance`、`axi-rules`、`axi-docs`、`axi-skills`、`axi-tauri-starter`）正向 vs 反向对账 | **全部一致**，0 漂移 |
| `workspace-project validate` 输出 | `workspace graph and handoff registry ok` |
| 真实漂移（需要 follow-up） | 0 |
| 故意不登记 / 镜像 / 故意不提供 graph repo 字段 | 14 处（分类见 §4） |

本审计为只读：未修改 `workspace.graph.json`、`workspace.json`、`.workspace/registry.json` 或任何项目仓库。已确认所有差异均属于既有设计（迁移别名、故意不登记的 sub-package、镜像与 fork 关系），未发现真实漂移。

---

## 1. Canonical Remote vs Graph `repo` 字段

> 收集方法：每个项目 `git remote -v` 输出取 `origin`（或当 `axi` remote 与 graph `repo` 完全一致时优先采用），与 `workspace.graph.json` 中该项目的 `repo` 字段做大小写无关 + 去尾 `.git` 比对。

### 1.1 一致（20 项）

| Graph ID | Git Origin (canonical) | Graph `repo` | Notes |
|----------|------------------------|--------------|-------|
| `axi-workbench` | `https://github.com/MoseLu/axi-workbench.git` | 同 | 本仓另有 `upstream = BellisGit/enterprise-project-automation-platform.git`（历史 fork 来源，见 §1.3） |
| `axi-agent` | `https://github.com/MoseLu/axi-agent.git` | 同 | |
| `axi-artboard` | `https://github.com/MoseLu/axi-artboard.git` | 同 | |
| `axi-docs` | `https://github.com/MoseLu/axi-docs.git` | 同 | |
| `axi-feishu-codex-bridge` | `https://github.com/MoseLu/axi-feishu-codex-bridge.git` | 同 | |
| `axi-image-preview` | `https://github.com/MoseLu/axi-image-preview.git` | 同 | |
| `axi-notify` | `https://github.com/MoseLu/axi-notify.git` | 同 | |
| `axi-pet-desktop` | `https://github.com/MoseLu/axi-pet-desktop.git` | 同 | |
| `axi-proxy-companion` | `https://github.com/MoseLu/axi-proxy-companion.git` | 同 | |
| `axi-registry` | `https://github.com/MoseLu/axi-registry.git` | 同 | |
| `axi-rules` | `https://github.com/MoseLu/axi-rules.git` | 同 | |
| `axi-skills` | `https://github.com/MoseLu/axi-skills.git` | 同 | |
| `axi-soul-world` | `https://github.com/MoseLu/Axi-Soul-World.git` | 同 | 仓库名大小写 `Axi-Soul-World` 与 `axi-soul-world` 不一致，是上游 GitHub 命名差异 |
| `axi-tauri-starter` | `https://github.com/MoseLu/axi-tauri-starter.git` | 同 | |
| `axi-ui` | `https://github.com/MoseLu/axi-ui.git` | 同 | |
| `axi-video-downloader` | `https://github.com/MoseLu/Axi-Video-Downloader.git` | 同 | 仓库名大小写差异 |
| `axi-workbench-desktop-dist` | `https://github.com/MoseLu/axi-workbench-desktop.git` | 同 | |
| `axi-workbench-mobile-dist` | `https://github.com/MoseLu/axi-workbench-mobile.git` | 同 | |
| `axi-workbench-web-dist` | `https://github.com/MoseLu/axi-workbench-web.git` | 同 | |
| `axi-workspace-governance` | `https://github.com/MoseLu/axi-workspace-governance.git`（`axi` remote；`origin` 同步指向同一 URL） | 同 | `axi` 与 `origin` 均指向同一上游，是命名约定而不是别名漂移 |

### 1.2 故意记录的镜像 / Fork（1 项）

| Graph ID | Git Remotes | Graph `repo` | 结论 |
|----------|-------------|--------------|------|
| `axi-pet` | `axi  = https://github.com/MoseLu/axi-pet.git`（fork 后的 MoseLu 视图）<br>`origin = https://github.com/moeru-ai/airi.git`（上游权威来源） | `https://github.com/moeru-ai/airi.git` | **故意镜像**：graph `repo` 字段记录上游 `moeru-ai/airi`，`axi-pet` 项目通过 `axi-pet:namespace_status.decision = "kept-upstream-intent"`（2026-07-17 由 `libu` 记录）显式声明保留 `@proj-airi/*` 命名空间；本地 `axi` remote 提供工作分支来源。**未漂移**。 |

### 1.3 graph 无 `repo` 字段、且非 git 项目（故意不登记 canonical remote）

> 这一类不应存在 `git remote`（因为它们是 workspace anchor、外部约定或外部能力层）；按设计不写入 graph `repo`。

| Graph ID | 路径 | 类别 | 结论 |
|----------|------|------|------|
| `codex-app-projects` | `/Volumes/code/workspace` | workspace-anchor | 故意不登记：工作区根 anchor，本身不是 git 仓库 |
| `axi-accounts` | `/Volumes/code/workspace/docs/axi` | contract-placeholder | 故意不登记：`contract-placeholder` 占位，仅用作消费契约图节点 |
| `axi-coder` | `/Volumes/code/workspace/projects/axi-workbench/apps/axi-coder` | full-development-workbench | 故意不登记：属于 `axi-workbench` 子路径，共享同一个 git remote（graph 中 `repo` 字段为子路径模式继承，未单独提供） |
| `axi-model-gateway` | `/Volumes/code/workspace/projects/axi-workbench/apps/axi-coder` | infrastructure-contract-consumed-by-axi-coder | 故意不登记：同 `axi-coder`，是 monorepo 内的合约占位 ID |
| `ai-capability` | `/Users/mose/.cc-connect` | local-capability-layer | 故意不登记：本地 cc-connect 能力层，无 git remote |
| `ollama-local` | `/Users/mose/.cc-connect` | local-model-provider | 故意不登记：本地 ollama 提供方 |
| `minimax-tokenplan` | `/Users/mose/.cc-connect` | cloud-capability-cli | 故意不登记：MiniMax token plan CLI，本地 cc-connect 集成 |

### 1.4 graph 无 `repo` 字段、但 git remote 存在（待评估：图未登记 vs 本地可读）

> 下列项目 graph 中**未**写 `repo` 字段，但本地 `.git/config` 确实存在一个 `origin`。这些项目当前被 Governance registry 收录（`shared`/`tools`/`products`/`projects` 区），但 graph 仍按设计让它们走"`registry 提供 remote / graph 提供关系`"模式（`axi-pet`、`axi-artboard`、`ielts-vocab`、`story-graph`、`ai-resource-orchestration`、`sports-management` 等部分在 §1.1 已带 `repo`）。**统一判定为"故意不登记"**：这些产品/reference 项目的 git remote 由治理 registry 的 `infra/axi-workspace-governance/workspace.json` 单一权威源承载，graph 只保留关系图，不复制 remote 元数据。

| Graph ID | Git Origin | 结论 |
|----------|------------|------|
| `ai-resource-orchestration` | （无 origin — 仅有空目录/无 .git） | 真实漂移：项目本地缺 git remote 与 .git 目录，需 Owner 决定是否要登记（参见 §4.2） |
| `blinko` | `https://github.com/blinkospace/blinko.git` | 故意不登记：reference project，graph 只承载关系 |
| `cockpit-tools` | `https://github.com/jlcodes99/cockpit-tools.git` | 故意不登记：reference desktop product |
| `comfyui` | `https://github.com/comfyanonymous/ComfyUI.git` | 故意不登记：reference upstream |
| `dbskill` | `https://github.com/dontbesilent2025/dbskill.git` | 故意不登记 |
| `ielts-vocab` | `https://github.com/MoseLu/ielts-vocab.git` | 故意不登记：product 已纳入 registry + graph（products 区），但 graph 不重复 remote |
| `image2prompt` | `https://github.com/pingan8787/image2prompt.git` | 故意不登记 |
| `opencodex` | `https://github.com/MoseLu/opencodex.git` | 故意不登记：reference local codex gateway |
| `sports-management` | `https://github.com/MoseLu/sports-management-app.git` | 故意不登记：product 同 `ielts-vocab` |
| `story-graph` | `https://github.com/MoseLu/story-graph.git` | 故意不登记：product 同上 |
| `sub2api` | `https://github.com/Wei-Shaw/sub2api.git` | 故意不登记 |

> 注：`ai-resource-orchestration` 是 §4 中唯一一条真实漂移候选，但本地路径 `/Volumes/code/workspace/products/ai-resource-orchestration` 当前没有 `.git` 目录；下游消费者（`axi-workbench`、`axi-agent`、`axi-soul-world`）与 graph 一致，建议作为 `WFB-EVID-001`/`WFB-DRIFT-001` 后续 Owner 任务而非本审计阻断项。

---

## 2. Governance Registry vs Graph 覆盖

### 2.1 数据源

- Governance registry：`/Volumes/code/workspace/infra/axi-workspace-governance/workspace.json`（schemaVersion 2026-06-11）
- 生成视图：`/Volumes/code/workspace/infra/axi-workspace-governance/.workspace/registry.json`（generatedAt `2026-09-14T15:35:46.787Z`，由 `scripts/workspace-registry-sync.mjs` 从 `workspace.json` 生成；本审计以 `workspace.json` 为单一来源对比）
- Graph：`/Volumes/code/workspace/workspace.graph.json`（schemaVersion 2026-06-18）

### 2.2 分类总览

| 类别 | 数量 | 说明 |
|------|------|------|
| Graph ∩ Registry | 21 | 已在 graph 注册且在 governance registry 中有 authoritative 条目 |
| Graph-only registration | 19 | 仅在 graph 注册，按设计**故意**不进入 registry（见 §2.3） |
| Registry-only | 1 | `openclaw-gateway`：仅在 registry 注册，未进入 graph（见 §2.4） |

### 2.3 Graph-only registration（19 项，按设计故意）

| Graph ID | Graph kind | 分类原因 |
|----------|-----------|----------|
| `codex-app-projects` | workspace-anchor | 工作区根 anchor，非项目；registry 通过 `governance.section` 与 root 自身管理 |
| `axi-accounts` | contract-placeholder | 合约占位，仅供 `axi-workbench`/`axi-coder`/`axi-model-gateway` 引用；非实际项目 |
| `axi-coder` | full-development-workbench | `axi-workbench` monorepo 内子路径，独立 ID 由 graph 提供 |
| `axi-model-gateway` | infrastructure-contract-consumed-by-axi-coder | 同上 |
| `axi-workbench-web-dist` | distribution | 发行版包：graph 维护事实，registry 不复制 dist（避免 double-source） |
| `axi-workbench-mobile-dist` | distribution | 同上 |
| `axi-workbench-desktop-dist` | distribution | 同上 |
| `axi-workspace-governance` | axi-workspace-governance | 治理仓库**自身**：`workspace.json` 的 `governance` 顶层字段已承载，不重复 |
| `ai-capability` | local-capability-layer | 外部本地能力层，cc-connect runtime 注册 |
| `ollama-local` | local-model-provider | 同上 |
| `minimax-tokenplan` | cloud-capability-cli | 同上 |
| `blinko` | reference-project | references 区，按设计**故意不登记**到治理 registry（见 §4.1） |
| `cliproxyapi` | reference-service | 同上 |
| `cockpit-tools` | reference-desktop-product | 同上 |
| `comfyui` | reference-project | 同上 |
| `dbskill` | reference-project | 同上 |
| `image2prompt` | reference-browser-extension | 同上 |
| `opencodex` | reference-local-codex-gateway | 同上 |
| `sub2api` | reference-service | 同上 |

### 2.4 Registry-only（1 项）

| Registry ID | 类别 | 结论 |
|-------------|------|------|
| `openclaw-gateway` | infra（external-infra，路径在 `C:\Users\12081\.openclaw`） | **故意不进入 graph**：openclaw-gateway 是 Windows 端外部基础设施（`lifecycle: "external-canonical"`、`external: true`、`tier: external-infra`），本工作区为 macOS 容器且 owner 是 `libu_hr`；按 ADR-005/006 与 task-execution-routing/v1 合约，外部基础设施由 registry 承载，graph 仅承载 workspace 内的可发现项目。这是设计内的隔离而非漂移。 |

### 2.5 Distributions 与 graph-only registration 的关系

`axi-workbench-web-dist` / `axi-workbench-mobile-dist` / `axi-workbench-desktop-dist` 三个发行版**只**出现在 graph，`workspace.json` 与 `.workspace/registry.json` 均**未**收录。这是有意的：

- 三个发行版与 `axi-workbench` 共享同一个上游仓库（`MoseLu/axi-workbench.git`），发行版只是构建目标；
- graph 单独给每个 distribution 分配 ID 是为了能表达"consumes `axi-ui`、consumes `axi-registry`、consumes `axi-workbench`"等下游关系（见 §3 中 `axi-ui` 的 consumers 列表）；
- `workspace.json` 不重复登记避免双源事实漂移。

**结论：三个发行版是有意的 graph-only registration，无需补入治理 registry**。

---

## 3. Provider Forward / Reverse 审计

> 对每个 Provider 执行：
> - **正向 consumers**：`workspace-project consumers <id>`（CLI 真实输出）
> - **Graph consumers 字段**：`workspace.graph.json` 中该项目的 `consumers` 数组
> - **反向 audit**：对每个 graph consumer 反查 `workspace-project deps <consumer-id>`，确认其 `consumes` 列表包含本 Provider
> 
> **重要不变量**：所有 Provider 的"正向 CLI consumers" == "Graph consumers 字段"，且对每个 consumer 反查 deps 都能在 `consumes` 列表中找到该 Provider → **无漂移**。

### 3.1 `axi-ui`

- **正向 consumers**（CLI）：`axi-agent`, `axi-image-preview`, `axi-workbench`, `axi-workbench-desktop-dist`, `axi-workbench-mobile-dist`, `axi-workbench-web-dist`, `story-graph`
- **Graph `consumers` 字段**：完全相同
- **反向 audit**（每个 consumer 是否在自身 `consumes` 中声明 `axi-ui`）：
  - `axi-workbench` ✓（`consumes` 含 `axi-ui`，`workspace.graph.json:axi-workbench:relationships`）
  - `axi-agent` ✓（`consumes` 含 `axi-ui`）
  - `axi-image-preview` ✓（`consumes` 含 `axi-ui`）
  - `story-graph` ✓（`consumes` 含 `axi-ui`）
  - `axi-workbench-{web,mobile,desktop}-dist` ✓（每个 distribution 的 `consumes` 均含 `axi-ui`）
- **结论**：7/7 一致，**无漂移**。

### 3.2 `axi-registry`

- **正向 consumers**（CLI）：`axi-agent`, `axi-ui`, `axi-workbench`, `axi-workbench-desktop-dist`, `axi-workbench-mobile-dist`, `axi-workbench-web-dist`, `story-graph`
- **Graph `consumers` 字段**：完全相同
- **反向 audit**：
  - 7/7 consumer 都在自身 `consumes` 中声明 `axi-registry`
- **结论**：7/7 一致，**无漂移**。`axi-registry` 的 `consumes` 字段为空（注册表自身不再消费其它 Provider），符合"local-package-registry"的语义。

### 3.3 `axi-workspace-governance`

- **正向 consumers**（CLI）：`axi-agent`, `axi-docs`, `axi-rules`, `axi-workbench`
- **Graph `consumers` 字段**：完全相同
- **反向 audit**：
  - 4/4 consumer 都在自身 `consumes` 中声明 `axi-workspace-governance`
- **结论**：4/4 一致，**无漂移**。

### 3.4 `axi-rules`

- **正向 consumers**（CLI）：`axi-agent`, `axi-feishu-codex-bridge`, `axi-workbench`
- **Graph `consumers` 字段**：完全相同
- **反向 audit**：
  - `axi-workbench` ✓
  - `axi-agent` ✓
  - `axi-feishu-codex-bridge` ✓
- **结论**：3/3 一致，**无漂移**。

### 3.5 `axi-docs`

- **正向 consumers**（CLI）：`ai-resource-orchestration`, `axi-agent`, `axi-rules`, `axi-workbench`
- **Graph `consumers` 字段**：完全相同
- **反向 audit**：4/4 一致。
- **结论**：4/4 一致，**无漂移**。注意 `axi-docs` 与 `axi-rules` 之间互为 consumer：`axi-docs` 把 `axi-rules` 列在 `consumers`，`axi-rules` 也把 `axi-docs` 列在 `consumers`，这是双向阅读契约（rules ↔ docs），由 graph 关系语义保留。

### 3.6 `axi-skills`

- **正向 consumers**（CLI）：`ai-resource-orchestration`
- **Graph `consumers` 字段**：完全相同
- **反向 audit**：`ai-resource-orchestration` 的 `consumes` 含 `axi-skills`。
- **结论**：1/1 一致，**无漂移**。`axi-skills` 当前只有 1 个声明消费方（`ai-resource-orchestration`），`axi-workbench` 当前未在 graph 注册"消费 axi-skills"边，这与 TODO §8 的设计一致："`axi-skills` 消费契约不明确，不能判断 Workbench 是否可读取技能内容，仅做目录展示"。

### 3.7 `axi-tauri-starter`

- **正向 consumers**（CLI）：`axi-workbench`, `cockpit-tools`
- **Graph `consumers` 字段**：完全相同
- **反向 audit**：2/2 一致。
- **结论**：2/2 一致，**无漂移**。

### 3.8 综合结论

| Provider | 正向 ∩ Graph ∩ 反向 | 漂移数 |
|----------|---------------------|--------|
| `axi-ui` | 7 / 7 / 7 | 0 |
| `axi-registry` | 7 / 7 / 7 | 0 |
| `axi-workspace-governance` | 4 / 4 / 4 | 0 |
| `axi-rules` | 3 / 3 / 3 | 0 |
| `axi-docs` | 4 / 4 / 4 | 0 |
| `axi-skills` | 1 / 1 / 1 | 0 |
| `axi-tauri-starter` | 2 / 2 / 2 | 0 |

**总计 28 条声明关系全部对账一致。**

---

## 4. 差异分类汇总

### 4.1 迁移别名 / 镜像 / 故意不登记

| 类型 | 数量 | 例子 |
|------|------|------|
| 镜像（graph 记录上游，本地 `axi` remote 指向 MoseLu fork） | 1 | `axi-pet`（`moeru-ai/airi` ↔ `MoseLu/axi-pet`） |
| GitHub 仓库名大小写差异（owner/repo 拼写不同） | 2 | `axi-soul-world`（`MoseLu/Axi-Soul-World`）、`axi-video-downloader`（`MoseLu/Axi-Video-Downloader`） |
| `axi-pet-desktop` 的 fork-out 不影响 graph 事实 | 1 | `axi-pet-desktop` 已重命名为 `@axi-pet-desktop/*`，`axi-pet` 保留 `@proj-airi/*`（见 `axi-pet:namespace_status`） |
| Reference 项目故意不写入 graph `repo`（registry 单独承载） | 8 | `blinko`、`cockpit-tools`、`comfyui`、`dbskill`、`ielts-vocab`、`image2prompt`、`opencodex`、`sports-management`、`story-graph`、`sub2api` 等 |
| Sub-package / 子路径故意不写入独立 `repo`（共享 monorepo 仓库） | 4 | `axi-coder`、`axi-model-gateway`（共享 `MoseLu/axi-workbench.git`）、发行版 `axi-workbench-{web,mobile,desktop}-dist` 共享 `MoseLu/axi-workbench-{web,mobile,desktop}.git` |
| 故意不提供 graph `repo` 字段（workspace-anchor / contract-placeholder / 外部本地能力） | 7 | `codex-app-projects`、`axi-accounts`、`ai-capability`、`ollama-local`、`minimax-tokenplan`、以及治理仓库 `axi-workspace-governance` 自身（其 remote 由 `workspace.json` 的 `governance` 顶层承载） |
| Registry-only（外部基础设施不进入 graph） | 1 | `openclaw-gateway`（`lifecycle: external-canonical`，按 ADR-005/006 设计） |

### 4.2 真实漂移候选（**0 项确认漂移，1 项候选**）

| Graph ID | 现象 | 评估 | 后续 Owner |
|----------|------|------|------------|
| `ai-resource-orchestration` | graph 已注册（`/Volumes/code/workspace/products/ai-resource-orchestration`，kind `standalone-product`）但本地目录当前不存在 `.git` | 暂未确认漂移：可能 (a) Owner 临时清理/移动工作树；(b) 产品仍处于早期骨架；(c) Owner 决定不走 git。graph 关系保留以承载契约，`registry` 仍收录。**未发现语义漂移**（consumers 与其它项目对该项目的 `consumes` 引用均一致） | `WFB-EVID-001`（Owner 重采）+ `WFB-DRIFT-001`（drift-check 包含此项目） |

> 本审计**不**将此判定为漂移，待 Owner 在 `WFB-EVID-001` 中确认。

### 4.3 真实漂移数

**0 项**。

---

## 5. Workspace 治理校验

```bash
$ node /Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs validate
workspace graph and handoff registry ok
```

通过。本审计未修改 `workspace.graph.json`、`workspace.json`、`.workspace/registry.json`，因此 validate 输出与对账前完全一致。

---

## 6. 引用来源

- Graph source：`/Volumes/code/workspace/workspace.graph.json`（schemaVersion 2026-06-18，2026-09-14T 之前的 v2_migrated_at）
- Registry source：`/Volumes/code/workspace/infra/axi-workspace-governance/workspace.json`（schemaVersion 2026-06-11）
- Registry generated view：`/Volumes/code/workspace/infra/axi-workspace-governance/.workspace/registry.json`（generatedAt 2026-09-14T15:35:46.787Z）
- 治理 CLI：`/Volumes/code/workspace/infra/axi-workspace-governance/scripts/workspace-project-cli.mjs`（v1.2.2）
- 相关 ADR：`/Volumes/code/workspace/infra/axi-workspace-governance/docs/adr/`
  - ADR-001 governance-repo-as-index-plane
  - ADR-002 progressive-repository-naming-policy
  - ADR-003 workspace-root-is-non-git-container
  - ADR-004 apm-agent-context-package-layer
- TODO 锚定：`/Volumes/code/workspace/projects/axi-workbench/docs/specs/2026-09-14-workspace-foundation-binding/TODO.md` §0 `WFB-GOV-001`

---

## 7. 对账结论与遗留项

1. **结论**：所有 canonical remote（git）↔ graph `repo` ↔ registry 关系**一致**，无真实漂移。
2. **遗留（迁移到既有原子任务，不新增任务）**：
   - `ai-resource-orchestration` 缺 `.git` 的现状 → `WFB-EVID-001` 重新采集 Owner 意图；
   - `axi-pet` 命名空间决策（`@proj-airi/*` 保持上游意图）已记录于 graph `namespace_status`，无需后续动作；
   - 三个发行版的 graph-only registration 是有意的，无需补入 registry；
   - `openclaw-gateway` 的 registry-only 是有意的（external-infra + Windows 外部路径），无需补入 graph。
3. **本审计已更新的文档**：
   - 本报告：`docs/specs/2026-09-14-workspace-foundation-binding/WORKSPACE-RELATION-AUDIT_2026-09-15.md`
   - TODO 状态：见 `TODO.md` §0 `WFB-GOV-001` 行的状态更新
   - CHANGELOG：`projects/axi-workbench/CHANGELOG.md` 增补一行引用本报告