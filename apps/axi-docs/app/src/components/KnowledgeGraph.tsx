import { useEffect, useRef, useCallback, MouseEvent } from 'react'
import { GraphData, GraphNode, GraphEdge } from '../types'
import { formatKnowledgeNodeLabel } from '../lib/knowledgeFormatter'

// ─── Physics constants ────────────────────────────────────────────────────────
const REPULSION = 3000
const GRAVITY = 0.002
const SPRING_K = 0.05
const REST_LENGTH_WIKILINK = 120
const REST_LENGTH_TAG = 80
const DAMPING = 0.85
const PADDING = 40

interface KnowledgeGraphProps {
  data: GraphData
  width: number
  height: number
  onNavigate: (path: string) => void
  onTagSelect?: (tag: string) => void
}

interface PhysicsState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  rafId: number | null
  running: boolean
}

export function KnowledgeGraph({ data, width, height, onNavigate, onTagSelect }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const physicsRef = useRef<PhysicsState>({ nodes: [], edges: [], rafId: null, running: false })
  const nodeElsRef = useRef<Map<string, SVGGElement>>(new Map())
  const edgeElsRef = useRef<Map<string, SVGLineElement>>(new Map())
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)

  const tick = useCallback(() => {
    const state = physicsRef.current
    if (!state.running) return

    const { nodes, edges } = state
    const cx = width / 2
    const cy = height / 2

    // Center gravity
    for (const node of nodes) {
      node.vx += (cx - node.x) * GRAVITY
      node.vy += (cy - node.y) * GRAVITY
    }

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x
        const dy = nodes[j].y - nodes[i].y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const distSoft = Math.max(dist, 30)
        const f = REPULSION / (distSoft * distSoft)
        const fx = (dx / dist) * f
        const fy = (dy / dist) * f
        nodes[i].vx -= fx
        nodes[i].vy -= fy
        nodes[j].vx += fx
        nodes[j].vy += fy
      }
    }

    // Spring attraction along edges
    const nodeById = new Map<string, GraphNode>(nodes.map((n: GraphNode) => [n.id, n]))
    for (const edge of edges) {
      const s = nodeById.get(edge.source)
      const t = nodeById.get(edge.target)
      if (!s || !t) continue
      const dx = t.x - s.x
      const dy = t.y - s.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const restLen = edge.kind === 'tag' ? REST_LENGTH_TAG : REST_LENGTH_WIKILINK
      const stretch = dist - restLen
      const f = stretch * SPRING_K
      const fx = (dx / dist) * f
      const fy = (dy / dist) * f
      s.vx += fx; s.vy += fy
      t.vx -= fx; t.vy -= fy
    }

    // Damping + integrate
    for (const node of nodes) {
      node.vx *= DAMPING
      node.vy *= DAMPING
      node.x = Math.max(PADDING, Math.min(width - PADDING, node.x + node.vx))
      node.y = Math.max(PADDING, Math.min(height - PADDING, node.y + node.vy))
    }

    // Direct DOM update
    for (const node of nodes) {
      const el = nodeElsRef.current.get(node.id)
      if (el) el.setAttribute('transform', `translate(${node.x},${node.y})`)
    }
    for (const edge of edges) {
      const edgeId = `${edge.source}__${edge.target}`
      const el = edgeElsRef.current.get(edgeId)
      if (el) {
        const s = nodeById.get(edge.source)
        const t = nodeById.get(edge.target)
        if (s && t) {
          el.setAttribute('x1', String(s.x))
          el.setAttribute('y1', String(s.y))
          el.setAttribute('x2', String(t.x))
          el.setAttribute('y2', String(t.y))
        }
      }
    }

    const ke = nodes.reduce((sum: number, n: GraphNode) => sum + n.vx * n.vx + n.vy * n.vy, 0)
    if (ke > 0.01) {
      state.rafId = requestAnimationFrame(tick)
    } else {
      state.running = false
      state.rafId = null
    }
  }, [width, height])

  // Initialize simulation when data changes
  useEffect(() => {
    const state = physicsRef.current
    if (state.rafId !== null) cancelAnimationFrame(state.rafId)
    state.running = false

    const cx = width / 2
    const cy = height / 2
    const nodes: GraphNode[] = data.nodes.map((n, i) => {
      if (n.kind === 'current') {
        return { ...n, x: cx, y: cy, vx: 0, vy: 0 }
      }
      const angle = (i / Math.max(data.nodes.length - 1, 1)) * Math.PI * 2
      const r = 150 + (Math.random() * 40 - 20)
      return { ...n, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, vx: 0, vy: 0 }
    })

    physicsRef.current = { nodes, edges: [...data.edges], rafId: null, running: true }
    physicsRef.current.rafId = requestAnimationFrame(tick)

    return () => {
      if (physicsRef.current.rafId !== null) cancelAnimationFrame(physicsRef.current.rafId)
      physicsRef.current.running = false
    }
  }, [data, width, height, tick])

  const handleMouseDown = useCallback((e: MouseEvent<SVGGElement>, nodeId: string) => {
    e.stopPropagation()
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return
    const node = physicsRef.current.nodes.find((n: GraphNode) => n.id === nodeId)
    if (!node) return
    draggingRef.current = {
      id: nodeId,
      offsetX: (e.clientX - svgRect.left) - node.x,
      offsetY: (e.clientY - svgRect.top) - node.y,
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return
    const node = physicsRef.current.nodes.find((n: GraphNode) => n.id === draggingRef.current!.id)
    if (!node) return
    node.x = (e.clientX - svgRect.left) - draggingRef.current.offsetX
    node.y = (e.clientY - svgRect.top) - draggingRef.current.offsetY
    node.vx = 0
    node.vy = 0
    if (!physicsRef.current.running) {
      physicsRef.current.running = true
      physicsRef.current.rafId = requestAnimationFrame(tick)
    }
  }, [tick])

  const handleMouseUp = useCallback(() => { draggingRef.current = null }, [])

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (draggingRef.current) return
    if (node.kind === 'note') onNavigate(node.id)
    else if (node.kind === 'tag' && onTagSelect) onTagSelect(node.label)
  }, [onNavigate, onTagSelect])

  const nodeRadius = (kind: GraphNode['kind']) =>
    kind === 'current' ? 18 : kind === 'note' ? 11 : 7

  const nodeFill = (kind: GraphNode['kind']) =>
    kind === 'current' ? 'var(--color-primary)' :
    kind === 'note' ? 'var(--color-obsidian)' :
    'var(--color-blinko)'

  const nodeOpacity = (kind: GraphNode['kind']) =>
    kind === 'current' ? 1 : kind === 'note' ? 0.7 : 0.6

  if (!data.nodes.length) {
    return (
      <div className="kp-graph" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
        无关联节点
      </div>
    )
  }

  const cx = width / 2
  const cy = height / 2

  return (
    <div className="kp-graph">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g>
          {data.edges.map(edge => {
            const edgeId = `${edge.source}__${edge.target}`
            return (
              <line
                key={edgeId}
                ref={(el: SVGLineElement | null) => {
                  if (el) edgeElsRef.current.set(edgeId, el)
                  else edgeElsRef.current.delete(edgeId)
                }}
                className={`graph-edge${edge.kind === 'tag' ? ' graph-edge--tag' : ''}`}
                x1={cx} y1={cy} x2={cx} y2={cy}
              />
            )
          })}
        </g>
        <g>
          {data.nodes.map(node => (
            <g
              key={node.id}
              ref={(el: SVGGElement | null) => {
                if (el) nodeElsRef.current.set(node.id, el)
                else nodeElsRef.current.delete(node.id)
              }}
              className="graph-node"
              transform={`translate(${cx},${cy})`}
              onMouseDown={(e: MouseEvent<SVGGElement>) => handleMouseDown(e, node.id)}
              onClick={() => handleNodeClick(node)}
            >
              <circle
                r={nodeRadius(node.kind)}
                fill={nodeFill(node.kind)}
                opacity={nodeOpacity(node.kind)}
              />
              <text textAnchor="middle" dy={nodeRadius(node.kind) + 12}>
                {(() => {
                  const displayLabel = formatKnowledgeNodeLabel(node)
                  return displayLabel.length > 12 ? displayLabel.slice(0, 12) + '…' : displayLabel
                })()}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
