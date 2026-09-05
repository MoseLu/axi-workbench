# Axi Workbench Mac App — M9 应用图标重做

- 时间：2026-09-02
- 平台：macOS 26.6.2 (Build 25G83), Apple Silicon
- 旧图：W 字 + 圆角矩形（早期占位）
- 新图：macOS Big Sur+ 应用图标风格

## 设计原则

占位图不是终稿。仅用于打通打包 + 视觉验证链路。设计原则：
- 圆角矩形 ~22%（macOS Big Sur+ "squircle" 视觉近似）
- 蓝紫渐变 #5B8DEF → #8B5CF6（中性、不抢眼）
- 中央**两个堆叠的圆角方块**代表"工作台窗"
- 顶栏三个圆点（macOS chrome 视觉，告知"工作台"语义）
- 窗内 4 行"内容"（图标 + 文本占位 + 操作点）
- 右侧 3 个控制点（半透明，柔白）
- **不含任何字母、品牌名或可识别 logo**

## 落地

1. `apps/workbench-desktop/scripts/generate-source-icon.mjs` 重写：1024×1024 PNG、纯 Node、不依赖图像库
2. `pnpm exec tauri icon ./src-tauri/icons/icon.png --output ./src-tauri/icons` 重生成全套
3. `pnpm build:desktop:dmg` 重新打包
4. `icon.icns` 90475B（ic13 类型）嵌入 `.app/Contents/Resources/icon.icns`

## 验证

| 项 | 结果 |
| --- | --- |
| `icon.png` 1024×1024 RGBA | ✅ 10271B（压缩后）|
| `icon.icns` Mac OS X icon, "ic13" type | ✅ 90475B |
| 多尺寸 PNG (32x32, 128x128, 128x128@2x, 64x64, ...) | ✅ tauri icon 全套 |
| `.app/Contents/Resources/icon.icns` | ✅ 90475B |
| 启动 + `lsappinfo info $PID` | ✅ bundleID `com.axi.workbench.desktop`, ARM64 Foreground |

## 已知

- **占位终稿**：设计师出图后替换 `src-tauri/icons/icon.png` → 重跑 `pnpm icon` → 重 build
- 该图未做 Retina @3x 高 DPI 适配（小尺寸自动降采样可能糊）—— tauri icon 默认覆盖 32/64/128/128@2x/256/512，足够用