import { describe, expect, it } from 'vitest'
import { runKnowledgeIntake } from './knowledgeIntake'

describe('knowledge intake IQC', () => {
  it('accepts documents with complete frontmatter and Chinese graph metadata', () => {
    const result = runKnowledgeIntake({
      id: 'concept-react-state',
      title: 'React 状态管理',
      type: 'concept',
      status: 'evergreen',
      tags: ['react', 'state'],
      created: '2026-03-25',
      modified: '2026-03-25',
      graphTitle: '状态管理',
      graphTags: ['前端', '状态'],
    })

    expect(result.accepted).toBe(true)
    expect(result.graphTitle).toBe('状态管理')
    expect(result.graphTags).toEqual(['前端', '状态'])
  })

  it('rejects documents missing required frontmatter fields', () => {
    const result = runKnowledgeIntake({
      title: '知识库索引',
      graphTitle: '知识库索引',
      graphTags: ['索引'],
    })

    expect(result.accepted).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'missing-fields')).toBe(true)
  })

  it('falls back to tags when documents do not provide explicit graph tags', () => {
    const result = runKnowledgeIntake({
      id: 'concept-react-state',
      title: 'React 状态管理',
      type: 'concept',
      status: 'evergreen',
      tags: ['react', 'state'],
      created: '2026-03-25',
      modified: '2026-03-25',
      graphTitle: '状态管理',
    })

    expect(result.accepted).toBe(true)
    expect(result.graphTags).toEqual(['react', 'state'])
    expect(result.issues.some((issue) => issue.code === 'missing-graph-tags')).toBe(true)
  })

  it('falls back to title and tags when explicit graph metadata is omitted', () => {
    const result = runKnowledgeIntake({
      id: 'agent-context',
      title: 'Current Context',
      type: 'concept',
      status: 'evergreen',
      tags: ['vault', 'context', 'current'],
      created: '2026-03-25',
      modified: '2026-03-25',
    })

    expect(result.accepted).toBe(true)
    expect(result.graphTitle).toBe('Current Context')
    expect(result.graphTags).toEqual(['vault', 'context', 'current'])
    expect(result.issues.some((issue) => issue.code === 'missing-graph-title')).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'missing-graph-tags')).toBe(true)
  })

  it('keeps documents admitted even when graph metadata is not Chinese', () => {
    const result = runKnowledgeIntake({
      id: 'agent-index',
      title: 'Vault Index for Agent',
      type: 'concept',
      status: 'evergreen',
      tags: ['vault', 'agent'],
      created: '2026-03-25',
      modified: '2026-03-25',
      graphTitle: 'Vault Index for Agent',
      graphTags: ['agent'],
    })

    expect(result.accepted).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'non-chinese-graph-title')).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'non-chinese-graph-tags')).toBe(true)
  })
})
