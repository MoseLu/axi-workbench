import { useMemo, useState } from 'react'
import { DocSource, KnowledgeCatalog, KnowledgeCatalogItem, SearchResult, SelectedFile } from '../types'
import {
  buildGuideRoute,
  getSiteLocaleConfig,
  type DocSetId,
  type GuidePageId,
  type SiteLocale,
} from '../config/siteConfig'
import { PageShell } from './CockpitPrimitives'
import { DocumentFooter } from './DocumentFooter'
import { DocumentView } from './DocumentView'
import { TableOfContents } from './TableOfContents'

type SidebarSectionId = string
export type GuideLocale = SiteLocale
export type { DocSetId, GuidePageId }
type CatalogSection = KnowledgeCatalog['sections'][number]

interface WorkspaceProjectIndexEntry {
  key: string
  title: string
  description: string
  order: number
}

export interface QuickKnowledgeItemLike {
  sourceId: string
  path: string
  name: string
  title?: string
  graphTitle?: string
  description?: string
}

interface HomeCommandCenterProps {
  source: DocSource
  sources: DocSource[]
  activeSourceId?: string | null
  catalog: KnowledgeCatalog | null
  searchResults?: SearchResult[] | null
  searching?: boolean
  searchQuery: string
  activeTag: string | null
  selectedFile: SelectedFile | null
  fileContent?: string | null
  fileName?: string
  fileLoading?: boolean
  onOpenExplorer: () => void
  onTagSelect: (tag: string | null) => void
  onOpenItem: (sourceId: string, path: string) => void
  onWikiLink?: (noteName: string) => void
  onClearSelectedFile: () => void
  graphFocusPath?: string | null
  docSet?: DocSetId
  guideLocale?: GuideLocale
  guidePageId?: GuidePageId
}

function workspaceProjectGroupKey(item: KnowledgeCatalogItem): string {
  if (item.projectId) return item.projectId
  const pathParts = item.path.split('/').filter(Boolean)
  if (pathParts[0] === 'project-docs' && pathParts[1]) return pathParts[1]
  return pathParts[0] || item.name
}

function normalizeWorkspaceProjectTitle(title: string): string {
  return title
    .replace(/\s*(?:README|PRD|TDD|TODO|INDEX|CHANGELOG|SECURITY|MILESTONE)\s*(?:文档)?$/i, '')
    .replace(/\s*(?:需求文档|技术设计|Agent 指南|智能体指南|任务清单|里程碑|变更记录|文档索引|安全策略)$/i, '')
    .trim() || title
}

function workspaceProjectDisplayTitle(key: string, items: KnowledgeCatalogItem[], guideLocale: GuideLocale): string {
  const translated = getSiteLocaleConfig(guideLocale).themeConfig.workspaceProjects[key]
  if (translated) return translated
  const overview = items.find((item) => item.documentTypeKey === 'overview' || item.path.endsWith('/README.md'))
  if (guideLocale === 'zh') {
    return normalizeWorkspaceProjectTitle(overview?.title || items[0]?.title || items[0]?.projectTitle || key)
  }
  return items[0]?.projectTitle || overview?.rawTitle || overview?.title || key
}

function buildWorkspaceProjectIndex(sections: CatalogSection[], guideLocale: GuideLocale): WorkspaceProjectIndexEntry[] {
  const grouped = new Map<string, { description: string, items: KnowledgeCatalogItem[], order: number }>()
  let order = 0

  for (const section of sections) {
    for (const item of section.items) {
      const key = workspaceProjectGroupKey(item)
      const description = item.description || section.description
      if (!grouped.has(key)) {
        grouped.set(key, { description, items: [], order })
      }
      grouped.get(key)!.items.push(item)
      order += 1
    }
  }

  return [...grouped.entries()]
    .sort((left, right) => left[1].order - right[1].order)
    .map(([key, group]) => ({
      key,
      title: workspaceProjectDisplayTitle(key, group.items, guideLocale),
      description: group.description,
      order: group.order,
    }))
}

function buildWorkspaceProjectSections(projectIndex: WorkspaceProjectIndexEntry[], section: CatalogSection | undefined): CatalogSection[] {
  const activeItemsByProject = new Map<string, KnowledgeCatalogItem[]>()
  if (section) {
    for (const item of section.items) {
      const key = workspaceProjectGroupKey(item)
      if (!activeItemsByProject.has(key)) {
        activeItemsByProject.set(key, [])
      }
      activeItemsByProject.get(key)!.push(item)
    }
  }

  return projectIndex.map((project) => {
    const items = activeItemsByProject.get(project.key) || []
    const description = items[0]?.description || project.description
    return {
      key: `workspace-project-${project.key}`,
      title: project.title,
      description,
      count: items.length,
      items,
    }
  })
}

export function HomeCommandCenter({
  source,
  sources,
  activeSourceId = null,
  catalog,
  searchResults,
  searching = false,
  searchQuery,
  selectedFile,
  fileContent = null,
  fileName = '',
  fileLoading = false,
  onOpenExplorer,
  onOpenItem,
  onWikiLink = () => undefined,
  docSet = 'guide',
  guideLocale = 'zh',
  guidePageId = 'getting-started',
}: HomeCommandCenterProps) {
  const isGuideDocSet = docSet === 'guide'
  const isSkillsDocSet = docSet === 'skills'
  const isWorkspaceDocSet = docSet === 'workspace' || source.kind === 'workspace-registry'
  const isStructuredDocSet = isSkillsDocSet || isWorkspaceDocSet
  const recentProjects = catalog?.recentDocs.filter((item) => item.docType === 'project').slice(0, 5) || []
  const dbskillSource = sources.find((item) => item.id === 'dbskill')
  const primarySections = useMemo(() => {
    const seen = new Set<string>()
    const sourceSections = isStructuredDocSet ? catalog?.sections || [] : catalog?.sections.slice(0, 4) || []

    return sourceSections
      .map((section) => {
        const items = section.items.filter((item) => {
          const key = `${item.sourceId}:${item.path}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        const visibleItemKeys = new Set(items.map((item) => `${item.sourceId}:${item.path}`))
        const subsections = section.subsections
          ?.map((subsection) => {
            const subsectionItems = subsection.items.filter((item) => visibleItemKeys.has(`${item.sourceId}:${item.path}`))
            return {
              ...subsection,
              count: subsectionItems.length,
              items: subsectionItems,
            }
          })
          .filter((subsection) => subsection.items.length > 0)

        return {
          ...section,
          count: items.length,
          items,
          subsections,
        }
      })
      .filter((section) => section.items.length > 0)
  }, [catalog?.sections, isStructuredDocSet])
  const workspaceDocumentTypeSections = useMemo(
    () => isWorkspaceDocSet ? primarySections : [],
    [isWorkspaceDocSet, primarySections],
  )
  const [selectedWorkspaceDocumentTypeKey, setSelectedWorkspaceDocumentTypeKey] = useState<string | null>(null)
  const [mobileOutlineOpen, setMobileOutlineOpen] = useState(false)
  const activeWorkspaceDocumentTypeKey = workspaceDocumentTypeSections.some((section) => section.key === selectedWorkspaceDocumentTypeKey)
    ? selectedWorkspaceDocumentTypeKey
    : workspaceDocumentTypeSections[0]?.key || null
  const activeWorkspaceDocumentType = workspaceDocumentTypeSections.find((section) => section.key === activeWorkspaceDocumentTypeKey)
  const workspaceProjectIndex = useMemo(
    () => buildWorkspaceProjectIndex(workspaceDocumentTypeSections, guideLocale),
    [guideLocale, workspaceDocumentTypeSections],
  )
  const workspaceProjectSections = useMemo(
    () => buildWorkspaceProjectSections(workspaceProjectIndex, activeWorkspaceDocumentType),
    [activeWorkspaceDocumentType, workspaceProjectIndex],
  )
  const workspaceAvailableProjectSections = useMemo(
    () => workspaceProjectSections.filter((section) => section.items.length > 0),
    [workspaceProjectSections],
  )
  const navigationSections = isWorkspaceDocSet ? workspaceProjectSections : primarySections
  const overviewSections = isWorkspaceDocSet ? workspaceAvailableProjectSections : primarySections
  const featuredDocs = catalog?.recentDocs.slice(0, 4) || []
  const explicitSource = activeSourceId ? sources.find((item) => item.id === activeSourceId) || null : null
  const currentSourceName = explicitSource?.name || source.name || '当前文档库'
  const normalizedSearchQuery = searchQuery.trim()
  const visibleSearchResults = (searchResults || []).slice(0, 8)
  const localeConfig = getSiteLocaleConfig(guideLocale)
  const homeCopy = localeConfig.ui.home
  const guidePages = localeConfig.themeConfig.guidePages
  const guideSections = localeConfig.themeConfig.guideSections
  const guideTitle = guidePages.find((page) => page.id === guidePageId)?.text || guidePageId
  const guideSelectedFile: SelectedFile = {
    sourceId: `axi-docs-${guideLocale}`,
    path: `guide/${guidePageId}.md`,
  }
  const guideCatalogItems = useMemo(() => (
    catalog?.sections.flatMap((section) => section.items)
      .filter((item) => item.sourceId === guideSelectedFile.sourceId)
    || []
  ), [catalog?.sections, guideSelectedFile.sourceId])
  const guideCatalogItemsByPath = useMemo(() => new Map(
    guideCatalogItems.map((item) => [item.path, item]),
  ), [guideCatalogItems])
  const guideDocumentSiblings = useMemo<KnowledgeCatalogItem[]>(() => (
    guidePages.map((page) => {
      const path = `guide/${page.id}.md`
      return guideCatalogItemsByPath.get(path) || {
        sourceId: guideSelectedFile.sourceId,
        path,
        name: page.id,
        title: page.text,
        tags: [],
        categories: ['guide'],
        techStack: [],
      }
    })
  ), [guideCatalogItemsByPath, guidePages, guideSelectedFile.sourceId])
  const selectedGuideCatalogItem = guideCatalogItemsByPath.get(guideSelectedFile.path) || null
  const guideSource = sources.find((item) => item.id === guideSelectedFile.sourceId) || {
    id: guideSelectedFile.sourceId,
    name: guideLocale === 'zh' ? 'Axi Docs · 中文文档' : 'Axi Docs · English',
    path: '',
    enabled: true,
    type: 'local' as const,
    kind: 'markdown-vault' as const,
    locale: guideLocale,
  }
  const [openSections, setOpenSections] = useState<Record<SidebarSectionId, boolean>>({
    introduction: true,
    content: true,
    knowledge: true,
    operations: true,
  })
  const toggleSection = (sectionId: SidebarSectionId) => {
    setOpenSections((current) => ({ ...current, [sectionId]: !current[sectionId] }))
  }
  const isSectionOpen = (sectionId: SidebarSectionId) => openSections[sectionId] ?? (sectionId.split(':').length <= 2)

  const renderCatalogSidebarSection = (section: NonNullable<KnowledgeCatalog['sections']>[number]) => {
    const sectionId = `catalog:${section.key}`
    const open = isSectionOpen(sectionId)
    const itemLimit = section.items.length
    const hiddenItemCount = Math.max(0, section.items.length - itemLimit)
    const hasSubsections = section.subsections && section.subsections.length > 0
    const emptySectionTitle = isWorkspaceDocSet && activeWorkspaceDocumentType
      ? (guideLocale === 'zh' ? `暂无${activeWorkspaceDocumentType.title}` : `No ${activeWorkspaceDocumentType.title}`)
      : (guideLocale === 'zh' ? '浏览目录' : 'Browse Directory')
    const renderCatalogItemButton = (item: NonNullable<KnowledgeCatalog['sections']>[number]['items'][number]) => (
      <button
        key={`${item.sourceId}:${item.path}`}
        className={`axi-docs-home__sidebar-link${item.sourceId === activeSourceId && item.path === selectedFile?.path ? ' active' : ''}`}
        onClick={() => onOpenItem(item.sourceId, item.path)}
        title={item.description || item.path}
        type="button"
      >
        <span>{item.title || item.name}</span>
      </button>
    )

    return (
      <nav key={section.key} className="axi-docs-home__sidebar-section" aria-label={section.title}>
        <button aria-expanded={open} className="axi-docs-home__sidebar-toggle" onClick={() => toggleSection(sectionId)} type="button">
          <span>{section.title}</span>
          <span aria-hidden="true" className="axi-docs-home__sidebar-caret"></span>
        </button>
        {open && (
          <div className="axi-docs-home__sidebar-items">
            {hasSubsections
              ? section.subsections!.map((subsection) => {
                const subsectionId = `${sectionId}:${subsection.key}`
                const subsectionOpen = isSectionOpen(subsectionId)
                return (
                  <div key={subsection.key} className="axi-docs-home__sidebar-subsection">
                    <button
                      aria-expanded={subsectionOpen}
                      className="axi-docs-home__sidebar-subtoggle"
                      onClick={() => toggleSection(subsectionId)}
                      title={subsection.description}
                      type="button"
                    >
                      <span>{subsection.title}</span>
                      <span aria-hidden="true" className="axi-docs-home__sidebar-caret"></span>
                    </button>
                    {subsectionOpen && (
                      <div className="axi-docs-home__sidebar-subitems">
                        {subsection.items.map(renderCatalogItemButton)}
                      </div>
                    )}
                  </div>
                )
              })
              : section.items.slice(0, itemLimit).map(renderCatalogItemButton)}
            {hiddenItemCount > 0 && (
              <div className="axi-docs-home__nav-card" role="note">
                <span>{guideLocale === 'zh' ? '本组还有更多条目' : 'More entries in this group'}</span>
                <small>{hiddenItemCount} {guideLocale === 'zh' ? '个条目可通过搜索定位' : 'more entries are available through search'}</small>
              </div>
            )}
            {section.items.length === 0 && (
              <div className="axi-docs-home__nav-card" role="note">
                <span>{emptySectionTitle}</span>
                <small>{section.description}</small>
              </div>
            )}
          </div>
        )}
      </nav>
    )
  }

  const renderOutlineContent = ({
    includeTopLink = false,
    onItemSelect,
  }: {
    includeTopLink?: boolean
    onItemSelect?: () => void
  } = {}) => (
    isGuideDocSet ? (
      <div className="axi-docs-home__outline-card axi-docs-home__outline-card--toc">
        {includeTopLink && (
          <a className="axi-docs-home__top-link" href="#overview" onClick={onItemSelect}>
            {guideLocale === 'zh' ? '回到顶部' : 'Return to top'}
          </a>
        )}
        <TableOfContents
          content={fileContent || ''}
          headingRootSelector=".axi-docs-home__guide-reader .doc-body"
          label={homeCopy.pageNavigation}
          onItemSelect={onItemSelect}
          scrollContainerSelector=".axi-docs-home__content"
        />
      </div>
    ) : (
      <div className="axi-docs-home__outline-card">
        <span className="axi-docs-home__nav-label">{homeCopy.pageNavigation}</span>
        <a href="#doc-set-overview">{guideLocale === 'zh' ? '文档集概览' : 'Docs Overview'}</a>
        {featuredDocs.length > 0 && <a href="#recent-docs">{guideLocale === 'zh' ? '最近更新' : 'Recent Updates'}</a>}
      </div>
    )
  )

  const renderSourceOutlineContent = () => isGuideDocSet ? null : (
    <div className="axi-docs-home__outline-card">
      <span className="axi-docs-home__nav-label">{explicitSource ? homeCopy.currentSource : homeCopy.docSources}</span>
      <strong>{explicitSource ? currentSourceName : homeCopy.unlockedSource}</strong>
      <p>
        {explicitSource
          ? explicitSource.description || '当前文档集已经接入 Axi Docs。'
          : homeCopy.defaultSourceHint}
      </p>
      {explicitSource && recentProjects.length > 0 && <small>{recentProjects.length} 个近期项目入口</small>}
    </div>
  )

  return (
    <PageShell className={`axi-docs-home${isWorkspaceDocSet ? ' axi-docs-home--workspace' : ''}`} compact>
      <aside className="axi-docs-home__sidebar" aria-label={homeCopy.sidebarLabel}>
        {isGuideDocSet ? (
          guideSections.map((section) => {
            const open = isSectionOpen(section.id)
            return (
              <nav key={section.id} className="axi-docs-home__sidebar-section" aria-label={section.text}>
                <button
                  aria-expanded={open}
                  className="axi-docs-home__sidebar-toggle"
                  onClick={() => toggleSection(section.id)}
                  type="button"
                >
                  <span>{section.text}</span>
                  <span aria-hidden="true" className="axi-docs-home__sidebar-caret"></span>
                </button>
                {open && (
                  <div className="axi-docs-home__sidebar-items">
                    {section.items.map((page) => (
                      <a
                        key={page.id}
                        aria-current={page.id === guidePageId ? 'page' : undefined}
                        className={`axi-docs-home__nav-link${page.id === guidePageId ? ' active' : ''}`}
                        href={buildGuideRoute(guideLocale, page.id)}
                      >
                        {page.text}
                      </a>
                    ))}
                  </div>
                )}
              </nav>
            )
          })
        ) : (
          <>
            {navigationSections.map(renderCatalogSidebarSection)}
            {navigationSections.length === 0 && (
              <nav className="axi-docs-home__sidebar-section" aria-label={currentSourceName}>
                <button aria-expanded={isSectionOpen('catalog:fallback')} className="axi-docs-home__sidebar-toggle" onClick={() => toggleSection('catalog:fallback')} type="button">
                  <span>{currentSourceName}</span>
                  <span aria-hidden="true" className="axi-docs-home__sidebar-caret"></span>
                </button>
                {isSectionOpen('catalog:fallback') && (
                  <div className="axi-docs-home__sidebar-items">
                    <button className="axi-docs-home__nav-card" onClick={onOpenExplorer} type="button">
                      <span>{guideLocale === 'zh' ? '浏览当前文档集' : 'Browse Current Docs'}</span>
                      <small>{source.description || currentSourceName}</small>
                    </button>
                  </div>
                )}
              </nav>
            )}
          </>
        )}
      </aside>

      <main className="axi-docs-home__content">
        <div className="axi-docs-home__mobile-outline">
          <button
            aria-controls="axi-docs-mobile-page-navigation"
            aria-expanded={mobileOutlineOpen}
            className="axi-docs-home__mobile-outline-toggle"
            onClick={() => setMobileOutlineOpen((open) => !open)}
            type="button"
          >
            <span>{homeCopy.pageNavigation}</span>
            <span aria-hidden="true" className="axi-docs-home__mobile-outline-caret"></span>
          </button>
          {mobileOutlineOpen && (
            <div
              aria-label={guideLocale === 'zh' ? '移动页面导航' : 'Mobile page navigation'}
              className="axi-docs-home__mobile-outline-panel"
              id="axi-docs-mobile-page-navigation"
              role="region"
            >
              {renderOutlineContent({ includeTopLink: isGuideDocSet, onItemSelect: () => setMobileOutlineOpen(false) })}
              {renderSourceOutlineContent()}
            </div>
          )}
        </div>
        {isWorkspaceDocSet && workspaceDocumentTypeSections.length > 0 && (
          <nav className="axi-docs-home__type-bar" aria-label={guideLocale === 'zh' ? '文档类型' : 'Document types'}>
            <div className="axi-docs-home__type-tabs">
              {workspaceDocumentTypeSections.map((section) => {
                const active = section.key === activeWorkspaceDocumentTypeKey
                return (
                  <button
                    key={section.key}
                    aria-pressed={active}
                    className={`axi-docs-home__type-tab${active ? ' active' : ''}`}
                    onClick={() => setSelectedWorkspaceDocumentTypeKey(section.key)}
                    title={section.description}
                    type="button"
                  >
                    <span>{section.title}</span>
                  </button>
                )
              })}
            </div>
          </nav>
        )}
        {isGuideDocSet ? (
          <article className="axi-docs-home__doc axi-docs-home__guide-reader document-detail-page__reader" id="overview">
            <DocumentView
              content={fileContent}
              fileName={fileName || guideTitle}
              footer={(
                <DocumentFooter
                  buildItemRoute={(item) => buildGuideRoute(guideLocale, item.path.replace(/^guide\//u, '').replace(/\.md$/u, '') as GuidePageId)}
                  documentSiblings={guideDocumentSiblings}
                  selectedCatalogItem={selectedGuideCatalogItem}
                  selectedFile={guideSelectedFile}
                  sidebarSections={[]}
                  source={guideSource}
                />
              )}
              loading={fileLoading}
              onTagSelect={() => undefined}
              onWikiLink={onWikiLink}
              selectedFile={guideSelectedFile}
              showKnowledgePanel={false}
              source={guideSource}
              variant="guide"
            />

            {guidePageId === 'search' && normalizedSearchQuery && (
              <section className="axi-docs-home__search-results" id="search-results" aria-live="polite">
                <h2>{guideLocale === 'zh'
                  ? `“${normalizedSearchQuery}” 的匹配文档`
                  : `Matches for "${normalizedSearchQuery}"`}</h2>
                {searching ? (
                  <p>{guideLocale === 'zh' ? '正在检索文档库...' : 'Searching documentation sources...'}</p>
                ) : visibleSearchResults.length > 0 ? (
                  <div className="axi-docs-home__result-list">
                    {visibleSearchResults.map((item) => (
                      <button key={`${item.sourceId}:${item.path}`} onClick={() => onOpenItem(item.sourceId, item.path)} type="button">
                        <strong>{item.title || item.name}</strong>
                        <span>{item.description || item.snippet || item.path}</span>
                        <small>{item.path}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>{guideLocale === 'zh'
                    ? '没有找到匹配文档。请更换关键词，或继续按左侧指南目录浏览。'
                    : 'No matching documents were found. Try another keyword or continue through the guide sidebar.'}</p>
                )}
              </section>
            )}
          </article>
        ) : (
          <article className="axi-docs-home__doc" id="overview">
            <h1>{currentSourceName}</h1>
            <section className="axi-docs-home__section" id="doc-set-overview">
              <h2>{guideLocale === 'zh' ? '文档集概览' : 'Docs Overview'}</h2>
              <p>{source.description || (guideLocale === 'zh' ? '当前顶级导航对应的文档集。左侧显示该文档集内部目录。' : 'This top-level navigation item maps to the document set shown in the left sidebar.')}</p>
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
                    <strong>{dbskillSource ? 'dbskill' : 'family'}</strong>
                    <span>{guideLocale === 'zh' ? '组织方式' : 'organization'}</span>
                  </div>
                </div>
              )}
              {isSkillsDocSet && dbskillSource && (
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
                <div className="axi-docs-home__result-list">
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
                      if (onOpenItem) {
                        // Navigate to workspace source and show architecture page
                        const workspaceSourceId = sources.find((s) => s.type === 'local')?.id || 'workspace'
                        onOpenItem(workspaceSourceId, 'architecture')
                      }
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
        )}
      </main>

      <aside className="axi-docs-home__outline" aria-label={homeCopy.outlineLabel}>
        {renderOutlineContent()}
        {renderSourceOutlineContent()}
      </aside>
    </PageShell>
  )
}
