// Generate the desktop app-icon SVG from the canonical dango-family PNG.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sourceIconPath = join(__dirname, '..', 'src-tauri', 'icons', 'dango-family.png')
const iconsDir = join(__dirname, '..', 'src-tauri', 'icons')
const desktopIconPath = join(iconsDir, 'icon.svg')

mkdirSync(iconsDir, { recursive: true })

const image = readFileSync(sourceIconPath).toString('base64')
const desktopSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Axi 团子大家族" data-family-layout="grandfather,grandmother;father,baby,mother;young-dango-1,young-dango-2">
  <image href="data:image/png;base64,${image}" x="0" y="0" width="1024" height="1024" preserveAspectRatio="xMidYMid meet" />
</svg>
`

writeFileSync(desktopIconPath, desktopSvg)
console.log(`[icon] synced ${sourceIconPath} -> ${desktopIconPath}`)
