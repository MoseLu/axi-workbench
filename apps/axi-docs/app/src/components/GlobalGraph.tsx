import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { pageCopy } from '../config/pageCopy'
import {
  getGlobalKnowledgeGraph as loadGlobalKnowledgeGraph,
  getKnowledgeGraph as loadKnowledgeGraph,
} from '../lib/knowledgeClient'
import { GraphEmptyStates } from './GlobalGraph/GraphEmptyStates'
import { GraphCanvas } from './GlobalGraph/GraphCanvas'
import { GraphHeroCanvas } from './GlobalGraph/GraphHeroCanvas'
import { GraphInspector } from './GlobalGraph/GraphInspector'
import { GraphStats } from './GlobalGraph/GraphStats'
import { GraphTopbar } from './GlobalGraph/GraphTopbar'
import { GraphTreePanel } from './GlobalGraph/GraphTreePanel'
import {
  buildFocusNode,
  useGraphCameraControls,
  useGraphFit,
  useGraphHeroPosition,
} from './GlobalGraph/useGraphInteractions'
import { useGraphData, useGraphLayoutTuning } from './GlobalGraph/useGraphData'
import { TREE_ROOT_ID, type GlobalGraphProps, type GraphApiResponse } from './GlobalGraph/types'

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
  const graphRef = useRef<Parameters<typeof useGraphCameraControls>[0]['graphRef']['current']>(null)
  const clickStateRef = useRef<{ id: string; at: number } | null>(null)

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

  const dataBundle = useGraphData({
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
  })
  const { tree, currentGraph, adjacency, treeEmphasisNodeIds, treeFocusDistances, treeLeafNodeIds, totals, selectedNode, selectedNeighbors } = dataBundle
  const layoutTuning = useGraphLayoutTuning({ mode, isHeroChrome, width, height, nodeCount: currentGraph.nodes.length })
  const heroTreeWarmupTicks = isHeroChrome && mode === 'tree'
    ? Math.max(layoutTuning.cooldownTicks * 2, 240)
    : 0

  const focusNode = useMemo(
    () => buildFocusNode({
      currentGraph,
      treeEmphasisNodeIds,
      isHeroChrome,
      mode,
      selectedNodeId,
      width,
      height,
      graphRef: graphRef as never,
    }),
    [currentGraph, height, isHeroChrome, mode, treeEmphasisNodeIds, width],
  )

  useGraphCameraControls({
    graphRef: graphRef as never,
    mode,
    isHeroChrome,
    autoRotate,
    layoutTuning,
    width,
    height,
    nodeCount: currentGraph.nodes.length,
    linkCount: currentGraph.links.length,
  })
  useGraphFit({
    graphRef: graphRef as never,
    currentGraph,
    mode,
    isHeroChrome,
    selectedNodeId,
    setHeroTreeReady,
    focusNode,
  })
  useGraphHeroPosition({
    graphRef: graphRef as never,
    currentGraph,
    isHeroChrome,
    mode,
  })

  useEffect(() => {
    if (isHeroChrome && mode === 'tree') return
    setHeroTreeReady(true)
  }, [isHeroChrome, mode])

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
      const target = currentGraph.nodes.find((node) => node.id === focusTargetId) as Parameters<typeof focusNode>[0] | undefined
      if (!target) return
      focusNode(target)
    }, isHeroChrome ? 180 : 900)

    return () => window.clearTimeout(timeout)
  }, [currentGraph.nodes, focusNode, isHeroChrome, mode, selectedNodeId])

  function handleNodeClick(node: { id: string; kind: 'current' | 'note' | 'tag' | 'branch'; path?: string } & { x?: number; y?: number; z?: number }) {
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

  function handleNodeOpen(node: { id: string; kind: 'current' | 'note' | 'tag' | 'branch'; path?: string; label?: string }) {
    if ((node.kind === 'note' || node.kind === 'current') && node.path) {
      onNavigate?.(node.path)
      return
    }
    if (node.kind === 'tag') {
      onTagSelect?.(node.label || '')
    }
  }

  function handleNodeInteraction(node: Parameters<typeof handleNodeClick>[0]) {
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

  function pickTreeNote(noteId: string, notePath?: string) {
    setSelectedNodeId(noteId)
    if (notePath) onNotePreview?.(notePath)
    else onNavigate?.(noteId)
  }

  const showTreePanel = !isHeroChrome && (!isDockLayout || mode === 'tree')
  const showInspectorPanel = !isHeroChrome && !isDockLayout && !isMinimalChrome
  const showFloatingInspector = (isDockLayout || isMinimalChrome) && Boolean(selectedNode)

  if ((loadingGlobal && mode !== 'focus') || (mode === 'focus' && loadingFocus)) {
    return <GraphEmptyStates mode="loading" width={width} height={height} />
  }

  if (mode === 'focus' && !focusPath) {
    return (
      <GraphEmptyStates
        mode="focus-empty"
        width={width}
        height={height}
        emptyFocusLabel={pageCopy.graph.emptyFocus}
      />
    )
  }

  if (currentGraph.nodes.length === 0) {
    return (
      <GraphEmptyStates
        mode="filtered-empty"
        width={width}
        height={height}
        emptyFilteredLabel={pageCopy.graph.emptyFiltered}
      />
    )
  }

  const graphLabels = {
    focusEyebrow: pageCopy.graph.labels.focusEyebrow,
    globalEyebrow: pageCopy.graph.labels.globalEyebrow,
    treeEyebrow: pageCopy.graph.labels.treeEyebrow,
    orphanEyebrow: pageCopy.graph.labels.orphanEyebrow,
    focusTitle: pageCopy.graph.labels.focusTitle,
    globalTitle: pageCopy.graph.labels.globalTitle,
    treeTitle: pageCopy.graph.labels.treeTitle,
    orphanTitle: pageCopy.graph.labels.orphanTitle,
    searchPlaceholder: pageCopy.graph.labels.searchPlaceholder,
    tagsToggle: pageCopy.graph.labels.tagsToggle,
    rotateToggle: pageCopy.graph.labels.rotateToggle,
    clearBranch: pageCopy.graph.labels.clearBranch,
    documents: pageCopy.graph.labels.documents,
    links: pageCopy.graph.labels.links,
    tags: pageCopy.graph.labels.tags,
    orphans: pageCopy.graph.labels.orphans,
    inspectorEmpty: pageCopy.graph.labels.inspectorEmpty,
    badgeCopy: pageCopy.graph.badges,
    actionLabels: {
      preview: pageCopy.graph.labels.preview,
      open: pageCopy.graph.labels.open,
      filterByTag: pageCopy.graph.labels.filterByTag,
      focusBranch: pageCopy.graph.labels.focusBranch,
    },
    neighboursLabel: '邻接节点',
    typeLabel: '类型',
    subDocsLabel: '子文档',
  }

  if (isHeroChrome) {
    return (
      <GraphHeroCanvas
        width={width}
        height={height}
        currentGraph={currentGraph}
        selectedNodeId={selectedNodeId}
        hoveredNodeId={hoveredNodeId}
        mode={mode}
        treeLeafNodeIds={treeLeafNodeIds}
        treeFocusDistances={treeFocusDistances}
        heroTreeReady={heroTreeReady}
        heroTreeWarmupTicks={heroTreeWarmupTicks}
        layoutTuning={layoutTuning}
        onNodeInteraction={handleNodeInteraction}
        onNodeHover={setHoveredNodeId}
        graphRef={graphRef as never}
      />
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
      <GraphTopbar
        mode={mode}
        labels={graphLabels}
        query={query}
        showTags={showTags}
        autoRotate={autoRotate}
        selectedBranch={selectedBranch}
        onQueryChange={setQuery}
        onToggleTags={() => setShowTags(value => !value)}
        onToggleAutoRotate={() => setAutoRotate(value => !value)}
        onClearBranch={() => setSelectedBranch(null)}
      />

      <GraphStats totals={totals} labels={graphLabels} />

      <div className="graph-space__body">
        {showTreePanel && (
          <GraphTreePanel
            rootChildren={tree.rootChildren}
            looseNotes={tree.looseNotes}
            expandedBranches={expandedBranches}
            selectedBranch={selectedBranch}
            selectedNodeId={selectedNodeId}
            totalsNotes={totals.notes}
            panelTitle={pageCopy.graph.treePanel}
            rootViewLabel={pageCopy.graph.labels.rootView}
            looseDocsLabel={pageCopy.graph.labels.looseDocs}
            onSelectBranch={setSelectedBranch}
            onSelectNode={pickTreeNote}
            onNotePreview={onNotePreview}
            onNavigate={onNavigate}
            toggleBranch={toggleBranch}
          />
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

          <GraphCanvas
            ref={graphRef as never}
            width={width}
            height={height}
            isDockLayout={isDockLayout}
            showTreePanel={showTreePanel}
            currentGraph={currentGraph}
            mode={mode}
            selectedNodeId={selectedNodeId}
            hoveredNodeId={hoveredNodeId}
            treeFocusDistances={treeFocusDistances}
            treeEmphasisNodeIds={treeEmphasisNodeIds}
            selectedNeighbors={selectedNeighbors}
            layoutTuning={layoutTuning}
            onNodeInteraction={handleNodeInteraction}
            onNodeHover={setHoveredNodeId}
          />

          {showFloatingInspector && (
            <div className="graph-stage__inspector-float">
              <GraphInspector
                selectedNode={selectedNode}
                adjacencySize={adjacency.get(selectedNode?.id || '')?.size || 0}
                onTagSelect={onTagSelect}
                onNotePreview={onNotePreview}
                onNavigate={onNavigate}
                onFocusBranch={(path) => setSelectedBranch(path)}
                inspectorEmpty={pageCopy.graph.labels.inspectorEmpty}
                badgeCopy={pageCopy.graph.badges}
                labels={graphLabels.actionLabels}
                neighboursLabel={graphLabels.neighboursLabel}
                typeLabel={graphLabels.typeLabel}
                subDocsLabel={graphLabels.subDocsLabel}
              />
            </div>
          )}
        </section>

        {showInspectorPanel && (
          <aside className="graph-space__inspector">
            <div className="graph-panel__header">
              <span>{pageCopy.graph.inspectorPanel}</span>
            </div>
            <GraphInspector
              selectedNode={selectedNode}
              adjacencySize={adjacency.get(selectedNode?.id || '')?.size || 0}
              onTagSelect={onTagSelect}
              onNotePreview={onNotePreview}
              onNavigate={onNavigate}
              onFocusBranch={(path) => setSelectedBranch(path)}
              inspectorEmpty={pageCopy.graph.labels.inspectorEmpty}
              badgeCopy={pageCopy.graph.badges}
              labels={graphLabels.actionLabels}
              neighboursLabel={graphLabels.neighboursLabel}
              typeLabel={graphLabels.typeLabel}
              subDocsLabel={graphLabels.subDocsLabel}
            />
          </aside>
        )}
      </div>
    </div>
  )
}