# macOS 应用图标

`icon-source.png` 是 macOS Dock / 应用图标的栅格母版，来自
`apps/workbench/src/assets/brand/ip-as-logo/` 中 `selected.json` 指定的候选。
其余 PNG、ICNS 文件由 Tauri 从该 PNG 生成。

`icon.svg` 仍由 `apps/workbench/public/favicon.svg` 同步，只作为十二色花瓣几何契约母版，不再喂给 `tauri icon`。

更新选中 IP 或 Web 几何标记后，运行：

```bash
pnpm --dir apps/workbench-desktop icon
```

不要直接编辑生成的 PNG 或 ICNS 文件。
