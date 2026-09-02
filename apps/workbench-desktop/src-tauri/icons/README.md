# macOS 应用图标

`icon.svg` 是 macOS 桌面端应用图标源文件：使用深石墨玻璃底，并嵌入与 Web
端完全一致、由直线切面组成且严格四重旋转对称的 Axi 四色花瓣标记。标记源文件是
`apps/workbench/public/favicon.svg`，其余 PNG、ICNS 文件由 Tauri 从该 SVG 生成。

更新 Web 标记后，运行：

```bash
pnpm --dir apps/workbench-desktop icon
```

不要直接编辑生成的 PNG 或 ICNS 文件；提交前应确认它们仍来自 Web 端四色草源文件。
