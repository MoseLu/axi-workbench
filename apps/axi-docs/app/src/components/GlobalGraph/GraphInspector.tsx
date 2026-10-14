import { formatKnowledgeNodeLabel } from '../../lib/knowledgeFormatter'
import { describeNodeKind } from './helpers'
import type { SpaceNode } from './types'

interface GraphInspectorProps {
  selectedNode: SpaceNode | null | undefined
  adjacencySize: number
  onTagSelect?: (tag: string) => void
  onNotePreview?: (path: string) => void
  onNavigate?: (path: string) => void
  onFocusBranch: (path: string | null) => void
  inspectorEmpty: string
  badgeCopy: { current: string; note: string; tag: string; branch: string }
  labels: {
    preview: string
    open: string
    filterByTag: string
    focusBranch: string
  }
  extraEmpty?: React.ReactNode
  emptyMode?: boolean
  neighboursLabel: string
  typeLabel: string
  subDocsLabel: string
}

export function GraphInspector({
  selectedNode,
  adjacencySize,
  onTagSelect,
  onNotePreview,
  onNavigate,
  onFocusBranch,
  inspectorEmpty,
  badgeCopy,
  labels,
  neighboursLabel,
  typeLabel,
  subDocsLabel,
}: GraphInspectorProps) {
  if (!selectedNode) {
    return (
      <div className="graph-inspector graph-inspector--empty">
        <p>{inspectorEmpty}</p>
      </div>
    )
  }

  return (
    <div className="graph-inspector">
      <div className={`graph-inspector__badge graph-inspector__badge--${selectedNode.kind}`}>
        {selectedNode.kind === 'current' && badgeCopy.current}
        {selectedNode.kind === 'note' && badgeCopy.note}
        {selectedNode.kind === 'tag' && badgeCopy.tag}
        {selectedNode.kind === 'branch' && badgeCopy.branch}
      </div>
      <h4 className="graph-inspector__title">{formatKnowledgeNodeLabel(selectedNode)}</h4>
      {selectedNode.path && (
        <div className="graph-inspector__path">{selectedNode.path}</div>
      )}
      {selectedNode.tags && selectedNode.tags.length > 0 && (
        <div className="graph-inspector__tags">
          {selectedNode.tags.slice(0, 8).map(tag => (
            <button
              key={tag}
              className="tag tag--small"
              onClick={() => onTagSelect?.(tag)}
              type="button"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div className="graph-inspector__facts">
        <div className="graph-fact">
          <span>{neighboursLabel}</span>
          <strong>{adjacencySize}</strong>
        </div>
        <div className="graph-fact">
          <span>{typeLabel}</span>
          <strong>{describeNodeKind(selectedNode.kind)}</strong>
        </div>
        {selectedNode.count !== undefined && (
          <div className="graph-fact">
            <span>{subDocsLabel}</span>
            <strong>{selectedNode.count}</strong>
          </div>
        )}
      </div>

      <div className="graph-inspector__actions">
        {(selectedNode.kind === 'note' || selectedNode.kind === 'current') && selectedNode.path && onNotePreview && (
          <button className="graph-action" onClick={() => onNotePreview(selectedNode.path!)} type="button">
            {labels.preview}
          </button>
        )}
        {(selectedNode.kind === 'note' || selectedNode.kind === 'current') && selectedNode.path && (
          <button className="graph-action" onClick={() => onNavigate?.(selectedNode.path!)} type="button">
            {labels.open}
          </button>
        )}
        {selectedNode.kind === 'tag' && (
          <button className="graph-action" onClick={() => onTagSelect?.(selectedNode.label)} type="button">
            {labels.filterByTag}
          </button>
        )}
        {selectedNode.kind === 'branch' && (
          <button className="graph-action" onClick={() => onFocusBranch(selectedNode.path || null)} type="button">
            {labels.focusBranch}
          </button>
        )}
      </div>
    </div>
  )
}
