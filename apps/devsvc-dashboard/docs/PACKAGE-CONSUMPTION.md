# `@axi/*` 版本化包消费清单（WFB-PACK-001）

> 状态：**记录完成（2026-09-15）**
>
> 责任侧：Axi Workbench Dashboard
>
> 相关项目：`shared/axi-ui`（Provider）、`infra/axi-registry`（Verdaccio registry）、`apps/axi-coder`、`projects/axi-agent-platform/frontend`、`distributions/axi-workbench-{web,mobile,desktop}`
>
> 本文件仅做版本与消费方式的**只读记录**。任何对 `package.json` 中 `@axi/*` 实际依赖的升级或切换必须在所属 Provider 仓库完成，并通过 `axi-registry` 发布后再重新执行本表验证。

---

## 1. Registry 来源与契约

| 字段 | 值 | 证据 |
|------|----|------|
| Registry 类型 | Verdaccio（本地） | [`infra/axi-registry/package.json`](../../../../../infra/axi-registry/package.json) |
| Registry URL | `http://127.0.0.1:4873/` | [`infra/axi-registry/config/config.yaml:26`](../../../../../infra/axi-registry/config/config.yaml) |
| 健康检查端点 | `http://127.0.0.1:4873/-/ping` | [`infra/axi-registry/scripts/health.mjs:1`](../../../../../infra/axi-registry/scripts/health.mjs) |
| 命名空间 | `@axi/*`（私有，`access: $all`、`publish: $authenticated`） | [`config/config.yaml:13-22`](../../../../../infra/axi-registry/config/config.yaml) |
| 上行 proxy | `https://registry.npmjs.org/`（仅非 `@axi/*` 包） | [`config/config.yaml:11`](../../../../../infra/axi-registry/config/config.yaml) |
| 发布脚本入口 | `pnpm publish:local:<pkg>`（位于 `shared/axi-ui/package.json`） | [`shared/axi-ui/package.json` scripts.publish:local:*](../../../../../shared/axi-ui/package.json) |
| 发布目标 registry | 每个包 `publishConfig.registry = http://127.0.0.1:4873/` | 例如 [`shared/axi-ui/packages/core/package.json`](../../../../../shared/axi-ui/packages/core/package.json) |

> **当前 storage 状态（2026-09-15）：** Verdaccio `storage/@axi/` 目录中已存在 `react/`, `react-addons/`, `react-antd/`, `tokens/`。这些是早期命名空间遗留物；当前 `axi-ui` 已切到 `core / shell / crud / settings / widgets / tokens / presets / addons / vite-plugin`。后续发布应清理旧条目或保留为只读镜像以避免消费者误装。

## 2. `@axi/*` 包版本快照（2026-09-15）

所有版本读取自 `shared/axi-ui/packages/*/package.json`。

| 包名 | 当前版本 | 发布目标 | 兼容范围（peerDependencies 提示） | Provider 路径 |
|------|---------|---------|----------------------------------|---------------|
| `@axi/addons` | `0.1.0` | `http://127.0.0.1:4873/` | 由 `@axi/core` 间接消费 | `shared/axi-ui/packages/addons/` |
| `@axi/core` | `0.2.1` | `http://127.0.0.1:4873/` | `react >=18 <20`、`react-dom >=18 <20`（peer） | `shared/axi-ui/packages/core/` |
| `@axi/crud` | `0.2.0` | `http://127.0.0.1:4873/` | 由 `@axi/core` / Shell 间接消费 | `shared/axi-ui/packages/crud/` |
| `@axi/presets` | `0.1.0` | `http://127.0.0.1:4873/` | `@axi/core` 的直接依赖（`workspace:^`） | `shared/axi-ui/packages/presets/` |
| `@axi/settings` | `0.1.0` | `http://127.0.0.1:4873/` | 由 `@axi/core` / Shell 间接消费 | `shared/axi-ui/packages/settings/` |
| `@axi/shell` | `0.3.0` | `http://127.0.0.1:4873/` | 与 `@axi/core` 0.2.x 配套（0.3.x 是当前最高位次） | `shared/axi-ui/packages/shell/` |
| `@axi/tokens` | `0.2.0` | `http://127.0.0.1:4873/` | `@axi/core` 与 `@axi/presets` 的基础依赖 | `shared/axi-ui/packages/tokens/` |
| `@axi/vite-plugin` | `0.1.0` | `http://127.0.0.1:4873/` | 由 `shared/axi-ui/gallery/` 内部消费 | `shared/axi-ui/packages/vite-plugin/` |
| `@axi/widgets` | `0.1.0` | `http://127.0.0.1:4873/` | 由 `@axi/core` / Shell 间接消费 | `shared/axi-ui/packages/widgets/` |

### 2.1 兼容范围说明

- `@axi/core 0.2.1` 的 `peerDependencies` 显式约束 `react >=18 <20`、`react-dom >=18 <20`，因此 React 18 与 React 19 消费者必须各自在自身 `package.json` 中固定 `react` / `react-dom` 主版本。
- `packages/core/package.json` 的 `dependencies` 中以 `workspace:^` 引用 `@axi/presets` 与 `@axi/tokens`，发布到 Verdaccio 时这两个内部引用需要在发布前的 `pnpm --filter @axi/core publish` 流程中保持为受控内部版本；否则消费者拿到的是未解析的 `workspace:^` 范围。
- `@axi/shell 0.3.0` 在版本号上高于 `@axi/core 0.2.1`；当前 dashboard 已通过 `link:` 直接消费两者的源码，因此不受发布版本号差异影响，但切到 Registry 模式时需要在 release notes 中显式记录该错位。

### 2.2 Provider CHANGELOG 引用

- 完整变更记录：[`shared/axi-ui/docs/state/CHANGELOG.md`](../../../../../shared/axi-ui/docs/state/CHANGELOG.md)。
- 关键里程碑（与 `core 0.2.x / shell 0.3.x` 对齐）：
  - `@axi/settings` 迁移到 `src/features/settings/`，`@axi/crud` 迁移到 `src/features/data-workflow/`。
  - Shell 的 navigation/topbar/tabs/message 归并到 `packages/shell/src/features/navigation/`。
  - Core theme runtime 归并到 `packages/core/src/capabilities/theme/`。
  - Gallery 引入 `workflow/todo` agent-handoff 工作区。
- 详细 module PRD 注册表：`shared/axi-ui/docs/modules/index.json`；通过 `pnpm check:module-docs` 在 Provider 侧守门。

## 3. Workbench Dashboard 消费矩阵

读取自 [`apps/devsvc-dashboard/package.json`](../package.json)。

| 依赖 | 版本约束 | 来源 | 消费方式 | 备注 |
|------|---------|------|---------|------|
| `@axi/addons` | `link:../../../../shared/axi-ui/packages/addons` | Provider 源码 link | 开发期 `link:` | 切到 Registry 消费需 Provider 端发布 `0.1.0` |
| `@axi/core` | `link:../../../../shared/axi-ui/packages/core` | Provider 源码 link | 开发期 `link:` | 当前版本 `0.2.1` |
| `@axi/crud` | `link:../../../../shared/axi-ui/packages/crud` | Provider 源码 link | 开发期 `link:` | 当前版本 `0.2.0` |
| `@axi/settings` | `link:../../../../shared/axi-ui/packages/settings` | Provider 源码 link | 开发期 `link:` | 当前版本 `0.1.0` |
| `@axi/shell` | `link:../../../../shared/axi-ui/packages/shell` | Provider 源码 link | 开发期 `link:` | 当前版本 `0.3.0` |
| `@axi/tokens` | `link:../../../../shared/axi-ui/packages/tokens` | Provider 源码 link | 开发期 `link:` | 当前版本 `0.2.0` |
| `@axi/widgets` | `link:../../../../shared/axi-ui/packages/widgets` | Provider 源码 link | 开发期 `link:` | 当前版本 `0.1.0` |

### 3.1 验证证据

- `pnpm --dir apps/devsvc-dashboard test` → ✅ PASS（25/25，包含 `scripts/scan-runtime-paths.test.mjs`）。
- `pnpm --dir apps/devsvc-dashboard typecheck` → ✅ PASS。
- `apps/devsvc-dashboard/scripts/scan-runtime-paths.mjs` 扫描构建产物，确认 `apps/devsvc-dashboard/dist/` 内不出现 `/Volumes/code/workspace/...` runtime wiring（详见本任务配套脚本与测试）。
- `apps/devsvc-dashboard/package.json` 中不存在 `@axi/*` 的硬编码绝对路径。

## 4. 其他消费者覆盖

| 消费者 | `package.json` 路径 | `@axi/*` 消费情况 | 当前状态 |
|--------|-------------------|-------------------|---------|
| `apps/axi-coder` | [`apps/axi-coder/package.json`](../../axi-coder/package.json) | `link:` 消费 `@axi/core`、`@axi/shell`、`@axi/tokens`（与 Dashboard 一致） | ✅ 已通过 link 消费；Registry 切流待 `WFB-PACK-002` |
| `projects/axi-agent-platform/frontend` | [`projects/axi-agent-platform/frontend/package.json`](../../../../../projects/axi-agent-platform/frontend/package.json) | **未直接消费 `@axi/*` 包**（仅自包含依赖，无 `@axi/core/shell/tokens` 等） | ⚠️ 当前与 `axi-ui` 无 runtime 耦合；如需引入，必须先在 graph 中建立契约 |
| `distributions/axi-workbench-web` | [`distributions/axi-workbench-web/package.json`](../../../../../distributions/axi-workbench-web/package.json) | 顶层 `package.json` 仅声明 `turbo/typescript/sass`；`@axi/*` 消费由子包 `packages/*` 完成 | ⚠️ 顶层无 `@axi/*`；需要审计子包后才给出明确阻塞或成功证据 |
| `distributions/axi-workbench-mobile` | [`distributions/axi-workbench-mobile/package.json`](../../../../../distributions/axi-workbench-mobile/package.json) | 顶层 `package.json` 仅声明 `turbo/typescript/sass`；未引用 `@axi/*` | ⚠️ 顶层无 `@axi/*`；需要审计子包 |
| `distributions/axi-workbench-desktop` | [`distributions/axi-workbench-desktop/package.json`](../../../../../distributions/axi-workbench-desktop/package.json) | 顶层 `package.json` 仅声明 `turbo/typescript/sass`；未引用 `@axi/*` | ⚠️ 顶层无 `@axi/*`；需要审计子包 |
| `packages/workbench-foundation`（Workbench 内部） | [`packages/workbench-foundation/package.json`](../../../../../packages/workbench-foundation/package.json) | `link:` 消费 `@axi/core` 与 `@axi/workstation-contracts`（后者为 Workbench 内部命名空间） | ✅ 已通过 link 消费 |

### 4.1 Distribution 阻断记录

`axi-workbench-web/mobile/desktop` 顶层 `package.json` 仅声明 `turbo/typescript/sass`，未直接声明 `@axi/*` 依赖。这并不等于它们不消费 `@axi/*`：

- 它们是 `turbo` monorepo，通过 `pnpm-workspace.yaml` 把 `packages/*` 纳入构建；`@axi/*` 消费由各子包（如 `@axi/workbench`）负责。
- 当前 `WFB-PACK-001` 仅做"顶层至少有 `@axi/*` 包名引用或明确阻塞记录"的两者取其一验证，因此本表以"未在顶层直接声明"作为**明确的阻塞记录**，避免在未审计子包的情况下误判通过。
- 真正切流到 Registry 后，需要在每个 distribution 的 `pnpm-lock.yaml` 中确认子包解析到 Verdaccio 上的具体 `@axi/*` 版本号。

## 5. 切流到版本化 Registry 的最低门槛（不在 WFB-PACK-001 范围内）

> 以下为后续 `WFB-PACK-002` 起跑线，仅记录不实施。

1. 在 Verdaccio `storage/@axi/` 中清理与当前命名空间不一致的旧条目（`react/`、`react-addons/`、`react-antd/`），或保留为只读镜像。
2. 修正 `@axi/core` 等包内 `dependencies: { "@axi/presets": "workspace:^" }` 的发布行为，确保通过 Verdaccio 消费时拿到真实版本而不是未解析的 `workspace:` 范围。
3. 把 devsvc-dashboard 与 axi-coder 的 `link:` 引用改为 `"@axi/core": "^0.2.1"` 等显式版本号，并在 `pnpm install` 时通过 `pnpm-workspace.yaml` 或 `.npmrc` 指向 Verdaccio。
4. 在 `apps/devsvc-dashboard/scripts/scan-runtime-paths.mjs` 的扫描基础上，把 `apps/axi-coder/dist/` 与各 distribution 的构建产物纳入同一次扫描，作为 Provider 升级前的回归门槛。

## 6. 已知风险

- `axi-ui` 当前本地未提交变更数较多（见 `TODO.md` 2026-09-14 快照），Provider 端一次发布即可能覆盖本表的版本快照。
- Workbench Dashboard 的 `link:` 路径是相对路径 `../../../../shared/axi-ui/packages/*`，与 Verdaccio 模式下绝对路径无关；本表不修改 `link:`。
- 当前 `apps/axi-coder/dist/` 历史产物包含 `workspace-project-completion.json` / `workspace-project-handoff.json`；这些是 governance 输出文件，不属于 runtime wiring，扫描器应识别它们为元数据而非运行时依赖。
