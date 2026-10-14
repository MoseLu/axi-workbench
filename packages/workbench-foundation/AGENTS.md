# `@axi/workbench-foundation` — 子项目 AGENTS

> 本文件管辖 `/Volumes/code/workspace/workbench/axi-workbench/packages/workbench-foundation`。
> 父级 [`packages/AGENTS.md`](../AGENTS.md) 与仓库根 [`AGENTS.md`](../../AGENTS.md) 仍然适用。
> 定位：独立 Web / 移动端的**认证会话与语言偏好基础包**；不包含任何页面或布局。

## 入口与子模块
- 入口：`src/index.ts`（barrel）；子路径导出：`./auth`、`./icons`、`./locale`、`./shell-contracts`。
- `src/auth.tsx` — `AuthProvider` / `useAuth` / `resolveGatewayURL`；邮箱验证码登录、会话查询（`GatewaySessionResponse` 形状）。
- `src/locale.tsx` — `WorkbenchLocaleProvider` / `useWorkbenchLocale` / `WORKBENCH_LOCALE_STORAGE_KEY`。
- `src/notifications.ts` — 通知拉取 / 已读 API、`NOTIFICATIONS_CHANGED_EVENT`、`NotificationApiError`。
- `src/home.ts` — Home 页项目过滤；`src/username.ts` — 用户名生成 / 校验；`src/icons.ts` — 图标映射；`src/shell-contracts.ts` — 壳层契约类型。
- 测试与源码同目录（`*.test.ts(x)`，由包内 `vitest.config.ts` 驱动）。

## 关键命令
```bash
pnpm --filter @axi/workbench-foundation type-check   # tsc --noEmit（没有 typecheck 别名）
pnpm --filter @axi/workbench-foundation build        # tsc
pnpm --filter @axi/workbench-foundation lint
# 本包没有 test script；测试通过 vitest（包内 vitest.config.ts）
```

## 依赖关系
- 依赖：`@axi/core`（跨仓，`foundation/axi-ui`）、`@axi/workstation-contracts`（本仓 `packages/schemas`）。
- peer：React 19、`@tanstack/react-query` 5。
- 消费者：`apps/workbench`（Web）与 `apps/workbench-mobile`（移动）。改动 `AuthProvider` / `resolveGatewayURL` / locale 会同时影响两端会话与语言偏好，属**跨端契约**；改前跑两端 type-check。
- 会话后端依赖 `identity-adapter` (8081) 与 `api-gateway` (8088) 的 session 端点。

## 已知违规
- 无：最大文件 `src/auth.tsx` 351 行，全部低于 600 行门禁（2026-10-15 实测）。

## 验证
- 最小：`pnpm --filter @axi/workbench-foundation type-check`。
- 会话 / 通知 / locale 行为改动：加 `build` 与对应 `*.test.ts(x)`；跨端影响时加 `pnpm --filter @axi/workbench type-check` 与 `pnpm --filter @axi/workbench-mobile type-check`。
