import { SPACE_COLORS } from './types'

interface GraphStatsLabels {
  documents: string
  links: string
  tags: string
  orphans: string
}

interface GraphStatsProps {
  totals: { notes: number; links: number; tags: number; orphans: number }
  labels: GraphStatsLabels
}

export function GraphStats({ totals, labels }: GraphStatsProps) {
  return (
    <div className="graph-space__stats">
      <div className="graph-metric">
        <span>{labels.documents}</span>
        <strong>{totals.notes}</strong>
      </div>
      <div className="graph-metric">
        <span>{labels.links}</span>
        <strong>{totals.links}</strong>
      </div>
      <div className="graph-metric">
        <span>{labels.tags}</span>
        <strong>{totals.tags}</strong>
      </div>
      <div className="graph-metric">
        <span>{labels.orphans}</span>
        <strong>{totals.orphans}</strong>
      </div>
      <div className="graph-legend">
        <span><i style={{ background: SPACE_COLORS.note }} />文档</span>
        <span><i style={{ background: SPACE_COLORS.branch }} />分支</span>
        <span><i style={{ background: SPACE_COLORS.tag }} />标签</span>
      </div>
    </div>
  )
}