import type { GraphNoteNode, GraphTreeNode } from '../../lib/knowledgeTreeGraph'

export type GlobalGraphMode = 'focus' | 'global' | 'tree' | 'orphan'
export type GraphChrome = 'hero' | 'cockpit' | 'minimal'

export interface GlobalGraphNode {
  id: string
  label: string
  kind: 'current' | 'note' | 'tag'
  path?: string
  tags?: string[]
}

export interface GlobalGraphEdge {
  source: string
  target: string
  kind: 'wikilink' | 'tag'
}

export interface GraphApiResponse {
  nodes: GlobalGraphNode[]
  edges: GlobalGraphEdge[]
  orphanNodes?: GlobalGraphNode[]
}

export type SpaceNodeKind = 'current' | 'note' | 'tag' | 'branch'

export interface SpaceNode {
  id: string
  label: string
  kind: SpaceNodeKind
  path?: string
  tags?: string[]
  count?: number
  depth?: number
}

export interface SpaceLink {
  source: string
  target: string
  kind: 'wikilink' | 'tag' | 'hierarchy'
}

export interface GlobalGraphProps {
  width: number
  height: number
  sourceId: string
  focusPath?: string | null
  mode: GlobalGraphMode
  chrome?: GraphChrome
  layout?: 'workspace' | 'dock' | 'hero'
  filterPaths?: string[]
  selectedBranch?: string | null
  selectedNodeId?: string | null
  onBranchChange?: (branch: string | null) => void
  onNodeSelect?: (nodeId: string | null) => void
  onNotePreview?: (path: string) => void
  onNavigate?: (path: string) => void
  onTagSelect?: (tag: string) => void
}

export interface PositionedSpaceNode extends SpaceNode {
  x: number
  y: number
  z: number
  fx: number
  fy: number
  fz: number
}

export const SPACE_COLORS: Record<SpaceNodeKind, string> = {
  current: '#7dd3fc',
  note: '#818cf8',
  tag: '#f59e0b',
  branch: '#34d399',
}

export const GRAPH_BACKDROP = '#06111f'
export const TREE_ROOT_ID = 'branch:__knowledge-root__'

export type { GraphNoteNode, GraphTreeNode }
