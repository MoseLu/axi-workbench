# Axi Workbench Verification

## 2026-08-07 Web / mobile application split

The user workbench is two independently runnable applications with an explicit ownership boundary:

- Web admin (`apps/workbench`, `http://127.0.0.1:5173`): `@axi/shell` Axi Dashboard Chrome, including sidebar, topbar actions, tabs, breadcrumbs, theme switch, and admin settings panel.
- Mobile app (`apps/workbench-mobile`, `http://127.0.0.1:5174`): its own Vite entry, header, tab bar, login surface, and mobile page composition. It does not import the Web application shell.
- Shared scope: `@axi/workbench-foundation` owns auth-session behavior and locale preference; API/contracts/tokens remain package contracts. No page, route, or layout is shared across the two applications.

### Commands

```bash
pnpm --filter @axi/workbench type-check
pnpm --filter @axi/workbench test
pnpm --filter @axi/workbench build
node apps/workbench/scripts/verify-ui-contracts.mjs
pnpm --filter @axi/workbench-foundation type-check
pnpm --filter @axi/workbench-mobile type-check
pnpm --filter @axi/workbench-mobile test
pnpm --filter @axi/workbench-mobile build
pnpm --filter @axi/workbench-mobile verify:contracts
pnpm check:boundaries
```

### Browser evidence

- In the Codex built-in browser, `:5173/admin/me` rendered `.axi-sidebar`, `.axi-topbar`, `.axi-tabbar`, and `.axi-breadcrumb-bar`; neither `.wb-mobile-shell` nor `.axi-mobile-tabbar` existed in the Web DOM.
- In the Codex built-in browser, `:5174/home` rendered `.axi-mobile-app`, `.wb-mobile-topbar`, and `.wb-bottom-nav`, with exactly five labels (`概览 / 项目 / 工作区 / 扫一扫 / 我的`) and no Web dashboard or breadcrumb nodes. The centered topbar opened its plus menu, and selecting `扫一扫` navigated to `/scan` with the mobile scan frame and active scan tab; console errors were empty.
- Production builds passed for both applications. The Web build retains its pre-existing large-chunk advisory; the mobile build has the same non-blocking Rollup advisory.

The production build still reports the existing non-blocking large-chunk advisory for the dashboard bundle.
