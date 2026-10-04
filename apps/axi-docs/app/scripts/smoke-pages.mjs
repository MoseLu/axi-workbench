#!/usr/bin/env node
/**
 * Smoke check for documentation detail pages.
 *
 * Walks /generated/knowledge/manifest.json, pulls each source bundle, samples
 * up to N documents per source, and probes each detail URL with plain fetch
 * (no headless browser required). Detects the failure markers that the React
 * app renders when it cannot load a document: "文件加载失败" / "无法加载".
 *
 * Note: this is a Vite SPA, so the served HTML for any /docs/... URL is the
 * shared shell. The error strings are produced client-side after the bundle
 * fetch resolves. This script therefore treats a page as passing when both
 * the SPA shell and the corresponding bundle.json are reachable AND the
 * bundle actually carries the document's content; failures or hard-coded
 * error markers in the response body flip a page to "failed".
 *
 * Usage:
 *   node scripts/smoke-pages.mjs [--base http://127.0.0.1:3005] [--locale zh] [--per-source 3]
 */

import process from 'node:process'

const DEFAULT_BASE = 'http://127.0.0.1:3005'
const DEFAULT_LOCALE = 'zh'
const DEFAULT_PER_SOURCE = 3

const FAILURE_MARKERS = ['文件加载失败', '无法加载']

function parseArgs(argv) {
  const args = {
    base: DEFAULT_BASE,
    locale: DEFAULT_LOCALE,
    perSource: DEFAULT_PER_SOURCE,
  }
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--base' || token === '-b') {
      args.base = argv[++i] ?? args.base
    } else if (token === '--locale' || token === '-l') {
      args.locale = argv[++i] ?? args.locale
    } else if (token === '--per-source' || token === '-n') {
      const value = Number(argv[++i])
      args.perSource = Number.isFinite(value) && value > 0 ? value : DEFAULT_PER_SOURCE
    } else if (token === '--help' || token === '-h') {
      printHelp()
      process.exit(0)
    } else {
      console.warn(`[smoke-pages] unknown argument: ${token}`)
    }
  }
  args.base = args.base.replace(/\/+$/u, '')
  return args
}

function printHelp() {
  console.log(`Usage: node scripts/smoke-pages.mjs [options]

Options:
  --base, -b <url>     Base URL of the running app (default ${DEFAULT_BASE})
  --locale, -l <code>  Locale code (default ${DEFAULT_LOCALE})
  --per-source, -n <n> Sample at most N documents per source (default ${DEFAULT_PER_SOURCE})
  --help, -h           Show this help
`)
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`)
  }
  return response.json()
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { accept: 'text/html,*/*' } })
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    body: await response.text(),
  }
}

/** Mirror of buildDocumentRoute in src/lib/routes.ts */
function buildDocumentUrl(base, sourceId, documentPath) {
  const encodedSource = encodeURIComponent(sourceId)
  const stripped = documentPath.replace(/\.md$/u, '')
  const encodedPath = stripped
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${base}/docs/${encodedSource}/${encodedPath}`
}

function buildBundleUrl(base, sourceId) {
  return `${base}/generated/knowledge/sources/${encodeURIComponent(sourceId)}/bundle.json`
}

function buildManifestUrl(base) {
  return `${base}/generated/knowledge/manifest.json`
}

function sampleDocuments(documents, limit) {
  if (!Array.isArray(documents) || documents.length === 0) return []
  if (documents.length <= limit) return documents.slice()
  const stride = documents.length / limit
  const sampled = []
  for (let i = 0; i < limit; i++) {
    const index = Math.min(documents.length - 1, Math.floor(i * stride))
    sampled.push(documents[index])
  }
  return sampled
}

function detectFailureMarkers(text) {
  return FAILURE_MARKERS.filter((marker) => text.includes(marker))
}

async function checkDocument({ base, locale, document, bundleOk, bundleCache }) {
  const url = buildDocumentUrl(base, document.sourceId, document.path)
  const issues = []

  if (!bundleOk) {
    issues.push(`bundle not loaded for source ${document.sourceId}`)
  } else if (!bundleCache.has(document.path)) {
    issues.push(`document "${document.path}" missing from bundle`)
  }

  let pageResult = null
  try {
    pageResult = await fetchText(url)
  } catch (error) {
    issues.push(`page request failed: ${error.message}`)
    return { url, document, ok: false, issues }
  }

  if (!pageResult.ok) {
    issues.push(`page returned HTTP ${pageResult.status}`)
  } else if (!pageResult.contentType.includes('text/html')) {
    issues.push(`page content-type was ${pageResult.contentType || 'unknown'}`)
  } else {
    const markers = detectFailureMarkers(pageResult.body)
    if (markers.length > 0) {
      issues.push(`failure markers found in response: ${markers.join(', ')}`)
    }
  }

  return { url, document, ok: issues.length === 0, issues }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const manifestUrl = buildManifestUrl(args.base)
  console.log(`Smoke check against ${args.base} (locale=${args.locale})`)

  let manifest
  try {
    manifest = await fetchJson(manifestUrl)
  } catch (error) {
    console.error(`[smoke-pages] failed to load manifest: ${error.message}`)
    process.exit(2)
  }

  const sources = Array.isArray(manifest.sources) ? manifest.sources : []
  console.log(`- ${sources.length} sources scanned`)

  let totalDocuments = 0
  let totalSampled = 0
  let passed = 0
  let failed = 0
  let skipped = 0
  const failures = []

  for (const source of sources) {
    const sourceId = source?.id
    if (!sourceId) {
      skipped += 1
      continue
    }

    let bundleOk = false
    let bundle = null
    let bundleCache = new Map()
    try {
      bundle = await fetchJson(buildBundleUrl(args.base, sourceId))
      bundleOk = true
    } catch (error) {
      console.warn(`[smoke-pages] bundle fetch failed for ${sourceId}: ${error.message}`)
      bundle = null
    }

    const documents = bundleOk && bundle && Array.isArray(bundle.documents) ? bundle.documents : []
    totalDocuments += documents.length
    const sampled = sampleDocuments(documents, args.perSource)
    totalSampled += sampled.length

    if (sampled.length === 0) {
      skipped += 1
      continue
    }

    if (bundleOk && bundle) {
      for (const doc of sampled) {
        if (doc && typeof doc.path === 'string') {
          bundleCache.set(doc.path, doc)
        }
      }
    }

    for (const doc of sampled) {
      const result = await checkDocument({
        base: args.base,
        locale: args.locale,
        document: doc,
        bundleOk,
        bundleCache,
      })
      if (result.ok) {
        passed += 1
      } else {
        failed += 1
        failures.push(result)
      }
    }
  }

  console.log(`- ${totalDocuments} documents found, ${totalSampled} sampled`)
  console.log(`- ${passed} passed, ${failed} failed`)

  if (failures.length > 0) {
    console.error('\nFailed pages:')
    for (const failure of failures) {
      console.error(`  ${failure.url}`)
      for (const issue of failure.issues) {
        console.error(`    - ${issue}`)
      }
    }
    process.exit(1)
  }
  process.exit(0)
}

main().catch((error) => {
  console.error(`[smoke-pages] unexpected error: ${error.stack ?? error.message}`)
  process.exit(2)
})