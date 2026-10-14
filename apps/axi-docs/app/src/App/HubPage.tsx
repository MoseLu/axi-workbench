import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { DocumentDetailPage } from '../components/DocumentDetailPage'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { KnowledgeWorkbench } from '../components/KnowledgeWorkbench'
import { NotFoundPage } from '../components/NotFoundPage'
import { WorkspaceArchitecturePage } from '../components/WorkspaceArchitecturePage'
import {
  getKnowledgeCategoryMeta,
  normalizeKnowledgeCategoryKey,
} from '../config/knowledgeRules'
import {
  DEFAULT_LOCALE,
  getDocSetSourceId,
  getSiteLocaleConfig,
  isDocSetId,
  isGuidePageId,
  isSiteLocale,
} from '../config/siteConfig'
import {
  getKnowledgeCatalog as loadKnowledgeCatalog,
  listKnowledgeSources as loadKnowledgeSources,
  readKnowledgeFile as loadKnowledgeFileContent,
  searchKnowledgeAll as searchKnowledgeDocuments,
} from '../lib/knowledgeClient'
import {
  decodeDocumentRoute,
} from '../lib/routes'
import {
  DocSource,
  KnowledgeCatalog,
  SearchResult,
  SelectedFile,
} from '../types'
import type { InitialPageData } from '../lib/initialPageData'
import { docSetForSourceId } from './docSetForSourceId'
import { flattenCatalogItems } from './flattenCatalogItems'
import { useHubActions } from './useHubActions'

type PageMode = 'home' | 'document'

function HubPage({ pageMode, initialData }: { pageMode: PageMode; initialData?: InitialPageData | null }) {
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const routeDocument = useMemo(
    () => (pageMode === 'document' ? decodeDocumentRoute(params.sourceId, params['*']) : null),
    [pageMode, params],
  )
  const urlSearchQuery = searchParams.get('q') || searchParams.get('keyword') || ''
  const routeGuideLocale = pageMode === 'home' && isSiteLocale(params.locale)
    ? params.locale
    : null
  const routeGuidePageId = pageMode === 'home' && params.guideId && isGuidePageId(params.guideId)
    ? params.guideId
    : null
  // Document pageMode 不带 :locale 段；通过 sourceId 后缀反推当前 locale，
  // 否则 <title> 会一直落到 DEFAULT_LOCALE，EN 路由也会渲染中文标题。
  const routeDocumentLocale = pageMode === 'document' && routeDocument
    ? (routeDocument.sourceId.endsWith('-zh') || routeDocument.sourceId === 'workspace' ? 'zh' : 'en')
    : null
  const guideLocale = routeGuideLocale || routeDocumentLocale || DEFAULT_LOCALE
  const guidePageId = routeGuidePageId || 'getting-started'
  const routeDocSet = pageMode === 'home' && params.collection && isDocSetId(params.collection)
    ? params.collection
    : null
  const docSet = routeDocSet || 'guide'
  const [sources, setSources] = useState<DocSource[]>(() => initialData?.sources || [])
  const routeDocSetSourceId = pageMode === 'home' ? getDocSetSourceId(docSet, guideLocale, sources) : null
  const [activeSource, setActiveSource] = useState(routeDocSetSourceId || searchParams.get('source') || routeDocument?.sourceId || 'workspace')
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(() => initialData?.content || null)
  const [fileName, setFileName] = useState(() => initialData?.path.split('/').pop()?.replace(/\.md$/u, '') || '')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery)
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(searchParams.get('tag'))
  const [searching, setSearching] = useState(false)
  const [catalog, setCatalog] = useState<KnowledgeCatalog | null>(() => initialData?.catalog || null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const loadedFileKeyRef = useRef(initialData ? `${initialData.sourceId}:${initialData.path}` : null)
  const loadedCatalogSourceRef = useRef(initialData?.sourceId || null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const localeConfig = useMemo(() => getSiteLocaleConfig(guideLocale), [guideLocale])
  const appCopy = localeConfig.ui

  const guideRouteFile = useMemo<SelectedFile | null>(
    () => pageMode === 'home' && docSet === 'guide' && routeDocSetSourceId
      ? { sourceId: routeDocSetSourceId, path: `guide/${guidePageId}.md` }
      : null,
    [docSet, guidePageId, pageMode, routeDocSetSourceId],
  )
  const effectiveSelectedFile = pageMode === 'document' ? routeDocument : guideRouteFile || selectedFile
  const currentSource = useMemo(
    () => sources.find((source) => source.id === activeSource) || null,
    [activeSource, sources],
  )
  const primaryWorkspaceSource = useMemo(
    () => sources.find((source) => source.enabled && source.type === 'local')
      || sources.find((source) => source.enabled)
      || null,
    [sources],
  )
  const workspaceSource = useMemo(() => {
    if (pageMode === 'document') return currentSource || primaryWorkspaceSource
    return currentSource?.type === 'local' ? currentSource : primaryWorkspaceSource
  }, [currentSource, pageMode, primaryWorkspaceSource])

  const {
    syncParams,
    handleNavigateHome,
    handleNavigateCategory,
    handleOpenExplorer,
    handleExitExplorer,
    handleOpenDocument,
    handleClearSelectedFile,
    handleSearchSubmit,
    handleSearch,
    handleSuggestionSelect,
    handleTagSelect,
    handleWikiLink,
  } = useHubActions({
    pageMode,
    docSet,
    guideLocale,
    activeSource,
    selectedFile,
    workspaceSource,
  })

  const fetchSources = useCallback(async () => {
    try {
      const data = await loadKnowledgeSources()
      setSources((current) => {
        if (
          current.length === data.length
          && current.every((source, index) => {
            const next = data[index]
            return source.id === next.id
              && source.name === next.name
              && source.enabled === next.enabled
              && source.type === next.type
              && source.icon === next.icon
          })
        ) {
          return current
        }
        return data
      })
      if (data.length === 0) return

      const preferredSource = routeDocument?.sourceId || activeSource
      const fallbackSource = data.find((source) => source.id === preferredSource) || data[0]
      if (!data.find((source) => source.id === preferredSource)) {
        setActiveSource(fallbackSource.id)
        syncParams({ source: fallbackSource.id }, true)
      }
    } catch (error) {
      console.error('Failed to fetch sources:', error)
    }
  }, [activeSource, routeDocument?.sourceId, syncParams])

  const loadFile = useCallback(async (sourceId: string, filePath: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      if (controller.signal.aborted) return
      const content = await loadKnowledgeFileContent(sourceId, filePath)
      if (controller.signal.aborted) return
      if (content !== null) {
        setFileContent(content)
        setFileName(filePath.split('/').pop()?.replace(/\.md$/, '') || 'Untitled')
      } else {
        setFileContent('# 文件加载失败\n\n无法加载该文件内容。')
        setFileName('Error')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setFileContent('# 加载错误\n\n网络请求失败。')
      setFileName('Error')
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  const loadCatalog = useCallback(async (sourceId: string) => {
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      const data = await loadKnowledgeCatalog(sourceId)
      if (!data) {
        throw new Error('目录加载失败')
      }
      setCatalog(data)
    } catch (error) {
      setCatalog(null)
      setCatalogError(error instanceof Error ? error.message : '目录加载失败')
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  const runSearch = useCallback(async (query: string) => {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) {
      setSearchResults(null)
      setSearching(false)
      return
    }

    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller

    setSearching(true)
    try {
      const results = await searchKnowledgeDocuments(normalizedQuery)
      if (controller.signal.aborted) return
      setSearchResults(results)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false)
      }
    }
  }, [])

  useEffect(() => {
    void fetchSources()
  }, [fetchSources])

  useEffect(() => {
    document.documentElement.lang = localeConfig.lang
    document.documentElement.dir = localeConfig.dir
    document.title = localeConfig.title
  }, [localeConfig])

  useEffect(() => {
    if (urlSearchQuery !== searchQuery) setSearchQuery(urlSearchQuery)
    if ((searchParams.get('tag') || null) !== activeTag) setActiveTag(searchParams.get('tag'))
    const sourceFromUrl = searchParams.get('source')
    if (routeDocSetSourceId && routeDocSetSourceId !== activeSource) {
      setActiveSource(routeDocSetSourceId)
      return
    }
    if (!routeDocSetSourceId && sourceFromUrl && sourceFromUrl !== activeSource) {
      setActiveSource(sourceFromUrl)
    }
  }, [activeSource, activeTag, routeDocSetSourceId, searchParams, searchQuery, urlSearchQuery])

  useEffect(() => {
    if (pageMode !== 'home') return
    if (!searchParams.has('source') && !searchParams.has('doc')) return

    const next = new URLSearchParams(searchParams)
    next.delete('source')
    next.delete('doc')
    setSearchParams(next, { replace: true })
  }, [pageMode, searchParams, setSearchParams])

  useEffect(() => {
    if (!effectiveSelectedFile) {
      abortRef.current?.abort()
      loadedFileKeyRef.current = null
      setFileContent(null)
      setFileName('')
      setLoading(false)
      return
    }
    const fileKey = `${effectiveSelectedFile.sourceId}:${effectiveSelectedFile.path}`
    if (loadedFileKeyRef.current === fileKey) return
    loadedFileKeyRef.current = fileKey
    void loadFile(effectiveSelectedFile.sourceId, effectiveSelectedFile.path)
  }, [effectiveSelectedFile, loadFile])

  useEffect(() => {
    const catalogSourceId = pageMode === 'document'
      ? routeDocument?.sourceId || activeSource
      : workspaceSource?.id
    if (!catalogSourceId || catalogSourceId === 'blinko') {
      loadedCatalogSourceRef.current = null
      setCatalog(null)
      setCatalogError(null)
      setCatalogLoading(false)
      return
    }
    if (catalogSourceId === loadedCatalogSourceRef.current) return
    loadedCatalogSourceRef.current = catalogSourceId
    void loadCatalog(catalogSourceId)
  }, [activeSource, loadCatalog, pageMode, routeDocument?.sourceId, workspaceSource?.id])

  useEffect(() => {
    if (pageMode === 'document') return
    void runSearch(searchQuery)
  }, [pageMode, runSearch, searchQuery])

  const catalogItems = useMemo(() => flattenCatalogItems(catalog), [catalog])
  const selectedCatalogItem = useMemo(
    () => effectiveSelectedFile
      ? catalogItems.find((item) => item.sourceId === effectiveSelectedFile.sourceId && item.path === effectiveSelectedFile.path) || null
      : null,
    [catalogItems, effectiveSelectedFile],
  )
  const relatedItems = useMemo(() => {
    if (!selectedCatalogItem) return []
    const primaryCategory = normalizeKnowledgeCategoryKey(selectedCatalogItem.categories[0] || '')
    if (!primaryCategory) return []
    return catalogItems
      .filter((item) => item.path !== selectedCatalogItem.path && item.categories.includes(primaryCategory))
      .slice(0, 8)
  }, [catalogItems, selectedCatalogItem])
  const documentSiblings = useMemo(() => {
    const primaryCategory = normalizeKnowledgeCategoryKey(selectedCatalogItem?.categories[0] || '')
    if (!primaryCategory) return []
    return catalog?.sections.find((section) => section.key === primaryCategory)?.items.slice(0, 10) || []
  }, [catalog?.sections, selectedCatalogItem?.categories])
  const documentSidebarSections = useMemo(() => {
    return catalog?.sections || []
  }, [catalog?.sections])

  const handleClearSelectedFileWithReset = useCallback(() => {
    handleClearSelectedFile()
    setSelectedFile(null)
    setFileContent(null)
    setFileName('')
  }, [handleClearSelectedFile])

  const handleSearchWithReset = useCallback((query: string) => {
    handleSearch(query)
    if (pageMode !== 'document') {
      setSelectedFile(null)
      setFileContent(null)
      setFileName('')
    }
  }, [handleSearch, pageMode])

  const handleSearchSubmitWithReset = useCallback((query: string) => {
    handleSearchSubmit(query)
    setActiveTag(null)
    setSelectedFile(null)
    setFileContent(null)
    setFileName('')
  }, [handleSearchSubmit])

  const handleTagSelectWithReset = useCallback((tag: string | null) => {
    handleTagSelect(tag)
    if (pageMode !== 'document') {
      setActiveTag(tag)
      setSelectedFile(null)
      setFileContent(null)
      setFileName('')
    }
  }, [handleTagSelect, pageMode])

  const invalidGuideRoute = pageMode === 'home' && docSet === 'guide' && (!routeGuideLocale || !routeGuidePageId)
  const invalidDocSetRoute = pageMode === 'home' && Boolean(params.collection) && (!routeGuideLocale || !routeDocSet)
  // The knowledge explorer (tree/path/islands graph stage) is reached with a
  // `view` search param on any doc-set home route.
  const workbenchPageMode: 'home' | 'explorer' = searchParams.get('view') ? 'explorer' : 'home'
  const activeHeaderDocSet = pageMode === 'document' ? docSetForSourceId(routeDocument?.sourceId) : docSet
  const documentCategoryKey = normalizeKnowledgeCategoryKey(selectedCatalogItem?.categories[0] || '')
  const documentCategoryMeta = documentCategoryKey ? getKnowledgeCategoryMeta(documentCategoryKey) : null
  const handleSkipToMain = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const main = document.getElementById('app-main-content')
    if (!main) return
    main.focus()
    main.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <div className={`app-layout app-layout--${pageMode}`}>
      <a className="skip-link" href="#app-main-content" onClick={handleSkipToMain}>
        {appCopy.skipToContent}
      </a>
      <Header
        activeDocSet={activeHeaderDocSet}
        onSearchChange={handleSearchWithReset}
        onSearchSubmit={handleSearchSubmitWithReset}
        onSuggestionSelect={handleSuggestionSelect}
        pageMode={pageMode}
        searchQuery={searchQuery}
        searching={searching}
      />
      <div className="app-body">
        <main className={`app-main app-main--${pageMode}`} id="app-main-content" tabIndex={-1}>
          <ErrorBoundary>
            {invalidGuideRoute || invalidDocSetRoute ? (
              <NotFoundPage
                description={appCopy.notFound.invalidDocSetDescription}
                onPrimaryAction={handleNavigateHome}
                onSecondaryAction={handleNavigateCategory}
                title={appCopy.notFound.invalidDocSet}
              />
            ) : pageMode === 'document' ? (
              effectiveSelectedFile ? (
                <DocumentDetailPage
                  categoryDescription={documentCategoryMeta?.description || '当前文档所属分类的上下文与延伸阅读。'}
                  categoryTitle={documentCategoryMeta?.title || '相关知识点'}
                  documentSiblings={documentSiblings}
                  sidebarSections={documentSidebarSections}
                  fileContent={fileContent}
                  fileLoading={loading}
                  fileName={fileName}
                  onTagSelect={handleTagSelectWithReset}
                  onWikiLink={handleWikiLink}
                  pageLocale={guideLocale}
                  relatedItems={relatedItems}
                  selectedCatalogItem={selectedCatalogItem}
                  selectedFile={effectiveSelectedFile}
                  source={currentSource || { id: effectiveSelectedFile.sourceId, name: effectiveSelectedFile.sourceId, path: '', enabled: true, type: 'local' }}
                />
              ) : (
                <NotFoundPage
                  description={appCopy.notFound.invalidDocumentDescription}
                  onPrimaryAction={handleNavigateHome}
                  onSecondaryAction={handleNavigateCategory}
                  title={appCopy.notFound.invalidDocument}
                />
              )
            ) : params['*'] === 'architecture' ? (
              <WorkspaceArchitecturePage />
            ) : workspaceSource ? (
              <KnowledgeWorkbench
                pageMode={workbenchPageMode}
                activeTag={activeTag}
                activeSourceId={docSet === 'guide' ? searchParams.get('source') : activeSource}
                catalog={catalog}
                catalogError={catalogError}
                catalogLoading={catalogLoading}
                fileContent={fileContent}
                fileLoading={loading}
                fileName={fileName}
                onClearSelectedFile={handleClearSelectedFileWithReset}
                onOpenExplorer={handleOpenExplorer}
                onRetryCatalog={() => { if (workspaceSource) void loadCatalog(workspaceSource.id) }}
                onNavigateHome={workbenchPageMode === 'explorer' ? handleExitExplorer : handleNavigateHome}
                onOpenItem={handleOpenDocument}
                onSearch={handleSearchWithReset}
                onTagSelect={handleTagSelectWithReset}
                onWikiLink={handleWikiLink}
                docSet={docSet}
                guideLocale={guideLocale}
                guidePageId={guidePageId}
                searchQuery={searchQuery}
                searchResults={searchResults}
                searching={searching}
                selectedFile={selectedFile}
                source={workspaceSource}
                sources={sources}
              />
            ) : (
              <div className="loading loading--fullscreen" role="status">
                <div className="spinner" />
                <p className="loading__label">{guideLocale === 'zh' ? '正在加载文档源…' : 'Loading documentation sources…'}</p>
              </div>
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

// Suppress lint for SearchSuggestion import alias used in useHubActions.
void 0

export { HubPage }
export type { PageMode }
void 0