# 占位图标

本目录当前为占位资源。`tauri build` 必需 `icons/icon.icns`（macOS）和一组 PNG。
设计资源就位后，运行：

```bash
pnpm --filter @axi/workbench-desktop icon
```

并将生成的 `icon.icns / icon.png / 32x32.png / 128x128.png / 128x128@2x.png` 替换本目录占位文件。