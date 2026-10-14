import { FileIcon, SearchIcon } from '../Icons'

interface GraphEmptyStatesProps {
  mode: 'loading' | 'focus-empty' | 'filtered-empty'
  width: number
  height: number
  loading?: boolean
  emptyFocusLabel?: string
  emptyFilteredLabel?: string
}

export function GraphEmptyStates({
  mode,
  width,
  height,
  loading,
  emptyFocusLabel,
  emptyFilteredLabel,
}: GraphEmptyStatesProps) {
  if (mode === 'loading') {
    return (
      <div className="graph-space graph-space--loading" style={{ width, height }}>
        <div className="spinner" style={{ width: 24, height: 24 }} />
        <span>{loading ? 'Loading…' : ''}</span>
      </div>
    )
  }

  if (mode === 'focus-empty') {
    return (
      <div className="graph-space graph-space--empty" style={{ width, height }}>
        <FileIcon />
        <p>{emptyFocusLabel}</p>
      </div>
    )
  }

  return (
    <div className="graph-space graph-space--empty" style={{ width, height }}>
      <SearchIcon />
      <p>{emptyFilteredLabel}</p>
    </div>
  )
}