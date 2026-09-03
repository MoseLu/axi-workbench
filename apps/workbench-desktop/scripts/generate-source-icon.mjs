// Wrap the Web six-color rounded petal-and-hub mark in a center-symmetric desktop app-icon treatment before rasterization.

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
  'fill="#5FD9E8"',
  'fill="#B88CFF"',
]
const requiredGeometry = [
  'd="M16 0.35 C14 1.25 12 3.15 11.45 5.65 C10.75 8.75 12.55 11.85 15.1 13.5',
  'd="M16 2.5 C14.7 3.25 13.55 4.65 13.1 6.45 C12.6 8.55 13.9 10.95 15.35 12.55',
  'transform="rotate(60 16 16)"',
  'transform="rotate(120 16 16)"',
  'transform="rotate(180 16 16)"',
  'transform="rotate(240 16 16)"',
  'transform="rotate(300 16 16)"',
  '<circle cx="16" cy="16" r="2.6"',
]

if (
  requiredMarks.some((mark) => !svg.includes(mark)) ||
  requiredGeometry.some((path) => !svg.includes(path))
) {
  throw new Error(`[icon] Web favicon is not the expected symmetric six-color Axi mark: ${webIconPath}`)
}

const mark = svg
  .replace(/^<svg\b[^>]*>/, '')
  .replace(/<\/svg>$/, '')
  .trim()

const desktopSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="axi-icon-bg" cx="50%" cy="50%" r="72%">
      <stop offset="0" stop-color="#35445A"/>
      <stop offset="0.58" stop-color="#1D2939"/>
      <stop offset="1" stop-color="#0D121A"/>
    </radialGradient>
  </defs>
  <rect x="12" y="12" width="1000" height="1000" rx="260" fill="#090D13"/>
  <rect x="30" y="30" width="964" height="964" rx="242" fill="url(#axi-icon-bg)"/>
  <rect x="38" y="38" width="948" height="948" rx="234" fill="none" stroke="#AFC2DE" stroke-opacity="0.18" stroke-width="12"/>
  <g transform="translate(512 512) scale(30) translate(-16 -16)">
    ${mark}
  </g>
</svg>
`

writeFileSync(desktopIconPath, desktopSvg)
console.log(`[icon] synced ${webIconPath} -> ${desktopIconPath}`)
