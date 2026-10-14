import { useMemo, useState } from 'react'
import { DocSource, KnowledgeCatalog, KnowledgeCatalogItem, SearchResult, SelectedFile } from '../types'
import {
  buildGuideRoute,
  getSiteLocaleConfig,
  type DocSetId,
  type GuidePageId,
  type SiteLocale,
} from '../config/siteConfig'

export type GuideLocale = SiteLocale
export interface QuickKnowledgeItemLike {
  sourceId: string
  path: string
  name: string
  title?: string
  graphTitle?: string
  description?: string
}
import { PageShell } from './CockpitPrimitives'
import { CatalogErrorBanner } from './HomeCommandCenter/CatalogErrorBanner'
import { CatalogSidebarSection } from './HomeCommandCenter/CatalogSidebarSection'
import { GuideArticle } from './HomeCommandCenter/GuideArticle'
import { OutlineContent } from './HomeCommandCenter/OutlineContent'
import { WorkspaceOverview } from './HomeCommandCenter/WorkspaceOverview'
import {
  buildWorkspaceProjectIndex,
  buildWorkspaceProjectSections,
} from './HomeCommandCenter/workspaceProjects'

type SidebarSectionId = string
export type { DocSetId, GuidePageId }

interface HomeCommandCenterProps {
  source: DocSource
  sources: DocSource[]
  activeSourceId?: string | null
  catalog: KnowledgeCatalog | null
  catalogError?: string | null
  onRetryCatalog?: () => void
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

export function HomeCommandCenter({
  source,
  sources,
  activeSourceId = null,
  catalog,
  catalogError = null,
  onRetryCatalog,
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
  void recentProjects
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

  const emptySectionTitle = isWorkspaceDocSet && activeWorkspaceDocumentType
    ? (guideLocale === 'zh' ? `暂无${activeWorkspaceDocumentType.title}` : `No ${activeWorkspaceDocumentType.title}`)
    : (guideLocale === 'zh' ? '浏览目录' : 'Browse Directory')

  return (
    <PageShell className={`axi-docs-home${isWorkspaceDocSet ? ' axi-docs-home--workspace' : ''}`} compact>
      <CatalogErrorBanner
        catalogError={catalogError}
        onRetryCatalog={onRetryCatalog}
        guideLocale={guideLocale}
      />
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
            {navigationSections.map((section) => (
              <CatalogSidebarSection
                key={section.key}
                section={section}
                isSectionOpen={isSectionOpen}
                toggleSection={toggleSection}
                onOpenItem={onOpenItem}
                activeSourceId={activeSourceId}
                selectedFilePath={selectedFile?.path}
                emptySectionTitle={emptySectionTitle}
              />
            ))}
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
              <OutlineContent
                isGuideDocSet={isGuideDocSet}
                includeTopLink={isGuideDocSet}
                onItemSelect={() => setMobileOutlineOpen(false)}
                content={fileContent || ''}
                pageNavigationLabel={homeCopy.pageNavigation}
                guideLocale={guideLocale}
              />
              {renderSourceOutline()}
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
          <GuideArticle
            fileContent={fileContent}
            fileLoading={fileLoading}
            fileName={fileName}
            guideTitle={guideTitle}
            guideSelectedFile={guideSelectedFile}
            guideSource={guideSource}
            guideLocale={guideLocale}
            guidePageId={guidePageId}
            normalizedSearchQuery={normalizedSearchQuery}
            searching={searching}
            visibleSearchResults={visibleSearchResults}
            guideDocumentSiblings={guideDocumentSiblings}
            selectedGuideCatalogItem={selectedGuideCatalogItem}
            onOpenItem={onOpenItem}
            onWikiLink={onWikiLink}
          />
        ) : (
          <WorkspaceOverview
            currentSourceName={currentSourceName}
            sourceDescription={source.description}
            isSkillsDocSet={isSkillsDocSet}
            catalog={catalog}
            dbskillSourceLabel={dbskillSource?.id}
            overviewSections={overviewSections}
            activeWorkspaceDocumentType={activeWorkspaceDocumentType}
            activeWorkspaceDocumentTypeKey={activeWorkspaceDocumentTypeKey}
            sources={sources}
            isWorkspaceDocSet={isWorkspaceDocSet}
            onOpenExplorer={onOpenExplorer}
            onOpenItem={onOpenItem}
            featuredDocs={featuredDocs}
            guideLocale={guideLocale}
          />
        )}
      </main>

      <aside className="axi-docs-home__outline" aria-label={homeCopy.outlineLabel}>
        <OutlineContent
          isGuideDocSet={isGuideDocSet}
          content={fileContent || ''}
          pageNavigationLabel={homeCopy.pageNavigation}
          guideLocale={guideLocale}
        />
        {renderSourceOutline()}
      </aside>
    </PageShell>
  )

  function renderSourceOutline() {
    if (isGuideDocSet) return null
    return (
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
  }
}