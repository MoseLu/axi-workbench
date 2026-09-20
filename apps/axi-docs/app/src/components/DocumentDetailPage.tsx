import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  formatKnowledgeItemTitle,
  formatKnowledgeTagLabel,
} from '../lib/knowledgeFormatter'
import { prepareDocumentDisplayMarkdown } from '../lib/documentDisplay'
import { buildDocumentRoute } from '../lib/routes'
import type { DocSource, KnowledgeCatalog, KnowledgeCatalogItem, SelectedFile } from '../types'
import { DocumentFooter } from './DocumentFooter'
import { FileIcon } from './Icons'
import { DocumentView } from './DocumentView'
import { ProjectHandoffCard } from './ProjectHandoffCard'
import { TableOfContents } from './TableOfContents'

interface DocumentDetailPageProps {
  source: DocSource
  selectedFile: SelectedFile
  selectedCatalogItem: KnowledgeCatalogItem | null
  fileContent: string | null
  fileName: string
  fileLoading: boolean
  categoryTitle: string
  categoryDescription: string
  documentSiblings: KnowledgeCatalogItem[]
  sidebarSections?: KnowledgeCatalog['sections']
  relatedItems: KnowledgeCatalogItem[]
  onTagSelect: (tag: string | null) => void
  onWikiLink: (noteName: string) => void
}

function documentTitle(item: Pick<KnowledgeCatalogItem, 'title' | 'name' | 'path' | 'graphTitle'>) {
  return formatKnowledgeItemTitle(item)
}

function sourceKindLabel(source: DocSource) {
  if (source.kind === 'skill-library') return '技能库'
  if (source.kind === 'workspace-registry') return '工作区文档'
  return '文档库'
}

export function DocumentDetailPage({
  source,
  selectedFile,
  selectedCatalogItem,
  fileContent,
  fileName,
  fileLoading,
  categoryTitle,
  categoryDescription,
  documentSiblings,
  sidebarSections = [],
  relatedItems,
  onTagSelect,
  onWikiLink,
}: DocumentDetailPageProps) {
  const tags = selectedCatalogItem?.tags || []
  const sourceLabel = sourceKindLabel(source)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    category: true,
    related: true,
  })
  const toggleSection = (sectionId: string) => {
    setOpenSections((current) => ({ ...current, [sectionId]: !current[sectionId] }))
  }
  const isSectionOpen = (sectionId: string) => openSections[sectionId] ?? (sectionId.split(':').length <= 2)
  const hasDocumentSetSidebar = sidebarSections.length > 0
  const tocContent = useMemo(
    () => prepareDocumentDisplayMarkdown(fileContent || '', source, selectedFile),
    [fileContent, selectedFile, source],
  )
  const visibleSidebarSections = useMemo(() => {
    return sidebarSections
      .map((section) => {
        const seen = new Set<string>()
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
  }, [sidebarSections])
  const renderDocumentSetLink = (item: KnowledgeCatalogItem) => (
    <Link
      key={`${item.sourceId}:${item.path}`}
      className={`document-detail-page__link${item.sourceId === selectedFile.sourceId && item.path === selectedFile.path ? ' active' : ''}`}
      title={item.description || item.path}
      to={buildDocumentRoute({ sourceId: item.sourceId, path: item.path })}
    >
      <span>{documentTitle(item)}</span>
    </Link>
  )

  return (
    <div className="document-detail-page">
      <aside className="document-detail-page__sidebar">
        <div className="document-detail-page__brand">
          <span>{sourceLabel}</span>
          <strong>{source.name}</strong>
          <p>{source.description}</p>
        </div>

        {hasDocumentSetSidebar ? (
          visibleSidebarSections.map((section) => {
            const sectionId = `catalog:${section.key}`
            const open = isSectionOpen(sectionId)
            const hasSubsections = section.subsections && section.subsections.length > 0

            return (
              <nav key={section.key} className="document-detail-page__nav" aria-label={section.title}>
                <button
                  aria-controls={`document-nav-${section.key}`}
                  aria-expanded={open}
                  className="document-detail-page__nav-heading"
                  onClick={() => toggleSection(sectionId)}
                  type="button"
                >
                  <span>{section.title}</span>
                  <span className="document-detail-page__nav-heading-meta">
                    <span aria-hidden="true" className="document-detail-page__nav-caret"></span>
                  </span>
                </button>
                {open && (
                  <div className="document-detail-page__link-list" id={`document-nav-${section.key}`}>
                    {hasSubsections
                      ? section.subsections!.map((subsection) => {
                        const subsectionId = `${sectionId}:${subsection.key}`
                        const subsectionOpen = isSectionOpen(subsectionId)
                        return (
                          <div key={subsection.key} className="document-detail-page__subsection">
                            <button
                              aria-expanded={subsectionOpen}
                              className="document-detail-page__subheading"
                              onClick={() => toggleSection(subsectionId)}
                              title={subsection.description}
                              type="button"
                            >
                              <span>{subsection.title}</span>
                              <span className="document-detail-page__nav-heading-meta">
                                <span aria-hidden="true" className="document-detail-page__nav-caret"></span>
                              </span>
                            </button>
                            {subsectionOpen && (
                              <div className="document-detail-page__subitems">
                                {subsection.items.map(renderDocumentSetLink)}
                              </div>
                            )}
                          </div>
                        )
                      })
                      : section.items.slice(0, source.kind === 'skill-library' || source.kind === 'workspace-registry' ? section.items.length : 12).map(renderDocumentSetLink)}
                  </div>
                )}
              </nav>
            )
          })
        ) : (
          <nav className="document-detail-page__nav" aria-label={`${source.name} 文档目录`}>
            <button
              aria-controls="document-nav-category"
              aria-expanded={openSections.category}
              className="document-detail-page__nav-heading"
              onClick={() => toggleSection('category')}
              type="button"
            >
              <span>{categoryTitle}</span>
              <span className="document-detail-page__nav-heading-meta">
                <small>{documentSiblings.length}</small>
                <span aria-hidden="true" className="document-detail-page__nav-caret"></span>
              </span>
            </button>
            {openSections.category && (
              <div className="document-detail-page__link-list" id="document-nav-category">
                {documentSiblings.map((item) => (
                  <Link
                    key={`${item.sourceId}:${item.path}`}
                    className={`document-detail-page__link${item.path === selectedFile.path ? ' active' : ''}`}
                    to={buildDocumentRoute({ sourceId: item.sourceId, path: item.path })}
                  >
                    <FileIcon />
                    <span>{documentTitle(item)}</span>
                  </Link>
                ))}
              </div>
            )}
          </nav>
        )}

        {!hasDocumentSetSidebar && relatedItems.length > 0 && (
          <nav className="document-detail-page__nav document-detail-page__nav--related" aria-label="相关推荐">
            <button
              aria-controls="document-nav-related"
              aria-expanded={openSections.related}
              className="document-detail-page__nav-heading"
              onClick={() => toggleSection('related')}
              type="button"
            >
              <span>相关推荐</span>
              <span className="document-detail-page__nav-heading-meta">
                <small>{relatedItems.length}</small>
                <span aria-hidden="true" className="document-detail-page__nav-caret"></span>
              </span>
            </button>
            {openSections.related && (
              <div className="document-detail-page__link-list" id="document-nav-related">
                {relatedItems.slice(0, 6).map((item) => (
                  <Link
                    key={`${item.sourceId}:${item.path}:related`}
                    className="document-detail-page__link"
                    to={buildDocumentRoute({ sourceId: item.sourceId, path: item.path })}
                  >
                    <span>{documentTitle(item)}</span>
                  </Link>
                ))}
              </div>
            )}
          </nav>
        )}
      </aside>

      <main className="document-detail-page__main">
        <div className="document-detail-page__reader">
          {selectedCatalogItem?.documentTypeKey === 'overview' && selectedCatalogItem.projectId && (
            <ProjectHandoffCard projectId={selectedCatalogItem.projectId} />
          )}
          <DocumentView
            content={fileContent}
            fileName={fileName}
            footer={(
              <DocumentFooter
                documentSiblings={documentSiblings}
                selectedCatalogItem={selectedCatalogItem}
                selectedFile={selectedFile}
                sidebarSections={visibleSidebarSections}
                source={source}
              />
            )}
            loading={fileLoading}
            onTagSelect={onTagSelect}
            onWikiLink={onWikiLink}
            selectedFile={selectedFile}
            showKnowledgePanel={false}
            source={source}
          />
        </div>
      </main>

      <aside className="document-detail-page__aside">
        <div className="document-detail-page__toc">
          <strong>页面导航</strong>
          <TableOfContents
            content={tocContent}
            headingRootSelector=".document-detail-page__reader .doc-body"
            scrollContainerSelector=".document-detail-page__reader .app-content"
          />
        </div>

        <div className="document-detail-page__meta">
          <strong>文档信息</strong>
          <p>{categoryDescription}</p>
          <span className="document-detail-page__source-kind">
            {sourceLabel}
          </span>
          <strong className="document-detail-page__source-name">{source.name}</strong>
          <p>{source.description}</p>
          {tags.length > 0 && (
            <div className="document-detail-page__tags">
              {tags.slice(0, 8).map((tag) => (
                <button key={tag} onClick={() => onTagSelect(tag)} type="button">
                  #{formatKnowledgeTagLabel(tag)}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
