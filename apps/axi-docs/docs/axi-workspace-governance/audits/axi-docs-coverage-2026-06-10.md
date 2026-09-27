# Axi Docs 工作区覆盖审计（2026-06-10）

> 范围：检查 `axi-docs` 文档仓库对 `/Volumes/code/workspace` 实际项目的覆盖完整度。
> 方法：把工作区真实目录树与 `axi-docs/docs/projects.index.json` + `docs/content/{en,zh}/projects/` + `docs/axi-workspace-governance/` 三处镜像进行对比。
> 不在范围：业务产品（`axi-image-preview` / `axi-pet` / `axi-notify` 等）的内部文档；`axi-skills` 树（已通过 `sources.lock.json` 直读）。

---

## 1. 总体结论

axi-docs 对工作区**不是完全覆盖**，存在 3 类缺口：

| 维度 | 状态 |
|---|---|
| WORKSPACE_INDEX.md 表格内项目（13 个 Axi 项目 + 1 个产品） | ✅ 全部 14 个有 7 件套镜像（`build-projects-index.mjs` 自动生成）|
| 真实存在但不在 WORKSPACE_INDEX.md 表格里的项目 | ⚠️ 2 个未镜像（`dbskill`、`codex-plus-app`）|
| 每项目根级门面文件（7 → 11 件套扩展） | ❌ CHANGELOG / SECURITY / CHANGE / CLAUDE / README.zh-CN / AGENTS.zh-CN 6 类未镜像 |
| 工作区治理镜像（governance） | ⚠️ 镜像了 5 份报告 + ADR/，**漏掉 governance 仓库自身 9 个根级门面** |

---

## 2. 工作区真实项目盘点

按分区（`ls /Volumes/code/workspace` 各分区下）：

| 分区 | 真实项目 | 镜像现状 |
|---|---|---|
| `projects/` | axi-workbench, axi-agent-platform, axi-notify, axi-image-preview, axi-pet, axi-docs, axi-rules, axi-sports-management-app（8 个）| ✅ 8/8 |
| `shared/` | axi-ui, axi-tauri-starter, dbskill（3 个；axi-skills 走 `sources.lock.json`）| ⚠️ 2/3，**dbskill 漏** |
| `infra/` | axi-registry, axi-workspace-governance（2 个）| ⚠️ 0/2 走镜像（脚本显式 skip；governance 走镜像目录）|
| `products/` | ielts-vocab（1 个）| ✅ 1/1 |
| `tools/` | axi-feishu-codex-bridge, axi-proxy-companion, axi-video-downloader, codex-plus-app（4 个）| ⚠️ 3/4，**codex-plus-app 漏** |
| `references/` | 7 个参考仓库 | ✅ 7/7（手工补） |
| 虚拟项目 | workspace.graph.json, dev-services.config.json | ✅ 2/2 |
| **合计** | **19 个真实 + 7 reference + 2 虚拟 = 28** | **25/28**（3 个真实漏） |

---

## 3. 缺口清单

### 3.1 缺失项目镜像（3 个）

| 项目 | 真实路径 | 真实根级文件 | 镜像策略建议 |
|---|---|---|---|
| **dbskill** | `/Volumes/code/workspace/shared/dbskill` | `README.md`, `README.zh-CN.md`, `LICENSE`, `VERSION`, `demo.gif`, `docs/`, `scripts/`, `skills/`, `tools/`, `知识库/` | 轻量镜像：7 件套 + 实际有的 README.zh-CN.md（合计 8 件）|
| **codex-plus-app** | `/Volumes/code/workspace/tools/codex-plus-app` | 仅 `outputs/`, `work/`, `.omx/metrics.json`（**无任何门面**）| 拉入镜像：仅 README + AGENTS + INDEX 3 件最小目录，README 标注"项目待填充" |
| **infra/axi-registry** | `/Volumes/code/workspace/infra/axi-registry` | AGENTS/CHANGELOG/INDEX/MILESTONE/PRD/README/README.zh-CN/SECURITY/TDD/TODO 10 件 | **保留 build 脚本 skip 行为**（governance 范围）—— 不强行纳入 7 件套项目镜像，靠 governance 镜像目录治理（见 §3.3）|

### 3.2 根级门面文件镜像不完整（7 → 11 件套）

`build-projects-index.mjs` 当前 `PIECES = ['README.md','AGENTS.md','INDEX.md','TODO.md','MILESTONE.md','PRD.md','TDD.md']`，每个项目只生成 7 件套。但工作区里大多数 Axi 项目实际有 8–13 个根级门面：

| 缺失件 | 涉及项目（举例）|
|---|---|
| `CHANGELOG.md` | workbench, agent-platform, notify, image-preview, pet, docs, sports-management, axi-ui, axi-tauri-starter, ielts-vocab, axi-proxy-companion, axi-video-downloader, axi-registry, governance |
| `SECURITY.md` | workbench, agent-platform, notify, image-preview, docs, sports-management, axi-ui, axi-tauri-starter, ielts-vocab, axi-proxy-companion, axi-registry, governance |
| `CHANGE.md` | image-preview, rules |
| `CLAUDE.md` | pet |
| `README.zh-CN.md` | image-preview, workbench 等 |
| `AGENTS.zh-CN.md` | image-preview 等 |

**影响**：调用方（`axi_docs_read` / 知识图谱 / Web 阅读页）只能拿到 7 件套内容，**看不见变更历史、安全策略、双语入口**。

**修复方向**：扩展 `PIECES` 为 11 件套 + 加"源文件存在检测"（源不存在时跳过该 piece、不报缺）。

### 3.3 governance 根级门面未镜像

`docs/axi-workspace-governance/` 镜像当前有：

```
README.md                ← 镜像自带说明
adr/                     ← ADR 目录
audits/                  ← 历史审计位置（空）
integration-map.md
ownership-matrix.md
project-catalog.md
project-completion.md
repo-topology.md
```

**漏掉** 9 个 governance 仓库**自身的根级门面**（在 `infra/axi-workspace-governance/` 根级）：

```
AGENTS.md, CHANGELOG.md, INDEX.md, MILESTONE.md, PRD.md,
README.zh-CN.md, SECURITY.md, TDD.md, TODO.md
```

**修复方向**：手工补这 9 个门面到镜像目录（不修改 `build-projects-index.mjs` 的 skip 行为，保留治理边界）。

---

## 4. 镜像机制现状

### 4.1 自动生成（90% 项目）

`app/scripts/build-projects-index.mjs`：

- **数据源**：`/Volumes/code/workspace/WORKSPACE_INDEX.md` 表格行
- **生成物**：`docs/projects.index.json` + `docs/content/{en,zh}/projects/<id>/{7 件套}`
- **存在检测**：`writeIfMissing`，不覆盖已存在文件；需 `--force` 才覆盖
- **跳过规则**：`infra/axi-workspace-governance` 与 `infra/axi-registry`（脚本 line 196-198）
- **PIECES 数量**：7 件套（line 16: `['README.md','AGENTS.md','INDEX.md','TODO.md','MILESTONE.md','PRD.md','TDD.md']`）
- **触发**：`pnpm --dir app projects:build` / `pnpm --dir app projects:check`

### 4.2 手工补全（references + 治理）

- `references/*` 7 个参考仓库 + `workspace.graph.json` / `dev-services.config.json` 2 个虚拟项目
- `docs/axi-workspace-governance/` 镜像目录

### 4.3 边界声明

`AGENTS.md`（根级）第 19-23 行声明 axi-docs 是「**文档枢纽 + 知识图谱 + MCP 文档总线** 三合一」，**没有**把"项目门面镜像"显式列为职责。这是声明的盲点——实际代码里 7 件套生成是核心产物之一。

---

## 5. 修复计划（带可执行命令）

### P0：补 2 个缺失项目镜像

**目标**：dbskill + codex-plus-app 也进入 `content/{en,zh}/projects/`，并被 `projects.index.json` 收录。

**实现路径**（绕开 build 脚本）：

```bash
# dbskill：轻量镜像（7 件套 + README.zh-CN.md）
mkdir -p /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/content/{en,zh}/projects/dbskill
# 8 个文件用 Write 工具手工创建（模板沿用 build-projects-index.mjs 的 PIECE_TEMPLATES）

# codex-plus-app：拉入镜像（最小 3 件）
mkdir -p /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/content/{en,zh}/projects/codex-plus-app
# README + AGENTS + INDEX（README 标注"项目待填充"）

# 更新 projects.index.json 加 2 条记录
# 字段参考 build 脚本 line 211-225 的 extractProjects 输出格式
```

### P1：扩展 11 件套镜像

**目标**：把 `PIECES` 从 7 件套扩为 11 件套，覆盖 CHANGELOG/SECURITY/CHANGE/CLAUDE/README.zh-CN/AGENTS.zh-CN。

**修改 `app/scripts/build-projects-index.mjs`**：

```js
// 改前
const PIECES = ['README.md', 'AGENTS.md', 'INDEX.md', 'TODO.md', 'MILESTONE.md', 'PRD.md', 'TDD.md'];

// 改后
const PIECES = ['README.md', 'AGENTS.md', 'INDEX.md', 'TODO.md', 'MILESTONE.md', 'PRD.md', 'TDD.md'];
const OPTIONAL_PIECES = [
  { name: 'CHANGELOG.md', required: false },
  { name: 'SECURITY.md', required: false },
  { name: 'CHANGE.md', required: false },
  { name: 'CLAUDE.md', required: false },
  { name: 'README.zh-CN.md', required: false },
  { name: 'AGENTS.zh-CN.md', required: false },
];

async function buildForProject(project, locale) {
  // ... 现存 7 件套逻辑不变
  // 新增：可选件按源文件存在性决定是否生成
  for (const opt of OPTIONAL_PIECES) {
    const sourcePath = path.join(project.path, opt.name);
    if (!(await exists(sourcePath))) continue;  // 源不存在则跳过
    const filePath = path.join(dir, opt.name);
    const body = frontmatter({ project, locale }) + '\n' + templateFor(opt.name, ctx);
    results[opt.name] = await writeIfMissing(filePath, body);
  }
  return results;
}
```

**重新生成**：

```bash
cd /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs
pnpm --dir app projects:build
```

**注意**：`--check` 模式需要更新为"7 件套必选 + 11 件套按源存在性判断"。

### P1：补 governance 根级门面镜像

**目标**：在 `docs/axi-workspace-governance/` 下补 9 个根级门面（AGENTS/CHANGELOG/INDEX/MILESTONE/PRD/README.zh-CN/SECURITY/TDD/TODO）。

```bash
# 1. 从源复制（最简单）
for f in AGENTS.md CHANGELOG.md INDEX.md MILESTONE.md PRD.md README.zh-CN.md SECURITY.md TDD.md TODO.md; do
  cp /Volumes/code/workspace/infra/axi-workspace-governance/$f \
     /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/$f
done

# 2. 镜像 README 中追加一句"包含 governance 根级门面（AGENTS/CHANGELOG/INDEX/MILESTONE/PRD/SECURITY/TDD/TODO + README.zh-CN）"
```

**注意**：axi-registry 不补镜像（脚本 skip 行为保持）；它本身已有 governance 镜像目录可承载。

### P1：根级 AGENTS.md 加第 4 项职责

**目标**：把"项目门面镜像"显式纳入 axi-docs 的职责声明。

**修改 `AGENTS.md` 第 19-23 行**：

```md
# 改前
Axi Docs 是 **「文档枢纽 + 知识图谱 + MCP 文档总线」三合一** 的项目：
1. **文档枢纽（Knowledge Hub）**：...
2. **知识图谱（Knowledge Graph UI）**：...
3. **MCP 文档总线（MCP Document Bus）**：...

# 改后
Axi Docs 是 **「文档枢纽 + 知识图谱 + MCP 文档总线 + 工作区项目门面镜像」四合一** 的项目：
1. **文档枢纽（Knowledge Hub）**：...
2. **知识图谱（Knowledge Graph UI）**：...
3. **MCP 文档总线（MCP Document Bus）**：...
4. **工作区项目门面镜像（Project Dossier Mirror）**：跨 5 个分区（projects/shared/infra/products/tools）
   自动生成 11 件套项目档案，由 `app/scripts/build-projects-index.mjs` 维护，详见 `docs/audit/axi-docs-coverage-2026-06-10.md`。
```

### 验证

```bash
cd /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs
pnpm --dir app projects:check       # 镜像文件完整性
pnpm --dir app source:check         # 文档源配置
pnpm --dir app verify               # 构建 + MCP 协议冒烟
pnpm --dir app typecheck            # TypeScript
```

---

## 6. P2（暂缓）

- 把 `dbskill` 真正加入 WORKSPACE_INDEX.md，让 build 脚本接管（需要先与 workspace governance 沟通）
- 把 `codex-plus-app` 真正加入 WORKSPACE_INDEX.md（需要先确认它确实是 Axi 工具，不是 OMX 临时工作目录）
- 把 7 件套 → 11 件套的 PIECE_TEMPLATES 内容也做模板化（目前是手写模板字符串）
- 在 `docs/content/{en,zh}/guide/` 加一篇"项目门面镜像"使用指南

---

## 7. 引用文件

- `app/scripts/build-projects-index.mjs`（镜像机制）
- `docs/project-docs.manifest.json`（项目元数据）
- `docs/sources.lock.json`（axi-skills 直读）
- `docs/projects.index.json`（自动生成的索引）
- `AGENTS.md`（根级声明）
- `app/AGENTS.md`（应用包内规则）
- `/Volumes/code/workspace/WORKSPACE_INDEX.md`（数据源）
- `/Volumes/code/workspace/infra/axi-workspace-governance/`（治理真源）

---

*最后更新：2026-06-10 — 由 axi-docs 维护者从工作区状态现场整理。*
*下次 WORKSPACE_INDEX.md 变更或 governance 根级结构变动时同步本文件。*
