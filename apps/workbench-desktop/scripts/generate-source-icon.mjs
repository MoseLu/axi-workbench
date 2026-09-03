// Scale the Web six-color rounded petal-and-hub mark into a transparent desktop app-icon canvas.

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
  'fill="#7FB5FF"',
  'fill="#FF929D"',
  'fill="#FFE07A"',
  'fill="#79E6A4"',
  'fill="#70E0EE"',
  'fill="#C39AFF"',
]
const requiredGeometry = [
  'd="M16 16 L9.95 5.55 C10.75 2.65 13.03 0.6 16 0.42 C18.97 0.6 21.25 2.65 22.05 5.55 Z"',
  'd="M16 14.85 L12.55 7.2 C13.1 4.8 14.35 2.75 16 1.85 C17.65 2.75 18.9 4.8 19.45 7.2 Z"',
  'stroke="#21364F"',
  'stroke="#274968"',
  'stroke-opacity="0.9"',
  'stroke-width="0.26"',
  'transform="rotate(60 16 16)"',
  'transform="rotate(120 16 16)"',
  'transform="rotate(180 16 16)"',
  'transform="rotate(240 16 16)"',
  'transform="rotate(300 16 16)"',
  '<circle cx="16" cy="16" r="2.48"',
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

const desktopSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none">
  <g transform="translate(512 512) scale(31) translate(-16 -16)">
    ${mark}
  </g>
</svg>
`

writeFileSync(desktopIconPath, desktopSvg)
console.log(`[icon] synced ${webIconPath} -> ${desktopIconPath}`)
