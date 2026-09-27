# 处置建议：`tools/codex-plus-app/`

> 起草日期：2026-06-10
> 来源：`docs/axi-workspace-governance/audits/axi-docs-coverage-2026-06-10.md` 缺口 #2
> 起草人：axi-docs 维护者
> 收件人：`tools/codex-plus-app` 目录的可能 owner

## 1. 现状

`/Volumes/code/workspace/tools/codex-plus-app/` 目录的实际内容（**截至 2026-06-10**）：

```
.DS_Store                       ← macOS 桌面服务缓存
.omx/                           ← OMX 编排器状态目录（含 metrics.json）
outputs/                        ← 空目录
work/                           ← 空目录
```

**没有**任何门面文件（无 `AGENTS.md` / `README.md` / `CHANGELOG.md` / `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` 等）。

**没有**任何源代码、配置、构建产物。

**`outputs/` 和 `work/` 都是空目录。**

## 2. 三种可能性

### 可能性 A：OMX 临时工作目录

证据：

- 目录含 `.omx/` 状态子目录
- `outputs/` 和 `work/` 是 OMX 习惯的"输入/输出"目录名
- 完全无任何项目文件

**结论**：可能是某个 OMX 任务在执行期间用 `cwd=tools/codex-plus-app` 跑过，**不是真实项目**。

### 可能性 B：Axi 工具的早期雏形，尚未落地

证据：

- 路径 `tools/codex-plus-app` 暗示"Codex Plus 的 app 形态"
- 命名风格与 `tools/axi-feishu-codex-bridge` 等 Axi 工具一致
- 但**没有任何源码或文档**——一个连 README 都没有的"雏形"不太可能存在 6 个月不被发现

**结论**：可能性较低。如果是雏形，至少该有 `AGENTS.md` 写设计意图。

### 可能性 C：误建或前任 owner 删源码未删目录

证据：

- 没有任何可识别的 owner 标识
- `outputs/` `work/` 留下空目录像是历史残留

**结论**：可能性中等。`.DS_Store` 的 mtime（2024-06-07）显示目录至少存在 1 年，期间内容可能被清空。

## 3. 处置方案（按 owner 偏好排）

### 方案 1：删除整个目录（推荐）

适用：可能性 A 成立。

操作：

```bash
rm -rf /Volumes/code/workspace/tools/codex-plus-app
# 同步删除 axi-docs 镜像
rm -rf /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/content/{en,zh}/projects/codex-plus-app
# 从 projects.index.json 移除 hand-curated 条目（编辑后跑 projects:build）
```

需要确认：

- [ ] 没人**正在**用该目录作为 OMX workdir（`pgrep -af codex-plus` 或类似）
- [ ] `.omx/metrics.json` 里的指标**未被**任何下游系统消费（搜 `.codex-plus` 看 workspace 引用）

### 方案 2：补一个最小 `AGENTS.md`（适用：可能性 B）

适用：若 owner 计划把 codex-plus-app 做成 Axi 工具，先补 `AGENTS.md` 占位 + README，dossier 升级到 7 件套。

操作：

```bash
# 在 tools/codex-plus-app 写：
echo "# Codex Plus App" > tools/codex-plus-app/README.md
echo "## Setup" >> tools/codex-plus-app/README.md
echo "TBD — see https://github.com/openai/codex for upstream." >> tools/codex-plus-app/README.md

cat > tools/codex-plus-app/AGENTS.md <<'EOF'
# Codex Plus App — Agent 契约

## Scope
TBD: 计划中的 Codex Plus 本地包装。**当前目录为占位**，尚未实现。

## Status
placeholder. Axi Docs dossier 3 件最小集保持。
EOF
```

镜像侧：dossier 升级到 7 件套，删除 `mirror-strategy: hand-curated-minimal` 标记。

### 方案 3：合并到既有项目

适用：若 codex-plus-app 内容**实际是** `tools/axi-feishu-codex-bridge` 或 `tools/axi-proxy-companion` 的子模块。

操作：

```bash
# 1. 列出 codex-plus-app 下所有非空内容
find /Volumes/code/workspace/tools/codex-plus-app -type f -not -path "*/.omx/*" -not -path "*/.DS_Store"

# 2. 如果都是空，则直接删除（同方案 1）
# 3. 如果有文件，按相关性合并：
#    - 与 axi-feishu-codex-bridge 相关 → 迁入
#    - 与 axi-proxy-companion 相关 → 迁入
#    - 不相关 → 评估是否新建项目
```

## 4. 决策表

| 答案 | 行动 |
|---|---|
| 目录内能找到 OMX 任务引用？| 走方案 1 |
| 目录归属 owner 已知，且有计划做成工具？| 走方案 2 |
| owner 模糊、6 个月无更新、目录基本为空？| 走方案 1（最可能） |
| 目录归属 owner 已知，且内容应属于其他项目？| 走方案 3 |

## 5. 建议下一步

`tools/codex-plus-app` 已在 2026-06-10 覆盖审计期间被 axi-docs 加了**3 件最小占位 dossier**，**不影响** `pnpm --dir app projects:check` 通过。但这只是可发现性补丁，**实质处置**需 owner 决定。

短期（1 周内）：

- [ ] owner 抽 10 分钟在 OMX / 工作区里搜 `codex-plus` 关键字，确认是否在用
- [ ] 若确认不用，提交删除 PR（方案 1）

长期：

- [ ] 完善 workspace "tools 准入"规则：所有新 `tools/axi-*` 或 `tools/codex-*` 必须先有 `AGENTS.md` + `README.md`，再 `pnpm --dir app projects:build` 让其有 dossier

---

*草案在 axi-docs `docs/audits/` 留底，待 owner 决定。*
