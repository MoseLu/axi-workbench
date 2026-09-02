// 生成 1024×1024 占位 icon.png（不依赖任何图像库）。
// 设计：深蓝渐变 + 居中白色"W"字形（暗指 Workbench）。
// 输出路径：src-tauri/icons/icon.png

import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, crc32 } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'src-tauri', 'icons')
mkdirSync(outDir, { recursive: true })

const SIZE = 1024

// RGBA 像素缓冲
const buf = Buffer.alloc(SIZE * SIZE * 4)

function setPx(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
}

// 1) 圆角矩形 + 线性渐变背景
const radius = 200 // 圆角半径
function inRoundedRect(x, y, w, h, r) {
  if (x < r && y < r && (r - x) ** 2 + (r - y) ** 2 > r * r) return false
  if (x > w - r && y < r && (x - (w - r)) ** 2 + (r - y) ** 2 > r * r) return false
  if (x < r && y > h - r && (r - x) ** 2 + (y - (h - r)) ** 2 > r * r) return false
  if (x > w - r && y > h - r && (x - (w - r)) ** 2 + (y - (h - r)) ** 2 > r * r) return false
  return x >= 0 && x < w && y >= 0 && y < h
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    if (!inRoundedRect(x, y, SIZE, SIZE, radius)) {
      setPx(x, y, 0, 0, 0, 0) // 透明背景
      continue
    }
    // 渐变：从顶 #1d4ed8 到 底 #0ea5e9
    const t = y / SIZE
    const r = Math.round(0x1d * (1 - t) + 0x0e * t)
    const g = Math.round(0x4e * (1 - t) + 0xa5 * t)
    const b = Math.round(0xd8 * (1 - t) + 0xe9 * t)
    setPx(x, y, r, g, b, 255)
  }
}

// 2) 居中绘制"W"字形（用矩形条拼接，避免依赖字体）
function fillRect(x0, y0, w, h, r, g, b) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) setPx(x, y, r, g, b, 255)
}

// "W" 由 4 条斜向笔画组成（用梯形近似）
// 中心基准
const cx = SIZE / 2
const wTop = 560 // W 顶部宽度
const wBottom = 560 // W 底部宽度
const wTop2 = 380 // 中间 V 字宽度
const wStroke = 90 // 笔触粗细
const wY = 320 // W 顶部 y
const wH = 460 // W 高度

// 左 1：从左上到中下
function diagonal(x1, y1, x2, y2, thickness) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  const steps = Math.ceil(len)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = Math.round(x1 + (x2 - x1) * t)
    const y = Math.round(y1 + (y2 - y1) * t)
    fillRect(x - thickness / 2, y - thickness / 2, thickness, thickness, 255, 255, 255)
  }
}

const halfTop = wTop / 2
const halfMid = wTop2 / 2
const leftTop = { x: cx - halfTop, y: wY }
const leftBottom = { x: cx - halfMid, y: wY + wH }
const midBottom = { x: cx, y: wY + wH - 80 } // 中间 V 顶点稍上
const rightBottom = { x: cx + halfMid, y: wY + wH }
const rightTop = { x: cx + halfTop, y: wY }

diagonal(leftTop.x, leftTop.y, leftBottom.x, leftBottom.y, wStroke)
diagonal(leftBottom.x, leftBottom.y, midBottom.x, midBottom.y, wStroke)
diagonal(midBottom.x, midBottom.y, rightBottom.x, rightBottom.y, wStroke)
diagonal(rightBottom.x, rightBottom.y, rightTop.x, rightTop.y, wStroke)

// 3) 编码 PNG（RGBA 8-bit）
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
  Buffer.from([8, 6, 0, 0, 0]), // 8-bit depth, RGBA color, no compression/filter/interlace
])

// 过滤字节：每行前面加 0x00 (None)
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0
  buf.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}
const idat = deflateSync(raw, { level: 9 })

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
])

const outPath = join(outDir, 'icon.png')
writeFileSync(outPath, png)
console.log(`[icon] wrote ${outPath} (${png.length} bytes, ${SIZE}x${SIZE})`)