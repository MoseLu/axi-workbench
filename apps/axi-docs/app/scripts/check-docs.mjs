import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const MANIFEST_PATH = resolve(import.meta.dirname, '..', '..', 'docs', 'project-docs.manifest.json')
const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..')

// Fields whose string values are relative document paths to validate.
// Commands (commands.*, startup_profile.*) and URLs are excluded.
const DOCUMENT_PATH_FIELDS = new Set([
  // top-level
  'canonicalPath', 'manifestPath', 'handoffPath',
  // documents section
  'agents', 'readme', 'readmeZh', 'index', 'todo', 'todoZh',
  'milestone', 'prd', 'tdd', 'changelog', 'changelogZh',
  'security', 'securityZh', 'error', 'errorZh',
  'rules', 'manifest', 'verification',
  'planningIndex', 'plans', 'plansZh',
  'plansContract', 'plansContractZh',
  // contracts
  'adr', 'changelog',
  // entrypoints
  'path',
  // environment
  'source',
])

const EXCLUDED_AT_ROOT = new Set([
  'commands', 'currentWork', 'troubleshooting', 'decisions',
  'owners', 'consumers', 'shared_packages_exposed', 'docs_entrypoints',
  'environment', 'contracts', 'created', 'updated', 'writer', 'source',
  'verification', 'startup_profile',
])

async function pathExists(fsPath) {
  try {
    await stat(fsPath)
    return true
  } catch {
    return false
  }
}

function isDocumentPath(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  // Exclude URLs, absolute paths, shell variables, compound commands
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false
  if (trimmed.startsWith('/') || trimmed.startsWith('$') || trimmed.startsWith('`')) return false
  // Exclude compound command strings (contain spaces and look like shell invocations)
  if (/^\S+\s+\S+/.test(trimmed)) return false
  // Must look like a file path (letters, digits, dash, underscore, dot, slash)
  if (!/^[a-zA-Z0-9_/.-]/.test(trimmed)) return false
  return trimmed.length > 0 && trimmed.length < 512
}

async function collectDocumentPaths(obj, prefix = '') {
  const paths = []
  if (typeof obj !== 'object' || obj === null) return paths

  for (const [key, value] of Object.entries(obj)) {
    const fieldKey = prefix ? `${prefix}.${key}` : key

    // Skip entire subtrees that are never document paths
    if (!prefix && EXCLUDED_AT_ROOT.has(key)) continue

    if (DOCUMENT_PATH_FIELDS.has(key) && isDocumentPath(value)) {
      paths.push({ field: fieldKey, path: value.trim() })
    } else if (Array.isArray(value)) {
      for (const item of value) {
        paths.push(...await collectDocumentPaths(item, `${fieldKey}[]`))
      }
    } else if (typeof value === 'object' && value !== null) {
      paths.push(...await collectDocumentPaths(value, fieldKey))
    }
  }
  return paths
}

async function main() {
  // 1. Load manifest
  let manifest
  try {
    const { readFile } = await import('node:fs/promises')
    manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf-8'))
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Manifest not found: ${MANIFEST_PATH}`)
    }
    throw new Error(`Failed to parse manifest: ${err.message}`)
  }

  // 2. Collect document paths
  const docPaths = await collectDocumentPaths(manifest)

  // 3. Validate each path
  const missing = []
  for (const { field, path: relPath } of docPaths) {
    const fullPath = resolve(PROJECT_ROOT, relPath)
    if (!(await pathExists(fullPath))) {
      missing.push({ field, path: relPath, resolved: fullPath })
    }
  }

  // 4. Report
  if (missing.length > 0) {
    const lines = missing.map(m => `  ${m.field}: "${m.path}" → ${m.resolved}`)
    throw new Error(`Missing paths in project-docs.manifest.json:\n${lines.join('\n')}`)
  }

  console.log('[docs:check] project-docs.manifest.json validation passed.')
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
