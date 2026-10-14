import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import {
  formatKnowledgeBranchLabel,
  formatKnowledgeNodeLabel,
  formatKnowledgeTagLabel,
} from '../../lib/knowledgeFormatter'
import { pageCopy } from '../../config/pageCopy'
import {
  SPACE_COLORS,
  TREE_ROOT_ID,
  type GlobalGraphNode,
  type GraphNoteNode,
  type GraphTreeNode,
  type PositionedSpaceNode,
  type SpaceLink,
  type SpaceNode,
  type SpaceNodeKind,
} from './types'

// ---------- label / endpoint helpers ----------

export function displayNodeLabel(node: Pick<SpaceNode, 'id' | 'kind' | 'label' | 'path'>): string {
  return formatKnowledgeNodeLabel(node).slice(0, 40)
}

export function truncateLabel(label: string, max = 26): string {
  return label.length > max ? `${label.slice(0, max)}…` : label
}

export function normalizeEndpoint(endpoint: string | { id: string }): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id
}

export function matchesQuery(
  node: Pick<GlobalGraphNode, 'label' | 'path' | 'tags'>,
  term: string,
): boolean {
  if (!term) return true
  const haystack = `${node.label} ${node.path || ''} ${(node.tags || []).join(' ')}`.toLowerCase()
  return term
    .split(/\s+/)
    .filter(Boolean)
    .every(token => haystack.includes(token))
}

export function describeNodeKind(kind: SpaceNodeKind): string {
  if (kind === 'current') return pageCopy.graph.badges.current
  if (kind === 'note') return pageCopy.graph.badges.note
  if (kind === 'tag') return pageCopy.graph.badges.tag
  return pageCopy.graph.badges.branch
}

// ---------- adjacency / tree structure helpers ----------

export function buildAdjacency(links: SpaceLink[]) {
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

export function buildTreeParentMap(links: SpaceLink[]) {
  const parentMap = new Map<string, string>()
  for (const link of links) {
    if (link.kind !== 'hierarchy') continue
    parentMap.set(normalizeEndpoint(link.target), normalizeEndpoint(link.source))
  }
  return parentMap
}

export function buildTreeChildrenMap(links: SpaceLink[]) {
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

export function collectSubtreeIds(
  rootId: string,
  childrenMap: Map<string, Set<string>>,
): Set<string> {
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

export function buildTreeDistanceMap(
  rootId: string,
  childrenMap: Map<string, Set<string>>,
): Map<string, number> {
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

export function sortTreeLayoutNodes(
  nodeIds: Iterable<string>,
  nodeById: Map<string, SpaceNode>,
): SpaceNode[] {
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

export function collectAncestorChain(
  nodeId: string,
  parentMap: Map<string, string>,
): string[] {
  const chain: string[] = []
  let current = parentMap.get(nodeId)
  while (current) {
    chain.push(current)
    current = parentMap.get(current)
  }
  return chain
}

// ---------- hero-tree layout ----------

export function buildHeroContextIds(
  graph: { nodes: SpaceNode[]; links: SpaceLink[] },
  focusId?: string | null,
): Set<string> {
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

export function layoutHeroTreeGraph(
  graph: { nodes: SpaceNode[]; links: SpaceLink[] },
  focusId: string | null | undefined,
  width: number,
  height: number,
): { nodes: PositionedSpaceNode[]; links: SpaceLink[] } {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  if (!nodeById.has(TREE_ROOT_ID)) return {
    nodes: graph.nodes.map((node) => ({ ...node, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0 })),
    links: graph.links,
  }

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

// ---------- tree graph construction ----------

export function createTreeGraph(
  roots: GraphTreeNode[],
  looseNotes: GraphNoteNode[],
  selectedBranch: GraphTreeNode | null,
  searchTerm: string,
): { nodes: SpaceNode[]; links: SpaceLink[] } {
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

// ---------- bounds / camera helpers ----------

export function getGraphBounds(
  nodes: Array<SpaceNode & { x: number; y: number; z: number }>,
) {
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

export function getCameraFitDistance(
  bounds: ReturnType<typeof getGraphBounds>,
  viewportWidth: number,
  viewportHeight: number,
  fovDegrees: number,
  paddingXRatio = 1.08,
  paddingYRatio = 1.08,
  depthFactor = 0.72,
): number {
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

export function resolveFocusScale(distance: number | null, node: SpaceNode): number {
  if (distance === null) return 1
  if (distance === 0) return node.id === TREE_ROOT_ID ? 1.4 : 1.34
  if (distance === 1) return node.kind === 'branch' ? 1.2 : 1.12
  if (distance === 2) return 1
  if (distance === 3) return 0.82
  return 0.62
}

// ---------- three.js node mesh builder ----------

export function createNodeObject(
  node: SpaceNode,
  selectedId: string | null,
  hoveredId: string | null,
  hero = false,
  focusDistance: number | null = null,
  subtreeFocused = false,
  alwaysShowLabel = false,
): THREE.Group {
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

// ---------- hero-graph simplification + path filtering ----------

export function simplifyGraphForHero(
  graph: { nodes: SpaceNode[]; links: SpaceLink[] },
  focusId?: string | null,
): { nodes: SpaceNode[]; links: SpaceLink[] } {
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

export function filterGraphByPaths(
  graph: { nodes: SpaceNode[]; links: SpaceLink[] },
  filterPaths?: string[],
): { nodes: SpaceNode[]; links: SpaceLink[] } {
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
