import ForceGraph3D from 'react-force-graph-3d'
import { formatKnowledgeNodeLabel } from '../../lib/knowledgeFormatter'
import { createNodeObject } from './helpers'
import type { GraphCanvasLayoutTuning } from './GraphCanvas'
import {
  GRAPH_BACKDROP,
  TREE_ROOT_ID,
  type GlobalGraphMode,
  type SpaceLink,
  type SpaceNode,
} from './types'

interface GraphHeroCanvasProps {
  width: number
  height: number
  currentGraph: { nodes: SpaceNode[]; links: SpaceLink[] }
  selectedNodeId: string | null
  hoveredNodeId: string | null
  mode: GlobalGraphMode
  treeLeafNodeIds: Set<string>
  treeFocusDistances: Map<string, number>
  heroTreeReady: boolean
  heroTreeWarmupTicks: number
  layoutTuning: GraphCanvasLayoutTuning
  onNodeInteraction: (node: SpaceNode & { x?: number; y?: number; z?: number }) => void
  onNodeHover: (nodeId: string | null) => void
  graphRef: React.MutableRefObject<unknown>
}

export function GraphHeroCanvas({
  width,
  height,
  currentGraph,
  selectedNodeId,
  hoveredNodeId,
  mode,
  treeLeafNodeIds,
  treeFocusDistances,
  heroTreeReady,
  heroTreeWarmupTicks,
  layoutTuning,
  onNodeInteraction,
  onNodeHover,
  graphRef,
}: GraphHeroCanvasProps) {
  return (
    <div className="graph-space graph-space--hero" style={{ width, height }}>
      <section className="graph-space__stage graph-space__stage--hero">
        <div style={{ opacity: heroTreeReady ? 1 : 0, transition: 'opacity 120ms ease' }}>
          <ForceGraph3D
            ref={graphRef as never}
            width={Math.max(width, 320)}
            height={Math.max(height, 360)}
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
              if (current.kind === 'tag') return 'rgba(245, 158, 11, 0.2)'
              if (current.kind === 'hierarchy') return 'rgba(52, 211, 153, 0.32)'
              return 'rgba(129, 140, 248, 0.24)'
            }}
            linkWidth={(link: object) => {
              const current = link as SpaceLink
              if (current.kind === 'hierarchy') {
                return 1.8
              }
              return 1.05
            }}
            linkOpacity={0.7}
            linkDirectionalParticles={0}
            nodeAutoColorBy="kind"
            nodeThreeObject={(node: object) => createNodeObject(
              node as SpaceNode,
              selectedNodeId,
              hoveredNodeId,
              true,
              mode === 'tree' && selectedNodeId && selectedNodeId !== TREE_ROOT_ID
                ? (treeFocusDistances.get((node as SpaceNode).id) ?? null)
                : null,
              false,
              mode === 'tree' && (
                (node as SpaceNode).id === TREE_ROOT_ID
                || treeLeafNodeIds.has((node as SpaceNode).id)
              ),
            )}
            nodeThreeObjectExtend={false}
            onNodeClick={(node: object) => onNodeInteraction(node as SpaceNode & { x?: number; y?: number; z?: number })}
            onNodeHover={(node: object | null) => {
              const current = node as SpaceNode | null
              onNodeHover(current?.id || null)
              document.body.style.cursor = current ? 'pointer' : 'default'
            }}
            dagMode={undefined}
            dagLevelDistance={mode === 'tree' ? undefined : layoutTuning.dagLevelDistance}
            d3AlphaDecay={layoutTuning.alphaDecay}
            d3VelocityDecay={layoutTuning.velocityDecay}
            warmupTicks={mode === 'tree' ? 0 : heroTreeWarmupTicks}
            cooldownTicks={mode === 'tree' ? 0 : layoutTuning.cooldownTicks}
          />
        </div>
      </section>
    </div>
  )
}