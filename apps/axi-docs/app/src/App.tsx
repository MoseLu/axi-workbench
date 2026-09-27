import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Header } from './components/Header'
import { DocumentDetailPage } from './components/DocumentDetailPage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { KnowledgeWorkbench } from './components/KnowledgeWorkbench'
import { NotFoundPage } from './components/NotFoundPage'
import { WorkspaceArchitecturePage } from './components/WorkspaceArchitecturePage'
import { getKnowledgeCategoryMeta, normalizeKnowledgeCategoryKey } from './config/knowledgeRules'
import {
  DEFAULT_LOCALE,
  getDefaultGuideRoute,
  getDocSetSourceId,
  getSiteLocaleConfig,
  isDocSetId,
  isGuidePageId,
  isSiteLocale,
  type DocSetId,
} from './config/siteConfig'
import {
  getKnowledgeCatalog as loadKnowledgeCatalog,
  listKnowledgeSources as loadKnowledgeSources,
  readKnowledgeFile as loadKnowledgeFileContent,
  searchKnowledgeAll as searchKnowledgeDocuments,
} from './lib/knowledgeClient'
import {
  buildDocumentRoute,
  decodeDocumentRoute,
  decodeDocumentId,
} from './lib/routes'
import { DocSource, KnowledgeCatalog, KnowledgeCatalogItem, SearchResult, SearchSuggestion, SelectedFile } from './types'

type PageMode = 'home' | 'document'
type ParamUpdates = Record<string, string | null | undefined>
const DEFAULT_GUIDE_ROUTE = getDefaultGuideRoute()

function docSetForSourceId(sourceId?: string | null): DocSetId {
  if (typeof sourceId === 'string' && (sourceId === 'axi-skills' || sourceId === 'axi-skills-zh')) {
    return 'skills'
  }
  if (sourceId === 'workspace') return 'workspace'
  return 'guide'
}

function flattenCatalogItems(catalog: KnowledgeCatalog | null): KnowledgeCatalogItem[] {
  if (!catalog) return []
  return catalog.sections.flatMap((section) => section.items)
}

function HubPage({ pageMode }: { pageMode: PageMode }) {
  const params = useParams()
  const navigate = useNavigate()
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
  const guideLocale = routeGuideLocale || DEFAULT_LOCALE
  const guidePageId = routeGuidePageId || 'getting-started'
  const routeDocSet = pageMode === 'home' && params.collection && isDocSetId(params.collection)
    ? params.collection
    : null
  const docSet = routeDocSet || 'guide'
  const [sources, setSources] = useState<DocSource[]>([])
  const routeDocSetSourceId = pageMode === 'home' ? getDocSetSourceId(docSet, guideLocale, sources) : null
  const [activeSource, setActiveSource] = useState(routeDocSetSourceId || searchParams.get('source') || routeDocument?.sourceId || 'workspace')
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery)
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(searchParams.get('tag'))
  const [searching, setSearching] = useState(false)
  const [catalog, setCatalog] = useState<KnowledgeCatalog | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
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

  const syncParams = useCallback((updates: ParamUpdates, replace = true) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
    })
    setSearchParams(next, { replace })
  }, [searchParams, setSearchParams])

  const buildLocation = useCallback((pathname: string, updates?: ParamUpdates) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
    })
    const search = next.toString()
    return {
      pathname,
      search: search ? `?${search}` : '',
    }
  }, [searchParams])

  const navigateWithParams = useCallback((pathname: string, updates?: ParamUpdates, replace = false) => {
    navigate(buildLocation(pathname, updates), { replace })
  }, [buildLocation, navigate])

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
      setFileContent(null)
      setFileName('')
      setLoading(false)
      return
    }
    void loadFile(effectiveSelectedFile.sourceId, effectiveSelectedFile.path)
  }, [effectiveSelectedFile, loadFile])

  useEffect(() => {
    const catalogSourceId = pageMode === 'document'
      ? routeDocument?.sourceId || activeSource
      : workspaceSource?.id
    if (!catalogSourceId || catalogSourceId === 'blinko') {
      setCatalog(null)
      setCatalogError(null)
      setCatalogLoading(false)
      return
    }
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
  const handleNavigateHome = useCallback(() => {
    navigateWithParams(DEFAULT_GUIDE_ROUTE, {
      q: null,
      keyword: null,
      tag: null,
      doc: null,
      branch: null,
      node: null,
      view: null,
    })
  }, [navigateWithParams])

  const handleNavigateCategory = useCallback(() => {
    navigateWithParams(
      docSet === 'guide' ? `/${guideLocale}/workspace` : `/${guideLocale}/${docSet}`,
      {
        source: null,
        q: null,
        keyword: null,
        tag: null,
        doc: null,
        branch: null,
        node: null,
        view: null,
      },
    )
  }, [docSet, guideLocale, navigateWithParams])

  const handleOpenDocument = useCallback((sourceId: string, path: string) => {
    navigateWithParams(
      buildDocumentRoute({ sourceId, path }),
      {
        source: null,
        doc: null,
        branch: null,
        node: null,
        view: null,
      },
    )
  }, [navigateWithParams])

  const handleClearSelectedFile = useCallback(() => {
    setSelectedFile(null)
    setFileContent(null)
    setFileName('')
    if (pageMode === 'document') return
    syncParams({
      doc: null,
      node: null,
      branch: searchParams.get('branch'),
    }, false)
  }, [pageMode, searchParams, syncParams])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setSelectedFile(null)
    setFileContent(null)
    setFileName('')

    syncParams({
      q: query.trim() ? query : null,
      keyword: null,
      doc: null,
      node: null,
    }, false)
  }, [syncParams])

  const handleSearchSubmit = useCallback((query: string) => {
    const normalizedQuery = query.trim()
    setActiveTag(null)
    setSearchQuery(normalizedQuery)
    setSelectedFile(null)
    setFileContent(null)
    setFileName('')

    navigateWithParams(`/${guideLocale}/guide/search`, {
      q: normalizedQuery || null,
      keyword: null,
      tag: null,
      doc: null,
      branch: null,
      node: null,
      view: null,
    })
  }, [guideLocale, navigateWithParams])

  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    if (suggestion.kind === 'document' && suggestion.sourceId && suggestion.path) {
      handleOpenDocument(suggestion.sourceId, suggestion.path)
      return
    }
    handleSearchSubmit(suggestion.query)
  }, [handleOpenDocument, handleSearchSubmit])

  const handleTagSelect = useCallback((tag: string | null) => {
    setActiveTag(tag)
    setSelectedFile(null)
    setFileContent(null)
    setFileName('')
    if (pageMode === 'document') return
    syncParams({
      tag,
      doc: null,
      node: null,
    }, false)
  }, [pageMode, syncParams])

  const handleWikiLink = useCallback((noteName: string) => {
    if (pageMode === 'document') {
      navigateWithParams(`/${guideLocale}/guide/search`, {
        q: noteName,
        keyword: null,
        source: activeSource,
        doc: null,
      })
      return
    }
    handleSearch(noteName)
  }, [activeSource, guideLocale, handleSearch, navigateWithParams, pageMode])

  const invalidGuideRoute = pageMode === 'home' && docSet === 'guide' && (!routeGuideLocale || !routeGuidePageId)
  const invalidDocSetRoute = pageMode === 'home' && Boolean(params.collection) && (!routeGuideLocale || !routeDocSet)
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
        onSearchChange={handleSearch}
        onSearchSubmit={handleSearchSubmit}
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
                  onTagSelect={handleTagSelect}
                  onWikiLink={handleWikiLink}
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
                activeTag={activeTag}
                activeSourceId={docSet === 'guide' ? searchParams.get('source') : activeSource}
                catalog={catalog}
                catalogError={catalogError}
                catalogLoading={catalogLoading}
                fileContent={fileContent}
                fileLoading={loading}
                fileName={fileName}
                onClearSelectedFile={handleClearSelectedFile}
                onNavigateExplorer={handleNavigateCategory}
                onNavigateHome={handleNavigateHome}
                onOpenItem={handleOpenDocument}
                onSearch={handleSearch}
                onTagSelect={handleTagSelect}
                onWikiLink={handleWikiLink}
                pageMode="home"
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
              <div className="loading loading--fullscreen"><div className="spinner" /></div>
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

function RouteFallback() {
  const navigate = useNavigate()

  return (
    <div className="standalone-route">
      <NotFoundPage
        description={getSiteLocaleConfig(DEFAULT_LOCALE).ui.notFound.fallbackDescription}
        onPrimaryAction={() => navigate('/')}
        onSecondaryAction={() => navigate('/')}
        title={getSiteLocaleConfig(DEFAULT_LOCALE).ui.notFound.fallback}
      />
    </div>
  )
}

function docSetRouteForSource(sourceId: string | null): string {
  if (sourceId === 'axi-skills') return '/en/skills'
  if (sourceId === 'axi-skills-zh') return '/zh/skills'
  if (sourceId === 'workspace') return '/zh/workspace'
  return DEFAULT_GUIDE_ROUTE
}

function LegacyCategoryRedirect() {
  const [searchParams] = useSearchParams()
  const sourceId = searchParams.get('source')
  const documentFromParam = searchParams.get('doc')
  const node = searchParams.get('node')
  const decodedDocument = documentFromParam ? decodeDocumentId(documentFromParam) : null

  if (decodedDocument) {
    return <Navigate replace to={buildDocumentRoute(decodedDocument)} />
  }

  if (sourceId && node && !node.startsWith('branch:') && /\//u.test(node)) {
    return <Navigate replace to={buildDocumentRoute({ sourceId, path: node })} />
  }

  return <Navigate replace to={docSetRouteForSource(sourceId)} />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to={DEFAULT_GUIDE_ROUTE} />} />
      <Route path="/:locale/guide/:guideId" element={<HubPage pageMode="home" />} />
      <Route path="/:locale/:collection" element={<HubPage pageMode="home" />} />
      <Route path="/workspace/architecture" element={<WorkspaceArchitecturePage />} />
      <Route path="/nodes/:categoryId" element={<LegacyCategoryRedirect />} />
      <Route path="/nodes/:categoryId/sub/:subId" element={<LegacyCategoryRedirect />} />
      <Route path="/docs/:sourceId/*" element={<HubPage pageMode="document" />} />
      <Route path="*" element={<RouteFallback />} />
    </Routes>
  )
}

export default App
