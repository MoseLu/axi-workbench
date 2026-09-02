# macOS 应用图标

`icon.svg` 是桌面端和 Web 端共用的 Axi 四色草标记源文件，内容同步自
`apps/workbench/public/favicon.svg`。其余 PNG、ICNS 文件由 Tauri 从该 SVG 生成。

更新 Web 标记后，运行：

```bash
pnpm --dir apps/workbench-desktop icon
```

不要直接编辑生成的 PNG 或 ICNS 文件；提交前应确认它们仍来自 Web 端四色草源文件。
