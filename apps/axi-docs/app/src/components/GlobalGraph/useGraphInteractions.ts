import { MutableRefObject, useEffect } from 'react'
import * as THREE from 'three'
import {
  GRAPH_BACKDROP,
  type GlobalGraphMode,
  type SpaceNode,
} from './types'
import { getCameraFitDistance, getGraphBounds } from './helpers'

export interface GraphFocusNodeArgs {
  id?: string
  x?: number
  y?: number
  z?: number
}

export interface GraphCameraInputs {
  graphRef: MutableRefObject<{
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
  } | null>
  mode: GlobalGraphMode
  isHeroChrome: boolean
  autoRotate: boolean
  layoutTuning: {
    chargeStrength: number
    linkDistance: number
    alphaDecay: number
    velocityDecay: number
    cooldownTicks: number
  }
  width: number
  height: number
  nodeCount: number
  linkCount: number
}

export function useGraphCameraControls({
  graphRef,
  mode,
  isHeroChrome,
  autoRotate,
  layoutTuning,
  width,
  height,
  nodeCount,
  linkCount,
}: GraphCameraInputs) {
  useEffect(() => {
    const controls = graphRef.current?.controls?.()
    if (!controls) return
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate = autoRotate && !(isHeroChrome && mode === 'tree')
    controls.autoRotateSpeed = isHeroChrome ? 0.2 : 0.32
    controls.minDistance = 120
    controls.maxDistance = 2400
  }, [autoRotate, graphRef, isHeroChrome, mode, nodeCount])

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
  }, [graphRef, nodeCount])

  useEffect(() => {
    const linkForce = graphRef.current?.d3Force?.('link')
    linkForce?.distance?.(layoutTuning.linkDistance)

    const chargeForce = graphRef.current?.d3Force?.('charge')
    chargeForce?.strength?.(layoutTuning.chargeStrength)
  }, [graphRef, layoutTuning, linkCount, nodeCount])

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
  }, [graphRef, height, isHeroChrome, mode, width])
}

export interface GraphFitInputs {
  graphRef: MutableRefObject<{
    zoomToFit?: (ms?: number, padding?: number, nodeFilter?: (node: SpaceNode) => boolean) => void
    cameraPosition?: (position: { x?: number; y?: number; z?: number }, lookAt?: { x?: number; y?: number; z?: number }, ms?: number) => void
  } | null>
  currentGraph: { nodes: SpaceNode[] }
  mode: GlobalGraphMode
  isHeroChrome: boolean
  selectedNodeId: string | null
  setHeroTreeReady: (ready: boolean) => void
  focusNode: (node: GraphFocusNodeArgs) => void
}

export function useGraphFit({
  graphRef,
  currentGraph,
  mode,
  isHeroChrome,
  selectedNodeId,
  setHeroTreeReady,
  focusNode,
}: GraphFitInputs) {
  const isHeroTree = isHeroChrome && mode === 'tree'
  const nodeCount = currentGraph.nodes.length

  useEffect(() => {
    if (nodeCount === 0) return
    const fitPadding = mode === 'tree' ? (isHeroChrome ? 0 : 56) : (isHeroChrome ? 8 : 80)

    if (isHeroTree) {
      setHeroTreeReady(false)
      const heroTimeout = window.setTimeout(() => {
        const heroTarget = (currentGraph.nodes.find((node: SpaceNode) => node.id === (selectedNodeId || 'branch:__knowledge-root__')) || currentGraph.nodes[0]) as (
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
  }, [currentGraph.nodes, focusNode, graphRef, isHeroChrome, isHeroTree, mode, nodeCount, selectedNodeId, setHeroTreeReady])
}

export interface GraphHeroPositionInputs {
  graphRef: MutableRefObject<{
    cameraPosition?: (position: { x?: number; y?: number; z?: number }, lookAt?: { x?: number; y?: number; z?: number }, ms?: number) => void
  } | null>
  currentGraph: { nodes: SpaceNode[] }
  isHeroChrome: boolean
  mode: GlobalGraphMode
}

export function useGraphHeroPosition({
  graphRef,
  currentGraph,
  isHeroChrome,
  mode,
}: GraphHeroPositionInputs) {
  useEffect(() => {
    if (!isHeroChrome || currentGraph.nodes.length === 0 || mode === 'tree') return

    const timeout = window.setTimeout(() => {
      const positionedNodes = currentGraph.nodes.filter((node) => (
        typeof (node as SpaceNode & { x?: number }).x === 'number'
        && typeof (node as SpaceNode & { y?: number }).y === 'number'
        && typeof (node as SpaceNode & { z?: number }).z === 'number'
      )) as Array<SpaceNode & { x: number; y: number; z: number }>

      if (positionedNodes.length === 0) return

      const bounds = getGraphBounds(positionedNodes)
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
  }, [currentGraph.nodes, graphRef, isHeroChrome, mode])
}

export interface GraphFocusInputs {
  currentGraph: { nodes: SpaceNode[] }
  treeEmphasisNodeIds: Set<string>
  isHeroChrome: boolean
  mode: GlobalGraphMode
  width: number
  height: number
  selectedNodeId: string | null
  graphRef: MutableRefObject<{
    cameraPosition?: (position: { x?: number; y?: number; z?: number }, lookAt?: { x?: number; y?: number; z?: number }, ms?: number) => void
  } | null>
}

export function buildFocusNode({
  currentGraph,
  treeEmphasisNodeIds,
  isHeroChrome,
  mode,
  width,
  height,
  graphRef,
}: GraphFocusInputs) {
  return function focusNode(node: GraphFocusNodeArgs) {
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
      const isHeroRootFocus = node.id === 'branch:__knowledge-root__'
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
    const isHeroRootFocus = isHeroTree && node.id === 'branch:__knowledge-root__'
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
}