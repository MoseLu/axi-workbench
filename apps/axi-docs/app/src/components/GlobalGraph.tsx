import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import { pageCopy } from '../config/pageCopy'
import {
  getGlobalKnowledgeGraph as loadGlobalKnowledgeGraph,
  getKnowledgeGraph as loadKnowledgeGraph,
} from '../lib/knowledgeClient'
import {
  formatKnowledgeBranchLabel,
  formatKnowledgeNodeLabel,
  formatKnowledgeTagLabel,
} from '../lib/knowledgeFormatter'
import {
  buildKnowledgeTree,
  collectTreeBranchIds,
  resolveSelectedTree,
  type GraphNoteNode,
  type GraphTreeNode,
} from '../lib/knowledgeTreeGraph'
import { FileIcon, FolderIcon, LinkIcon, SearchIcon } from './Icons'
import { OverlayScrollbar } from './OverlayScrollbar'

type GlobalGraphMode = 'focus' | 'global' | 'tree' | 'orphan'
type GraphChrome = 'hero' | 'cockpit' | 'minimal'

interface GlobalGraphNode {
  id: string
  label: string
  kind: 'current' | 'note' | 'tag'
  path?: string
  tags?: string[]
}

interface GlobalGraphEdge {
  source: string
  target: string
  kind: 'wikilink' | 'tag'
}

interface GraphApiResponse {
  nodes: GlobalGraphNode[]
  edges: GlobalGraphEdge[]
  orphanNodes?: GlobalGraphNode[]
}

type SpaceNodeKind = 'current' | 'note' | 'tag' | 'branch'

interface SpaceNode {
  id: string
  label: string
  kind: SpaceNodeKind
  path?: string
  tags?: string[]
  count?: number
  depth?: number
}

interface SpaceLink {
  source: string
  target: string
  kind: 'wikilink' | 'tag' | 'hierarchy'
}

interface GlobalGraphProps {
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

const SPACE_COLORS: Record<SpaceNodeKind, string> = {
  current: '#7dd3fc',
  note: '#818cf8',
  tag: '#f59e0b',
  branch: '#34d399',
}

const GRAPH_BACKDROP = '#06111f'
const TREE_ROOT_ID = 'branch:__knowledge-root__'

function displayNodeLabel(node: Pick<SpaceNode, 'id' | 'kind' | 'label' | 'path'>): string {
  return formatKnowledgeNodeLabel(node).slice(0, 40)
}

function truncateLabel(label: string, max = 26): string {
  return label.length > max ? `${label.slice(0, max)}…` : label
}

function normalizeEndpoint(endpoint: string | { id: string }): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id
}

function matchesQuery(node: Pick<GlobalGraphNode, 'label' | 'path' | 'tags'>, term: string): boolean {
  if (!term) return true
  const haystack = `${node.label} ${node.path || ''} ${(node.tags || []).join(' ')}`.toLowerCase()
  return term
    .split(/\s+/)
    .filter(Boolean)
    .every(token => haystack.includes(token))
}

function buildAdjacency(links: SpaceLink[]) {
  const adjacency = new Map<string, Set<string>>()
  for (const link of links) {
    const sourceId = normalizeEndpoint(link.source)
    const targetId = normalizeEndpoint(link.target)
    if (!adjacency.has(sourceId)) adjacency.set(sourceId, new Set())
    if (!adjacency.has(targetId)) adjacency.set(targetId, new Set())
    adjacency.get(sourceId)!.add(targetId)
    adjacency.get(targetId)!.add(sourceId)
  }
  return adjacency
}

function buildTreeParentMap(links: SpaceLink[]) {
  const parentMap = new Map<string, string>()
  for (const link of links) {
    if (link.kind !== 'hierarchy') continue
    parentMap.set(normalizeEndpoint(link.target), normalizeEndpoint(link.source))
  }
  return parentMap
}

function buildTreeChildrenMap(links: SpaceLink[]) {
  const childrenMap = new Map<string, Set<string>>()
  for (const link of links) {
    if (link.kind !== 'hierarchy') continue
    const sourceId = normalizeEndpoint(link.source)
    const targetId = normalizeEndpoint(link.target)
    if (!childrenMap.has(sourceId)) childrenMap.set(sourceId, new Set())
    childrenMap.get(sourceId)!.add(targetId)
  }
  return childrenMap
}

function collectSubtreeIds(rootId: string, childrenMap: Map<string, Set<string>>) {
  const ids = new Set<string>([rootId])
  const queue = [rootId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    for (const childId of childrenMap.get(currentId) || []) {
      if (ids.has(childId)) continue
      ids.add(childId)
      queue.push(childId)
    }
  }

  return ids
}

function buildTreeDistanceMap(rootId: string, childrenMap: Map<string, Set<string>>) {
  const distances = new Map<string, number>([[rootId, 0]])
  const queue = [rootId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const nextDistance = (distances.get(currentId) || 0) + 1
    for (const childId of childrenMap.get(currentId) || []) {
      if (distances.has(childId)) continue
      distances.set(childId, nextDistance)
      queue.push(childId)
    }
  }

  return distances
}

interface PositionedSpaceNode extends SpaceNode {
  x: number
  y: number
  z: number
  fx: number
  fy: number
  fz: number
}

function sortTreeLayoutNodes(nodeIds: Iterable<string>, nodeById: Map<string, SpaceNode>) {
  return [...nodeIds]
    .map((id) => nodeById.get(id))
    .filter((node): node is SpaceNode => Boolean(node))
    .sort((left, right) => {
      const typeScore = (node: SpaceNode) => {
        if (node.id === TREE_ROOT_ID) return 200
        if (node.kind === 'branch') return 120 + (node.count || 0)
        if (node.kind === 'current') return 80
        return 40
      }
      const scoreDiff = typeScore(right) - typeScore(left)
      if (scoreDiff !== 0) return scoreDiff
      return left.label.localeCompare(right.label, 'zh-CN')
    })
}

function collectAncestorChain(nodeId: string, parentMap: Map<string, string>) {
  const chain: string[] = []
  let current = parentMap.get(nodeId)
  while (current) {
    chain.push(current)
    current = parentMap.get(current)
  }
  return chain
}

function buildHeroContextIds(
  graph: { nodes: SpaceNode[]; links: SpaceLink[] },
  focusId?: string | null,
) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const parentMap = buildTreeParentMap(graph.links)
  const childrenMap = buildTreeChildrenMap(graph.links)
  const resolvedFocusId = focusId && nodeById.has(focusId) ? focusId : TREE_ROOT_ID
  const keepIds = new Set<string>([TREE_ROOT_ID, resolvedFocusId])

  if (resolvedFocusId === TREE_ROOT_ID) {
    for (const node of graph.nodes) {
      if (node.kind !== 'tag') keepIds.add(node.id)
    }
    return keepIds
  }

  for (const id of collectSubtreeIds(resolvedFocusId, childrenMap)) {
    keepIds.add(id)
  }

  const ancestors = collectAncestorChain(resolvedFocusId, parentMap)
  let pathChildId = resolvedFocusId
  for (const ancestorId of ancestors) {
    keepIds.add(ancestorId)
    const siblingIds = childrenMap.get(ancestorId) || new Set<string>()
    for (const siblingId of siblingIds) {
      keepIds.add(siblingId)
      if (siblingId === pathChildId) continue
      for (const childId of sortTreeLayoutNodes(childrenMap.get(siblingId) || [], nodeById).slice(0, 3).map((node) => node.id)) {
        keepIds.add(childId)
      }
    }
    pathChildId = ancestorId
  }

  for (const rootChildId of childrenMap.get(TREE_ROOT_ID) || []) {
    keepIds.add(rootChildId)
  }

  return keepIds
}

function layoutHeroTreeGraph(
  graph: { nodes: SpaceNode[]; links: SpaceLink[] },
  focusId: string | null | undefined,
  width: number,
  height: number,
) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  if (!nodeById.has(TREE_ROOT_ID)) return graph

  const parentMap = buildTreeParentMap(graph.links)
  const childrenMap = buildTreeChildrenMap(graph.links)
  const centerId = focusId && nodeById.has(focusId) ? focusId : TREE_ROOT_ID
  const placed = new Map<string, PositionedSpaceNode>()
  const xUnit = Math.max(width * 0.19, 250)
  const yUnit = Math.max(height * 0.18, 180)
  const outerRadiusX = Math.max(width * 0.45, 680)
  const outerRadiusY = Math.max(height * 0.4, 330)
  const zUnit = Math.max(Math.min(width, height) * 0.11, 78)
  const subtreeWeightCache = new Map<string, number>()
  const subtreeDepthCache = new Map<string, number>()

  const placeNode = (id: string, x: number, y: number, z = 0) => {
    const node = nodeById.get(id)
    if (!node) return
    placed.set(id, { ...node, x, y, z, fx: x, fy: y, fz: z })
  }

  const getVisibleChildren = (id: string) =>
    sortTreeLayoutNodes(childrenMap.get(id) || [], nodeById).map((node) => node.id)

  const getSubtreeWeight = (id: string): number => {
    const cached = subtreeWeightCache.get(id)
    if (cached !== undefined) return cached
    const childIds = getVisibleChildren(id)
    if (childIds.length === 0) {
      subtreeWeightCache.set(id, 1)
      return 1
    }
    const weight = Math.max(
      1,
      childIds.reduce((sum, childId) => sum + getSubtreeWeight(childId), 0),
    )
    subtreeWeightCache.set(id, weight)
    return weight
  }

  const getSubtreeDepth = (id: string): number => {
    const cached = subtreeDepthCache.get(id)
    if (cached !== undefined) return cached
    const childIds = getVisibleChildren(id)
    if (childIds.length === 0) {
      subtreeDepthCache.set(id, 1)
      return 1
    }
    const depth = 1 + Math.max(...childIds.map((childId) => getSubtreeDepth(childId)))
    subtreeDepthCache.set(id, depth)
    return depth
  }

  const layoutFan = (
    parentId: string,
    childIds: string[],
    centerAngle: number,
    spread: number,
    radiusX: number,
    radiusY: number,
    depth: number,
  ) => {
    const parent = placed.get(parentId)
    if (!parent || childIds.length === 0) return
    const orderedChildren = sortTreeLayoutNodes(childIds, nodeById)
    const nextSpread = Math.max(0.56, spread * 0.74)
    const nextRadiusX = Math.max(radiusX * 0.76, 150)
    const nextRadiusY = Math.max(radiusY * 0.76, 132)
    orderedChildren.forEach((child, index) => {
      const t = orderedChildren.length === 1 ? 0 : index / (orderedChildren.length - 1) - 0.5
      const angle = centerAngle + t * spread
      const childX = parent.x + Math.cos(angle) * radiusX
      const childY = parent.y + Math.sin(angle) * radiusY
      const childZ = parent.z
        + Math.sin(angle * 1.18 + depth * 0.42) * zUnit * 0.68
        + t * zUnit * Math.max(1.2, orderedChildren.length / 1.8)
        + (index % 2 === 0 ? 1 : -1) * depth * zUnit * 0.12
      placeNode(child.id, childX, childY, childZ)
    })

    orderedChildren.forEach((child, index) => {
      const t = orderedChildren.length === 1 ? 0 : index / (orderedChildren.length - 1) - 0.5
      const angle = centerAngle + t * spread
      const nestedChildIds = [...(childrenMap.get(child.id) || [])].filter((id) => nodeById.has(id) && !placed.has(id))
      layoutFan(
        child.id,
        nestedChildIds,
        angle,
        nextSpread,
        nextRadiusX,
        nextRadiusY,
        depth + 1,
      )
    })
  }

  placeNode(centerId, 0, 0, 0)

  if (centerId === TREE_ROOT_ID) {
    const rootChildren = sortTreeLayoutNodes(childrenMap.get(TREE_ROOT_ID) || [], nodeById)
    const totalWeight = Math.max(
      1,
      rootChildren.reduce((sum, child) => sum + getSubtreeWeight(child.id), 0),
    )
    const maxDepth = Math.max(2, ...rootChildren.map((child) => getSubtreeDepth(child.id)))
    const rootRingX = Math.max(Math.min(width * 0.22, 320), 260)
    const rootRingY = Math.max(Math.min(height * 0.16, 180), 140)
    const maxRadiusX = Math.max(Math.min(width * 0.34, 440), rootRingX + 110)
    const maxRadiusY = Math.max(Math.min(height * 0.21, 220), rootRingY + 60)
    const radialStepX = Math.max((maxRadiusX - rootRingX) / Math.max(maxDepth - 1, 1), 68)
    const radialStepY = Math.max((maxRadiusY - rootRingY) / Math.max(maxDepth - 1, 1), 38)
    const startAngle = -Math.PI
    const fullSpan = Math.PI * 2

    const placeRadialSubtree = (
      nodeId: string,
      depth: number,
      centerAngle: number,
      span: number,
    ) => {
      const radiusX = rootRingX + Math.max(0, depth - 1) * radialStepX
      const radiusY = rootRingY + Math.max(0, depth - 1) * radialStepY
      const zScale = Math.max(0.46, 1 - depth * 0.12)
      const childX = Math.cos(centerAngle) * radiusX
      const childY = Math.sin(centerAngle) * radiusY
      const childZ = Math.sin(centerAngle * 1.18) * zUnit * zScale
      placeNode(nodeId, childX, childY, childZ)

      const childIds = getVisibleChildren(nodeId).filter((id) => !placed.has(id))
      if (childIds.length === 0) return

      const totalChildWeight = Math.max(
        1,
        childIds.reduce((sum, childId) => sum + getSubtreeWeight(childId), 0),
      )
      const minSpan = Math.min(0.34, span / Math.max(childIds.length, 1))
      let cursor = centerAngle - span / 2
      childIds.forEach((childId) => {
        const childWeight = getSubtreeWeight(childId)
        const proportionalSpan = span * (childWeight / totalChildWeight)
        const childSpan = childIds.length === 1
          ? span * 0.62
          : Math.max(minSpan, proportionalSpan)
        const childAngle = childIds.length === 1
          ? centerAngle
          : cursor + childSpan / 2
        const nextSpan = Math.min(childSpan * 0.84, span * 0.84)
        placeRadialSubtree(childId, depth + 1, childAngle, nextSpan)
        cursor += childSpan
      })
    }

    let cursor = startAngle
    rootChildren.forEach((child) => {
      const weightRatio = getSubtreeWeight(child.id) / totalWeight
      const childSpan = Math.max(fullSpan * weightRatio, 0.6)
      const childAngle = cursor + childSpan / 2
      placeRadialSubtree(child.id, 1, childAngle, Math.min(childSpan * 0.78, 1.34))
      cursor += childSpan
    })
  } else {
    const ancestorChain = collectAncestorChain(centerId, parentMap)
    let previousId = centerId
    ancestorChain.forEach((ancestorId, index) => {
      const ancestorX = -xUnit * (index + 1.06)
      const ancestorY = (index % 2 === 0 ? -1 : 1) * yUnit * Math.min(0.22 + index * 0.1, 0.46)
      const ancestorZ = (ancestorChain.length - index) * zUnit * 0.34 - zUnit * 0.3
      placeNode(ancestorId, ancestorX, ancestorY, ancestorZ)

      const sideChildIds = [...(childrenMap.get(ancestorId) || [])]
        .filter((id) => id !== previousId && nodeById.has(id))
      layoutFan(
        ancestorId,
        sideChildIds,
        Math.PI + (index % 2 === 0 ? -0.65 : 0.65),
        0.94,
        Math.max(xUnit * 0.86, 180),
        Math.max(yUnit * 0.9, 150),
        1,
      )

      previousId = ancestorId
    })

    const focusChildren = [...(childrenMap.get(centerId) || [])].filter((id) => nodeById.has(id))
    layoutFan(
      centerId,
      focusChildren,
      0,
      1.46,
      Math.max(xUnit * 1.08, 230),
      Math.max(yUnit * 1.08, 200),
      1,
    )

    const remainingRootBranches = [...(childrenMap.get(TREE_ROOT_ID) || [])]
      .filter((id) => !placed.has(id) && nodeById.has(id))
    const orderedRootBranches = sortTreeLayoutNodes(remainingRootBranches, nodeById)
    orderedRootBranches.forEach((branch, index) => {
      const angle = orderedRootBranches.length === 1
        ? Math.PI * 0.82
        : Math.PI * 0.55 + (index * Math.PI * 0.9) / Math.max(orderedRootBranches.length - 1, 1)
      const branchX = Math.cos(angle) * outerRadiusX
      const branchY = Math.sin(angle) * outerRadiusY
      const branchZ = Math.sin(angle * 1.3) * zUnit * 0.82 + (index - (orderedRootBranches.length - 1) / 2) * zUnit * 0.24
      placeNode(branch.id, branchX, branchY, branchZ)
      layoutFan(
        branch.id,
        [...(childrenMap.get(branch.id) || [])],
        angle,
        0.82,
        Math.max(xUnit * 0.76, 150),
        Math.max(yUnit * 0.8, 126),
        1,
      )
    })
  }

  const remainingNodes = sortTreeLayoutNodes(
    graph.nodes.map((node) => node.id).filter((id) => !placed.has(id)),
    nodeById,
  )
  remainingNodes.forEach((node, index) => {
    const angle = -Math.PI * 0.9 + (index * Math.PI * 1.8) / Math.max(remainingNodes.length, 1)
    placeNode(
      node.id,
      Math.cos(angle) * outerRadiusX,
      Math.sin(angle) * outerRadiusY * 1.08,
      Math.sin(angle * 1.24) * zUnit * 0.78 + (index - (remainingNodes.length - 1) / 2) * zUnit * 0.22,
    )
  })

  return {
    nodes: graph.nodes.map((node) => placed.get(node.id) || ({ ...node, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0 })),
    links: graph.links,
  }
}

function createTreeGraph(
  roots: GraphTreeNode[],
  looseNotes: GraphNoteNode[],
  selectedBranch: GraphTreeNode | null,
  searchTerm: string,
) {
  const nodes: SpaceNode[] = [{
    id: TREE_ROOT_ID,
    label: selectedBranch ? formatKnowledgeBranchLabel(selectedBranch.label) : '知识空间',
    kind: 'branch',
    path: selectedBranch?.pathKey,
    count: selectedBranch?.count,
    depth: 0,
  }]
  const links: SpaceLink[] = []

  function visitBranch(branch: GraphTreeNode, parentId: string) {
    nodes.push({
      id: branch.id,
      label: branch.label,
      kind: 'branch',
      path: branch.pathKey,
      count: branch.count,
      depth: branch.depth,
    })
    links.push({ source: parentId, target: branch.id, kind: 'hierarchy' })

    for (const child of branch.children) {
      visitBranch(child, branch.id)
    }

    for (const note of branch.notes) {
      if (!matchesQuery(note, searchTerm)) continue
      nodes.push({
        id: note.id,
        label: note.label,
        kind: note.kind === 'current' ? 'current' : 'note',
        path: note.path,
        tags: note.tags,
      })
      links.push({ source: branch.id, target: note.id, kind: 'hierarchy' })
    }
  }

  for (const branch of roots) {
    visitBranch(branch, TREE_ROOT_ID)
  }

  for (const note of looseNotes) {
    if (!matchesQuery(note, searchTerm)) continue
    nodes.push({
      id: note.id,
      label: note.label,
      kind: note.kind === 'current' ? 'current' : 'note',
      path: note.path,
      tags: note.tags,
    })
    links.push({ source: TREE_ROOT_ID, target: note.id, kind: 'hierarchy' })
  }

  return { nodes, links }
}

function getGraphBounds(nodes: Array<SpaceNode & { x: number; y: number; z: number }>) {
  return nodes.reduce(
    (accumulator, node) => ({
      minX: Math.min(accumulator.minX, node.x),
      maxX: Math.max(accumulator.maxX, node.x),
      minY: Math.min(accumulator.minY, node.y),
      maxY: Math.max(accumulator.maxY, node.y),
      minZ: Math.min(accumulator.minZ, node.z),
      maxZ: Math.max(accumulator.maxZ, node.z),
    }),
    {
      minX: nodes[0].x,
      maxX: nodes[0].x,
      minY: nodes[0].y,
      maxY: nodes[0].y,
      minZ: nodes[0].z,
      maxZ: nodes[0].z,
    },
  )
}

function getCameraFitDistance(
  bounds: ReturnType<typeof getGraphBounds>,
  viewportWidth: number,
  viewportHeight: number,
  fovDegrees: number,
  paddingXRatio = 1.08,
  paddingYRatio = 1.08,
  depthFactor = 0.72,
) {
  const safeWidth = Math.max(viewportWidth, 320)
  const safeHeight = Math.max(viewportHeight, 360)
  const aspect = safeWidth / safeHeight
  const verticalFov = THREE.MathUtils.degToRad(fovDegrees)
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
  const spanX = Math.max(bounds.maxX - bounds.minX, 140) * paddingXRatio
  const spanY = Math.max(bounds.maxY - bounds.minY, 140) * paddingYRatio
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 96)
  const distanceX = (spanX / 2) / Math.tan(horizontalFov / 2)
  const distanceY = (spanY / 2) / Math.tan(verticalFov / 2)

  return Math.max(distanceX, distanceY, spanZ * depthFactor, 220)
}

function resolveFocusScale(distance: number | null, node: SpaceNode) {
  if (distance === null) return 1
  if (distance === 0) return node.id === TREE_ROOT_ID ? 1.4 : 1.34
  if (distance === 1) return node.kind === 'branch' ? 1.2 : 1.12
  if (distance === 2) return 1
  if (distance === 3) return 0.82
  return 0.62
}

function createNodeObject(
  node: SpaceNode,
  selectedId: string | null,
  hoveredId: string | null,
  hero = false,
  focusDistance: number | null = null,
  subtreeFocused = false,
  alwaysShowLabel = false,
) {
  const color = SPACE_COLORS[node.kind]
  const isSelected = node.id === selectedId
  const isHovered = node.id === hoveredId
  const focusScale = subtreeFocused && focusDistance === null
    ? (node.kind === 'branch' ? 0.82 : 0.74)
    : hero && !subtreeFocused
      ? 1
    : resolveFocusScale(focusDistance, node)
  const heroBaseScale = hero
    ? node.id === TREE_ROOT_ID
      ? 2.02
      : node.kind === 'branch'
        ? 1.82
        : node.kind === 'current'
          ? 1.72
          : 1.64
    : 1
  const scale = heroBaseScale * focusScale
  const radius = node.kind === 'current'
    ? 10 * scale
    : node.kind === 'branch'
      ? 7 * scale
      : node.kind === 'tag'
        ? 5 * scale
        : 6.5 * scale

  const geometry = new THREE.SphereGeometry(radius, 24, 24)
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: isSelected
      ? 0.95
      : isHovered
        ? 0.65
        : subtreeFocused && focusDistance === null
          ? 0.18
          : focusDistance !== null && focusDistance >= 3
            ? 0.18
            : 0.34,
    metalness: 0.25,
    roughness: node.kind === 'tag' ? 0.38 : 0.3,
  })

  const mesh = new THREE.Mesh(geometry, material)
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.8, 16, 16),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isSelected
        ? 0.15
        : isHovered
          ? 0.09
          : subtreeFocused && focusDistance === null
            ? 0.03
            : focusDistance !== null && focusDistance >= 3
              ? 0.02
              : 0.04,
    }),
  )

  const group = new THREE.Group()
  group.add(halo)
  group.add(mesh)

  const showLabel = !hero
    || isSelected
    || isHovered
    || alwaysShowLabel
    || node.kind === 'current'
    || (hero && node.kind === 'branch')
    || (node.kind === 'branch' && (!subtreeFocused || focusDistance !== null) && (focusDistance === null || focusDistance <= 3))
    || (focusDistance !== null && focusDistance <= (hero ? 3 : 2))
  if (showLabel) {
    const displayLabel = displayNodeLabel(node)
    const label = new SpriteText(
      node.kind === 'tag'
        ? `#${truncateLabel(formatKnowledgeTagLabel(node.label), 18)}`
        : truncateLabel(displayLabel, hero ? (alwaysShowLabel ? 14 : 18) : 20),
    )
    label.color = node.kind === 'tag' ? '#fde68a' : '#e5eef9'
    const heroLabelBase = node.id === TREE_ROOT_ID
      ? 10.2
      : node.kind === 'branch'
        ? 8.9
        : alwaysShowLabel
          ? 7.1
          : 7.9
    label.textHeight = hero
      ? (isSelected ? heroLabelBase * 1.22 : heroLabelBase * focusScale)
      : (isSelected ? 7 : node.kind === 'branch' ? 6 * focusScale : 5 * focusScale)
    label.backgroundColor = 'rgba(8, 15, 32, 0.78)'
    label.padding = 3
    label.borderRadius = 3
    label.renderOrder = 12
    const labelMaterial = label.material
    if (Array.isArray(labelMaterial)) {
      for (const material of labelMaterial) {
        material.depthTest = false
        material.depthWrite = false
      }
    } else if (labelMaterial) {
      labelMaterial.depthTest = false
      labelMaterial.depthWrite = false
    }
    const labelSprite = label as unknown as THREE.Sprite
    const labelObject = label as unknown as THREE.Object3D
    if (hero && alwaysShowLabel && node.id !== TREE_ROOT_ID) {
      const positionedNode = node as SpaceNode & { x?: number; y?: number }
      const x = positionedNode.x ?? 0
      const y = positionedNode.y ?? 0
      const absX = Math.abs(x)
      const absY = Math.abs(y)
      const horizontal = absX >= absY
      const directionX = horizontal
        ? (x >= 0 ? 1 : -1)
        : Math.max(-0.7, Math.min(0.7, x / Math.max(absY, 1)))
      const directionY = horizontal
        ? Math.max(-0.48, Math.min(0.48, y / Math.max(absX, 1)))
        : (y >= 0 ? 1 : -1)

      labelSprite.center.set(
        horizontal ? (directionX >= 0 ? 0 : 1) : 0.5,
        horizontal ? 0.5 : (directionY >= 0 ? 0 : 1),
      )
      labelObject.position.set(
        horizontal ? directionX * (radius + 16) : directionX * 14,
        horizontal ? directionY * 12 : directionY * (radius + 14),
        0,
      )
    } else {
      labelObject.position.set(0, radius + (hero ? 18 : 8), 0)
    }
    group.add(label)
  }

  return group
}

function simplifyGraphForHero(
  graph: { nodes: SpaceNode[]; links: SpaceLink[] },
  focusId?: string | null,
) {
  const nonTagNodes = graph.nodes.filter((node) => node.kind !== 'tag')
  if (focusId && focusId !== TREE_ROOT_ID) {
    const contextIds = buildHeroContextIds({ nodes: nonTagNodes, links: graph.links }, focusId)
    const contextualNodes = nonTagNodes.filter((node) => contextIds.has(node.id))
    if (contextualNodes.length > 0) {
      const visibleIds = new Set(contextualNodes.map((node) => node.id))
      return {
        nodes: contextualNodes,
        links: graph.links.filter((link) => visibleIds.has(normalizeEndpoint(link.source)) && visibleIds.has(normalizeEndpoint(link.target))),
      }
    }
  }

  if (nonTagNodes.length <= 40) {
    const visibleIds = new Set(nonTagNodes.map((node) => node.id))
    return {
      nodes: nonTagNodes,
      links: graph.links.filter((link) => visibleIds.has(normalizeEndpoint(link.source)) && visibleIds.has(normalizeEndpoint(link.target))),
    }
  }

  const visibleNodes = [...nonTagNodes]
    .sort((left, right) => {
      const score = (node: SpaceNode) => {
        if (node.id === TREE_ROOT_ID) return 200
        if (node.kind === 'branch') return 100 - (node.depth || 0)
        if (node.kind === 'current') return 90
        if (node.kind === 'note') return 60
        return 10
      }
      return score(right) - score(left)
    })
    .slice(0, 40)

  const visibleIds = new Set(visibleNodes.map((node) => node.id))
  return {
    nodes: visibleNodes,
    links: graph.links.filter((link) => visibleIds.has(normalizeEndpoint(link.source)) && visibleIds.has(normalizeEndpoint(link.target))).slice(0, 72),
  }
}

function describeNodeKind(kind: SpaceNodeKind) {
  if (kind === 'current') return pageCopy.graph.badges.current
  if (kind === 'note') return pageCopy.graph.badges.note
  if (kind === 'tag') return pageCopy.graph.badges.tag
  return pageCopy.graph.badges.branch
}

function filterGraphByPaths(graph: { nodes: SpaceNode[]; links: SpaceLink[] }, filterPaths?: string[]) {
  if (!filterPaths || filterPaths.length === 0) return graph

  const allowedPaths = new Set(filterPaths)
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const keepIds = new Set(
    graph.nodes
      .filter((node) => (node.kind === 'note' || node.kind === 'current') && node.path && allowedPaths.has(node.path))
      .map((node) => node.id),
  )

  if (keepIds.size === 0) {
    return { nodes: [] as SpaceNode[], links: [] as SpaceLink[] }
  }

  let changed = true
  while (changed) {
    changed = false
    for (const link of graph.links) {
      const sourceId = normalizeEndpoint(link.source)
      const targetId = normalizeEndpoint(link.target)
      const sourceNode = nodeById.get(sourceId)
      const targetNode = nodeById.get(targetId)
      if (!sourceNode || !targetNode) continue

      if (link.kind === 'hierarchy') {
        if (keepIds.has(sourceId) && !keepIds.has(targetId)) {
          keepIds.add(targetId)
          changed = true
        }
        if (keepIds.has(targetId) && !keepIds.has(sourceId)) {
          keepIds.add(sourceId)
          changed = true
        }
        continue
      }

      if (link.kind === 'tag') {
        const noteId = sourceNode.kind === 'tag' ? targetId : sourceId
        const tagId = noteId === sourceId ? targetId : sourceId
        if (keepIds.has(noteId) && !keepIds.has(tagId)) {
          keepIds.add(tagId)
          changed = true
        }
      }
    }
  }

  return {
    nodes: graph.nodes.filter((node) => keepIds.has(node.id)),
    links: graph.links.filter((link) => keepIds.has(normalizeEndpoint(link.source)) && keepIds.has(normalizeEndpoint(link.target))),
  }
}

export function GlobalGraph({
  width,
  height,
  sourceId,
  focusPath,
  mode,
  chrome,
  layout = 'workspace',
  filterPaths,
  selectedBranch: selectedBranchProp,
  selectedNodeId: selectedNodeIdProp,
  onBranchChange,
  onNodeSelect,
  onNotePreview,
  onNavigate,
  onTagSelect,
}: GlobalGraphProps) {
  const graphRef = useRef<{
    cameraPosition?: (position: { x?: number; y?: number; z?: number }, lookAt?: { x?: number; y?: number; z?: number }, ms?: number) => void
    camera?: () => THREE.Camera
    controls?: () => {
      enableDamping?: boolean
      dampingFactor?: number
      autoRotate?: boolean
      autoRotateSpeed?: number
      minDistance?: number
      maxDistance?: number
    }
    zoomToFit?: (ms?: number, padding?: number, nodeFilter?: (node: SpaceNode) => boolean) => void
    scene?: () => THREE.Scene
    d3Force?: (forceName: string) => {
      distance?: (distance: number) => void
      strength?: (strength: number) => void
    } | undefined
  } | null>(null)

  const [globalData, setGlobalData] = useState<GraphApiResponse>({ nodes: [], edges: [], orphanNodes: [] })
  const [focusData, setFocusData] = useState<GraphApiResponse | null>(null)
  const [loadingGlobal, setLoadingGlobal] = useState(true)
  const [loadingFocus, setLoadingFocus] = useState(false)
  const [internalSelectedBranch, setInternalSelectedBranch] = useState<string | null>(null)
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [showTags, setShowTags] = useState(true)
  const [autoRotate, setAutoRotate] = useState(() => {
    if (typeof window === 'undefined') return true
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  const [query, setQuery] = useState('')
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set())
  const [heroTreeReady, setHeroTreeReady] = useState(false)
  const clickStateRef = useRef<{ id: string; at: number } | null>(null)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const resolvedChrome = chrome || (layout === 'hero' ? 'hero' : layout === 'dock' ? 'minimal' : 'cockpit')
  const isDockLayout = layout === 'dock'
  const isHeroChrome = resolvedChrome === 'hero'
  const isMinimalChrome = resolvedChrome === 'minimal'
  const selectedBranch = selectedBranchProp === undefined ? internalSelectedBranch : selectedBranchProp
  const selectedNodeId = selectedNodeIdProp === undefined ? internalSelectedNodeId : selectedNodeIdProp

  const setSelectedBranch = (branch: string | null) => {
    onBranchChange?.(branch)
    if (selectedBranchProp === undefined) {
      setInternalSelectedBranch(branch)
    }
  }

  const setSelectedNodeId = (nodeId: string | null) => {
    onNodeSelect?.(nodeId)
    if (selectedNodeIdProp === undefined) {
      setInternalSelectedNodeId(nodeId)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoadingGlobal(true)
    loadGlobalKnowledgeGraph(sourceId)
      .then((payload) => {
        if (!cancelled) {
          setGlobalData({
            nodes: payload.nodes || [],
            edges: payload.edges || [],
            orphanNodes: payload.orphanNodes || [],
          })
          const nextExpanded = new Set<string>()
          for (const node of payload.nodes || []) {
            if (node.kind === 'note' && node.path?.includes('/')) {
              nextExpanded.add(node.path.split('/')[0])
            }
          }
          setExpandedBranches(nextExpanded)
        }
      })
      .catch(() => {
        if (!cancelled) setGlobalData({ nodes: [], edges: [], orphanNodes: [] })
      })
      .finally(() => {
        if (!cancelled) setLoadingGlobal(false)
      })

    return () => {
      cancelled = true
    }
  }, [sourceId])

  useEffect(() => {
    if (mode !== 'focus' || !focusPath) {
      setFocusData(null)
      setLoadingFocus(false)
      return
    }

    let cancelled = false
    setLoadingFocus(true)
    loadKnowledgeGraph(sourceId, focusPath)
      .then((payload) => {
        if (!cancelled) {
          setFocusData({ nodes: payload.nodes || [], edges: payload.edges || [] })
        }
      })
      .catch(() => {
        if (!cancelled) setFocusData({ nodes: [], edges: [] })
      })
      .finally(() => {
        if (!cancelled) setLoadingFocus(false)
      })

    return () => {
      cancelled = true
    }
  }, [focusPath, mode, sourceId])

  const connectedNotes = useMemo(
    () => globalData.nodes.filter((node): node is GraphNoteNode => node.kind === 'note'),
    [globalData.nodes],
  )

  const orphanNotes = useMemo(
    () => (globalData.orphanNodes || []).filter((node): node is GraphNoteNode => node.kind === 'note'),
    [globalData.orphanNodes],
  )

  const allNotes = useMemo(() => {
    const map = new Map<string, GraphNoteNode>()
    for (const node of [...connectedNotes, ...orphanNotes]) {
      map.set(node.id, node)
    }
    return [...map.values()]
  }, [connectedNotes, orphanNotes])

  const tree = useMemo(() => buildKnowledgeTree(allNotes), [allNotes])
  const selectedTree = useMemo(() => resolveSelectedTree(tree, selectedBranch), [tree, selectedBranch])

  const baseGraph = useMemo(() => {
    if (mode === 'focus') {
      const nodes = (focusData?.nodes || [])
        .filter(node => node.kind === 'current' || node.kind === 'note' || (showTags && node.kind === 'tag'))
        .filter(node => matchesQuery(node, deferredQuery))
        .map<SpaceNode>(node => ({
          id: node.id,
          label: node.label,
          kind: node.kind === 'current' ? 'current' : node.kind === 'tag' ? 'tag' : 'note',
          path: node.path,
          tags: node.tags,
        }))

      const visibleIds = new Set(nodes.map(node => node.id))
      const links = (focusData?.edges || [])
        .filter(edge => visibleIds.has(normalizeEndpoint(edge.source)) && visibleIds.has(normalizeEndpoint(edge.target)))
        .filter(edge => showTags || edge.kind !== 'tag')
        .map<SpaceLink>(edge => ({ ...edge }))

      return { nodes, links }
    }

    if (mode === 'tree') {
      return createTreeGraph(
        selectedTree.roots,
        selectedTree.looseNotes,
        selectedTree.currentBranch,
        deferredQuery,
      )
    }

    if (mode === 'orphan') {
      const nodes = orphanNotes
        .filter(node => !selectedBranch || node.path?.startsWith(selectedBranch))
        .filter(node => matchesQuery(node, deferredQuery))
        .map<SpaceNode>(node => ({
          id: node.id,
          label: node.label,
          kind: 'note',
          path: node.path,
          tags: node.tags,
        }))

      return { nodes, links: [] as SpaceLink[] }
    }

    const allowedBranchIds = selectedBranch && tree.branchMap.get(selectedBranch)
      ? collectTreeBranchIds(tree.branchMap.get(selectedBranch)!)
      : null

    const notes = allNotes
      .filter(node => !selectedBranch || (node.path && allowedBranchIds?.has(node.path.split('/').slice(0, -1).join('/'))))
      .filter(node => matchesQuery(node, deferredQuery))
      .map<SpaceNode>(node => ({
        id: node.id,
        label: node.label,
        kind: 'note',
        path: node.path,
        tags: node.tags,
      }))

    const visibleNoteIds = new Set(notes.map(node => node.id))
    const visibleTagIds = new Set<string>()
    const links = globalData.edges
      .filter(edge => {
        const source = normalizeEndpoint(edge.source)
        const target = normalizeEndpoint(edge.target)
        if (edge.kind === 'tag') {
          if (!showTags) return false
          const noteId = visibleNoteIds.has(source) ? source : visibleNoteIds.has(target) ? target : null
          const tagId = noteId === source ? target : source
          if (!noteId) return false
          visibleTagIds.add(tagId)
          return true
        }
        return visibleNoteIds.has(source) && visibleNoteIds.has(target)
      })
      .map<SpaceLink>(edge => ({ ...edge }))

    const tags = globalData.nodes
      .filter((node): node is GlobalGraphNode => node.kind === 'tag')
      .filter(node => visibleTagIds.has(node.id))
      .filter(node => matchesQuery(node, deferredQuery))
      .map<SpaceNode>(node => ({
        id: node.id,
        label: node.label,
        kind: 'tag',
        tags: node.tags,
      }))

    return { nodes: [...notes, ...tags], links }
  }, [allNotes, deferredQuery, focusData, globalData.edges, globalData.nodes, mode, orphanNotes, selectedBranch, selectedTree, showTags, tree.branchMap])

  const filteredGraph = useMemo(
    () => filterGraphByPaths(baseGraph, filterPaths),
    [baseGraph, filterPaths],
  )

  const currentGraph = useMemo(
    () => {
      if (!isHeroChrome) return filteredGraph
      const heroFocusId = mode === 'tree' ? (selectedNodeId || TREE_ROOT_ID) : selectedNodeId
      const heroGraph = simplifyGraphForHero(filteredGraph, heroFocusId)
      if (mode !== 'tree') return heroGraph
      return layoutHeroTreeGraph(heroGraph, heroFocusId || TREE_ROOT_ID, width, height)
    },
    [filteredGraph, height, isHeroChrome, mode, selectedNodeId, width],
  )

  const adjacency = useMemo(() => buildAdjacency(currentGraph.links), [currentGraph.links])
  const treeParentMap = useMemo(
    () => mode === 'tree' ? buildTreeParentMap(currentGraph.links) : new Map<string, string>(),
    [currentGraph.links, mode],
  )
  const treeChildrenMap = useMemo(
    () => mode === 'tree' ? buildTreeChildrenMap(currentGraph.links) : new Map<string, Set<string>>(),
    [currentGraph.links, mode],
  )

  const selectedNode = useMemo(
    () => currentGraph.nodes.find(node => node.id === selectedNodeId) || null,
    [currentGraph.nodes, selectedNodeId],
  )
  const showTreePanel = !isHeroChrome && (!isDockLayout || mode === 'tree')
  const showInspectorPanel = !isHeroChrome && !isDockLayout && !isMinimalChrome
  const showFloatingInspector = (isDockLayout || isMinimalChrome) && Boolean(selectedNode)

  const layoutTuning = useMemo(() => {
    const viewportBase = Math.max(Math.min(width, height), 360)
    const densityFactor = Math.max(0.7, Math.min(1.1, 22 / Math.max(currentGraph.nodes.length, 8)))

    if (mode === 'tree') {
      return isHeroChrome
        ? {
            chargeStrength: -Math.round(Math.min(Math.max(viewportBase * 0.3 * densityFactor, 240), 360)),
            linkDistance: Math.min(Math.max(viewportBase * 0.105 * densityFactor, 88), 138),
            dagLevelDistance: Math.min(Math.max(viewportBase * 0.062 * densityFactor, 48), 82),
            alphaDecay: 0.036,
            velocityDecay: 0.24,
            cooldownTicks: 160,
          }
        : {
            chargeStrength: -Math.round(Math.min(Math.max(viewportBase * 0.22 * densityFactor, 180), 260)),
            linkDistance: Math.min(Math.max(viewportBase * 0.12 * densityFactor, 104), 146),
            dagLevelDistance: Math.min(Math.max(viewportBase * 0.105 * densityFactor, 96), 132),
            alphaDecay: 0.05,
            velocityDecay: 0.28,
            cooldownTicks: 110,
          }
    }

    return isHeroChrome
      ? {
          chargeStrength: -190,
          linkDistance: 110,
          dagLevelDistance: undefined,
          alphaDecay: 0.05,
          velocityDecay: 0.26,
          cooldownTicks: 120,
        }
      : {
          chargeStrength: -140,
          linkDistance: 90,
          dagLevelDistance: undefined,
          alphaDecay: 0.022,
          velocityDecay: 0.24,
          cooldownTicks: 130,
        }
  }, [currentGraph.nodes.length, height, isHeroChrome, mode, width])
  const heroTreeWarmupTicks = isHeroChrome && mode === 'tree'
    ? Math.max(layoutTuning.cooldownTicks * 2, 240)
    : 0

  const selectedNeighbors = useMemo(
    () => selectedNodeId ? adjacency.get(selectedNodeId) || new Set<string>() : new Set<string>(),
    [adjacency, selectedNodeId],
  )

  const treeSubtreeRootId = useMemo(() => {
    if (mode !== 'tree' || !selectedNodeId) return selectedNodeId
    const current = currentGraph.nodes.find((node) => node.id === selectedNodeId)
    if (!current) return null
    return current.id
  }, [currentGraph.nodes, mode, selectedNodeId, treeParentMap])

  const treeEmphasisNodeIds = useMemo(() => {
    if (mode !== 'tree' || !treeSubtreeRootId) return new Set<string>()
    return collectSubtreeIds(treeSubtreeRootId, treeChildrenMap)
  }, [mode, treeChildrenMap, treeSubtreeRootId])

  const treeLeafNodeIds = useMemo(() => {
    if (mode !== 'tree') return new Set<string>()
    return new Set(
      currentGraph.nodes
        .filter((node) => node.id !== TREE_ROOT_ID)
        .filter((node) => (treeChildrenMap.get(node.id)?.size ?? 0) === 0)
        .map((node) => node.id),
    )
  }, [currentGraph.nodes, mode, treeChildrenMap])

  const treeFocusDistances = useMemo(() => {
    if (mode !== 'tree' || !treeSubtreeRootId || !currentGraph.nodes.some((node) => node.id === treeSubtreeRootId)) {
      return new Map<string, number>()
    }
    return buildTreeDistanceMap(treeSubtreeRootId, treeChildrenMap)
  }, [currentGraph.nodes, mode, treeChildrenMap, treeSubtreeRootId])

  const totals = useMemo(() => ({
    notes: currentGraph.nodes.filter(node => node.kind === 'note' || node.kind === 'current').length,
    links: currentGraph.links.filter(edge => edge.kind === 'wikilink').length,
    tags: currentGraph.nodes.filter(node => node.kind === 'tag').length,
    orphans: filterPaths && filterPaths.length > 0
      ? orphanNotes.filter(node => filterPaths.includes(node.path || '')).length
      : orphanNotes.length,
  }), [currentGraph.links, currentGraph.nodes, filterPaths, orphanNotes])

  useEffect(() => {
    const controls = graphRef.current?.controls?.()
    if (!controls) return
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate = autoRotate && !(isHeroChrome && mode === 'tree')
    controls.autoRotateSpeed = isHeroChrome ? 0.2 : 0.32
    controls.minDistance = 120
    controls.maxDistance = 2400
  }, [autoRotate, currentGraph.nodes.length, isHeroChrome, mode])

  useEffect(() => {
    const scene = graphRef.current?.scene?.()
    if (!scene || scene.getObjectByName('knowledge-space-ambient')) return

    scene.fog = new THREE.FogExp2(GRAPH_BACKDROP, 0.00065)

    const ambientLight = new THREE.AmbientLight('#dce8ff', 1.2)
    ambientLight.name = 'knowledge-space-ambient'
    scene.add(ambientLight)

    const primaryLight = new THREE.DirectionalLight('#8bc5ff', 1.8)
    primaryLight.name = 'knowledge-space-key'
    primaryLight.position.set(140, 180, 120)
    scene.add(primaryLight)

    const accentLight = new THREE.PointLight('#8b5cf6', 1.2, 1200)
    accentLight.name = 'knowledge-space-accent'
    accentLight.position.set(-120, -60, 180)
    scene.add(accentLight)
  }, [currentGraph.nodes.length])

  useEffect(() => {
    const linkForce = graphRef.current?.d3Force?.('link')
    linkForce?.distance?.(layoutTuning.linkDistance)

    const chargeForce = graphRef.current?.d3Force?.('charge')
    chargeForce?.strength?.(layoutTuning.chargeStrength)
  }, [currentGraph.links.length, currentGraph.nodes.length, layoutTuning])

  useEffect(() => {
    const camera = graphRef.current?.camera?.()
    if (!(camera instanceof THREE.PerspectiveCamera)) return

    const nextFov = isHeroChrome && mode === 'tree' ? 42 : 58
    const nextAspect = Math.max(width, 320) / Math.max(height, 360)
    let shouldUpdate = false

    if (Math.abs(camera.fov - nextFov) > 0.01) {
      camera.fov = nextFov
      shouldUpdate = true
    }
    if (Math.abs(camera.aspect - nextAspect) > 0.01) {
      camera.aspect = nextAspect
      shouldUpdate = true
    }

    if (shouldUpdate) {
      camera.updateProjectionMatrix()
    }
  }, [height, isHeroChrome, mode, width])

  useEffect(() => {
    if (currentGraph.nodes.length === 0) return
    const fitPadding = mode === 'tree' ? (isHeroChrome ? 0 : 56) : (isHeroChrome ? 8 : 80)
    const isHeroTree = isHeroChrome && mode === 'tree'
    if (isHeroTree) {
      setHeroTreeReady(false)
      const heroTimeout = window.setTimeout(() => {
        const heroTarget = (currentGraph.nodes.find((node) => node.id === (selectedNodeId || TREE_ROOT_ID)) || currentGraph.nodes[0]) as (
          SpaceNode & { x?: number; y?: number; z?: number }
        ) | undefined
        if (heroTarget) {
          focusNode(heroTarget)
        }
        setHeroTreeReady(true)
      }, 160)
      return () => window.clearTimeout(heroTimeout)
    }
    const initialTimeout = window.setTimeout(() => {
      graphRef.current?.zoomToFit?.(700, fitPadding)
    }, 220)
    const settleTimeout = mode === 'tree' && !isHeroTree
      ? window.setTimeout(() => {
          graphRef.current?.zoomToFit?.(520, fitPadding)
        }, 2200)
      : null
    return () => {
      window.clearTimeout(initialTimeout)
      if (settleTimeout !== null) window.clearTimeout(settleTimeout)
    }
  }, [currentGraph.links.length, currentGraph.nodes.length, isHeroChrome, mode])

  useEffect(() => {
    if (isHeroChrome && mode === 'tree') return
    setHeroTreeReady(true)
  }, [isHeroChrome, mode])

  useEffect(() => {
    if (!isHeroChrome || currentGraph.nodes.length === 0 || mode === 'tree') return

    const timeout = window.setTimeout(() => {
      const positionedNodes = currentGraph.nodes.filter((node) => (
        typeof (node as SpaceNode & { x?: number }).x === 'number'
        && typeof (node as SpaceNode & { y?: number }).y === 'number'
        && typeof (node as SpaceNode & { z?: number }).z === 'number'
      )) as Array<SpaceNode & { x: number; y: number; z: number }>

      if (positionedNodes.length === 0) return

      const bounds = positionedNodes.reduce(
        (accumulator, node) => ({
          minX: Math.min(accumulator.minX, node.x),
          maxX: Math.max(accumulator.maxX, node.x),
          minY: Math.min(accumulator.minY, node.y),
          maxY: Math.max(accumulator.maxY, node.y),
          minZ: Math.min(accumulator.minZ, node.z),
          maxZ: Math.max(accumulator.maxZ, node.z),
        }),
        {
          minX: positionedNodes[0].x,
          maxX: positionedNodes[0].x,
          minY: positionedNodes[0].y,
          maxY: positionedNodes[0].y,
          minZ: positionedNodes[0].z,
          maxZ: positionedNodes[0].z,
        },
      )

      const center = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
        z: (bounds.minZ + bounds.maxZ) / 2,
      }
      const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 220)
      const distance = Math.max(span * 0.92, 260)

      graphRef.current?.cameraPosition?.(
        {
          x: center.x + distance * 0.42,
          y: center.y + distance * 0.18,
          z: center.z + distance * 0.94,
        },
        {
          x: center.x,
          y: center.y + distance * 0.03,
          z: center.z,
        },
        900,
      )
    }, 1100)

    return () => window.clearTimeout(timeout)
  }, [currentGraph.nodes, isHeroChrome, mode])

  useEffect(() => {
    const hasSelectedNode = selectedNodeId ? currentGraph.nodes.some((node) => node.id === selectedNodeId) : false
    if ((!selectedNodeId || !hasSelectedNode) && currentGraph.nodes.length > 0) {
      if (mode === 'tree' && currentGraph.nodes.some((node) => node.id === TREE_ROOT_ID)) {
        setSelectedNodeId(TREE_ROOT_ID)
        return
      }
      const current = currentGraph.nodes.find(node => node.kind === 'current')
      setSelectedNodeId(current?.id || currentGraph.nodes[0].id)
    }
  }, [currentGraph.nodes, mode, selectedNodeId])

  useEffect(() => {
    if (mode !== 'tree' || currentGraph.nodes.length === 0 || !selectedNodeId) return
    if (isHeroChrome && selectedNodeId === TREE_ROOT_ID) return
    const timeout = window.setTimeout(() => {
      const focusTargetId = selectedNodeId
      const target = currentGraph.nodes.find((node) => node.id === focusTargetId) as (SpaceNode & {
        x?: number
        y?: number
        z?: number
      }) | undefined
      if (!target) return
      if (isHeroChrome) {
        focusNode(target)
        return
      }
      focusNode(target)
    }, isHeroChrome ? 180 : 900)

    return () => window.clearTimeout(timeout)
  }, [currentGraph.nodes, isHeroChrome, mode, selectedNodeId])

  function focusNode(node: { id?: string; x?: number; y?: number; z?: number }) {
    const positionedNodes = currentGraph.nodes.filter((current) => (
      typeof (current as SpaceNode & { x?: number }).x === 'number'
      && typeof (current as SpaceNode & { y?: number }).y === 'number'
      && typeof (current as SpaceNode & { z?: number }).z === 'number'
    )) as Array<SpaceNode & { x: number; y: number; z: number }>

    if (positionedNodes.length === 0) return

    const isHeroTree = isHeroChrome && mode === 'tree'
    const subtreeNodes = treeEmphasisNodeIds.size > 0
      ? positionedNodes.filter((current) => treeEmphasisNodeIds.has(current.id))
      : positionedNodes
    if (isHeroTree) {
      const isHeroRootFocus = node.id === TREE_ROOT_ID
      const focusBoundsNodes = isHeroRootFocus || subtreeNodes.length === 0
        ? positionedNodes
        : subtreeNodes
      const bounds = getGraphBounds(focusBoundsNodes)
      const center = {
        x: node.x ?? (bounds.minX + bounds.maxX) / 2,
        y: node.y ?? (bounds.minY + bounds.maxY) / 2,
        z: node.z ?? (bounds.minZ + bounds.maxZ) / 2,
      }
      const verticalSpan = Math.max(bounds.maxY - bounds.minY, 180)
      const adjustedCenter = {
        ...center,
        y: center.y + verticalSpan * (isHeroRootFocus ? 0.06 : 0.04),
      }
      const distance = getCameraFitDistance(
        bounds,
        width,
        height,
        42,
        isHeroRootFocus ? 1.2 : 1.14,
        isHeroRootFocus ? 1.28 : 1.2,
        isHeroRootFocus ? 0.92 : 0.76,
      )
      graphRef.current?.cameraPosition?.(
        {
          x: adjustedCenter.x + distance * (isHeroRootFocus ? 0.02 : 0.08),
          y: adjustedCenter.y + distance * (isHeroRootFocus ? 0.05 : 0.08),
          z: adjustedCenter.z + distance * (isHeroRootFocus ? 0.86 : 0.62),
        },
        {
          x: adjustedCenter.x,
          y: adjustedCenter.y,
          z: adjustedCenter.z,
        },
        420,
      )
      return
    }
    const focusBoundsNodes = subtreeNodes.length > 0 ? subtreeNodes : positionedNodes
    const bounds = getGraphBounds(focusBoundsNodes)
    const graphCenter = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
    }
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 220)
    const nodeCenter = {
      x: node.x ?? graphCenter.x,
      y: node.y ?? graphCenter.y,
      z: node.z ?? graphCenter.z,
    }
    const focusWeight = mode === 'tree' ? (isHeroTree ? 1 : 0.24) : 0.55
    const topSpan = bounds.maxY - graphCenter.y
    const bottomSpan = graphCenter.y - bounds.minY
    const verticalBias = mode === 'tree'
      ? (isHeroTree ? 0 : Math.max(-span * 0.06, Math.min(span * 0.09, (topSpan - bottomSpan) * 0.16 + span * 0.02)))
      : 0
    const isHeroRootFocus = isHeroTree && node.id === TREE_ROOT_ID
    const center = {
      x: isHeroTree ? nodeCenter.x : graphCenter.x + (nodeCenter.x - graphCenter.x) * focusWeight,
      y: (isHeroTree ? nodeCenter.y : graphCenter.y + (nodeCenter.y - graphCenter.y) * focusWeight) - verticalBias,
      z: isHeroTree ? nodeCenter.z : graphCenter.z + (nodeCenter.z - graphCenter.z) * focusWeight,
    }
    const distance = Math.max(
      span * (mode === 'tree' ? (isHeroTree ? (isHeroRootFocus ? 0.62 : 0.54) : 1.12) : 0.82),
      mode === 'tree' ? (isHeroTree ? 180 : 320) : 240,
    )

    graphRef.current?.cameraPosition?.(
      {
        x: center.x + distance * (isHeroTree ? 0 : 0.36),
        y: center.y + distance * (isHeroTree ? 0.01 : 0.16),
        z: center.z + distance * (isHeroTree ? 0.68 : 0.92),
      },
      {
        x: center.x,
        y: center.y + (isHeroTree ? 0 : 0),
        z: center.z,
      },
      900,
    )
  }

  function handleNodeClick(node: SpaceNode & { x?: number; y?: number; z?: number }) {
    const nextSelectedNodeId = mode === 'tree' && node.kind === 'branch' && !isHeroChrome ? TREE_ROOT_ID : node.id
    setSelectedNodeId(nextSelectedNodeId)
    if (node.kind === 'branch' && !isHeroChrome) {
      startTransition(() => {
        setSelectedBranch(node.path || null)
      })
    }
    if ((node.kind === 'note' || node.kind === 'current') && node.path) {
      onNotePreview?.(node.path)
    }
    if (!(isHeroChrome && mode === 'tree')) {
      focusNode(node)
    }
  }

  function handleNodeOpen(node: SpaceNode) {
    if ((node.kind === 'note' || node.kind === 'current') && node.path) {
      onNavigate?.(node.path)
      return
    }
    if (node.kind === 'tag') {
      onTagSelect?.(node.label)
    }
  }

  function handleNodeInteraction(node: SpaceNode & { x?: number; y?: number; z?: number }) {
    const now = Date.now()
    const last = clickStateRef.current
    if (last && last.id === node.id && now - last.at < 260) {
      clickStateRef.current = null
      handleNodeOpen(node)
      return
    }

    clickStateRef.current = { id: node.id, at: now }
    handleNodeClick(node)
  }

  function toggleBranch(pathKey: string) {
    setExpandedBranches(previous => {
      const next = new Set(previous)
      if (next.has(pathKey)) next.delete(pathKey)
      else next.add(pathKey)
      return next
    })
  }

  function renderTreeNodes(nodes: GraphTreeNode[]) {
    return nodes.map(branch => {
      const isExpanded = expandedBranches.has(branch.pathKey) || (selectedBranch ? selectedBranch.startsWith(branch.pathKey) : branch.depth <= 1)
      const isActive = selectedBranch === branch.pathKey
      return (
        <div key={branch.id} className="graph-tree-node">
          <button
            className={`graph-tree-branch${isActive ? ' active' : ''}`}
            style={{ paddingLeft: `${branch.depth * 12 + 14}px` }}
            onClick={() => startTransition(() => setSelectedBranch(isActive ? null : branch.pathKey))}
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
                setSelectedNodeId(note.id)
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
  }

  function renderInspectorContent() {
    if (!selectedNode) {
      return (
        <div className="graph-inspector graph-inspector--empty">
          <p>{pageCopy.graph.labels.inspectorEmpty}</p>
        </div>
      )
    }

    return (
      <div className="graph-inspector">
        <div className={`graph-inspector__badge graph-inspector__badge--${selectedNode.kind}`}>
          {selectedNode.kind === 'current' && pageCopy.graph.badges.current}
          {selectedNode.kind === 'note' && pageCopy.graph.badges.note}
          {selectedNode.kind === 'tag' && pageCopy.graph.badges.tag}
          {selectedNode.kind === 'branch' && pageCopy.graph.badges.branch}
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
            <span>邻接节点</span>
            <strong>{adjacency.get(selectedNode.id)?.size || 0}</strong>
          </div>
          <div className="graph-fact">
            <span>类型</span>
            <strong>{describeNodeKind(selectedNode.kind)}</strong>
          </div>
          {selectedNode.count !== undefined && (
            <div className="graph-fact">
              <span>子文档</span>
              <strong>{selectedNode.count}</strong>
            </div>
          )}
        </div>

        <div className="graph-inspector__actions">
          {(selectedNode.kind === 'note' || selectedNode.kind === 'current') && selectedNode.path && onNotePreview && (
            <button className="graph-action" onClick={() => onNotePreview(selectedNode.path!)} type="button">
              {pageCopy.graph.labels.preview}
            </button>
          )}
          {(selectedNode.kind === 'note' || selectedNode.kind === 'current') && selectedNode.path && (
            <button className="graph-action" onClick={() => onNavigate?.(selectedNode.path!)} type="button">
              {pageCopy.graph.labels.open}
            </button>
          )}
          {selectedNode.kind === 'tag' && (
            <button className="graph-action" onClick={() => onTagSelect?.(selectedNode.label)} type="button">
              {pageCopy.graph.labels.filterByTag}
            </button>
          )}
          {selectedNode.kind === 'branch' && (
            <button className="graph-action" onClick={() => setSelectedBranch(selectedNode.path || null)} type="button">
              {pageCopy.graph.labels.focusBranch}
            </button>
          )}
        </div>
      </div>
    )
  }

  if ((loadingGlobal && mode !== 'focus') || (mode === 'focus' && loadingFocus)) {
    return (
      <div className="graph-space graph-space--loading" style={{ width, height }}>
        <div className="spinner" style={{ width: 24, height: 24 }} />
        <span>{pageCopy.graph.loading}</span>
      </div>
    )
  }

  if (mode === 'focus' && !focusPath) {
    return (
      <div className="graph-space graph-space--empty" style={{ width, height }}>
        <FileIcon />
        <p>{pageCopy.graph.emptyFocus}</p>
      </div>
    )
  }

  if (currentGraph.nodes.length === 0) {
    return (
      <div className="graph-space graph-space--empty" style={{ width, height }}>
        <SearchIcon />
        <p>{pageCopy.graph.emptyFiltered}</p>
      </div>
    )
  }

  if (isHeroChrome) {
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
              onNodeClick={(node: object) => handleNodeInteraction(node as SpaceNode & { x?: number; y?: number; z?: number })}
              onNodeHover={(node: object | null) => {
                const current = node as SpaceNode | null
                setHoveredNodeId(current?.id || null)
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

  return (
    <div
      className={[
        'graph-space',
        isDockLayout ? 'graph-space--dock' : 'graph-space--workspace',
        `graph-space--chrome-${resolvedChrome}`,
        showTreePanel ? 'graph-space--tree-panel' : 'graph-space--no-tree',
      ].join(' ')}
      style={{ width, height }}
    >
      <div className="graph-space__topbar">
        <div>
          <div className="graph-space__eyebrow">
            {mode === 'focus' && pageCopy.graph.labels.focusEyebrow}
            {mode === 'global' && pageCopy.graph.labels.globalEyebrow}
            {mode === 'tree' && pageCopy.graph.labels.treeEyebrow}
            {mode === 'orphan' && pageCopy.graph.labels.orphanEyebrow}
          </div>
          <h3 className="graph-space__title">
            {mode === 'focus' && pageCopy.graph.labels.focusTitle}
            {mode === 'global' && pageCopy.graph.labels.globalTitle}
            {mode === 'tree' && pageCopy.graph.labels.treeTitle}
            {mode === 'orphan' && pageCopy.graph.labels.orphanTitle}
          </h3>
        </div>

        <div className="graph-space__toolbar">
          <label className="graph-space__search" aria-label="筛选图谱节点">
            <SearchIcon />
            <input
              aria-label="筛选图谱节点"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={pageCopy.graph.labels.searchPlaceholder}
            />
          </label>

          <button
            className={`graph-chip${showTags ? ' active' : ''}`}
            onClick={() => setShowTags(value => !value)}
            type="button"
          >
            {pageCopy.graph.labels.tagsToggle}
          </button>
          <button
            className={`graph-chip${autoRotate ? ' active' : ''}`}
            onClick={() => setAutoRotate(value => !value)}
            type="button"
          >
            {pageCopy.graph.labels.rotateToggle}
          </button>
          {selectedBranch && (
            <button className="graph-chip" onClick={() => setSelectedBranch(null)} type="button">
              {pageCopy.graph.labels.clearBranch}
            </button>
          )}
        </div>
      </div>

      <div className="graph-space__stats">
        <div className="graph-metric">
          <span>{pageCopy.graph.labels.documents}</span>
          <strong>{totals.notes}</strong>
        </div>
        <div className="graph-metric">
          <span>{pageCopy.graph.labels.links}</span>
          <strong>{totals.links}</strong>
        </div>
        <div className="graph-metric">
          <span>{pageCopy.graph.labels.tags}</span>
          <strong>{totals.tags}</strong>
        </div>
        <div className="graph-metric">
          <span>{pageCopy.graph.labels.orphans}</span>
          <strong>{totals.orphans}</strong>
        </div>
        <div className="graph-legend">
          <span><i style={{ background: SPACE_COLORS.note }} />文档</span>
          <span><i style={{ background: SPACE_COLORS.branch }} />分支</span>
          <span><i style={{ background: SPACE_COLORS.tag }} />标签</span>
        </div>
      </div>

      <div className="graph-space__body">
        {showTreePanel && (
          <aside className="graph-space__tree">
            <div className="graph-panel__header">
              <FolderIcon />
              <span>{pageCopy.graph.treePanel}</span>
            </div>
            <OverlayScrollbar
              ariaLabel={pageCopy.graph.treePanel}
              className="graph-tree-scrollbar"
              viewClassName="graph-tree"
              wrapClassName="graph-tree-scrollbar__wrap"
            >
              <button
                className={`graph-tree-root${selectedBranch === null ? ' active' : ''}`}
                onClick={() => setSelectedBranch(null)}
                type="button"
              >
                <span className="graph-tree-root__title">{pageCopy.graph.labels.rootView}</span>
                <span className="graph-tree-count">{totals.notes}</span>
              </button>
              {renderTreeNodes(tree.rootChildren)}
              {tree.looseNotes.length > 0 && (
                <div className="graph-tree-node">
                  <div className="graph-tree-section">{pageCopy.graph.labels.looseDocs}</div>
                  {tree.looseNotes.map(note => (
                    <button
                      key={note.id}
                      className={`graph-tree-leaf${selectedNodeId === note.id ? ' active' : ''}`}
                      style={{ paddingLeft: '18px' }}
                      onClick={() => {
                        setSelectedNodeId(note.id)
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
        )}

        <section className="graph-space__stage">
          <div className="graph-stage__overlay">
            <div className="graph-stage__hint">{pageCopy.graph.stageHint}</div>
            <div className="graph-stage__mode">
              {mode === 'focus'
                ? pageCopy.graph.labels.focusMode
                : mode === 'tree'
                ? pageCopy.graph.labels.treeMode
                : mode === 'orphan'
                  ? pageCopy.graph.labels.orphanMode
                  : pageCopy.graph.labels.globalMode}
            </div>
          </div>
          <ForceGraph3D
            ref={graphRef as never}
            width={Math.max(width - (isDockLayout ? (showTreePanel ? 220 : 0) : 540), 320)}
            height={Math.max(height - (isDockLayout ? 116 : 140), 280)}
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
            onNodeClick={(node: object) => handleNodeInteraction(node as SpaceNode & { x?: number; y?: number; z?: number })}
            onNodeHover={(node: object | null) => {
              const current = node as SpaceNode | null
              setHoveredNodeId(current?.id || null)
              document.body.style.cursor = current ? 'pointer' : 'default'
            }}
            dagMode={mode === 'tree' ? 'zout' : undefined}
            dagLevelDistance={layoutTuning.dagLevelDistance}
            d3AlphaDecay={layoutTuning.alphaDecay}
            d3VelocityDecay={layoutTuning.velocityDecay}
            cooldownTicks={layoutTuning.cooldownTicks}
          />

          {showFloatingInspector && (
            <div className="graph-stage__inspector-float">
              {renderInspectorContent()}
            </div>
          )}
        </section>

        {showInspectorPanel && (
          <aside className="graph-space__inspector">
            <div className="graph-panel__header">
              <LinkIcon />
              <span>{pageCopy.graph.inspectorPanel}</span>
            </div>
            {renderInspectorContent()}
          </aside>
        )}
      </div>
    </div>
  )
}
