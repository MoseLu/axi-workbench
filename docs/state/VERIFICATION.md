# Axi Workbench Verification

## 2026-08-07 UI shell audit

The user workbench is one multi-end application with an explicit rendering boundary:

- Desktop Web (`viewport >= 768px`): `@axi/shell` Axi Dashboard Chrome, including sidebar, topbar actions, tabs, breadcrumbs, theme switch, and admin settings panel.
- Mobile Web (`viewport < 768px`): independent mobile topbar, page-level settings/theme screens, and bottom navigation; desktop sidebar/chrome is not rendered.

### Commands

```bash
pnpm --filter @axi/workbench type-check
pnpm --filter @axi/workbench test
pnpm --filter @axi/workbench build
node apps/workbench/scripts/verify-ui-contracts.mjs
```

### Browser evidence

- 1440px desktop: Axi Dashboard shell rendered with shared tabs, breadcrumbs, topbar actions, dark/light theme switching, and the settings drawer.
- 500px mobile viewport: mobile shell rendered without desktop sidebar/chrome nodes; mobile theme page switched to dark mode and persisted through `axi.workbench.theme.mode`.
- Console: only React Router v7 future-flag warnings; no runtime exception.
- Network: shared Axi modules and styles returned successfully; no persistent failed request.

The production build still reports the existing non-blocking large-chunk advisory for the dashboard bundle.
