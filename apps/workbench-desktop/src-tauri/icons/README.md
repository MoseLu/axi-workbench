# macOS 应用图标

`icon.svg` 是 macOS 桌面端应用图标源文件：使用透明画布，绘制与 Web 端完全一致、六瓣径向相接且不互相覆盖的内外层圆润轮廓和紧凑弧形花心，并通过清晰黑色双层勾勒形成 Axi 十二色花瓣标记。标记源文件是
`apps/workbench/public/favicon.svg`，其余 PNG、ICNS 文件由 Tauri 从该 SVG 生成。

更新 Web 标记后，运行：

```bash
pnpm --dir apps/workbench-desktop icon
```

不要直接编辑生成的 PNG 或 ICNS 文件；提交前应确认它们仍来自 Web 端十二色花瓣源文件。
