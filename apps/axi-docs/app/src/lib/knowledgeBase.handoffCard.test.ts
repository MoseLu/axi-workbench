import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getHandoffSnapshotStatus,
  getProjectHandoffCard,
} from './knowledgeBase'

const fixtureSnapshot = path.join(__dirname, '__fixtures__', 'handoff-snapshot-15.json')

function writeHandoffFixture(root: string, opts: { mtime?: Date; body?: object } = {}): string {
  const workspaceDir = path.join(root, '.workspace')
  fs.mkdirSync(workspaceDir, { recursive: true })
  const file = path.join(workspaceDir, 'project-handoff.json')
  const body = opts.body || JSON.parse(fs.readFileSync(fixtureSnapshot, 'utf8'))
  fs.writeFileSync(file, JSON.stringify(body), 'utf8')
  if (opts.mtime) fs.utimesSync(file, opts.mtime, opts.mtime)
  return file
}

describe('getProjectHandoffCard', () => {
  const tempDirs: string[] = []
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('returns state=ok with readiness/score/read order when snapshot has the project (T1)', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-card-ok-'))
    tempDirs.push(root)
    const now = new Date('2026-06-11T06:00:00.000Z')
    // Use a custom snapshot so the project has a readOrder we can assert.
    const customBody = {
      schemaVersion: '2026-06-11',
      generatedAt: '2026-06-11T05:34:37.955Z',
      projects: [{
        id: 'axi-docs',
        name: 'Axi Docs',
        path: '/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs',
        kind: 'project',
        lifecycle: 'active-canonical',
        owner: 'libu',
        readiness: 'verified',
        score: 10,
        manifestPath: '/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/project-docs.manifest.json',
        handoffPath: '/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/HANDOFF.md',
        readOrder: ['AGENTS.md', 'README.md', 'TODO.md'],
        commands: { verify: ['pnpm --dir app verify', 'pnpm --dir app test:run'], smoke: ['pnpm --dir app docs:check'] },
        lastVerifiedAt: '2026-06-11T05:34:37.955Z',
      }],
    }
    const handoffPath = writeHandoffFixture(root, { mtime: now, body: customBody })
    const card = await getProjectHandoffCard('axi-docs', { handoffPath, now })
    expect(card.state).toBe('ok')
    expect(card.readiness).toBe('verified')
    expect(card.score).toBe(10)
    expect(card.readOrder).toEqual(['AGENTS.md', 'README.md', 'TODO.md'])
    expect(card.manifestPath).toContain('project-docs.manifest.json')
    expect(card.handoffPath).toContain('HANDOFF.md')
    expect(card.verifyCommand).toBe('pnpm --dir app verify')
    expect(card.smokeCommand).toBe('pnpm --dir app docs:check')
  })

  it('returns state=missing with all-null fields when the file is absent (T2)', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-card-missing-'))
    tempDirs.push(root)
    const now = new Date('2026-06-11T06:00:00.000Z')
    const card = await getProjectHandoffCard('axi-docs', {
      handoffPath: path.join(root, '.workspace', 'project-handoff.json'),
      now,
    })
    expect(card.state).toBe('missing')
    expect(card.readiness).toBe('unknown')
    expect(card.score).toBe(0)
    expect(card.readOrder).toEqual([])
    expect(card.manifestPath).toBeNull()
    expect(card.handoffSource).toBe('none')
  })

  it('returns state=stale with ageDays when lastVerifiedAt is older than 14 days (T3)', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-card-stale-'))
    tempDirs.push(root)
    const staleDate = '2026-05-15T06:00:00.000Z'
    const now = new Date('2026-06-11T06:00:00.000Z')
    // Force a 27-day-old lastVerifiedAt; the helper compares against
    // `now`, not file mtime.
    const customBody = {
      schemaVersion: '2026-06-11',
      generatedAt: staleDate,
      projects: [{
        id: 'axi-docs',
        name: 'Axi Docs',
        path: '/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs',
        kind: 'project',
        lifecycle: 'active-canonical',
        owner: 'libu',
        readiness: 'verified',
        score: 10,
        commands: { verify: [], smoke: [] },
        lastVerifiedAt: staleDate,
      }],
    }
    const handoffPath = writeHandoffFixture(root, { mtime: now, body: customBody })
    const card = await getProjectHandoffCard('axi-docs', { handoffPath, now })
    expect(card.state).toBe('stale')
    expect(card.ageDays).not.toBeNull()
    expect(card.ageDays!).toBeGreaterThan(14)
    expect(card.lastVerifiedAt).toBe(staleDate)
  })

  it('returns state=missing when the project id is not in the snapshot (T4)', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-card-unknown-'))
    tempDirs.push(root)
    const now = new Date('2026-06-11T06:00:00.000Z')
    const handoffPath = writeHandoffFixture(root, { mtime: now })
    const card = await getProjectHandoffCard('nonexistent-project', { handoffPath, now })
    expect(card.state).toBe('missing')
    expect(card.handoffSource).toBe('handoff')
    expect(card.handoffGeneratedAt).toBe('2026-06-11T05:34:37.955Z')
    expect(card.readOrder).toEqual([])
  })
})

describe('getHandoffSnapshotStatus', () => {
  const tempDirs: string[] = []
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('returns source=handoff with ageDays when the snapshot exists', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-status-'))
    tempDirs.push(root)
    const now = new Date('2026-06-11T06:00:00.000Z')
    const handoffPath = writeHandoffFixture(root, { mtime: now })
    const status = await getHandoffSnapshotStatus({ handoffPath, now })
    expect(status.source).toBe('handoff')
    expect(status.generatedAt).toBe('2026-06-11T05:34:37.955Z')
    expect(status.ageDays).toBeGreaterThanOrEqual(0)
  })

  it('returns source=none when the snapshot file is missing', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-status-missing-'))
    tempDirs.push(root)
    const status = await getHandoffSnapshotStatus({
      handoffPath: path.join(root, '.workspace', 'project-handoff.json'),
    })
    expect(status.source).toBe('none')
    expect(status.generatedAt).toBeNull()
  })
})
