# AXI Git 系统与仓库联邦规范

## 1. 边界

`/Volumes/code/workspace` 是工作区容器，不是 Git 仓库。每个可维护项目拥有自己的 Repository；Workspace Registry 负责记录 Project、Repository 和外部来源之间的关系。

```text
Workspace
  └── Project
        └── Repository
              └── Branch / Commit / Tag
```

- Workspace：管理项目、资源、关系和治理状态。
- Project：管理目标、生命周期、文档、规则和技能。
- Repository：管理代码、文件历史、分支和发布。
- Git：作为物理变化来源，不能替代 AXI 的语义 Change。

## 2. Repository Registry

`foundation/workspace-governance/workspace.json` 是仓库注册的权威来源。每个正式代码项目应记录：

- `path`
- `remote`
- `source_remote`（若来自 fork 或外部上游）
- `remote_required`
- `default_branch`
- `lifecycle`
- `branchPolicy`
- `remote_decision_pending`（若远程创建或 owner 决策尚未完成）

以下情况允许 `remote_required: false`，且必须在注册说明中明确原因：Workspace 容器、外部只读 reference、明确的本地运行时状态、尚未通过 admission 的 incubation。

正式 Axi 项目默认 `remote_required: true`。没有远程仓库不能报告为“可交付完成”，只能标记为 `remote-pending`。

## 3. 分支策略

默认策略为轻量 Git Flow：

```text
main              稳定、可发布状态
dev               日常集成分支（复杂项目或明确采用 dev 的项目）
feat/<description>功能变化
fix/<description>  缺陷修复
hotfix/<description>紧急修复
experiment/<description>临时实验，完成后删除
```

- 简单项目可以只使用 `main + feat/*`。
- 复杂项目可以使用 `main + dev + feat/* + fix/* + hotfix/*`。
- `release/*` 只在有明确发布里程碑时创建。
- `debug` 不作为长期分支，使用 `experiment/*` 替代。
- 不强行要求所有仓库使用同一默认分支；以 Registry 中的 `default_branch` 为准。

## 4. Project Lifecycle 与 Git 状态分离

Git branch 描述代码状态，Project Lifecycle 描述创造过程，二者不能互相替代。

```text
IDEA → EXPLORING → DEVELOPING → VERIFYING → RELEASED → MAINTAINING → ARCHIVED
```

Project 可以处于 `DEVELOPING`，Repository 同时位于 `dev` 或 `feat/*`；项目进入 `ARCHIVED` 也不代表必须删除仓库。

## 5. Change Type

Commit 和 AXI Change Object 使用同一组可映射的变化类型：

| Commit / Change Type | 语义 |
|---|---|
| `feature` | 新能力 |
| `bugfix` | 缺陷修复 |
| `refactor` | 不改变外部能力的结构调整 |
| `experiment` | 临时验证 |
| `migration` | 数据、Schema 或运行时迁移 |
| `architecture` | 核心模型或跨项目契约变化 |
| `release` | 发布里程碑 |
| `deprecation` | 能力或路径退役 |

推荐提交格式：

```text
<type>(<scope>): <description>
```

例如：`feat(workbench): add project graph` 应转换为 `Change.type=feature`、`scope=workbench`。

## 6. 多仓库与嵌套仓库

一个 Project 可以包含多个 Repository。扫描器不得仅凭任意 `.git` 自动注册仓库；必须通过显式 Registry、项目边界或用户确认登记。

```text
Project: AXI-Platform
├── Repository: backend
├── Repository: frontend
└── Repository: docs
```

每个 Repository Adapter 输出统一的 `RepositoryChange`：

```json
{
  "type": "repository_change",
  "repository": "axi-workbench",
  "project": "AXI-WORKBENCH",
  "commit": "abc123",
  "files": ["ProjectNode.vue"],
  "change_type": "feature"
}
```

多个 RepositoryChange 再由 Change Sync 聚合为语义 Change Object，不能把每个 commit 直接当作系统级变化。

## 7. Push 审计规则

审计必须区分：

- `PASS`：远程存在、认证有效、dry-run 通过。
- `REJECTED_BY_REMOTE`：远程存在但账号没有写权限或分支被保护。
- `BLOCKED_BY_LOCAL_GATE`：本地 pre-push 检查失败。
- `NO_ORIGIN`：没有远程。
- `REMOTE_PENDING`：正式项目需要远程但远程尚未创建。
- `REFERENCE_READ_ONLY`：外部 reference 只允许拉取，不要求向上游 push。
- `NO_GIT`：Workspace anchor、文档容器或明确本地能力，不是代码 Repository。

禁止通过 `--no-verify`、强制推送或替换外部上游 remote 来伪造 push 成功。

## 8. 当前整改结论（2026-09-21）

- AXI Workspace 根目录保持非 Git 容器。
- `axi-workbench-cli` 已初始化本地 `dev` 仓库，但对应 GitHub Repository 尚不存在，状态为 `REMOTE_PENDING`。
- `axi-skills` 已补齐 `origin=https://github.com/MoseLu/axi-skills.git`；当前远程 `dev` 比本地领先，必须先审阅并整合远程变化，不能直接推送。
- `axi-ui` 的 push 被本地 `check-file-lines` 拦截，原因是 `gallery/src/gallery-model.ts` 超过 600 行，状态为 `BLOCKED_BY_LOCAL_GATE`。
- `axi-pet` 的上游 remote 是 `moeru-ai/airi`，属于 fork 上游，不应向该地址推送；应另设 Axi fork remote 或明确保持只读。
- `references/*` 外部仓库的 403 属于预期只读边界，不作为 Axi 自有仓库 push 失败处理。

