import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { pageCopy } from '../config/pageCopy'
import {
  formatKnowledgeBranchPath,
  formatKnowledgeItemTitle,
  formatKnowledgeTagLabel,
} from '../lib/knowledgeFormatter'
import { buildCategoryRoute } from '../lib/routes'
import type { DocSource, KnowledgeCatalog, KnowledgeCatalogSection, SelectedFile } from '../types'
import { CompactEmptyState, MetricPill, PageShell, RailPanel, SectionHeader, SegmentedTabs } from './CockpitPrimitives'
import { DocumentView } from './DocumentView'
import { FileIcon, LinkIcon, SearchIcon } from './Icons'
import { PreviewCard, type PreviewCardFact } from './PreviewCard'

const GlobalGraph = lazy(async () => {
  const module = await import('./GlobalGraph')
  return { default: module.GlobalGraph }
})

type CategoryExplorerView = 'tree' | 'path' | 'islands'
type CategoryDrawerTab = 'summary' | 'preview'

interface CategoryGraphPageProps {
  source: DocSource
  homeHref: string
  catalog: KnowledgeCatalog | null
  categorySection: KnowledgeCatalogSection | null
  selectedFile: SelectedFile | null
  fileContent: string | null
  fileName: string
  fileLoading: boolean
  searchQuery: string
  activeTag: string | null
  selectedBranch: string | null
  selectedNodeId: string | null
  view: CategoryExplorerView
  getCategoryHref: (route: string) => string
  getDocumentHref: (sourceId: string, path: string) => string
  onViewChange: (view: CategoryExplorerView) => void
  onBranchChange: (branch: string | null) => void
  onNodeChange: (node: string | null) => void
  onPreviewItem: (sourceId: string, path: string) => void
  onOpenItem: (sourceId: string, path: string) => void
  onTagSelect: (tag: string | null) => void
  onWikiLink: (noteName: string) => void
}

function resolveGraphMode(view: CategoryExplorerView) {
  if (view === 'islands') return 'orphan'
  if (view === 'path') return 'focus'
  return 'tree'
}

function documentTitle(item: { title?: string | null; name?: string | null; path?: string | null }) {
  return formatKnowledgeItemTitle(item)
}

export function CategoryGraphPage({
  source,
  homeHref,
  catalog,
  categorySection,
  selectedFile,
  fileContent,
  fileName,
  fileLoading,
  searchQuery,
  activeTag,
  selectedBranch,
  selectedNodeId,
  view,
  getCategoryHref,
  getDocumentHref,
  onViewChange,
  onBranchChange,
  onNodeChange,
  onPreviewItem,
  onOpenItem,
  onTagSelect,
  onWikiLink,
}: CategoryGraphPageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState({ width: 1280, height: 900 })
  const [drawerTab, setDrawerTab] = useState<CategoryDrawerTab>('summary')
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!stageRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setViewport({
        width: Math.max(Math.round(entry.contentRect.width), 320),
        height: Math.max(Math.round(entry.contentRect.height), 480),
      })
    })
    observer.observe(stageRef.current)
    return () => observer.disconnect()
  }, [])

  const categoryTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of categorySection?.items || []) {
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1)
      }
    }

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh-CN'))
      .slice(0, 8)
  }, [categorySection?.items])

  const selectedCatalogItem = useMemo(
    () => categorySection?.items.find((item) => item.path === selectedFile?.path) || categorySection?.items[0] || null,
    [categorySection?.items, selectedFile?.path],
  )

  const relatedItems = useMemo(
    () => (categorySection?.items || []).filter((item) => item.path !== selectedCatalogItem?.path).slice(0, 6),
    [categorySection?.items, selectedCatalogItem?.path],
  )
  const selectedCatalogPath = selectedCatalogItem?.path || null

  const previewFacts = useMemo<PreviewCardFact[]>(() => {
    if (!selectedCatalogItem) return []

    return [
      { label: '当前分类', value: categorySection?.title || '未归类' },
      { label: '同类节点', value: categorySection?.count || 0 },
      { label: '当前视图', value: view === 'tree' ? '树构' : view === 'path' ? '路径聚焦' : '孤岛巡检' },
    ]
  }, [categorySection?.count, categorySection?.title, selectedCatalogItem, view])

  useEffect(() => {
    if (view === 'tree') return
    const firstItem = categorySection?.items[0]
    if (!firstItem || selectedFile || selectedNodeId) return

    onNodeChange(firstItem.path)
    onPreviewItem(firstItem.sourceId, firstItem.path)
  }, [categorySection?.key, categorySection?.items, onNodeChange, onPreviewItem, selectedFile, selectedNodeId, view])

  useEffect(() => {
    if (view === 'tree' || selectedFile || !selectedNodeId) return

    const matchedItem = categorySection?.items.find((item) => item.path === selectedNodeId)
    if (!matchedItem) return

    onPreviewItem(matchedItem.sourceId, matchedItem.path)
  }, [categorySection?.items, onPreviewItem, selectedFile, selectedNodeId, view])

  useEffect(() => {
    if (!selectedCatalogPath) return
    setDrawerOpen(true)
    setDrawerTab('summary')
  }, [selectedCatalogPath])

  return (
    <PageShell className="category-graph-page" compact>
      <div className="category-graph-page__header">
        <div className="category-graph-page__breadcrumbs">
          <Link className="category-graph-page__crumb" to={homeHref}>
            知识总览
          </Link>
          <span>/</span>
          <span className="category-graph-page__crumb category-graph-page__crumb--current">
            {categorySection?.title || '分类图谱'}
          </span>
        </div>

        <div className="category-graph-page__toolbar">
          <SegmentedTabs
            ariaLabel="分类图谱视图模式"
            className="category-graph-page__views"
            idBase="category-graph-view-tabs"
            items={[
              { value: 'tree', label: '树构' },
              { value: 'path', label: '路径' },
              { value: 'islands', label: '孤岛' },
            ]}
            onChange={onViewChange}
            panelId="category-graph-stage"
            value={view}
          />

          {(searchQuery.trim() || activeTag || selectedBranch) && (
            <div className="category-graph-page__states">
              {searchQuery.trim() && (
                <span className="category-graph-page__state">
                  <SearchIcon />
                  <span>{searchQuery}</span>
                </span>
              )}
              {activeTag && (
                <button className="category-graph-page__state" onClick={() => onTagSelect(null)} type="button">
                  #{formatKnowledgeTagLabel(activeTag)}
                </button>
              )}
              {selectedBranch && <span className="category-graph-page__state">分支 {formatKnowledgeBranchPath(selectedBranch)}</span>}
            </div>
          )}
        </div>
      </div>

      <div className="category-graph-page__layout">
        <aside className="category-graph-page__sidebar">
          <RailPanel className="category-graph-page__panel category-graph-page__panel--summary" tone="primary">
            <SectionHeader
              description={categorySection?.description || pageCopy.category.fallbackDescription}
              eyebrow={source.name}
              title={<h1>{categorySection?.title || pageCopy.category.fallbackTitle}</h1>}
            />
            <div className="category-graph-page__metrics">
              <MetricPill accent="blue" label="文档数" value={categorySection?.count || 0} />
              <MetricPill accent="teal" label="高频标签" value={categoryTags.length} />
            </div>
          </RailPanel>

          <RailPanel className="category-graph-page__panel category-graph-page__panel--scroll" tone="secondary">
            <SectionHeader
              compact
              eyebrow={pageCopy.category.railTitle}
              meta={<span>{catalog?.sections.length || 0} 个分类</span>}
              title={<strong>快速切换分类</strong>}
              description={pageCopy.category.railDescription}
            />
            <div className="category-graph-page__section-list">
              {(catalog?.sections || []).map((section) => (
                <Link
                  key={section.key}
                  className={`category-graph-page__section-item${section.key === categorySection?.key ? ' active' : ''}`}
                  to={getCategoryHref(buildCategoryRoute(section.key))}
                >
                  <div>
                    <strong>{section.title}</strong>
                    <span>{section.description}</span>
                  </div>
                  <small>{section.count}</small>
                </Link>
              ))}
            </div>
          </RailPanel>

          <RailPanel className="category-graph-page__panel category-graph-page__panel--scroll" tone="ghost">
            <SectionHeader
              compact
              eyebrow="核心入口"
              meta={<span>{Math.min(categorySection?.items.length || 0, 8)} 条</span>}
              title={<strong>文档入口与高频标签</strong>}
            />
            <div className="category-graph-page__document-list">
              {(categorySection?.items.slice(0, 8) || []).map((item) => (
                <button
                  key={`${item.sourceId}:${item.path}`}
                  className={`category-graph-page__document-link${selectedFile?.path === item.path ? ' active' : ''}`}
                  onClick={() => {
                    onNodeChange(item.path)
                    onPreviewItem(item.sourceId, item.path)
                  }}
                  onDoubleClick={() => onOpenItem(item.sourceId, item.path)}
                  type="button"
                >
                  <FileIcon />
                  <div>
                    <strong>{documentTitle(item)}</strong>
                    <span>{item.path}</span>
                  </div>
                </button>
              ))}
            </div>
            {categoryTags.length > 0 && (
              <div className="category-graph-page__tag-list">
                {categoryTags.map((tag) => (
                  <button key={tag.name} className="category-graph-page__tag" onClick={() => onTagSelect(tag.name)} type="button">
                    #{formatKnowledgeTagLabel(tag.name)}
                    <small>{tag.count}</small>
                  </button>
                ))}
              </div>
            )}
          </RailPanel>
        </aside>

        <RailPanel className="category-graph-page__graph-panel" tone="primary">
          <SectionHeader
            actions={(
              <button
                className="category-graph-page__inline-action"
                onClick={() => setDrawerOpen((current) => !current)}
                type="button"
              >
                {drawerOpen ? '收起详情' : '节点详情'}
              </button>
            )}
            className="category-graph-page__graph-header"
            compact
            description="单击节点更新详情抽屉，双击进入完整文档；复杂细节不再常驻占用第三栏。"
            eyebrow="图谱舞台"
            meta={<span>{view === 'tree' ? '树构主视图' : view === 'path' ? '路径聚焦' : '孤岛巡检'}</span>}
            title={<strong>{categorySection?.title || pageCopy.category.fallbackTitle}</strong>}
          />

          <div className="category-graph-page__graph-stack">
            <div
              className="category-graph-page__graph-stage"
              id="category-graph-stage"
              ref={stageRef}
              role="tabpanel"
              aria-labelledby={`category-graph-view-tabs-tab-${view}`}
            >
              <Suspense
                fallback={(
                  <div className="hero-knowledge-scene__fallback">
                    <div className="spinner" />
                    <span>正在加载分类图谱...</span>
                  </div>
                )}
              >
                <GlobalGraph
                  focusPath={selectedFile?.path || categorySection?.items[0]?.path || null}
                  chrome="cockpit"
                  height={viewport.height}
                  layout="dock"
                  mode={resolveGraphMode(view)}
                  onBranchChange={onBranchChange}
                  onNavigate={(path) => onOpenItem(source.id, path)}
                  onNodeSelect={onNodeChange}
                  onNotePreview={(path) => onPreviewItem(source.id, path)}
                  onTagSelect={(tag) => onTagSelect(tag)}
                  selectedBranch={selectedBranch}
                  selectedNodeId={selectedNodeId}
                  sourceId={source.id}
                  filterPaths={categorySection?.items.map((item) => item.path)}
                  width={viewport.width}
                />
              </Suspense>
            </div>

            <aside className={`category-graph-page__drawer${drawerOpen ? ' is-open' : ''}`}>
              <div className="category-graph-page__drawer-shell">
                <div className="category-graph-page__drawer-toolbar">
                  <div>
                    <span className="category-graph-page__drawer-eyebrow">Details on Demand</span>
                    <strong className="category-graph-page__drawer-title">节点详情抽屉</strong>
                  </div>
                  <button className="category-graph-page__inline-action" onClick={() => setDrawerOpen(false)} type="button">
                    关闭
                  </button>
                </div>

                <SegmentedTabs
                  ariaLabel="详情抽屉视图"
                  idBase="category-drawer-tabs"
                  items={[
                    { value: 'summary', label: pageCopy.category.summaryTab },
                    { value: 'preview', label: pageCopy.category.previewTab },
                  ]}
                  onChange={setDrawerTab}
                  panelId="category-drawer-panel"
                  value={drawerTab}
                />

                <div
                  className="category-graph-page__drawer-body"
                  id="category-drawer-panel"
                  role="tabpanel"
                  aria-labelledby={`category-drawer-tabs-tab-${drawerTab}`}
                >
                  {selectedCatalogItem ? (
                    drawerTab === 'summary' ? (
                      <>
                        <PreviewCard
                          actions={selectedFile ? (
                            <Link className="category-graph-page__inline-action" to={getDocumentHref(selectedFile.sourceId, selectedFile.path)}>
                              打开详情
                            </Link>
                          ) : null}
                          categories={selectedCatalogItem.categories}
                          description={selectedCatalogItem.description || '当前节点的摘要、标签和上下文会在这里集中呈现。'}
                          docType={selectedCatalogItem.docType}
                          facts={previewFacts}
                          onTagSelect={onTagSelect}
                          path={selectedCatalogItem.path}
                          sourceName={source.name}
                          tags={selectedCatalogItem.tags}
                          title={documentTitle(selectedCatalogItem)}
                          updated={selectedCatalogItem.updated}
                        />

                        <section className="category-graph-page__drawer-section">
                          <div className="category-graph-page__drawer-section-head">
                            <strong>延伸入口</strong>
                            <span>{relatedItems.length} 条</span>
                          </div>
                          <p>保持图谱主舞台稳定，只把同类入口按需拉到抽屉里。</p>
                          <div className="category-graph-page__document-list">
                            {relatedItems.map((item) => (
                              <button
                                key={`${item.sourceId}:${item.path}:drawer`}
                                className="category-graph-page__document-link"
                                onClick={() => {
                                  onNodeChange(item.path)
                                  onPreviewItem(item.sourceId, item.path)
                                }}
                                type="button"
                              >
                                <FileIcon />
                                <div>
                                  <strong>{documentTitle(item)}</strong>
                                  <span>{item.path}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </section>
                      </>
                    ) : (
                      <div className="category-graph-page__preview-document">
                        <DocumentView
                          content={fileContent}
                          fileName={fileName}
                          loading={fileLoading}
                          onTagSelect={onTagSelect}
                          onWikiLink={onWikiLink}
                          selectedFile={selectedFile}
                          showKnowledgePanel={false}
                          source={source}
                          variant="panel"
                        />
                      </div>
                    )
                  ) : (
                    <CompactEmptyState
                      className="category-graph-page__preview-empty"
                      icon={<LinkIcon />}
                      title="还没有选中文档"
                      description="单击图谱节点或左侧入口，即可在抽屉里查看节点摘要与原文。"
                    />
                  )}
                </div>
              </div>
            </aside>
          </div>
        </RailPanel>
      </div>
    </PageShell>
  )
}
