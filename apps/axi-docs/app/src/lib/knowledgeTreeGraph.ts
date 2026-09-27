import type { KnowledgeGraphSnapshotNode } from '../types'
import { formatKnowledgeBranchLabel } from './knowledgeFormatter'

export interface GraphNoteNode extends Pick<KnowledgeGraphSnapshotNode, 'id' | 'label' | 'path' | 'tags'> {
  kind: 'current' | 'note'
}

export interface GraphTreeNode {
  id: string
  label: string
  pathKey: string
  depth: number
  count: number
  notes: GraphNoteNode[]
  children: GraphTreeNode[]
}

export interface ResolvedGraphTree {
  roots: GraphTreeNode[]
  looseNotes: GraphNoteNode[]
  currentBranch: GraphTreeNode | null
}

export function buildKnowledgeTree(notes: GraphNoteNode[]) {
  const branchMap = new Map<string, GraphTreeNode>()
  const rootChildren: GraphTreeNode[] = []
  const looseNotes: GraphNoteNode[] = []

  function ensureBranch(pathKey: string, label: string, depth: number): GraphTreeNode {
    const existing = branchMap.get(pathKey)
    if (existing) return existing

    const branch: GraphTreeNode = {
      id: `branch:${pathKey}`,
      label,
      pathKey,
      depth,
      count: 0,
      notes: [],
      children: [],
    }
    branchMap.set(pathKey, branch)
    return branch
  }

  for (const note of notes) {
    const parts = (note.path || note.label)
      .split('/')
      .filter(Boolean)
    const directories = parts.slice(0, -1)

    if (directories.length === 0) {
      looseNotes.push(note)
      continue
    }

    let parent: GraphTreeNode | null = null
    let pathKey = ''
    for (const [index, segment] of directories.entries()) {
      pathKey = pathKey ? `${pathKey}/${segment}` : segment
      const branch = ensureBranch(pathKey, formatKnowledgeBranchLabel(segment), index + 1)
      branch.count += 1

      if (!parent) {
        if (!rootChildren.some((item) => item.id === branch.id)) {
          rootChildren.push(branch)
        }
      } else if (!parent.children.some((item) => item.id === branch.id)) {
        parent.children.push(branch)
      }

      parent = branch
    }

    parent?.notes.push(note)
  }

  return { rootChildren, branchMap, looseNotes }
}

export function collectTreeBranchIds(branch: GraphTreeNode): Set<string> {
  const ids = new Set<string>([branch.pathKey])
  for (const child of branch.children) {
    for (const id of collectTreeBranchIds(child)) {
      ids.add(id)
    }
  }
  return ids
}

export function resolveSelectedTree(
  tree: ReturnType<typeof buildKnowledgeTree>,
  selectedBranch: string | null,
): ResolvedGraphTree {
  if (!selectedBranch) {
    return {
      roots: tree.rootChildren,
      looseNotes: tree.looseNotes,
      currentBranch: null,
    }
  }

  const currentBranch = tree.branchMap.get(selectedBranch) || null
  if (!currentBranch) {
    return {
      roots: tree.rootChildren,
      looseNotes: tree.looseNotes,
      currentBranch: null,
    }
  }

  return {
    roots: currentBranch.children,
    looseNotes: currentBranch.notes,
    currentBranch,
  }
}
