import { DocumentFooter } from '../DocumentFooter'
import { DocumentView } from '../DocumentView'
import { buildGuideRoute, type SiteLocale, type GuidePageId } from '../../config/siteConfig'

type GuideLocale = SiteLocale
import { DocSource, KnowledgeCatalogItem, SearchResult, SelectedFile } from '../../types'

interface GuideArticleProps {
  fileContent: string | null
  fileLoading: boolean
  fileName: string
  guideTitle: string
  guideSelectedFile: SelectedFile
  guideSource: DocSource
  guideLocale: GuideLocale
  guidePageId: string
  normalizedSearchQuery: string
  searching: boolean
  visibleSearchResults: SearchResult[]
  guideDocumentSiblings: KnowledgeCatalogItem[]
  selectedGuideCatalogItem: KnowledgeCatalogItem | null
  onOpenItem: (sourceId: string, path: string) => void
  onWikiLink?: (noteName: string) => void
}

export function GuideArticle({
  fileContent,
  fileLoading,
  fileName,
  guideTitle,
  guideSelectedFile,
  guideSource,
  guideLocale,
  guidePageId,
  normalizedSearchQuery,
  searching,
  visibleSearchResults,
  guideDocumentSiblings,
  selectedGuideCatalogItem,
  onOpenItem,
  onWikiLink,
}: GuideArticleProps) {
  return (
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
            locale={guideLocale}
          />
        )}
        loading={fileLoading}
        onTagSelect={() => undefined}
        onWikiLink={onWikiLink || (() => undefined)}
        selectedFile={guideSelectedFile}
        showKnowledgePanel={false}
        source={guideSource}
        variant="guide"
        locale={guideLocale}
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
  )
}