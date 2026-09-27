import { useState } from 'react'
import { SegmentedTabs } from './CockpitPrimitives'
import { ArchitectureOverview } from './ArchitectureOverview'
import { ArchitectureDataFlow } from './ArchitectureDataFlow'
import { ArchitectureBootstrap } from './ArchitectureBootstrap'
import { ArchitectureChangeTriggers } from './ArchitectureChangeTriggers'

type ArchitectureView = 'full' | 'flow' | 'bootstrap' | 'changes'

interface WorkspaceArchitecturePageProps {
  onNavigateToDocument?: (path: string) => void
}

export function WorkspaceArchitecturePage({
  onNavigateToDocument,
}: WorkspaceArchitecturePageProps) {
  const [activeView, setActiveView] = useState<ArchitectureView>('full')

  const viewItems = [
    { value: 'full' as const, label: '全架构' },
    { value: 'flow' as const, label: '数据流转' },
    { value: 'bootstrap' as const, label: '项目准入' },
    { value: 'changes' as const, label: '修改触发' },
  ]

  const renderView = () => {
    switch (activeView) {
      case 'flow':
        return <ArchitectureDataFlow onNavigate={onNavigateToDocument} />
      case 'bootstrap':
        return <ArchitectureBootstrap onNavigate={onNavigateToDocument} />
      case 'changes':
        return <ArchitectureChangeTriggers onNavigate={onNavigateToDocument} />
      default:
        return <ArchitectureOverview onNavigate={onNavigateToDocument} />
    }
  }

  return (
    <div className="workspace-architecture">
      <div className="arch-header">
        <div className="arch-title-row">
          <span className="arch-eyebrow">工作区架构</span>
          <h1 className="arch-title">Axi 工作区文档架构 v5</h1>
          <p className="arch-subtitle">6 大架构层 + 1 条闭环 · 2026-08-21</p>
        </div>
      </div>

      <div className="arch-tabs">
        <SegmentedTabs
          items={viewItems}
          value={activeView}
          onChange={setActiveView}
        />
      </div>

      {renderView()}

      <div className="arch-legend">
        <span className="legend-item legend-core">实心蓝边 · 核心模块</span>
        <span className="legend-item legend-muted">灰斜体 · 非核心/排除</span>
        <span className="legend-item legend-warn">红边 · 时效性缺口</span>
        <span className="legend-item legend-hi">绿边 · 已对齐/强项</span>
      </div>
    </div>
  )
}
