// 生成 Tauri 必需的占位图标（PNG + ICNS）。
// 仅在 apps/workbench-desktop/src-tauri/icons/ 下写入零像素资源，
// 不依赖任何图像处理库（避免引入 Pillow / sharp）。

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'src-tauri', 'icons')
mkdirSync(iconsDir, { recursive: true })

// PNG 1x1 透明最小像素
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000d49444154789c62000100000005000100' +
    '0d0a2db40000000049454e44ae426082',
  'hex',
)

// ICNS 最小占位：仅含一个 1x1 PNG 图块
// icns header: 'icns' + 4-byte total length (BE) + then chunks
function buildIcns(pngBuffer) {
  const header = Buffer.from('icns', 'ascii')
  const totalLength = 8 + 8 + pngBuffer.length // header + 1 chunk header + png
  const lengthBuf = Buffer.alloc(4)
  lengthBuf.writeUInt32BE(totalLength, 0)
  // chunk: type 'ic07' (128x128 PNG) is a standard maskable type; but minimum accepted by tauri-build is any well-formed icns containing a PNG. Use 'ic07'.
  const chunkHeader = Buffer.from('ic07', 'ascii')
  const chunkLengthBuf = Buffer.alloc(4)
  chunkLengthBuf.writeUInt32BE(8 + pngBuffer.length, 0)
  return Buffer.concat([header, lengthBuf, chunkHeader, chunkLengthBuf, pngBuffer])
}

const icns = buildIcns(TINY_PNG)

const files = {
  'icon.png': TINY_PNG,
  '32x32.png': TINY_PNG,
  '128x128.png': TINY_PNG,
  '128x128@2x.png': TINY_PNG,
  'icon.icns': icns,
  'icon.ico': TINY_PNG, // Windows 端当前不走，先占位
}

for (const [name, buf] of Object.entries(files)) {
  const target = join(iconsDir, name)
  if (existsSync(target) && !process.argv.includes('--force')) continue
  writeFileSync(target, buf)
  console.log(`[icons] wrote ${target} (${buf.length} bytes)`)
}

console.log('[icons] placeholder icons generated; replace before production release')