// Sync the Web product mark into the desktop icon source before rasterization.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webIconPath = join(__dirname, '..', '..', 'workbench', 'public', 'favicon.svg')
const iconsDir = join(__dirname, '..', 'src-tauri', 'icons')
const desktopIconPath = join(iconsDir, 'icon.svg')

mkdirSync(iconsDir, { recursive: true })

const svg = readFileSync(webIconPath, 'utf8').trim()
const requiredMarks = [
  'viewBox="0 0 32 32"',
  'fill="#72A7FF"',
  'fill="#FF7B84"',
  'fill="#FFD166"',
  'fill="#67D891"',
]

if (requiredMarks.some((mark) => !svg.includes(mark))) {
  throw new Error(`[icon] Web favicon is not the expected four-color Axi mark: ${webIconPath}`)
}

writeFileSync(desktopIconPath, `${svg}\n`)
console.log(`[icon] synced ${webIconPath} -> ${desktopIconPath}`)
