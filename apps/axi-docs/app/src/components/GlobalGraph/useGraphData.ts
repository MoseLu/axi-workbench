import { useMemo } from 'react'
import {
  buildKnowledgeTree,
  collectTreeBranchIds,
  resolveSelectedTree,
} from '../../lib/knowledgeTreeGraph'
import {
  buildAdjacency,
  buildTreeChildrenMap,
  buildTreeDistanceMap,
  buildTreeParentMap,
  collectSubtreeIds,
  createTreeGraph,
  filterGraphByPaths,
  layoutHeroTreeGraph,
  matchesQuery,
  normalizeEndpoint,
  simplifyGraphForHero,
} from './helpers'
import {
  TREE_ROOT_ID,
  type GlobalGraphMode,
  type GlobalGraphNode,
  type GraphApiResponse,
  type GraphNoteNode,
  type SpaceLink,
  type SpaceNode,
} from './types'

export interface GraphDataBundle {
  allNotes: GraphNoteNode[]
  connectedNotes: GraphNoteNode[]
  orphanNotes: GraphNoteNode[]
  tree: ReturnType<typeof buildKnowledgeTree>
  selectedTree: ReturnType<typeof resolveSelectedTree>
  baseGraph: { nodes: SpaceNode[]; links: SpaceLink[] }
  filteredGraph: { nodes: SpaceNode[]; links: SpaceLink[] }
  currentGraph: { nodes: SpaceNode[]; links: SpaceLink[] }
  adjacency: Map<string, Set<string>>
  treeParentMap: Map<string, string>
  treeChildrenMap: Map<string, Set<string>>
  treeSubtreeRootId: string | null | undefined
  treeEmphasisNodeIds: Set<string>
  treeLeafNodeIds: Set<string>
  treeFocusDistances: Map<string, number>
  totals: { notes: number; links: number; tags: number; orphans: number }
  selectedNode: SpaceNode | null
  selectedNeighbors: Set<string>
}

export interface GraphDataInputs {
  globalData: GraphApiResponse
  focusData: GraphApiResponse | null
  mode: GlobalGraphMode
  isHeroChrome: boolean
  selectedBranch: string | null
  selectedNodeId: string | null
  showTags: boolean
  deferredQuery: string
  filterPaths?: string[]
  width: number
  height: number
}

export function useGraphData(inputs: GraphDataInputs): GraphDataBundle {
  const {
    globalData,
    focusData,
    mode,
    isHeroChrome,
    selectedBranch,
    selectedNodeId,
    showTags,
    deferredQuery,
    filterPaths,
    width,
    height,
  } = inputs

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
      .filter((node): node is GlobalGraphNode & { kind: 'tag' } => node.kind === 'tag')
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

  const currentGraph = useMemo(() => {
    if (!isHeroChrome) return filteredGraph
    const heroFocusId = mode === 'tree' ? (selectedNodeId || TREE_ROOT_ID) : selectedNodeId
    const heroGraph = simplifyGraphForHero(filteredGraph, heroFocusId)
    if (mode !== 'tree') return heroGraph
    return layoutHeroTreeGraph(heroGraph, heroFocusId || TREE_ROOT_ID, width, height)
  }, [filteredGraph, height, isHeroChrome, mode, selectedNodeId, width])

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

  const selectedNeighbors = useMemo(
    () => selectedNodeId ? adjacency.get(selectedNodeId) || new Set<string>() : new Set<string>(),
    [adjacency, selectedNodeId],
  )

  return {
    allNotes,
    connectedNotes,
    orphanNotes,
    tree,
    selectedTree,
    baseGraph,
    filteredGraph,
    currentGraph,
    adjacency,
    treeParentMap,
    treeChildrenMap,
    treeSubtreeRootId,
    treeEmphasisNodeIds,
    treeLeafNodeIds,
    treeFocusDistances,
    totals,
    selectedNode,
    selectedNeighbors,
  }
}

export interface GraphLayoutTuning {
  chargeStrength: number
  linkDistance: number
  dagLevelDistance: number | undefined
  alphaDecay: number
  velocityDecay: number
  cooldownTicks: number
}

export interface GraphLayoutTuningInputs {
  mode: GlobalGraphMode
  isHeroChrome: boolean
  width: number
  height: number
  nodeCount: number
}

export function useGraphLayoutTuning(inputs: GraphLayoutTuningInputs): GraphLayoutTuning {
  const { mode, isHeroChrome, width, height, nodeCount } = inputs
  return useMemo(() => {
    const viewportBase = Math.max(Math.min(width, height), 360)
    const densityFactor = Math.max(0.7, Math.min(1.1, 22 / Math.max(nodeCount, 8)))

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
  }, [height, isHeroChrome, mode, nodeCount, width])
}