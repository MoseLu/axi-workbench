import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DocSource,
  KnowledgeCatalog,
  SearchResult,
  SelectedFile,
} from '../types'
import { HomeCommandCenter, QuickKnowledgeItemLike, type DocSetId, type GuideLocale, type GuidePageId } from './HomeCommandCenter'
import { KnowledgeExplorer } from './KnowledgeExplorer'

type ExplorerView = 'tree' | 'path' | 'islands'

interface KnowledgeWorkbenchProps {
  source: DocSource
  sources: DocSource[]
  activeSourceId?: string | null
  catalog: KnowledgeCatalog | null
  catalogLoading: boolean
  catalogError: string | null
  searchQuery: string
  searchResults: SearchResult[] | null
  searching: boolean
  selectedFile: SelectedFile | null
  fileContent: string | null
  fileName: string
  fileLoading: boolean
  activeTag: string | null
  pageMode: 'home' | 'explorer'
  docSet?: DocSetId
  guideLocale?: GuideLocale
  guidePageId?: GuidePageId
  onOpenItem: (sourceId: string, path: string) => void
  onTagSelect: (tag: string | null) => void
  onSearch: (query: string) => void
  onWikiLink: (noteName: string) => void
  onNavigateHome: () => void
  onNavigateExplorer: () => void
  onClearSelectedFile: () => void
}

function normalizeExplorerView(value: string | null): ExplorerView {
  if (value === 'path' || value === 'islands') return value
  return 'tree'
}

export function KnowledgeWorkbench({
  source,
  sources,
  activeSourceId = null,
  catalog,
  searchQuery,
  searchResults,
  searching,
  selectedFile,
  fileContent,
  fileName,
  fileLoading,
  activeTag,
  pageMode,
  docSet,
  guideLocale,
  guidePageId,
  onOpenItem,
  onTagSelect,
  onWikiLink,
  onNavigateHome,
  onNavigateExplorer,
  onClearSelectedFile,
}: KnowledgeWorkbenchProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const quickOpenItems = useMemo<QuickKnowledgeItemLike[]>(() => {
    if ((searchResults || []).length > 0) return (searchResults || []).slice(0, 5)
    if ((catalog?.sections || []).length > 0) return catalog?.sections[0].items.slice(0, 5) || []
    return catalog?.recentDocs.slice(0, 5) || []
  }, [catalog?.recentDocs, catalog?.sections, searchResults])

  const graphFocusPath = selectedFile?.path || searchResults?.[0]?.path || null
  const explorerView = normalizeExplorerView(searchParams.get('view'))
  const explorerBranch = searchParams.get('branch')
  const explorerNode = searchParams.get('node')

  const updateExplorerParams = (updates: Record<'view' | 'branch' | 'node', string | null | undefined>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key)
      else next.set(key, value)
    })
    setSearchParams(next, { replace: false })
  }

  if (pageMode === 'explorer') {
    return (
      <KnowledgeExplorer
        activeTag={activeTag}
        fileContent={fileContent}
        fileLoading={fileLoading}
        fileName={fileName}
        graphFocusPath={graphFocusPath}
        onBranchChange={(branch) => updateExplorerParams({ view: explorerView, branch, node: explorerNode })}
        onClearSelectedFile={onClearSelectedFile}
        onNavigateHome={onNavigateHome}
        onNodeChange={(node) => updateExplorerParams({ view: explorerView, branch: explorerBranch, node })}
        onOpenItem={onOpenItem}
        onTagSelect={onTagSelect}
        onViewChange={(view) => updateExplorerParams({ view, branch: explorerBranch, node: explorerNode })}
        onWikiLink={onWikiLink}
        quickOpenItems={quickOpenItems}
        searchQuery={searchQuery}
        selectedBranch={explorerBranch}
        selectedFile={selectedFile}
        selectedNodeId={explorerNode}
        source={source}
        view={explorerView}
      />
    )
  }

  return (
    <div className="knowledge-workbench knowledge-workbench--home">
      <HomeCommandCenter
        activeTag={activeTag}
        activeSourceId={activeSourceId}
        catalog={catalog}
        docSet={docSet}
        fileContent={fileContent}
        fileLoading={fileLoading}
        fileName={fileName}
        graphFocusPath={graphFocusPath}
        guideLocale={guideLocale}
        guidePageId={guidePageId}
        onClearSelectedFile={onClearSelectedFile}
        onOpenExplorer={onNavigateExplorer}
        onOpenItem={onOpenItem}
        onTagSelect={onTagSelect}
        onWikiLink={onWikiLink}
        searching={searching}
        searchQuery={searchQuery}
        searchResults={searchResults}
        selectedFile={selectedFile}
        source={source}
        sources={sources}
      />
    </div>
  )
}

export type { QuickKnowledgeItemLike as QuickKnowledgeItem }
