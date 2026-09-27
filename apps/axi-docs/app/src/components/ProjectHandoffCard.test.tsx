import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as knowledgeBase from '../lib/knowledgeBase'
import { ProjectHandoffCard } from './ProjectHandoffCard'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ProjectHandoffCard', () => {
  it('renders the ok state with readiness and score (C1)', async () => {
    vi.spyOn(knowledgeBase, 'getProjectHandoffCard').mockResolvedValue({
      state: 'ok',
      readiness: 'verified',
      score: 10,
      readOrder: ['AGENTS.md', 'README.md'],
      entrypoints: [{ id: 'web', path: 'app/src/main.tsx', purpose: 'Mount the reader' }],
      smokeCommand: 'pnpm docs:check',
      verifyCommand: 'pnpm verify',
      currentWork: { active: ['Maintain handoff'], knownFailures: [] },
      lastVerifiedAt: '2026-06-11T05:34:37.955Z',
      ageDays: 0.5,
      handoffPath: '/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/HANDOFF.md',
      manifestPath: '/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/project-docs.manifest.json',
      handoffSource: 'handoff',
      handoffGeneratedAt: '2026-06-11T05:34:37.955Z',
    })

    render(<ProjectHandoffCard projectId="axi-docs" />)
    await waitFor(() => {
      expect(screen.getByTestId('project-handoff-card')).toHaveAttribute('data-state', 'ok')
    })
    expect(screen.getByText('verified')).toBeInTheDocument()
    expect(screen.getByText(/10 \/ 10/)).toBeInTheDocument()
    expect(screen.getByText('AGENTS.md')).toBeInTheDocument()
  })

  it('renders the missing state with a notice (C2)', async () => {
    vi.spyOn(knowledgeBase, 'getProjectHandoffCard').mockResolvedValue({
      state: 'missing',
      readiness: 'unknown',
      score: 0,
      readOrder: [],
      entrypoints: [],
      smokeCommand: null,
      verifyCommand: null,
      currentWork: { active: [], knownFailures: [] },
      lastVerifiedAt: null,
      ageDays: null,
      handoffPath: null,
      manifestPath: null,
      handoffSource: 'none',
      handoffGeneratedAt: null,
    })

    render(<ProjectHandoffCard projectId="axi-docs" />)
    await waitFor(() => {
      expect(screen.getByTestId('project-handoff-card')).toHaveAttribute('data-state', 'missing')
    })
    expect(screen.getByText(/未读取到 handoff 快照/)).toBeInTheDocument()
  })

  it('renders the stale state with a refresh notice (C3)', async () => {
    vi.spyOn(knowledgeBase, 'getProjectHandoffCard').mockResolvedValue({
      state: 'stale',
      readiness: 'verified',
      score: 8,
      readOrder: [],
      entrypoints: [],
      smokeCommand: null,
      verifyCommand: null,
      currentWork: { active: [], knownFailures: [] },
      lastVerifiedAt: '2026-05-15T05:34:37.955Z',
      ageDays: 27.2,
      handoffPath: null,
      manifestPath: null,
      handoffSource: 'handoff',
      handoffGeneratedAt: '2026-05-15T05:34:37.955Z',
    })

    render(<ProjectHandoffCard projectId="axi-docs" />)
    await waitFor(() => {
      expect(screen.getByTestId('project-handoff-card')).toHaveAttribute('data-state', 'stale')
    })
    expect(screen.getByText(/超过 14 天/)).toBeInTheDocument()
    expect(screen.getByText(/27\.2/)).toBeInTheDocument()
  })
})
