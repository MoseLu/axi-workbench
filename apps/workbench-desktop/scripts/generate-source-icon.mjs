// 生成 1024×1024 应用图标（macOS 应用图标风格，无文字、无品牌）
// 设计：
//   * 大圆角矩形（macOS Big Sur+ squircle 视觉风格，半径 ≈ 22%）
//   * 蓝紫渐变背景（#5B8DEF → #8B5CF6）
//   * 中央两个堆叠的圆角方块代表"工作台窗"
//   * 右侧三个点代表"控制/通知"
// 不含任何字母、品牌名或可识别 logo，仅作为占位设计稿；最终出图由设计师提供。

import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, crc32 } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'src-tauri', 'icons')
mkdirSync(outDir, { recursive: true })

const SIZE = 1024
const buf = Buffer.alloc(SIZE * SIZE * 4)

function setPx(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
}

/**
 * macOS Big Sur+ 应用图标圆角矩形（squircle 视觉近似）。
 * 用四角扇形 + 主体矩形掩码，避开 iOS-style superellipse 公式但视觉接近。
 */
function inSquircle(x, y, w, h, r) {
  if (x < 0 || x >= w || y < 0 || y >= h) return false
  if (x < r && y < r && (r - x) ** 2 + (r - y) ** 2 > r * r) return false
  if (x > w - r && y < r && (x - (w - r)) ** 2 + (r - y) ** 2 > r * r) return false
  if (x < r && y > h - r && (r - x) ** 2 + (y - (h - r)) ** 2 > r * r) return false
  if (x > w - r && y > h - r && (x - (w - r)) ** 2 + (y - (h - r)) ** 2 > r * r) return false
  return true
}

function fillRect(x0, y0, w, h, r, g, b, a = 255) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) setPx(x, y, r, g, b, a)
}

/* ---------- 1) 圆角矩形背景 + 渐变 ---------- */
const RADIUS = Math.round(SIZE * 0.225) // ~230px
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    if (!inSquircle(x, y, SIZE, SIZE, RADIUS)) {
      setPx(x, y, 0, 0, 0, 0)
      continue
    }
    // 蓝紫渐变：从 #5B8DEF (91, 141, 239) 顶部 → #8B5CF6 (139, 92, 246) 底部
    const t = y / SIZE
    const tr = Math.round(0x5B * (1 - t) + 0x8B * t)
    const tg = Math.round(0x8D * (1 - t) + 0x5C * t)
    const tb = Math.round(0xEF * (1 - t) + 0xF6 * t)
    setPx(x, y, tr, tg, tb, 255)
  }
}

/* ---------- 2) 中央"工作台窗"双层堆叠 ---------- */
// 后面的小窗（淡色）：左下偏移
function roundedRect(x, y, w, h, radius, r, g, b, a) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (inSquircle(xx - x, yy - y, w, h, radius)) setPx(xx, yy, r, g, b, a)
    }
  }
}

const W1 = 460
const H1 = 360
const W2 = 460
const H2 = 360
const RAD = 36

// 后窗（淡色 + 阴影感）
roundedRect(280 + 40, 320 + 40, W1, H1, RAD, 255, 255, 255, 70)
// 前窗（亮色）
roundedRect(280, 320, W2, H2, RAD, 255, 255, 255, 235)

// 顶栏色条：前窗顶部 12px
fillRect(280, 320, W2, 12, 0xFF, 0xFF, 0xFF, 235)
// 红黄绿三个圆点（macOS chrome 视觉，告知"工作台"语义）
function fillCircle(cx, cy, radius, r, g, b, a) {
  for (let yy = -radius; yy <= radius; yy++)
    for (let xx = -radius; xx <= radius; xx++)
      if (xx * xx + yy * yy <= radius * radius) setPx(cx + xx, cy + yy, r, g, b, a)
}
fillCircle(310, 336, 9, 0xFF, 0x5F, 0x57, 255)   // 红
fillCircle(340, 336, 9, 0xFE, 0xBC, 0x2E, 255)   // 黄
fillCircle(370, 336, 9, 0x28, 0xC8, 0x40, 255)   // 绿

/* ---------- 3) 窗内"内容" 抽象行（代表文档/任务列表） ---------- */
for (let i = 0; i < 4; i++) {
  const yLine = 380 + i * 56
  // 左侧圆点（图标占位）
  fillCircle(320, yLine + 16, 8, 0x8B, 0x5C, 0xF6, 255)
  // 中间一行短矩形（文本占位）
  fillRect(346, yLine + 8, 240 - i * 24, 16, 0xC4, 0xC9, 0xD4, 255)
  // 右侧小圆点（操作/状态）
  fillCircle(680, yLine + 16, 6, 0xE5, 0xE7, 0xEB, 255)
}

/* ---------- 4) 右侧三个"控制点"（代表通知/工具） ---------- */
// 在前窗右侧外部排成竖列，柔白色半透明
for (let i = 0; i < 3; i++) {
  const cy = 400 + i * 100
  fillCircle(800, cy, 22, 255, 255, 255, 200)
  // 内圈小点
  fillCircle(800, cy, 8, 91 + i * 20, 141 - i * 10, 239 - i * 30, 255)
}

/* ---------- 5) 编码 PNG ---------- */
function be32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n, 0); return b }
function chunk(type, data) {
  const len = be32(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = be32(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const ihdr = Buffer.concat([
  be32(SIZE), be32(SIZE),
  Buffer.from([8, 6, 0, 0, 0]),
])
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0
  buf.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}
const idat = deflateSync(raw, { level: 9 })
const png = Buffer.concat([
  sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
])

const outPath = join(outDir, 'icon.png')
writeFileSync(outPath, png)
console.log(`[icon] wrote ${outPath} (${png.length} bytes, ${SIZE}x${SIZE}, macOS app icon style)`)