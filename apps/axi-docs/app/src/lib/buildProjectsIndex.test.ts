import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  extractProjectsFromHandoff,
  HANDOFF_PATH,
  inferPartition,
  inferSection,
  readHandoffSnapshot,
} from './buildProjectsIndex.mjs'

const fixturePath = path.join(__dirname, '__fixtures__', 'handoff-snapshot-15.json')

function loadFixture() {
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
}

describe('inferPartition', () => {
  it('maps canonical workspace prefixes', () => {
    expect(inferPartition('/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs')).toBe('projects')
    expect(inferPartition('/Volumes/code/workspace/tools/axi-feishu-codex-bridge')).toBe('tools')
    expect(inferPartition('/Volumes/code/workspace/infra/axi-registry')).toBe('infra')
    expect(inferPartition('/Volumes/code/workspace/shared/axi-ui')).toBe('shared')
    expect(inferPartition('/Volumes/code/workspace/products/ielts-vocab')).toBe('products')
    expect(inferPartition('/Volumes/code/workspace/references/some-ref')).toBe('references')
  })

  it('falls back to unknown outside the workspace', () => {
    expect(inferPartition('/tmp/foo')).toBe('unknown')
  })

  it('classifies top-level .json files as infra', () => {
    expect(inferPartition('/Volumes/code/workspace/dev-services.config.json')).toBe('infra')
  })
})

describe('inferSection', () => {
  it('puts canonical projects in core', () => {
    expect(inferSection({ kind: 'project', lifecycle: 'active-canonical', partition: 'projects' })).toBe('core')
  })

  it('puts shared-provider and shared-reference in shared', () => {
    expect(inferSection({ kind: 'shared', lifecycle: 'active-shared-provider', partition: 'shared' })).toBe('shared')
    expect(inferSection({ kind: 'shared', lifecycle: 'active-shared-reference', partition: 'shared' })).toBe('shared')
  })

  it('puts tool and product kinds in reference', () => {
    expect(inferSection({ kind: 'tool', lifecycle: 'active-tool', partition: 'tools' })).toBe('reference')
    expect(inferSection({ kind: 'product', lifecycle: 'active-product', partition: 'products' })).toBe('reference')
  })

  it('puts infra in shared', () => {
    expect(inferSection({ kind: 'infra', lifecycle: 'active-infra', partition: 'infra' })).toBe('shared')
  })
})

describe('extractProjectsFromHandoff', () => {
  it('omits dedicated governance and registry surfaces from dossier output (B1)', () => {
    const projects = extractProjectsFromHandoff(loadFixture(), new Date('2026-06-11'))
    expect(projects).toHaveLength(4)
    expect(projects.map((project) => project.id)).not.toContain('axi-registry')
    const sections = projects.reduce<Record<string, number>>((acc, p) => {
      acc[p.section] = (acc[p.section] || 0) + 1
      return acc
    }, {})
    // 2 canonical (axi-docs, axi-pet) → core
    // 1 shared-provider (axi-rules) → shared
    // 1 tool (axi-feishu-codex-bridge) → reference
    expect(sections.core).toBe(2)
    expect(sections.shared).toBe(1)
    expect(sections.reference).toBe(1)
  })

  it('omits the workspace-governance mirror when supplied by handoff', () => {
    const snapshot = loadFixture()
    snapshot.projects.push({
      id: 'axi-workspace-governance',
      name: 'Axi Workspace Governance',
      path: '/Volumes/code/workspace/infra/axi-workspace-governance',
      kind: 'axi-workspace-governance',
      lifecycle: 'active-governance',
      readiness: 'verified',
      summary: 'Workspace governance.',
      commands: { verify: ['pnpm handoff:test'] },
    })

    const projects = extractProjectsFromHandoff(snapshot, new Date('2026-06-11'))

    expect(projects.map((project) => project.id)).not.toContain('axi-workspace-governance')
  })

  it('maps readiness to status and commands.verify to a joined string', () => {
    const projects = extractProjectsFromHandoff(loadFixture(), new Date())
    const docs = projects.find((p) => p.id === 'axi-docs')!
    expect(docs.status).toBe('verified')
    expect(docs.verification).toBe('pnpm --dir app verify; pnpm --dir app test:run')
    const bridge = projects.find((p) => p.id === 'axi-feishu-codex-bridge')!
    expect(bridge.verification).toBe('pnpm test; pnpm build')
  })

  it('attaches handoff metadata to every parsed project', () => {
    const projects = extractProjectsFromHandoff(loadFixture(), new Date())
    for (const project of projects) {
      expect(project.handoffGeneratedAt).toBe('2026-06-11T05:34:37.955Z')
      expect(project.kind).toBeTruthy()
      expect(project.lifecycle).toBeTruthy()
    }
  })

  it('throws when projects[] is missing (B3)', () => {
    expect(() => extractProjectsFromHandoff({ schemaVersion: '2026-06-11' })).toThrow(/projects\[\]/)
  })

  it('throws when a project is missing commands.verify', () => {
    const snapshot = {
      schemaVersion: '2026-06-11',
      projects: [
        {
          id: 'bad', name: 'Bad', path: '/Volumes/code/workspace/projects/bad',
          kind: 'project', lifecycle: 'active-canonical', readiness: 'verified',
          summary: 'x', commands: { verify: 'not-an-array' },
        },
      ],
    }
    expect(() => extractProjectsFromHandoff(snapshot)).toThrow(/commands\.verify/)
  })

  it('throws when schemaVersion is the wrong type', () => {
    expect(() => extractProjectsFromHandoff({ schemaVersion: 123, projects: [] })).toThrow(/schemaVersion/)
  })
})

describe('readHandoffSnapshot', () => {
  const tempDirs: string[] = []
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  function writeSnapshotWithMtime(ageDays: number) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-test-'))
    tempDirs.push(dir)
    const file = path.join(dir, 'project-handoff.json')
    fs.writeFileSync(file, JSON.stringify(loadFixture()), 'utf8')
    const past = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000)
    fs.utimesSync(file, past, past)
    return file
  }

  it('returns the parsed snapshot for a fresh file', async () => {
    const file = writeSnapshotWithMtime(0)
    const result = await readHandoffSnapshot({ handoffPath: file, maxAgeDays: 14, now: new Date() })
    expect(result.error).toBeNull()
    const snapshot = result.snapshot as { projects?: unknown[] } | null
    expect(snapshot?.projects).toHaveLength(5)
    expect(result.stale).toBe(false)
  })

  it('marks files older than maxAgeDays as stale but still returns them (T2)', async () => {
    const file = writeSnapshotWithMtime(20)
    const result = await readHandoffSnapshot({ handoffPath: file, maxAgeDays: 14, now: new Date() })
    expect(result.error).toBeNull()
    const snapshot = result.snapshot as { projects?: unknown[] } | null
    expect(snapshot?.projects).toHaveLength(5)
    expect(result.stale).toBe(true)
    expect(result.ageDays).toBeGreaterThan(14)
  })

  it('returns an error result when the file is missing (T1)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-missing-'))
    tempDirs.push(dir)
    const result = await readHandoffSnapshot({
      handoffPath: path.join(dir, 'nope.json'),
      maxAgeDays: 14,
      now: new Date(),
    })
    expect(result.snapshot).toBeNull()
    expect(result.error).toBeInstanceOf(Error)
    expect(result.stale).toBe(false)
  })

  it('points the constant at the governance snapshot', () => {
    expect(HANDOFF_PATH).toBe('/Volumes/code/workspace/.workspace/project-handoff.json')
  })
})
