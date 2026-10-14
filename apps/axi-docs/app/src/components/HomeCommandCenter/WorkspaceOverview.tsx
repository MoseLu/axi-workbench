import type { SiteLocale } from '../../config/siteConfig'
import { DocSource, KnowledgeCatalog, KnowledgeCatalogSection } from '../../types'

type GuideLocale = SiteLocale

interface WorkspaceOverviewProps {
  currentSourceName: string
  sourceDescription: string | undefined
  isSkillsDocSet: boolean
  catalog: KnowledgeCatalog | null
  dbskillSourceLabel: string | undefined
  overviewSections: KnowledgeCatalogSection[]
  activeWorkspaceDocumentType: KnowledgeCatalogSection | undefined
  activeWorkspaceDocumentTypeKey: string | null
  sources: DocSource[]
  isWorkspaceDocSet: boolean
  onOpenExplorer: () => void
  onOpenItem: (sourceId: string, path: string) => void
  featuredDocs: KnowledgeCatalog['recentDocs']
  guideLocale: GuideLocale
}

export function WorkspaceOverview({
  currentSourceName,
  sourceDescription,
  isSkillsDocSet,
  catalog,
  dbskillSourceLabel,
  overviewSections,
  activeWorkspaceDocumentType,
  activeWorkspaceDocumentTypeKey,
  sources,
  isWorkspaceDocSet,
  onOpenExplorer,
  onOpenItem,
  featuredDocs,
  guideLocale,
}: WorkspaceOverviewProps) {
  return (
    <article className="axi-docs-home__doc" id="overview">
      <h1>{currentSourceName}</h1>
      <section className="axi-docs-home__section" id="doc-set-overview">
        <h2>{guideLocale === 'zh' ? '文档集概览' : 'Docs Overview'}</h2>
        <p>{sourceDescription || (guideLocale === 'zh' ? '当前顶级导航对应的文档集。左侧显示该文档集内部目录。' : 'This top-level navigation item maps to the document set shown in the left sidebar.')}</p>
        <div className="axi-docs-home__overview-actions">
          <button className="axi-docs-home__graph-entry" onClick={onOpenExplorer} type="button">
            <span>{guideLocale === 'zh' ? '打开知识图谱' : 'Open knowledge graph'}</span>
            <small>{guideLocale === 'zh' ? '以树构 / 路径 / 孤岛三种视图探索文档关联' : 'Explore document relations in tree, path, and islands views'}</small>
          </button>
        </div>
        {isSkillsDocSet && catalog && (
          <div className="axi-docs-home__stats-grid" aria-label="技能库统计">
            <div>
              <strong>{catalog.totalDocs}</strong>
              <span>{guideLocale === 'zh' ? '个已索引条目' : 'indexed entries'}</span>
            </div>
            <div>
              <strong>{catalog.sections.length}</strong>
              <span>{guideLocale === 'zh' ? '个能力分组' : 'capability groups'}</span>
            </div>
            <div>
              <strong>{dbskillSourceLabel ? 'dbskill' : 'family'}</strong>
              <span>{guideLocale === 'zh' ? '组织方式' : 'organization'}</span>
            </div>
          </div>
        )}
        {isSkillsDocSet && dbskillSourceLabel && (
          <div className="axi-docs-home__callout">
            <strong>{guideLocale === 'zh' ? '组织基线' : 'Organization baseline'}</strong>
            <p>
              {guideLocale === 'zh'
                ? '技能库保留 Axi Skills 的 700+ 实际技能入口，同时按最新 dbskill 的工具箱思路拆成能力分组；dbskill 自身也作为独立来源接入，可通过全局搜索检索 dbs 方法、知识包和内容工程模板。'
                : 'The Skills collection keeps the 700+ Axi Skills entries while grouping them with the latest dbskill toolbox model. dbskill is also connected as a standalone source for DBS methods, knowledge packs, and content-engineering templates.'}
            </p>
          </div>
        )}
        {overviewSections.length > 0 && (
          <div className="axi-docs-home__result-list" key={activeWorkspaceDocumentTypeKey || 'all'} style={{ animation: 'axi-docs-list-in 0.24s ease' }}>
            {overviewSections.map((section) => (
              <button
                key={section.key}
                onClick={() => {
                  const firstItem = section.items[0]
                  if (firstItem) onOpenItem(firstItem.sourceId, firstItem.path)
                }}
                type="button"
              >
                <strong>{section.title}</strong>
                <span>{section.description}</span>
                <small>{isWorkspaceDocSet && activeWorkspaceDocumentType
                  ? activeWorkspaceDocumentType.title
                  : `${section.count} ${guideLocale === 'zh' ? '篇文档' : 'docs'}`}</small>
              </button>
            ))}
            {/* Architecture Visualization Entry */}
            <button
              key="workspace-architecture"
              onClick={() => {
                const workspaceSourceId = sources.find((s) => s.type === 'local')?.id || 'workspace'
                onOpenItem(workspaceSourceId, 'architecture')
              }}
              type="button"
            >
              <strong>🗺️ {guideLocale === 'zh' ? '架构可视化' : 'Architecture Visualization'}</strong>
              <span>{guideLocale === 'zh' ? '6 大架构层 + 1 条闭环' : '6 Architecture Layers + 1 Closed Loop'}</span>
              <small>{guideLocale === 'zh' ? '交互式工作区架构图' : 'Interactive workspace architecture diagram'}</small>
            </button>
          </div>
        )}
      </section>
      {featuredDocs.length > 0 && (
      <section className="axi-docs-home__section" id="recent-docs">
        <h2>{guideLocale === 'zh' ? '最近更新' : 'Recent Updates'}</h2>
        <div className="axi-docs-home__result-list">
          {featuredDocs.map((item) => (
            <button key={`${item.sourceId}:${item.path}`} onClick={() => onOpenItem(item.sourceId, item.path)} type="button">
              <strong>{item.title}</strong>
              <span>{item.description || item.path}</span>
              <small>{item.path}</small>
            </button>
          ))}
        </div>
      </section>
      )}
    </article>
  )
}