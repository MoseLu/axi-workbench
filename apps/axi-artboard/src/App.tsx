import './App.scss'
import OverlayCanvas from './overlay/OverlayCanvas'

/**
 * Axi Artboard — Agent visual feedback surface.
 *
 * The application is intentionally empty: there is no demo UI. The
 * product IS the overlay — it sits above whatever the user happens
 * to have mounted, so the demo just leaves a blank canvas for the
 * overlay to draw on. Mount OverlayCanvas at the end of the tree so
 * it paints on top of every other element via a fixed-position
 * canvas with pointer-events: none.
 *
 * Window.__artboard exposes the picker API that MCP / agent loops
 * read from. To put the picker over a different app or component,
 * mount `<OverlayCanvas />` once in that app's root.
 *
 * See `src/overlay/OverlayCanvas.tsx` for the overlay implementation
 * and AGENTS.md for the full picker workflow.
 */
export default function App() {
  return (
    <div className="app-root app-root-blank h-full flex flex-col overflow-hidden relative bg-transparent">
      <main className="main main-blank flex-1 min-h-0 relative">
        {/* Empty canvas — the picker has nothing to bind to here. */}
      </main>

      {/*
        OverlayCanvas is the entire product. Mounted last so it paints
        on top of the rest via a fixed-position canvas with
        pointer-events: none. The debug API it exposes is documented
        on `window.__artboard`.
      */}
      <OverlayCanvas />
    </div>
  )
}