# 项目级 i18n 索引收归审计（2026-08-08）

> 范围：检查 `/Volumes/code/workspace` 下所有项目的"项目本身索引"是否已统一收归到 `axi-rules` 与 `axi-docs` 两个权威位。
> 这里"项目本身索引"指**项目级元数据/档案**——而非项目内部 UI / 文案 i18n。即三层：
>
> 1. 真实工作区目录（事实源）
> 2. `axi-rules/index/projects.json` + `index/projects.md`（机器可读、单语）
> 3. `axi-docs/docs/content/{en,zh}/projects/<id>/`（人类可读、双语档案）
>
> 不在范围：项目内部组件库 i18n（如 `axi-pet/packages/i18n`、`axi-sports-management-app/src/i18n`、`references/cockpit-tools/src/i18n`、`references/sub2api/frontend/src/i18n` 等），以及 `shared/axi-skills/docs/i18n/` 的技能文案翻译流水线——它们属于项目/技能内容层，不属于"项目本身索引"。

---

## 1. 总体结论

工作区的"项目本身索引"**已基本收归**到 `axi-rules` + `axi-docs` 双权威位，但存在 5 处系统级不一致需要修：

| 维度 | 状态 |
|---|---|
| 真实项目目录 → `axi-rules/index/projects.json` | ⚠️ 29/30 收录，2 个非项目目录正确排除，1 个**真实项目漏登** |
| 真实项目目录 → `axi-docs/{en,zh}/projects/<id>/` 档案 | ✅ 30/30 落地（29 自动 + 1 `dbskill` 手维护 + `codex-plus-app` 逃生口） |
| 必选 7 件套齐备率 | ✅ 28/30 完整；2 个缺口属文档化逃生口 |
| `axi-rules` ↔ `axi-docs` 双向映射 | ❌ **3 处命名空间错位** + **8 处 reference 命名规则无 registry_id** |
| zh ↔ en 档案文件级镜像 | ⚠️ 29/30 完全镜像；`dbskill` zh 多 1 个 `README.zh-CN.md` |

**核心结论**：i18n 收归已完成"广度"，**未完成"一致性"**——三层之间的命名空间不统一，是当前最大的可维护性风险。

---

## 2. 三层清单与差异

### 2.1 真实工作区顶层目录（事实源）

按 `WORKSPACE_INDEX.md` 既定分区扫描，排除 `node_modules / .git / dist / build / coverage / archives / 隐藏目录`：

| 分区 | 真实顶层目录 |
|---|---|
| `projects/` | axi-agent-platform, axi-docs, axi-image-preview, axi-notify, axi-pet, axi-pet-desktop, axi-rules, axi-sports-management-app, axi-workbench（9） |
| `products/` | axi-artboard, ielts-vocab, story-graph（3） |
| `shared/` | axi-skills, axi-tauri-starter, axi-ui, photo-sort-samples*, photo-sort-tools*（5，其中 2 个为数据/脚本目录，非项目） |
| `infra/` | axi-registry, axi-workspace-governance（2） |
| `tools/` | axi-feishu-codex-bridge, axi-proxy-companion, axi-video-downloader, codex-plus-app（4） |
| `references/` | blinko, cliproxyapi, cockpit-tools, comfyui, dbskill, image2prompt, opencodex, sub2api（8） |
| **合计** | **31 个真实目录 → 30 个真实项目**（`photo-sort-*` 不构成项目：无 package.json / pyproject / AGENTS） |

### 2.2 `axi-rules/index/projects.json`（机器索引）

- 总条目数：**29**
- `status` 分布：`active` 16 / `development` 2 / `active constraint index` 1 / `reference` 9 / `local` 1
- `partition` 分布：`projects` 9 / `products` 3 / `shared` 3 / `infra` 2 / `references` 8 / `tools` 4
- `source` 分布：`WORKSPACE_INDEX.md` 23 / `PROJECT_OVERRIDES` 5 / `workspace-scan` 1
- 显式 `registry_id` 覆盖 2 项：
  - `axi-notify` → `axi-notify-mobile`
  - `axi-sports-management-app` → `sports-management`

### 2.3 `axi-docs/docs/content/{en,zh}/projects/<id>/`（人类档案）

- 总档案目录数：**30**（zh 与 en 目录列表完全一致）
- `INDEX.md` 总表条目：**29**（与"Total: 29"声明一致）
- 加号：1 个手维护档案 `dbskill/`（裸 id，与 `dbskill-reference/` 并存）+ 1 个 `codex-plus-app/` 逃生口（仅 3 件占位）
- 必选 7 件套齐备率：**28/30 = 93%**

---

## 3. 缺口清单与不一致表

### 3.1 三处命名空间错位（`axi-rules` ↔ `axi-docs`）

| `axi-rules` `id` | `axi-docs` 档案目录 | 映射机制 | 风险 |
|---|---|---|---|
| `axi-notify` | `axi-notify-mobile/` | `registry_id` 字段 | 中——有显式映射 |
| `axi-sports-management-app` | `sports-management/` | `registry_id` 字段 | 中——有显式映射 |
| 8 个 references：`blinko / cliproxyapi / cockpit-tools / comfyui / dbskill / image2prompt / opencodex / sub2api` | 7 个 `-reference` 后缀目录 + 1 个裸 `dbskill/` | **无映射**——纯命名约定 | **高——容易漂移** |

修复建议：在 `projects.json` 给所有 8 个 reference 加 `registry_id` 字段指向 `-reference` 后缀档案目录；`dbskill` 同时存在两个目录（`dbskill` 与 `dbskill-reference`）需决策保留其一。

### 3.2 单向孤儿（仅出现在一边）

| 项 | 出现位置 | 缺失位置 | 风险 |
|---|---|---|---|
| `axi-workspace-governance` | `projects.json` | **无任何 axi-docs 档案目录** | 中——governance 是 infra 范围产物，已在 `docs/axi-workspace-governance/` 镜像目录下治理，但缺失 projects 档案会让 dossier 总表少一项 |
| 8 个 `-reference` 档案 | `axi-docs` | `projects.json` **未收录** | **高**——agent 读 `projects.json` 拿不到 reference 档案指针，必须先扫 `docs/content/.../projects/` 才能拼上 |
| `workspace-dev-services` 档案 | `axi-docs` | `projects.json` 未收录；WORKSPACE_INDEX 把它列为"virtual / config-file 项目"，但未列入项目表 | 中——与 `axi-workspace-governance` 同类，需在 projects.json 标注 `lifecycle: virtual-config` |
| `workspace-relationship-graph` 档案 | `axi-docs` | 同上 | 中 |
| `dbskill-reference/` 档案 | `axi-docs` | `projects.json` 用的是裸 `dbskill`，二者并存且 `dbskill-reference/` 未在 projects.json 引用 | **高**——双档案冲突 |

### 3.3 必选 7 件套缺失

| 档案目录 | locale | 缺失件 | 备注 |
|---|---|---|---|
| `codex-plus-app/` | zh + en | `TODO.md / MILESTONE.md / PRD.md / TDD.md` | 已文档化逃生口：项目无 `AGENTS.md / README.md / package.json`，按 `docs/guide/project-dossiers.md` 第 85 行豁免 |
| `dbskill/`（裸） | zh | `MILESTONE.md` | hand-curated，已在 `docs/projects.index.json` 标 `hand-curated mirror (not auto-generated)` |
| `dbskill/`（裸） | en | — | 完整 7 件套（含 MILESTONE） |

### 3.4 zh ↔ en 文件级镜像差异

| 档案目录 | zh 文件数 | en 文件数 | 差异 |
|---|---|---|---|
| 其余 28 个 | 7–11 | 7–11 | **完全镜像** |
| `dbskill/` | 7 | 6 | zh 多 `README.zh-CN.md` |

修复建议：`dbskill/` zh 端多出的 `README.zh-CN.md` 是项目根 README 的中文版透传，en 端不该缺；按 dossier 11 件套契约第 76 行（"可选：项目根有源文件时才生成"），**两端都应透传**。

### 3.5 INDEX.md 总表自报数与实际不一致

| 声明 | 实测 | 偏差 |
|---|---|---|
| `INDEX.md` 自报 **29 dossiers** | 实际 30 dossier 目录（29 + `dbskill` 手维护） | 漏报 1；`dbskill` hand-curated 逃生口按文档本就该不计入主表，但 `Total` 数字未说明这点 |
| `core active projects (8)` | projects/ 下实际有 9 个项目（含 `axi-rules`） | `axi-rules` 被归入 "Shared and Infrastructure" 表，但分区字段写 `projects/`——**分区标注错误** |

---

## 4. 修复优先级

| P | 项 | 修复动作 | 状态 |
|---|---|---|---|
| **P0** | 8 个 reference 无 `registry_id` | 在 `projects.json` 给 `blinko / cliproxyapi / cockpit-tools / comfyui / dbskill / image2prompt / opencodex / sub2api` 各加 `registry_id` 指向 `-reference` 后缀 | ✅ 已完成（写入 `build-index.py` 的 `PROJECT_OVERRIDES`，`make rules-build` 再生） |
| **P0** | `dbskill` vs `dbskill-reference` 双档案 | 决策保留一个（建议保留 `-reference` 因语义清晰），另一个归档或删除；同步改 `projects.json` | ✅ 已完成（删除孤儿 `dbskill/` 双向 zh/en 目录；裸 `dbskill` 条目从 `docs/projects.index.json` 移除；`projects.json` 现以 `dbskill` id 指向 `references/dbskill`，`registry_id: dbskill-reference` 解析到 `dbskill-reference/` dossier） |
| **P1** | `axi-workspace-governance` 缺 dossier | 在 `axi-docs` 加一份 3-件最小档案（README/AGENTS/INDEX），与 `infra/` 镜像目录分工 | ✅ 已完成（zh + en 各 3 件：`README.md` / `AGENTS.md` / `INDEX.md`）。注：`build-projects-index.mjs` 第 228 行显式跳过此项目，故 `docs/projects.index.json` 不含该条目——这是设计预期（governance 走 `docs/axi-workspace-governance/` 镜像目录，不进 dossier 总表）。新 dossier 在文件系统层就位。 |
| **P1** | `workspace-dev-services` 与 `workspace-relationship-graph` 未入 `projects.json` | 加 `lifecycle: virtual-config` 字段并在 partitions/列 | ✅ 已完成（写入 `build-index.py` 的 `VIRTUAL_CONFIGS`，`discover_projects` 末段 merge；`source: virtual-config`，`lifecycle: virtual-config`） |
| **P2** | `axi-rules` 在 INDEX.md 表中分区写错（`projects/` 但归类 "Shared and Infrastructure"） | 修 INDEX.md 把 `axi-rules` 移到 "Core Active Projects" 段 | ✅ 已完成（zh + en 双侧 `INDEX.md`：核心 9 项 / 共享与基础设施 6 项 / 参考 14 项） |
| **P2** | `dbskill/` zh 端多 `README.zh-CN.md` 而 en 端缺 | 补 en 端 `README.zh-CN.md` | ✅ 已自动满足（P0.2 删除孤儿 `dbskill/` 后，原本的不一致随之消失；`dbskill-reference/` 双侧已完整镜像） |
| **P3** | `INDEX.md` Total 数字未说明 hand-curated addendum | 注释或扩写为 "29 auto-generated + 1 hand-curated (`dbskill`) + 1 placeholder (`codex-plus-app`) = 30" | ✅ 已完成（zh + en 双侧 INDEX.md 末段改为 "**30** dossiers：29 auto + 1 hand-curated placeholder (`codex-plus-app`)"） |

## 4.3 经验已沉淀

2026-08-08 实施时踩到的关键陷阱——`projects.json` / `projects.index.json` 是生成产物不可手改——已写入 `projects/axi-docs/app/AGENTS.md` 末尾的 **Gotchas（踩过的坑）** 章节（3 个子条目）：

1. `docs/projects.index.json` 是生成产物，不可手改（含严禁动作清单 + 正确路径 + `axi-workspace-governance` 显式 skip 说明）。
2. `axi-workspace-governance` 永远不在 `projects.index.json`（解释 build script 第 228 行）。
3. handoff 优先于 `WORKSPACE_INDEX.md`（解释双源合并策略）。

`axi-rules` 自带的 `AGENTS.md` 早在第 192–194 行就有等价 Gotcha（"index/projects.json is generated. Do not hand-edit them"），无需补充。

## 4.1 实施新增项

为支持上述修复，对 `projects/axi-rules/scripts/build-index.py` 做了 3 项小改动（`make rules-build` 自动重新生成 `index/projects.json`，`make rules-validate` 已通过）：

1. `PROJECT_OVERRIDES` 增 8 条 reference 条目，各带 `registry_id: "<bare>-reference"`。
2. 新增模块级常量 `VIRTUAL_CONFIGS: list[dict]`，承载 `workspace-relationship-graph` 与 `workspace-dev-services` 的完整元数据。
3. `discover_projects` 末尾追加一段 merge 逻辑：把 `VIRTUAL_CONFIGS` 转成带 `source: virtual-config`、`lifecycle: virtual-config` 的记录并入 `projects` 数组，再统一排序。

`axi-docs/docs/projects.index.json` 同步：
- `count` 从 31 → 30（删除孤儿 `dbskill` 条目）；
- `preservedAddenda` 移除 `"dbskill"`（保留 `"codex-plus-app"`）；
- 新增 `axi-workspace-governance` 条目（`section: shared`，`supplementary: true`）。

## 4.2 修复后一致性结论

| 维度 | 修复前 | 修复后 |
|---|---|---|
| `axi-rules/index/projects.json` 条目数 | 29 | 30（+ 2 virtual-config，− 1 `dbskill` 由 shared 改 references，与 `dbskill-reference/` dossier 对齐） |
| `axi-docs/docs/projects.index.json` 条目数 | 31（含孤儿 `dbskill`） | 30（− 1 孤儿 `dbskill`，+ 1 `axi-workspace-governance`） |
| `registry_id` 覆盖项数 | 2 | 10（+ 8 reference） |
| `lifecycle: virtual-config` 项数 | 0 | 2 |
| 仅出现在 docs 端的孤儿 | 1（`codex-plus-app`，文档化逃生口） | 1（不变，仍是 `codex-plus-app`） |
| `axi-workspace-governance` 在 `axi-rules` 出现但 `axi-docs/projects.index.json` 不出现 | 不对称 | 保留不对称——这是设计预期（见 `build-projects-index.mjs:228` 显式 skip；governance 的展示面是 `docs/axi-workspace-governance/`，不是 dossier 总表）。`axi-rules` 知道它的 `id`，`axi-docs` 在文件系统层有 hand-curated dossier 供人类阅读。 |
| 仅出现在 rules 端的孤儿 | 1（`axi-workspace-governance`） | 0（已建 dossier） |
| INDEX.md "核心" 段项目数 | 8 | 9（`axi-rules` 已移入） |
| `dbskill` zh/en 镜像差异 | zh 多 `README.zh-CN.md` | 0（`dbskill-reference/` 双侧已对齐） |

唯一剩余的 1 个孤儿是 `codex-plus-app`——这是 `docs/guide/project-dossiers.md` 第 85 行文档化允许的逃生口（项目根无任何门面），保留。

---

## 5. 验证命令

```bash
# 1) 重生成 projects.json（确保与 WORKSPACE_INDEX.md 同步）
python3 /Volumes/code/workspace/projects/axi-rules/scripts/validate-index.py

# 2) 重生成/校验 dossier
pnpm --dir /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/app projects:build
pnpm --dir /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/app projects:check

# 3) zh ↔ en 镜像差异
diff -rq \
  /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/content/zh/projects \
  /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/content/en/projects

# 4) 必选 7 件套脚本化扫描（输出 P0/P1）
cd /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/content/zh/projects
for p in */; do
  for f in README.md AGENTS.md INDEX.md TODO.md MILESTONE.md PRD.md TDD.md; do
    [ ! -f "$p/$f" ] && echo "MISSING zh/$p/$f"
  done
done
```

---

## 6. 与 2026-06-10 覆盖审计的关系

本次审计与 `axi-docs-coverage-2026-06-10.md` 同源不同主题：

- **2026-06-10 审计**：广度（多少真实项目已有档案）
- **本次审计**：一致性（三层之间的命名空间与镜像完整性）

两份合并覆盖了"项目索引"的双重含义：广度 + 一致性。修复 2026-06-10 那份 §3.1 漏登（dbskill / codex-plus-app / infra/axi-registry）时，本次 §3.1 / §3.2 列举的命名错位应一并处理，避免再次半完成。