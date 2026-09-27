import { describe, expect, it } from 'vitest'
import {
  buildKnowledgeTree,
  resolveSelectedTree,
  type GraphNoteNode,
} from './knowledgeTreeGraph'

function createNote(path: string, kind: 'current' | 'note' = 'note'): GraphNoteNode {
  return {
    id: path,
    label: path.split('/').at(-1) || path,
    kind,
    path,
    tags: [],
  }
}

describe('knowledge tree graph', () => {
  it('does not return the selected branch as its own child root', () => {
    const tree = buildKnowledgeTree([
      createNote('20-Projects/OVERVIEW.md'),
      createNote('20-Projects/axi-docs/OVERVIEW.md'),
      createNote('20-Projects/axi-docs/ADR/ADR-001.md'),
    ])

    const selected = resolveSelectedTree(tree, '20-Projects')

    expect(selected.currentBranch?.pathKey).toBe('20-Projects')
    expect(selected.roots.map((branch) => branch.pathKey)).toEqual(['20-Projects/axi-docs'])
    expect(selected.roots.some((branch) => branch.pathKey === '20-Projects')).toBe(false)
    expect(selected.looseNotes.map((note) => note.path)).toEqual(['20-Projects/OVERVIEW.md'])
  })

  it('surfaces a focused branch notes directly under the graph root anchor', () => {
    const tree = buildKnowledgeTree([
      createNote('20-Projects/axi-docs/OVERVIEW.md', 'current'),
      createNote('20-Projects/axi-docs/ADR/ADR-001.md'),
      createNote('20-Projects/axi-docs/ADR/ADR-002.md'),
    ])

    const selected = resolveSelectedTree(tree, '20-Projects/axi-docs')

    expect(selected.roots.map((branch) => branch.pathKey)).toEqual(['20-Projects/axi-docs/ADR'])
    expect(selected.looseNotes.map((note) => note.path)).toEqual(['20-Projects/axi-docs/OVERVIEW.md'])
  })
})
