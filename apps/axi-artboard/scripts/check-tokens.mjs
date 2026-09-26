#!/usr/bin/env node
// scripts/check-tokens.mjs — guard against three-source design-token drift.
//
// Source of truth (each must agree on the SAME keys):
//   - src/styles/abstracts/_variables.scss   (Sass $vars)
//   - src/styles/tailwind.css                 (@theme block, --color-pin etc.)
//   - src/styles/base/_root-vars.scss         (:root block, --pin etc.)
//
// What's compared:
//   - palette  : scss value ↔ tailwind value (color hex, normalized)
//                scss key set == tailwind key set == :root key set
//                :root value is always #{v.$xxx} so not byte-compared.
//   - font     : keys aligned on all three sides (value stacks contain
//                single-vs-double quotes that vary by Sass/CSS dialect).
//   - radius   : scss value ↔ tailwind value (px, whitespace-insensitive)
//                keys aligned on :root side too.
//
// Exit code: 0 = aligned, 1 = drift.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SRC = {
  scss: resolve(ROOT, 'src/styles/abstracts/_variables.scss'),
  tw: resolve(ROOT, 'src/styles/tailwind.css'),
  twConfig: resolve(ROOT, 'tailwind.config.js'),
  cssvars: resolve(ROOT, 'src/styles/base/_root-vars.scss'),
}

// ─── extractors ─────────────────────────────────────────────────

// Extract `$name: value;` declarations (single line or multi-line until
// matching closing brace / paren, terminated by `;`). Comments skipped.
function extractSassVars(text) {
  const out = new Map()
  // Strip // line comments first to keep regex simple.
  const stripped = text
    .split(/\r?\n/)
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
  // Walk character stream: find `$name:` then accumulate until `;` not in `()`/`[]`/`{}`.
  let i = 0
  while (i < stripped.length) {
    const ch = stripped[i]
    if (ch !== '$') { i++; continue }
    let j = i + 1
    while (j < stripped.length && /[a-zA-Z0-9_-]/.test(stripped[j])) j++
    const name = stripped.slice(i + 1, j)
    if (!name) { i = j; continue }
    // Skip whitespace.
    while (j < stripped.length && /\s/.test(stripped[j])) j++
    if (stripped[j] !== ':') { i = j; continue }
    j++
    while (j < stripped.length && /\s/.test(stripped[j])) j++
    let depth = 0
    let inSassInterp = false
    const startVal = j
    while (j < stripped.length) {
      const c = stripped[j]
      const n = stripped[j + 1]
      if (!inSassInterp && c === '#' && n === '{') {
        inSassInterp = true
        j += 2
        continue
      }
      if (inSassInterp) {
        if (c === '}') inSassInterp = false
        j++
        continue
      }
      if (c === '(' || c === '[' || c === '{') depth++
      else if (c === ')' || c === ']' || c === '}') depth--
      if (depth === 0 && c === ';') break
      j++
    }
    const value = stripped.slice(startVal, j).trim()
    out.set(name, value)
    i = j + 1
  }
  return out
}

// Extract declarations from a CSS/SCSS block `{ ... }` of a given selector
// pattern. Returns Map of normalized key → raw value string.
// Tailwind @theme keys carry a `--color-` prefix that :root keys don't;
// the caller decides whether to strip it for cross-source comparison.
function extractCssBlock(text, selectorPattern) {
  // Brace-counting find: locate `selector {`, then walk forward counting
  // `{`/`}` until depth returns to 0. Works for blocks that contain nested
  // expressions or sass interpolation.
  const headRe = new RegExp(`${selectorPattern}\\s*\\{`, 'm')
  const head = text.match(headRe)
  if (!head) return new Map()
  const start = head.index + head[0].length
  let depth = 1
  let i = start
  let inSassInterp = false
  while (i < text.length && depth > 0) {
    const c = text[i]
    const n = text[i + 1]
    if (!inSassInterp && c === '#' && n === '{') {
      inSassInterp = true
      i += 2
      continue
    }
    if (inSassInterp) {
      if (c === '}') inSassInterp = false
      i++
      continue
    }
    if (c === '{') depth++
    else if (c === '}') depth--
    i++
  }
  if (depth !== 0) return new Map()
  const body = text.slice(start, i - 1)
  const out = new Map()
  // Strip /* ... */ block comments.
  const cleaned = body.replace(/\/\*[\s\S]*?\*\//g, '')
  // Strip // line comments (sass inside .scss files).
  const cleaned2 = cleaned
    .split(/\r?\n/)
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
  // Walk declaration stream.
  let ii = 0
  while (ii < cleaned2.length) {
    if (cleaned2[ii] !== '-' || cleaned2[ii + 1] !== '-') { ii++; continue }
    let j = ii + 2
    while (j < cleaned2.length && /[a-zA-Z0-9_-]/.test(cleaned2[j])) j++
    const rawKey = cleaned2.slice(ii, j)
    while (j < cleaned2.length && /\s/.test(cleaned2[j])) j++
    if (cleaned2[j] !== ':') { ii = j; continue }
    j++
    while (j < cleaned2.length && /\s/.test(cleaned2[j])) j++
    let depth = 0
    let inSassInterp = false
    const startVal = j
    while (j < cleaned2.length) {
      const c = cleaned2[j]
      const n = cleaned2[j + 1]
      // Sass interpolation #{ ... }: open on `#{`, close on matching `}`.
      if (!inSassInterp && c === '#' && n === '{') {
        inSassInterp = true
        j += 2
        continue
      }
      if (inSassInterp) {
        if (c === '}') inSassInterp = false
        j++
        continue
      }
      if (c === '(' || c === '[') depth++
      else if (c === ')' || c === ']') depth--
      if (depth === 0 && c === ';') break
      j++
    }
    const value = cleaned2.slice(startVal, j).trim()
    out.set(rawKey, value)
    ii = j + 1
  }
  return out
}

// ─── value normalizers ──────────────────────────────────────────

function normColor(v) {
  // Lowercase hex, drop whitespace; rgba(...) normalized too.
  return v
    .trim()
    .replace(/\s+/g, '')
    .replace(/^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/i, '#$1$2$3') // #fff → #ffffff
    .toLowerCase()
}

function normPx(v) {
  // "10 px" → "10px"; "10.5px" stays.
  return v.replace(/\s+/g, '')
}

// ─── catalog ────────────────────────────────────────────────────

// Each token has a short `scss` name and per-source key names. :root keys
// are unprefixed; Tailwind @theme keys carry a category prefix.
const CATEGORIES = {
  palette: {
    tokens: [
      ['ink-0','ink-0','ink-0'],
      ['ink-1','ink-1','ink-1'],
      ['ink-2','ink-2','ink-2'],
      ['ink-3','ink-3','ink-3'],
      ['rule-1','rule-1','rule-1'],
      ['rule-2','rule-2','rule-2'],
      ['rule-3','rule-3','rule-3'],
      ['bone','bone','bone'],
      ['bone-soft','bone-soft','bone-soft'],
      ['ink-text','ink-text','ink-text'],
      ['ink-mute','ink-mute','ink-mute'],
      ['ink-dim','ink-dim','ink-dim'],
      ['pin','pin','pin'],
      ['pin-soft','pin-soft','pin-soft'],
      ['pin-ghost','pin-ghost','pin-ghost'],
      ['coral','coral','coral'],
      ['amber','amber','amber'],
      ['steel','steel','steel'],
      ['steel-soft','steel-soft','steel-soft'],
    ].map(([scss, tw, root]) => ({ scss, tw: `--color-${tw}`, root: `--${root}` })),
  },
  font: {
    // scss $font-display / tw --font-display / :root --font-display
    tokens: [
      { scss: 'font-display', tw: '--font-display', root: '--font-display' },
      { scss: 'font-mono', tw: '--font-mono', root: '--font-mono' },
    ],
  },
  radius: {
    // scss $r-sm / tw --radius-sm / :root --r-sm
    tokens: [
      { scss: 'r-sm', tw: '--radius-sm', root: '--r-sm' },
      { scss: 'r-md', tw: '--radius-md', root: '--r-md' },
      { scss: 'r-lg', tw: '--radius-lg', root: '--r-lg' },
    ],
  },
}

// ─── comparator ─────────────────────────────────────────────────

function check(category) {
  const missing = []
  const mismatched = []
  const cat = CATEGORIES[category]
  for (const t of cat.tokens) {
    const sVal = scss.get(t.scss) ?? null
    const tVal = tw.get(t.tw) ?? null
    const cVal = cssvars.get(t.root) ?? null
    const onS = sVal != null
    const onT = tVal != null
    const onC = cVal != null
    if (!(onS && onT && onC)) {
      const missingOn = []
      if (!onS) missingOn.push('scss')
      if (!onT) missingOn.push('tailwind')
      if (!onC) missingOn.push(':root')
      missing.push({ key: t.scss, missingOn })
      continue
    }
    // For Tailwind v3 the extracted `tVal` is the token NAME, not the
    // colour/px value (we read it from tailwind.config.js, which only
    // declares the key). Skip the value-vs-value comparison in that
    // case — key-set parity is enough.
    const twHasValue = /^(#[0-9a-fA-F]|rgba?\(|hsl)/.test(tVal) || /\d+(?:\.\d+)?(?:px|rem|em)\b/.test(tVal)
    if (category === 'palette' && twHasValue) {
      const ns = normColor(sVal), nt = normColor(tVal)
      if (ns !== nt) mismatched.push({ key: t.scss, scope: 'scss↔tailwind', scss: sVal, tw: tVal })
    } else if (category === 'radius' && twHasValue) {
      const ns = normPx(sVal), nt = normPx(tVal)
      if (ns !== nt) mismatched.push({ key: t.scss, scope: 'scss↔tailwind', scss: sVal, tw: tVal })
    }
    // font category: key set compared above; values intentionally skipped.
  }
  return { missing, mismatched }
}

function fmt(v) {
  if (v == null) return '(absent)'
  return v.length > 60 ? v.slice(0, 57) + '...' : v
}

function report(name, d) {
  if (!d.missing.length && !d.mismatched.length) return false
  for (const m of d.missing) {
    console.error(`  ✗ [${name}] ${m.key} missing on: ${m.missingOn.join(', ')}`)
  }
  for (const m of d.mismatched) {
    console.error(`  ✗ [${name}] ${m.key} (${m.scope})`)
    console.error(`      scss      = ${fmt(m.scss)}`)
    console.error(`      tailwind  = ${fmt(m.tw)}`)
  }
  return true
}

// ─── main ───────────────────────────────────────────────────────

const [scssText, twText, twConfigText, cssvarsText] = await Promise.all([
  readFile(SRC.scss, 'utf8'),
  readFile(SRC.tw, 'utf8'),
  readFile(SRC.twConfig, 'utf8'),
  readFile(SRC.cssvars, 'utf8'),
])

const scss = extractSassVars(scssText)
const cssvars = extractCssBlock(cssvarsText, ':root')

/**
 * Token extractor with two modes:
 *  - Tailwind v4: parse the @theme block inside `src/styles/tailwind.css`
 *    (CSS-first config).
 *  - Tailwind v3: parse the JS-style theme.extend block inside
 *    `tailwind.config.js`. We look for the simple shape
 *    `theme: { extend: { colors: { <name>: 'var(--color-<name>)' } } }`
 *    and project it back to the `--color-<name>` keys for the same
 *    comparator surface.
 */
const tw = (() => {
  const v4 = extractCssBlock(twText, '@theme')
  if (v4.size > 0) return v4

  const out = new Map()
  // Find `colors: { ... }` inside theme.extend.
  const colorsMatch = twConfigText.match(/colors:\s*\{([\s\S]*?)\n\s*\}/m)
  if (!colorsMatch) return out
  const block = colorsMatch[1]
  // Each line is `name: 'var(--color-name)'[,]?`.
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^\s*([a-zA-Z0-9_-]+)\s*:\s*['"]var\(--([a-zA-Z0-9_-]+)\)['"]/)
    if (m) {
      // m[1] = short name (e.g. "ink"); m[2] = token name (e.g. "color-ink-0")
      out.set(`--${m[2]}`, m[2])
    }
  }
  // Also surface font + radius as single-name keys.
  const fontMatch = twConfigText.match(/fontFamily:\s*\{([\s\S]*?)\n\s{4}\}/m)
  if (fontMatch) {
    for (const line of fontMatch[1].split(/\r?\n/)) {
      const m = line.match(/^\s*([a-zA-Z0-9_-]+)\s*:/)
      if (m) out.set(`--font-${m[1]}`, m[1])
    }
  }
  const radiusMatch = twConfigText.match(/borderRadius:\s*\{([\s\S]*?)\n\s{4}\}/m)
  if (radiusMatch) {
    for (const line of radiusMatch[1].split(/\r?\n/)) {
      const m = line.match(/^\s*([a-zA-Z0-9_-]+)\s*:/)
      if (m) out.set(`--radius-${m[1]}`, m[1])
    }
  }
  return out
})()

console.log(
  `tokens: scss=${scss.size}, tailwind@theme=${tw.size}, :root=${cssvars.size}`
)

let drifted = false
for (const [cat, name] of [['palette', 'palette'], ['font', 'font'], ['radius', 'radius']]) {
  const d = check(cat)
  const ok = !d.missing.length && !d.mismatched.length
  console.log(`${cat}: ${ok ? 'aligned' : 'drift'}`)
  drifted = report(name, d) || drifted
}

if (drifted) {
  console.error(
    '\n✗ design-token drift detected across _variables.scss / tailwind.css @theme / _root-vars.scss :root'
  )
  process.exit(1)
}
console.log('✓ design tokens aligned across all three sources')