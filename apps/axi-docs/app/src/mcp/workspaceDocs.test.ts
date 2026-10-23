// readWorkspaceDoc is the only workspace-doc reader reachable from an
// MCP tool handler, so it is the boundary that has to hold: `path` is
// caller-supplied and every earlier version joined it straight onto the
// category root. These cases pin the traversal, symlink, extension and
// unknown-category rejections.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readWorkspaceDoc, listWorkspaceDocCategories } from './workspaceDocs'

// The category roots come from the real workspace config, which would tie
// these cases to whatever machine runs them. The documentSources module is
// mocked per test file so every category root resolves inside a throwaway
// temp root, while every other export (used transitively by knowledgeBase)
// stays real.
const wiredRoot = vi.hoisted(() => ({ dir: '' }))

vi.mock('../config/documentSources', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../config/documentSources')>()
  return {
    ...actual,
    resolveWorkspacePathFromConfig: (...segments: string[]) =>
      join(wiredRoot.dir, ...segments),
  }
})

describe('readWorkspaceDoc path safety', () => {
  // Rejection shapes are asserted against the wired temp root, so they do
  // not depend on a particular workspace checkout.

  it('rejects an unknown category before touching the filesystem', async () => {
    const result = await readWorkspaceDoc({ category: 'nope', path: 'a.md' })
    expect(result.error).toMatch(/unknown category/)
    expect(result).not.toHaveProperty('content')
  })

  it('exposes the documented category set', async () => {
    const { categories } = await listWorkspaceDocCategories()
    const names = categories.map((c) => c.name)
    for (const expected of ['adr', 'architecture', 'prd', 'registry', 'scripts']) {
      expect(names).toContain(expected)
    }
  })

  const BAD_PATHS: Array<[string, string]> = [
    ['parent traversal', '../../../../etc/passwd.md'],
    ['deep traversal', '../../../secrets.md'],
    ['absolute path', '/etc/hosts.md'],
    ['NUL byte', 'ok.md\u0000.txt'],
  ]

  for (const [label, badPath] of BAD_PATHS) {
    it(`rejects ${label}`, async () => {
      const result = await readWorkspaceDoc({ category: 'adr', path: badPath })
      expect(result.error).toBeTruthy()
      expect(result).not.toHaveProperty('content')
    })
  }

  it('rejects a non-markdown extension even inside a valid root', async () => {
    // Stays inside the adr root on purpose: the only gate that can reject
    // this input is the isSupported extension allowlist.
    const result = await readWorkspaceDoc({ category: 'adr', path: 'meeting-notes.txt' })
    expect(result.error).toMatch(/unsupported file type/)
    expect(result).not.toHaveProperty('content')
  })

  it('rejects whitespace-padded input instead of normalising it silently', async () => {
    const result = await readWorkspaceDoc({ category: 'adr', path: ' ok.md ' })
    expect(result.error).toMatch(/non-empty string/)
  })
})

describe('readWorkspaceDoc symlink containment', () => {
  // Real temp root wired through the mocked documentSources module, so the
  // cases below exercise readWorkspaceDoc itself rather than a mirror of
  // its internal path.relative guard.
  let root = ''
  let outside = ''

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'axi-docs-ws-root-'))
    outside = mkdtempSync(join(tmpdir(), 'axi-docs-ws-out-'))
    // Matches the real adr mapping:
    // resolveWorkspacePathFromConfig('foundation', 'workspace-governance', 'docs', 'adr').
    mkdirSync(join(root, 'foundation', 'workspace-governance', 'docs', 'adr'), {
      recursive: true,
    })
    writeFileSync(
      join(root, 'foundation', 'workspace-governance', 'docs', 'adr', 'real.md'),
      '# inside\n',
      'utf8',
    )
    writeFileSync(join(outside, 'secret.md'), '# outside\n', 'utf8')
    wiredRoot.dir = root
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
    wiredRoot.dir = ''
  })

  it('reads a real markdown document from the wired category root', async () => {
    const result = await readWorkspaceDoc({ category: 'adr', path: 'real.md' })
    expect(result.error).toBeUndefined()
    expect(result.content).toBe('# inside\n')
  })

  it('rejects a symlink that points outside the category root', async () => {
    let linked = false
    try {
      symlinkSync(
        join(outside, 'secret.md'),
        join(root, 'foundation', 'workspace-governance', 'docs', 'adr', 'link.md'),
      )
      linked = true
    } catch {
      // Symlink creation is unavailable in some sandboxes; the traversal
      // cases above still pin the caller-facing contract.
    }
    if (!linked) return

    const result = await readWorkspaceDoc({ category: 'adr', path: 'link.md' })
    expect(result.error).toMatch(/escapes the adr root via a symlink/)
    expect(result).not.toHaveProperty('content')
  })
})
