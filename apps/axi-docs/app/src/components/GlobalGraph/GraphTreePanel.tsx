import { startTransition } from 'react'
import { formatKnowledgeNodeLabel } from '../../lib/knowledgeFormatter'
import { FileIcon, FolderIcon } from '../Icons'
import { OverlayScrollbar } from '../OverlayScrollbar'
import type { GraphNoteNode, GraphTreeNode } from './types'

interface GraphTreePanelProps {
  rootChildren: GraphTreeNode[]
  looseNotes: GraphNoteNode[]
  expandedBranches: Set<string>
  selectedBranch: string | null
  selectedNodeId: string | null
  totalsNotes: number
  panelTitle: string
  rootViewLabel: string
  looseDocsLabel: string
  onSelectBranch: (branch: string | null) => void
  onSelectNode: (nodeId: string, path?: string) => void
  onNotePreview?: (path: string) => void
  onNavigate?: (path: string) => void
  toggleBranch: (pathKey: string) => void
}

export function GraphTreePanel({
  rootChildren,
  looseNotes,
  expandedBranches,
  selectedBranch,
  selectedNodeId,
  totalsNotes,
  panelTitle,
  rootViewLabel,
  looseDocsLabel,
  onSelectBranch,
  onSelectNode,
  onNotePreview,
  onNavigate,
  toggleBranch,
}: GraphTreePanelProps) {
  const renderTreeNodes = (nodes: GraphTreeNode[]) =>
    nodes.map(branch => {
      const isExpanded = expandedBranches.has(branch.pathKey)
        || (selectedBranch ? selectedBranch.startsWith(branch.pathKey) : branch.depth <= 1)
      const isActive = selectedBranch === branch.pathKey
      return (
        <div key={branch.id} className="graph-tree-node">
          <button
            className={`graph-tree-branch${isActive ? ' active' : ''}`}
            style={{ paddingLeft: `${branch.depth * 12 + 14}px` }}
            onClick={() => startTransition(() => onSelectBranch(isActive ? null : branch.pathKey))}
            onDoubleClick={() => toggleBranch(branch.pathKey)}
            title={branch.pathKey}
            type="button"
          >
            <span className={`graph-tree-caret${isExpanded ? ' expanded' : ''}`}>▶</span>
            <FolderIcon />
            <span className="graph-tree-label">{branch.label}</span>
            <span className="graph-tree-count">{branch.count}</span>
          </button>

          {isExpanded && branch.notes.length > 0 && branch.notes.map(note => (
            <button
              key={note.id}
              className={`graph-tree-leaf${selectedNodeId === note.id ? ' active' : ''}`}
              style={{ paddingLeft: `${branch.depth * 12 + 36}px` }}
              onClick={() => {
                onSelectNode(note.id, note.path)
                if (note.path) {
                  onNotePreview?.(note.path)
                } else {
                  onNavigate?.(note.id)
                }
              }}
              onDoubleClick={() => onNavigate?.(note.path || note.id)}
              title={note.path}
              type="button"
            >
              <FileIcon />
              <span className="graph-tree-label">{formatKnowledgeNodeLabel(note)}</span>
            </button>
          ))}

          {isExpanded && branch.children.length > 0 && renderTreeNodes(branch.children)}
        </div>
      )
    })

  return (
    <aside className="graph-space__tree">
      <div className="graph-panel__header">
        <FolderIcon />
        <span>{panelTitle}</span>
      </div>
      <OverlayScrollbar
        ariaLabel={panelTitle}
        className="graph-tree-scrollbar"
        viewClassName="graph-tree"
        wrapClassName="graph-tree-scrollbar__wrap"
      >
        <button
          className={`graph-tree-root${selectedBranch === null ? ' active' : ''}`}
          onClick={() => onSelectBranch(null)}
          type="button"
        >
          <span className="graph-tree-root__title">{rootViewLabel}</span>
          <span className="graph-tree-count">{totalsNotes}</span>
        </button>
        {renderTreeNodes(rootChildren)}
        {looseNotes.length > 0 && (
          <div className="graph-tree-node">
            <div className="graph-tree-section">{looseDocsLabel}</div>
            {looseNotes.map(note => (
              <button
                key={note.id}
                className={`graph-tree-leaf${selectedNodeId === note.id ? ' active' : ''}`}
                style={{ paddingLeft: '18px' }}
                onClick={() => {
                  onSelectNode(note.id, note.path)
                  if (note.path) {
                    onNotePreview?.(note.path)
                  } else {
                    onNavigate?.(note.id)
                  }
                }}
                onDoubleClick={() => onNavigate?.(note.path || note.id)}
                title={note.path}
                type="button"
              >
                <FileIcon />
                <span className="graph-tree-label">{formatKnowledgeNodeLabel(note)}</span>
              </button>
            ))}
          </div>
        )}
      </OverlayScrollbar>
    </aside>
  )
}
