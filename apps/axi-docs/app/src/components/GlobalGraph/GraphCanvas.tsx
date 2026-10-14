import ForceGraph3D from 'react-force-graph-3d'
import { formatKnowledgeNodeLabel } from '../../lib/knowledgeFormatter'
import { createNodeObject, normalizeEndpoint } from './helpers'
import {
  GRAPH_BACKDROP,
  type GlobalGraphMode,
  type SpaceLink,
  type SpaceNode,
} from './types'

export interface GraphCanvasLayoutTuning {
  chargeStrength: number
  linkDistance: number
  dagLevelDistance: number | undefined
  alphaDecay: number
  velocityDecay: number
  cooldownTicks: number
}

export interface GraphCanvasProps {
  ref?: React.MutableRefObject<unknown>
  width: number
  height: number
  isDockLayout: boolean
  showTreePanel: boolean
  currentGraph: { nodes: SpaceNode[]; links: SpaceLink[] }
  mode: GlobalGraphMode
  selectedNodeId: string | null
  hoveredNodeId: string | null
  treeFocusDistances: Map<string, number>
  treeEmphasisNodeIds: Set<string>
  selectedNeighbors: Set<string>
  layoutTuning: GraphCanvasLayoutTuning
  onNodeInteraction: (node: SpaceNode & { x?: number; y?: number; z?: number }) => void
  onNodeHover: (nodeId: string | null) => void
}

export function GraphCanvas({
  ref,
  width,
  height,
  isDockLayout,
  showTreePanel,
  currentGraph,
  mode,
  selectedNodeId,
  hoveredNodeId,
  treeFocusDistances,
  treeEmphasisNodeIds,
  selectedNeighbors,
  layoutTuning,
  onNodeInteraction,
  onNodeHover,
}: GraphCanvasProps) {
  const canvasWidth = Math.max(width - (isDockLayout ? (showTreePanel ? 220 : 0) : 540), 320)
  const canvasHeight = Math.max(height - (isDockLayout ? 116 : 140), 280)

  return (
    <ForceGraph3D
      ref={ref as never}
      width={canvasWidth}
      height={canvasHeight}
      graphData={currentGraph as never}
      nodeLabel={(node: object) => {
        const current = node as SpaceNode
        return current.path
          ? `${formatKnowledgeNodeLabel(current)}\n${current.path}`
          : formatKnowledgeNodeLabel(current)
      }}
      backgroundColor={GRAPH_BACKDROP}
      showNavInfo={false}
      linkColor={(link: object) => {
        const current = link as SpaceLink
        const source = normalizeEndpoint(current.source)
        const target = normalizeEndpoint(current.target)
        const sourceDistance = mode === 'tree' ? treeFocusDistances.get(source) : null
        const targetDistance = mode === 'tree' ? treeFocusDistances.get(target) : null
        const emphasisDistance = sourceDistance == null || targetDistance == null
          ? null
          : Math.min(sourceDistance, targetDistance)
        const subtreeFocused = mode === 'tree' && treeEmphasisNodeIds.size > 0
        const inFocusedSubtree = !subtreeFocused || (treeEmphasisNodeIds.has(source) && treeEmphasisNodeIds.has(target))
        const faded = !inFocusedSubtree || (emphasisDistance !== null && emphasisDistance >= 3)
        const highlighted = selectedNodeId && (
          source === selectedNodeId
          || target === selectedNodeId
          || selectedNeighbors.has(source)
          || selectedNeighbors.has(target)
        )
        if (current.kind === 'tag') return highlighted ? 'rgba(245, 158, 11, 0.85)' : faded ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.25)'
        if (current.kind === 'hierarchy') return highlighted ? 'rgba(52, 211, 153, 0.8)' : faded ? 'rgba(52, 211, 153, 0.16)' : 'rgba(52, 211, 153, 0.28)'
        return highlighted ? 'rgba(129, 140, 248, 0.95)' : faded ? 'rgba(129, 140, 248, 0.12)' : 'rgba(129, 140, 248, 0.22)'
      }}
      linkWidth={(link: object) => {
        const current = link as SpaceLink
        const source = normalizeEndpoint(current.source)
        const target = normalizeEndpoint(current.target)
        const sourceDistance = mode === 'tree' ? treeFocusDistances.get(source) : null
        const targetDistance = mode === 'tree' ? treeFocusDistances.get(target) : null
        const emphasisDistance = sourceDistance == null || targetDistance == null
          ? null
          : Math.min(sourceDistance, targetDistance)
        const subtreeFocused = mode === 'tree' && treeEmphasisNodeIds.size > 0
        const inFocusedSubtree = !subtreeFocused || (treeEmphasisNodeIds.has(source) && treeEmphasisNodeIds.has(target))
        return selectedNodeId && (source === selectedNodeId || target === selectedNodeId)
          ? 3.2
          : !inFocusedSubtree || (emphasisDistance !== null && emphasisDistance >= 3)
            ? 0.8
          : current.kind === 'hierarchy'
            ? 1.6
            : 1.1
      }}
      linkOpacity={0.7}
      linkDirectionalParticles={(link: object) => {
        const current = link as SpaceLink
        const source = normalizeEndpoint(current.source)
        const target = normalizeEndpoint(current.target)
        const sourceDistance = mode === 'tree' ? treeFocusDistances.get(source) : null
        const targetDistance = mode === 'tree' ? treeFocusDistances.get(target) : null
        const emphasisDistance = sourceDistance == null || targetDistance == null
          ? null
          : Math.min(sourceDistance, targetDistance)
        const subtreeFocused = mode === 'tree' && treeEmphasisNodeIds.size > 0
        const inFocusedSubtree = !subtreeFocused || (treeEmphasisNodeIds.has(source) && treeEmphasisNodeIds.has(target))
        return selectedNodeId && (source === selectedNodeId || target === selectedNodeId)
          ? 3
          : !inFocusedSubtree || (emphasisDistance !== null && emphasisDistance >= 3)
            ? 0
          : current.kind === 'hierarchy'
            ? 1
            : 0
      }}
      linkDirectionalParticleWidth={1.8}
      linkDirectionalParticleSpeed={0.0035}
      nodeAutoColorBy="kind"
      nodeThreeObject={(node: object) => createNodeObject(
        node as SpaceNode,
        selectedNodeId,
        hoveredNodeId,
        false,
        mode === 'tree' ? (treeFocusDistances.get((node as SpaceNode).id) ?? null) : null,
        mode === 'tree' && treeEmphasisNodeIds.size > 0,
      )}
      nodeThreeObjectExtend={false}
      onNodeClick={(node: object) => onNodeInteraction(node as SpaceNode & { x?: number; y?: number; z?: number })}
      onNodeHover={(node: object | null) => {
        const current = node as SpaceNode | null
        onNodeHover(current?.id || null)
        document.body.style.cursor = current ? 'pointer' : 'default'
      }}
      dagMode={mode === 'tree' ? 'zout' : undefined}
      dagLevelDistance={layoutTuning.dagLevelDistance}
      d3AlphaDecay={layoutTuning.alphaDecay}
      d3VelocityDecay={layoutTuning.velocityDecay}
      cooldownTicks={layoutTuning.cooldownTicks}
    />
  )
}