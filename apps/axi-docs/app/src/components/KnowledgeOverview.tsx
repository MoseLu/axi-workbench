import { KnowledgeCatalog } from '../types'
import { formatKnowledgeItemTitle, formatKnowledgeTagLabel } from '../lib/knowledgeFormatter'
import { BookIcon, TagIcon, FileIcon, FolderIcon } from './Icons'

interface KnowledgeOverviewProps {
  sourceName: string
  catalog: KnowledgeCatalog | null
  loading: boolean
  error?: string | null
  onOpenItem: (sourceId: string, path: string) => void
  onTagSelect: (tag: string) => void
}

export function KnowledgeOverview({
  sourceName,
  catalog,
  loading,
  error,
  onOpenItem,
  onTagSelect,
}: KnowledgeOverviewProps) {
  if (loading) {
    return (
      <div className="knowledge-overview">
        <div className="loading"><div className="spinner" /></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="knowledge-overview">
        <div className="empty-state">
          <BookIcon />
          <div>
            <p className="empty-state-text">知识目录加载失败</p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-2)' }}>
              {error}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!catalog) {
    return (
      <div className="knowledge-overview">
        <div className="empty-state">
          <BookIcon />
          <p className="empty-state-text">暂无知识目录</p>
        </div>
      </div>
    )
  }

  return (
    <div className="knowledge-overview">
      <section className="overview-hero">
        <div className="overview-hero__text">
          <div className="overview-eyebrow">{sourceName}</div>
          <h1 className="overview-title">知识库总览</h1>
          <p className="overview-subtitle">
            先看索引和重点板块，再决定是走全局图谱、标签导航，还是直接全文搜索。
          </p>
        </div>
        <div className="overview-stats">
          <div className="overview-stat">
            <span className="overview-stat__label">文档总数</span>
            <strong>{catalog.totalDocs}</strong>
          </div>
          <div className="overview-stat">
            <span className="overview-stat__label">标签数</span>
            <strong>{catalog.totalTags}</strong>
          </div>
          <div className="overview-stat">
            <span className="overview-stat__label">目录分区</span>
            <strong>{catalog.sections.length}</strong>
          </div>
        </div>
      </section>

      {catalog.topTags.length > 0 && (
        <section className="overview-panel">
          <div className="overview-panel__header">
            <div>
              <h2>高频标签</h2>
              <p>快速判断知识库里是否已经有对应主题的内容。</p>
            </div>
            <TagIcon />
          </div>
          <div className="overview-tags">
            {catalog.topTags.slice(0, 18).map((tag) => (
              <button
                key={tag.name}
                className="tag"
                onClick={() => onTagSelect(tag.name)}
                title={`${tag.count} 篇文档`}
              >
                #{formatKnowledgeTagLabel(tag.name)}
                <span className="tag-count">{tag.count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {catalog.recentDocs.length > 0 && (
        <section className="overview-panel">
          <div className="overview-panel__header">
            <div>
              <h2>近期更新</h2>
              <p>优先看最近沉淀的文档，判断当前经验是否仍然可复用。</p>
            </div>
            <FileIcon />
          </div>
          <div className="overview-recent">
            {catalog.recentDocs.slice(0, 6).map((item) => (
              <button
                key={`${item.sourceId}:${item.path}`}
                className="overview-list-item"
                onClick={() => onOpenItem(item.sourceId, item.path)}
              >
                <div>
                  <div className="overview-list-item__title">{formatKnowledgeItemTitle(item)}</div>
                  <div className="overview-list-item__meta">{item.path}</div>
                </div>
                <span className="overview-list-item__badge">{item.docType || 'note'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="overview-sections">
        {catalog.sections.map((section) => (
          <article key={section.key} className="overview-card">
            <div className="overview-card__header">
              <div>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </div>
              <span className="overview-card__count">{section.count}</span>
            </div>

            <div className="overview-card__items">
              {section.items.slice(0, 5).map((item) => (
                <button
                  key={`${item.sourceId}:${item.path}`}
                  className="overview-list-item"
                  onClick={() => onOpenItem(item.sourceId, item.path)}
                >
                  <div>
                    <div className="overview-list-item__title">{formatKnowledgeItemTitle(item)}</div>
                    <div className="overview-list-item__meta">{item.path}</div>
                  </div>
                  <FolderIcon />
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
