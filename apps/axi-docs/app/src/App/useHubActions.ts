import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  DEFAULT_LOCALE,
  getDefaultGuideRoute,
  getDocSetSourceId,
  isDocSetId,
  isGuidePageId,
  isSiteLocale,
  type DocSetId,
  type SiteLocale,
} from '../config/siteConfig'
import {
  buildDocumentRoute,
  decodeDocumentRoute,
  decodeDocumentId,
} from '../lib/routes'
import { SelectedFile, SearchSuggestion } from '../types'

export interface HubActionsInputs {
  pageMode: 'home' | 'document'
  docSet: DocSetId
  guideLocale: SiteLocale
  activeSource: string
  selectedFile: SelectedFile | null
  workspaceSource: { id: string } | null
}

export interface HubActions {
  syncParams: (updates: Record<string, string | null | undefined>, replace?: boolean) => void
  buildLocation: (pathname: string, updates?: Record<string, string | null | undefined>) => { pathname: string; search: string }
  navigateWithParams: (pathname: string, updates?: Record<string, string | null | undefined>, replace?: boolean) => void
  handleNavigateHome: () => void
  handleNavigateCategory: () => void
  handleOpenExplorer: () => void
  handleExitExplorer: () => void
  handleOpenDocument: (sourceId: string, path: string) => void
  handleClearSelectedFile: () => void
  handleSearchSubmit: (query: string) => void
  handleSearch: (query: string) => void
  handleSuggestionSelect: (suggestion: SearchSuggestion) => void
  handleTagSelect: (tag: string | null) => void
  handleWikiLink: (noteName: string) => void
}

const DEFAULT_GUIDE_ROUTE = getDefaultGuideRoute()

export function useHubActions({
  pageMode,
  docSet,
  guideLocale,
  activeSource,
  selectedFile,
  workspaceSource,
}: HubActionsInputs): HubActions {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  void selectedFile

  const syncParams = useCallback((updates: Record<string, string | null | undefined>, replace = true) => {
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

  const buildLocation = useCallback((pathname: string, updates?: Record<string, string | null | undefined>) => {
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

  const navigateWithParams = useCallback((pathname: string, updates?: Record<string, string | null | undefined>, replace = false) => {
    navigate(buildLocation(pathname, updates), { replace })
  }, [buildLocation, navigate])

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

  const handleOpenExplorer = useCallback(() => {
    navigateWithParams(
      docSet === 'guide' ? `/${guideLocale}/workspace` : `/${guideLocale}/${docSet}`,
      {
        view: 'tree',
        source: null,
        q: null,
        keyword: null,
        tag: null,
        doc: null,
        branch: null,
        node: null,
      },
    )
  }, [docSet, guideLocale, navigateWithParams])

  const handleExitExplorer = useCallback(() => {
    syncParams({ view: null, branch: null, node: null }, true)
  }, [syncParams])

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
    if (pageMode === 'document') return
    syncParams({
      doc: null,
      node: null,
      branch: searchParams.get('branch'),
    }, false)
  }, [pageMode, searchParams, syncParams])

  const handleSearchSubmit = useCallback((query: string) => {
    const normalizedQuery = query.trim()
    syncParams({
      q: normalizedQuery || null,
      keyword: null,
      tag: null,
      doc: null,
      branch: null,
      node: null,
      view: null,
    })
    navigateWithParams(`/${guideLocale}/guide/search`)
  }, [guideLocale, navigateWithParams, syncParams])

  const handleSearch = useCallback((query: string) => {
    if (pageMode === 'document') {
      if (query.trim()) {
        handleSearchSubmit(query)
      }
      return
    }
    syncParams({
      q: query.trim() ? query : null,
      keyword: null,
      doc: null,
      node: null,
    }, false)
  }, [handleSearchSubmit, pageMode, syncParams])

  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    if (suggestion.kind === 'document' && suggestion.sourceId && suggestion.path) {
      handleOpenDocument(suggestion.sourceId, suggestion.path)
      return
    }
    handleSearchSubmit(suggestion.query)
  }, [handleOpenDocument, handleSearchSubmit])

  const handleTagSelect = useCallback((tag: string | null) => {
    if (pageMode === 'document') {
      navigateWithParams(
        docSet === 'guide' ? `/${guideLocale}/workspace` : `/${guideLocale}/${docSet}`,
        {
          tag: tag || null,
          source: null,
          q: null,
          keyword: null,
          doc: null,
          branch: null,
          node: null,
          view: null,
        },
      )
      return
    }
    syncParams({
      tag,
      doc: null,
      node: null,
    }, false)
  }, [docSet, guideLocale, navigateWithParams, pageMode, syncParams])

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

  void workspaceSource
  void isDocSetId
  void isGuidePageId
  void isSiteLocale
  void decodeDocumentRoute
  void decodeDocumentId
  void getDocSetSourceId
  void DEFAULT_LOCALE

  return {
    syncParams,
    buildLocation,
    navigateWithParams,
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
  }
}