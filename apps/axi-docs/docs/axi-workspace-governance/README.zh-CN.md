# Axi Workspace Governance（中文）

`axi-workspace-governance` 是 `/Volumes/code/workspace` 工作区的根治理仓库。
它只承担"元数据 + 索引 + 审计"职责，不直接运行业务代码，也不暴露 API。

## 定位

- 工作区模式：`Polyrepo + 注册表 + 治理仓库`，**不**建立工作区级 mega monorepo。
- 权威清单：`workspace.json`（顶层 `version` / `schemaVersion` 共同表达快照与 schema 版本）。
- 文档枢纽：`docs/` 目录；单向镜像到 `projects/axi-docs/docs/axi-workspace-governance`。
- 私有 Verdaccio 注册表：`http://localhost:4873`，发布与消费 `@axi/*` 共享包。

## 目录结构

```text
axi-workspace-governance/
├── .workspace/                 # 本地元配置与生成的 registry（不入库）
├── agent/                      # Agent 支撑工具
├── infra/                      # 基础设施仓库引用
├── projects/                   # 活跃业务项目引用
├── references/                 # 参考与归档副本
├── shared/                     # 跨项目共享包引用
├── tools/                      # 独立工具项目引用
├── scripts/                    # 工作区治理脚本
├── docs/                       # 权威治理文档（含 ADR / 审计 / 索引）
├── contracts/                  # 跨项目契约定义
├── workspace.json              # 工作区权威声明
├── CHANGELOG.md                # 治理变更记录
└── README.md
```

## 常用命令

```bash
pnpm workspace:docs:sync      # 生成多仓索引文档并镜像到 Axi Docs
pnpm workspace:registry:sync  # 根据 workspace.json 生成 .workspace/registry.json
pnpm workspace:audit          # 检查登记漂移、路径缺失、Git 基线、共享策略
pnpm workflow:audit           # 工作流基线审计
pnpm resource:verify          # 验证资源与真实 provider 的可达性
pnpm completion:test          # 跑治理自测（Node test runner）
```

## 当前治理原则

- `axi-workspace-governance` 是轻量治理仓库；业务代码不在此仓库内运行。
- 远端使用独立仓库 `axiomaticworld/axi-workspace-governance`，不复用 legacy `enterprise-workspace` 名称。
- 仓库命名遵循 `ADR-002`：现有业务产品保留语义名，新增治理/基础设施/共享/Agent/工具类仓库使用 `axi-*` 前缀。
- `.workspace/registry.json` 由脚本生成，**禁止**手工编辑。
- 共享包统一通过 Verdaccio 发布，**不**推荐 Git Submodule 作为正式集成方式。

## 已登记目录

详见 `docs/project-catalog.md`。登记包括 `infra/axi-registry`、`projects/axi-workbench`、`projects/axi-agent-platform`、`projects/axi-notify`、`projects/axi-docs`、`products/ielts-vocab`、`shared/axi-ui`、`tools/axi-proxy-companion` 等。

## 文档入口

- 完整产品需求：`PRD.md`
- 技术设计：`TDD.md`
- 任务与里程碑：`TODO.md` / `MILESTONE.md`
- 文档索引：`INDEX.md`
- 变更记录：`CHANGELOG.md`
- Agent 协作规则：`AGENTS.md`
- 命名策略 ADR：`docs/adr/ADR-002-progressive-repository-naming-policy.md`

## 安全与发布

- 安全策略：`SECURITY.md` / `SECURITY.zh-CN.md`
- 发布流程：`docs/RELEASING.md`
- 仓库所有者分配：`CODEOWNERS`
