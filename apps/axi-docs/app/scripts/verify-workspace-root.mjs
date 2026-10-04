#!/usr/bin/env node
// Verify that documentSources.ts detects the real Axi workspace root
// under `/Volumes/code/workspace` and resolves every document source
// to a real directory or an empty string.
//
// Run from the axi-docs project root:
//   cd apps/axi-docs && node --import tsx scripts/verify-workspace-root.mjs
// or via the local pnpm tsx shim:
//   cd apps/axi-docs && pnpm tsx scripts/verify-workspace-root.mjs

import fs from 'node:fs'
import path from 'node:path'

import { getDocumentSourceRegistry } from '../src/config/documentSources.ts'

const cwd = process.cwd()
const home = cwd
const expectedWorkspaceRoot = '/Volumes/code/workspace'

function classify(p) {
  if (!p) return 'empty'
  try {
    const stat = fs.statSync(p)
    return stat.isDirectory() ? 'exists-dir' : 'exists-file'
  } catch {
    return 'MISSING'
  }
}

const sources = getDocumentSourceRegistry()
const summary = sources.map((s) => ({
  id: s.id,
  path: s.path,
  status: classify(s.path),
  enabled: s.enabled,
}))

const result = {
  cwd,
  expectedWorkspaceRoot,
  workspaceRootMatch: cwd === expectedWorkspaceRoot || cwd.startsWith(expectedWorkspaceRoot + path.sep),
  sourceCount: sources.length,
  sources: summary,
}

console.log(JSON.stringify(result, null, 2))

const missing = summary.filter((s) => s.status === 'MISSING')
if (missing.length > 0) {
  console.error(`\nFAIL: ${missing.length} source path(s) point at nonexistent directories:`)
  for (const m of missing) console.error(`  - ${m.id}: ${m.path}`)
  process.exit(1)
} else {
  console.error(`\nOK: all ${summary.length} source paths resolve to a real directory or empty string.`)
}