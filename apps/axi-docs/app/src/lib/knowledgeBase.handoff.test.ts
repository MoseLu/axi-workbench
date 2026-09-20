import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  __getHandoffPathForTests,
  __isExcludedWorkspaceKindForTests,
  __loadHandoffProjectsForTests,
  __shouldUseSuiteDefinitionsForProjectForTests,
} from './knowledgeBase'

const fixtureSnapshot = path.join(__dirname, '__fixtures__', 'handoff-snapshot-15.json')

function writeHandoffFixture(root: string): string {
  const workspaceDir = path.join(root, '.workspace')
  fs.mkdirSync(workspaceDir, { recursive: true })
  const target = path.join(workspaceDir, 'project-handoff.json')
  fs.copyFileSync(fixtureSnapshot, target)
  return target
}

describe('workspace handoff loader', () => {
  const tempDirs: string[] = []
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('returns source=handoff with 5 mapped projects when the snapshot is present (T5)', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-ok-'))
    tempDirs.push(root)
    writeHandoffFixture(root)
    const result = await __loadHandoffProjectsForTests(root)
    expect(result.source).toBe('handoff')
    expect(result.error).toBeNull()
    expect(result.projects).toHaveLength(5)
    const docs = result.projects.find((p) => p.id === 'axi-docs')
    expect(docs).toBeDefined()
    expect(docs?.status).toBe('verified')
    expect(docs?.verification).toBe('pnpm --dir app verify; pnpm --dir app test:run')
    expect(docs?.docs).toContain('project-docs.manifest.json')
  })

  it('returns source=none when the snapshot is missing (T1)', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-missing-'))
    tempDirs.push(root)
    const result = await __loadHandoffProjectsForTests(root)
    expect(result.source).toBe('none')
    expect(result.projects).toEqual([])
    expect(result.error).toBeInstanceOf(Error)
  })

  it('returns source=none when the snapshot has no projects[]', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-empty-'))
    tempDirs.push(root)
    const dir = path.join(root, '.workspace')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'project-handoff.json'), JSON.stringify({ schemaVersion: '2026-06-11' }), 'utf8')
    const result = await __loadHandoffProjectsForTests(root)
    expect(result.source).toBe('none')
    expect(result.error).toBeInstanceOf(Error)
  })

  it('returns source=none when a project lacks commands.verify (T6)', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-bad-'))
    tempDirs.push(root)
    const dir = path.join(root, '.workspace')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'project-handoff.json'),
      JSON.stringify({
        schemaVersion: '2026-06-11',
        generatedAt: '2026-06-11T05:00:00.000Z',
        projects: [
          {
            id: 'bad', name: 'Bad', path: '/Volumes/code/workspace/projects/bad',
            kind: 'project', lifecycle: 'active-canonical', readiness: 'verified',
            summary: 'broken',
            // no commands.verify
          },
        ],
      }),
      'utf8',
    )
    const result = await __loadHandoffProjectsForTests(root)
    expect(result.source).toBe('none')
    expect(result.error).toBeInstanceOf(Error)
  })

  it('exposes the snapshot path helper', () => {
    const root = '/tmp/axi-docs-workspace'
    expect(__getHandoffPathForTests(root)).toBe(
      path.join(root, '.workspace', 'project-handoff.json'),
    )
  })
})

describe('workspace project predicates', () => {
  it('excludes reference and cockpit kinds (T3)', () => {
    expect(__isExcludedWorkspaceKindForTests('reference')).toBe(true)
    expect(__isExcludedWorkspaceKindForTests('cockpit')).toBe(true)
    expect(__isExcludedWorkspaceKindForTests('REFERENCE')).toBe(true)
    expect(__isExcludedWorkspaceKindForTests('project')).toBe(false)
    expect(__isExcludedWorkspaceKindForTests(undefined)).toBe(false)
  })

  it('forces suite definitions when the project root does not exist', () => {
    const project = {
      id: 'axi-pet',
      name: 'Axi Pet',
      projectPath: '/Volumes/code/workspace/projects/axi-pet',
      purpose: '',
      stack: '',
      status: 'documented',
      docs: '',
      verification: '',
      notes: '',
      description: '',
      updated: '2026-06-10',
    }
    expect(__shouldUseSuiteDefinitionsForProjectForTests(project, false)).toBe(true)
    expect(__shouldUseSuiteDefinitionsForProjectForTests(project, true)).toBe(false)
  })

  it('forces suite definitions for paths under /local/ segments (T4)', () => {
    const project = {
      id: 'axi-pet',
      name: 'Axi Pet',
      projectPath: '/Volumes/code/workspace/projects/local/axi-pet',
      purpose: '',
      stack: '',
      status: 'documented',
      docs: '',
      verification: '',
      notes: '',
      description: '',
      updated: '2026-06-10',
    }
    expect(__shouldUseSuiteDefinitionsForProjectForTests(project, true)).toBe(true)
  })
})
