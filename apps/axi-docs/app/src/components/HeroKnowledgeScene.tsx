import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { pageCopy } from '../config/pageCopy'

const GlobalGraph = lazy(async () => {
  const module = await import('./GlobalGraph')
  return { default: module.GlobalGraph }
})

interface HeroKnowledgeSceneProps {
  sourceId: string
  focusPath?: string | null
  mode: 'focus' | 'global' | 'tree'
  onNavigate: (path: string) => void
  onTagSelect?: (tag: string) => void
  chrome?: 'hero' | 'cockpit' | 'minimal'
  layout?: 'hero' | 'dock' | 'workspace'
}

export function HeroKnowledgeScene({
  sourceId,
  focusPath,
  mode,
  onNavigate,
  onTagSelect,
  chrome = 'hero',
  layout = 'hero',
}: HeroKnowledgeSceneProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState({ width: 1200, height: 720 })
  const [shouldRenderScene, setShouldRenderScene] = useState(false)

  useEffect(() => {
    if (!sceneRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setViewport({
        width: Math.max(Math.round(entry.contentRect.width), 320),
        height: Math.max(Math.round(entry.contentRect.height), 360),
      })
    })
    observer.observe(sceneRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (shouldRenderScene) return

    const activate = () => setShouldRenderScene(true)
    if (typeof window === 'undefined') {
      activate()
      return
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
      cancelIdleCallback?: (handle: number) => void
    }

    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(activate, { timeout: 1200 })
      return () => idleWindow.cancelIdleCallback?.(idleId)
    }

    const timeoutId = window.setTimeout(activate, 700)
    return () => window.clearTimeout(timeoutId)
  }, [shouldRenderScene])

  return (
    <div
      className="hero-knowledge-scene"
      onFocusCapture={() => setShouldRenderScene(true)}
      onPointerEnter={() => setShouldRenderScene(true)}
      ref={sceneRef}
    >
      {shouldRenderScene ? (
        <Suspense
          fallback={(
            <div className="hero-knowledge-scene__fallback">
              <div className="spinner" />
              <span>{pageCopy.graph.loading}</span>
            </div>
          )}
        >
          <GlobalGraph
            chrome={chrome}
            focusPath={focusPath}
            height={viewport.height}
            layout={layout}
            mode={mode}
            onNavigate={onNavigate}
            onTagSelect={onTagSelect}
            sourceId={sourceId}
            width={viewport.width}
          />
        </Suspense>
      ) : chrome === 'hero' ? (
        <div className="hero-knowledge-scene__poster" aria-hidden="true">
          <div className="hero-knowledge-scene__poster-grid" />
          <div className="hero-knowledge-scene__poster-orbit hero-knowledge-scene__poster-orbit--one" />
          <div className="hero-knowledge-scene__poster-orbit hero-knowledge-scene__poster-orbit--two" />
          <div className="hero-knowledge-scene__poster-copy">
            <strong>{pageCopy.graph.heroPosterTitle}</strong>
            <span>{pageCopy.graph.heroPosterDescription}</span>
          </div>
        </div>
      ) : (
        <div className="hero-knowledge-scene__fallback">
          <div className="spinner" />
          <span>{pageCopy.graph.loading}</span>
        </div>
      )}
    </div>
  )
}
