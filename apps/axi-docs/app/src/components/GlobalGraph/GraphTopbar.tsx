import { SearchIcon } from '../Icons'
import type { GlobalGraphMode } from './types'

interface GraphLabels {
  focusEyebrow: string
  globalEyebrow: string
  treeEyebrow: string
  orphanEyebrow: string
  focusTitle: string
  globalTitle: string
  treeTitle: string
  orphanTitle: string
  searchPlaceholder: string
  tagsToggle: string
  rotateToggle: string
  clearBranch: string
}

interface GraphTopbarProps {
  mode: GlobalGraphMode
  labels: GraphLabels
  query: string
  showTags: boolean
  autoRotate: boolean
  selectedBranch: string | null
  onQueryChange: (next: string) => void
  onToggleTags: () => void
  onToggleAutoRotate: () => void
  onClearBranch: () => void
}

export function GraphTopbar({
  mode,
  labels,
  query,
  showTags,
  autoRotate,
  selectedBranch,
  onQueryChange,
  onToggleTags,
  onToggleAutoRotate,
  onClearBranch,
}: GraphTopbarProps) {
  const eyebrowByMode: Record<GlobalGraphMode, string> = {
    focus: labels.focusEyebrow,
    global: labels.globalEyebrow,
    tree: labels.treeEyebrow,
    orphan: labels.orphanEyebrow,
  }
  const titleByMode: Record<GlobalGraphMode, string> = {
    focus: labels.focusTitle,
    global: labels.globalTitle,
    tree: labels.treeTitle,
    orphan: labels.orphanTitle,
  }

  return (
    <div className="graph-space__topbar">
      <div>
        <div className="graph-space__eyebrow">{eyebrowByMode[mode]}</div>
        <h3 className="graph-space__title">{titleByMode[mode]}</h3>
      </div>

      <div className="graph-space__toolbar">
        <label className="graph-space__search" aria-label="筛选图谱节点">
          <SearchIcon />
          <input
            aria-label="筛选图谱节点"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder={labels.searchPlaceholder}
          />
        </label>

        <button
          className={`graph-chip${showTags ? ' active' : ''}`}
          onClick={onToggleTags}
          type="button"
        >
          {labels.tagsToggle}
        </button>
        <button
          className={`graph-chip${autoRotate ? ' active' : ''}`}
          onClick={onToggleAutoRotate}
          type="button"
        >
          {labels.rotateToggle}
        </button>
        {selectedBranch && (
          <button className="graph-chip" onClick={onClearBranch} type="button">
            {labels.clearBranch}
          </button>
        )}
      </div>
    </div>
  )
}