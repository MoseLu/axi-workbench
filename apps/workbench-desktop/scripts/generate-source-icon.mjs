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
  'fill="#A8C9FF"',
  'fill="#FFB3BA"',
  'fill="#FFE6A1"',
  'fill="#A8EBC2"',
  'fill="#A8EAF0"',
  'fill="#D2B7FF"',
]
const requiredGeometry = [
  'd="M16 0.18 C13.55 1.35 11 3.1 10.65 5.3 C10.65 6.7 11.25 7.75 11.85 8.8 L16 16 L20.15 8.8 C20.75 7.75 21.35 6.7 21.35 5.3 C21 3.1 18.45 1.35 16 0.18 Z"',
  'd="M16 2.05 C14.4 3 13.1 4.6 13 6.3 C12.9 8 14 10 15.3 12.4 C15.55 12.9 15.8 13.45 16 13.95 C16.2 13.45 16.45 12.9 16.7 12.4 C18 10 19.1 8 19 6.3 C18.9 4.6 17.6 3 16 2.05 Z"',
  'stroke="#617C96"',
  'stroke="#6B849C"',
  'stroke-opacity="0.92"',
  'stroke-width="0.24"',
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
