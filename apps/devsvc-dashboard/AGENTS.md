# Axi DevSvc Dashboard（Host）— 子项目 AGENTS

> 本文件管辖 `/Volumes/code/workspace/workbench/axi-workbench/apps/devsvc-dashboard`。
> 父级 [`apps/AGENTS.md`](../AGENTS.md) 与仓库根 [`AGENTS.md`](../../AGENTS.md) 仍然适用。
> 本应用是 **Host（宿主壳）**：负责托管其他 Axi Dashboard Apps 与展示其状态，自己不做被托管应用的业务执行。

## 入口
- `index.html` → `src/main.tsx`（antd reset + `@axi/tokens` / `@axi/core` 样式 + 主题恢复 + observability SDK）→ `src/AppRouter.tsx`。
- 应用注册表：`src/app-registry.tsx`；壳层：`src/app-shell/Shell.tsx`。
- 桌面壳：`src-tauri/`（Tauri 2；productName `Axi Dashboard`，identifier `com.axi.dashboard`，devUrl `http://127.0.0.1:17889`，frontendDist `../dist`）。
- 端口：dev 17889（strictPort）、preview 17890、PM2 生产服务 17888（由工作区 wrapper `/Volumes/code/workspace/scripts/service/devsvc/devsvc` 启动，**不在本包内启动**）。

## 子模块划分
| 目录 | 职责 |
|---|---|
| `src/features/` | `dashboard` / `services` / `servers` / `alerts` / `deploy` / `observability` / `search` / `settings` / `theme` / `hosted` / `axi-resources` / `auth` / `status` / `topbar` |
| `src/app-shell/` | `Shell`、`AppToolbar`、`toolbarSlot` |
| `src/settings/` `src/theme/` `src/i18n/` `src/lib/` | 设置、主题 token、i18n、工具 |
| `config/axi-apps.json` | 可托管应用清单（`appId` / `cwd` / `startCommand` / `routes` / `${port}` 占位符）；Host 运行时分配 loopback 端口并经 `AXI_APP_PORT` 注入 |
| `config/axi-resources.json` | 资源页配置 |
| `scripts/` | `check-file-lines.mjs`（600 行门禁）、`drift-check.mjs`、`test-loader.mjs`、`install-git-hooks.mjs` |

当前托管清单（`config/axi-apps.json`）：`axi-fleet-console`、`axi-coder`、`axi-verification-inbox`、`axi-docs`、`axi-image-preview`、`axi-agent`、`axi-artboard`、`axi-resource-orchestration`、`axi-resource-gateway`。

## 关键命令
```bash
pnpm --filter @axi/devsvc-dashboard dev            # 17889
pnpm --filter @axi/devsvc-dashboard typecheck      # 也有 type-check 别名
pnpm --filter @axi/devsvc-dashboard build
pnpm --filter @axi/devsvc-dashboard test           # node --test scripts/*.test.mjs
pnpm --filter @axi/devsvc-dashboard check:file-lines
pnpm --filter @axi/devsvc-dashboard drift-check
pnpm --filter @axi/devsvc-dashboard tauri build    # macOS 应用（需 17888 服务在线）
```

## 依赖关系
- `@axi/core` / `@axi/shell` / `@axi/tokens` / `@axi/crud` / `@axi/settings` / `@axi/widgets` / `@axi/icons` / `@axi/addons` / `@axi/presets` 经 `link:../../../../foundation/axi-ui/packages/*` 引用（跨仓）；`@axi/observability-web` / `@axi/observability-react-hooks` 来自 `foundation/axi-observability`。
- Hosted 应用只通过 `config/axi-apps.json` 接入；**不要在 Host 内复刻 hosted 应用的执行按钮**，执行 / 授权 / 审计边界归各自 owner（见配置里的 `executionBoundary`）。
- 版本化包消费记录见 [`docs/PACKAGE-CONSUMPTION.md`](docs/PACKAGE-CONSUMPTION.md)（WFB-PACK-001）。

## 已知违规（2026-10-15 实测）
- 600 行门禁：`src/features/axi-resources/AxiResourcesPage.tsx` 719 行**超限**；`src/app-shell/Shell.tsx` 501 行接近阈值；`src/i18n/locales/en-US.ts` 466 行（未超限，关注）。

## 验证
- 最小：`pnpm --filter @axi/devsvc-dashboard typecheck`。
- 壳层 / 注册表 / 配置改动：加 `test` 与 `build`；涉及托管应用时另跑被托管项目自己的验证。
