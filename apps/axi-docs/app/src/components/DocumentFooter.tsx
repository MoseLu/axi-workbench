import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { buildDocumentEditUrl } from '../config/documentRepositories'
import { formatDisplayDate } from '../lib/intl'
import { formatKnowledgeItemTitle } from '../lib/knowledgeFormatter'
import { buildDocumentRoute } from '../lib/routes'
import type { DocSource, KnowledgeCatalog, KnowledgeCatalogItem, SelectedFile } from '../types'
import { EditIcon } from './Icons'
import './DocumentFooter.css'

interface DocumentFooterProps {
  buildItemRoute?: (item: KnowledgeCatalogItem) => string
  documentSiblings: KnowledgeCatalogItem[]
  selectedCatalogItem: KnowledgeCatalogItem | null
  selectedFile: SelectedFile
  sidebarSections: KnowledgeCatalog['sections']
  source: DocSource
}

function documentTitle(item: KnowledgeCatalogItem) {
  return formatKnowledgeItemTitle(item)
}

export function DocumentFooter({
  buildItemRoute = (item) => buildDocumentRoute({ sourceId: item.sourceId, path: item.path }),
  documentSiblings,
  selectedCatalogItem,
  selectedFile,
  sidebarSections,
  source,
}: DocumentFooterProps) {
  const orderedDocuments = useMemo(() => {
    const candidates = sidebarSections.length > 0
      ? sidebarSections.flatMap((section) => (
        source.kind === 'skill-library' && section.subsections?.length
          ? section.subsections.flatMap((subsection) => subsection.items)
          : section.items
      ))
      : documentSiblings
    const seen = new Set<string>()

    return candidates.filter((item) => {
      const key = `${item.sourceId}:${item.path}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [documentSiblings, sidebarSections, source.kind])
  const currentIndex = orderedDocuments.findIndex((item) => (
    item.sourceId === selectedFile.sourceId && item.path === selectedFile.path
  ))
  const previousDocument = currentIndex > 0 ? orderedDocuments[currentIndex - 1] : null
  const nextDocument = currentIndex >= 0 && currentIndex < orderedDocuments.length - 1
    ? orderedDocuments[currentIndex + 1]
    : null
  const editUrl = buildDocumentEditUrl(source.id, selectedFile.path)
  const updatedLabel = selectedCatalogItem?.updated
    ? formatDisplayDate(selectedCatalogItem.updated, { dateStyle: 'medium', timeStyle: 'medium' })
    : null
  const isEnglish = source.locale === 'en'

  if (!editUrl && !updatedLabel && !previousDocument && !nextDocument) return null

  return (
    <footer className="document-detail-page__footer">
      {(editUrl || updatedLabel) && (
        <div className="document-detail-page__edit-info">
          {editUrl && (
            <a
              className="document-detail-page__edit-link"
              href={editUrl}
              rel="noreferrer"
              target="_blank"
            >
              <EditIcon />
              <span>{isEnglish ? 'Edit this page on GitHub' : '在 GitHub 上编辑此页面'}</span>
            </a>
          )}
          {updatedLabel && (
            <p className="document-detail-page__last-updated">
              {isEnglish ? 'Last updated: ' : '最后更新于：'}
              <time dateTime={selectedCatalogItem?.updated}>{updatedLabel}</time>
            </p>
          )}
        </div>
      )}

      {(previousDocument || nextDocument) && (
        <nav aria-label={isEnglish ? 'Pager' : '分页器'} className="document-detail-page__pager">
          <div>
            {previousDocument && (
              <Link
                className="document-detail-page__pager-link"
                to={buildItemRoute(previousDocument)}
              >
                <span>{isEnglish ? 'Previous page' : '上一页'}</span>
                <strong>{documentTitle(previousDocument)}</strong>
              </Link>
            )}
          </div>
          <div>
            {nextDocument && (
              <Link
                className="document-detail-page__pager-link document-detail-page__pager-link--next"
                to={buildItemRoute(nextDocument)}
              >
                <span>{isEnglish ? 'Next page' : '下一页'}</span>
                <strong>{documentTitle(nextDocument)}</strong>
              </Link>
            )}
          </div>
        </nav>
      )}
    </footer>
  )
}
