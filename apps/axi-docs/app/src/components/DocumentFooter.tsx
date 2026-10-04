import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buildDocumentEditUrl } from '../config/documentRepositories'
import { formatDisplayDate } from '../lib/intl'
import { formatKnowledgeItemTitle, type DocumentTitleLocale } from '../lib/knowledgeFormatter'
import { buildDocumentRoute } from '../lib/routes'
import { isSiteLocale } from '../config/siteConfig'
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
  locale?: DocumentTitleLocale
}

function documentTitle(item: KnowledgeCatalogItem, locale: DocumentTitleLocale) {
  return formatKnowledgeItemTitle({ ...item, locale })
}

export function DocumentFooter({
  buildItemRoute = (item) => buildDocumentRoute({ sourceId: item.sourceId, path: item.path }),
  documentSiblings,
  selectedCatalogItem,
  selectedFile,
  sidebarSections,
  source,
  locale,
}: DocumentFooterProps) {
  // locale 优先 prop；fallback 到 useParams；再 fallback 到 source.locale；最末 'zh'。
  // URL locale 是事实源，但 HMR/嵌套组件可能让 useParams 暂时拿到 undefined。
  const params = useParams()
  const resolvedLocale: DocumentTitleLocale =
    locale
    ?? (isSiteLocale(params.locale) && params.locale === 'en' ? 'en' : 'zh')
  const isEnglish: DocumentTitleLocale = resolvedLocale === 'en' ? 'en' : 'zh'
  const dateLocale = isEnglish === 'en' ? 'en-US' : 'zh-CN'
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
    ? formatDisplayDate(selectedCatalogItem.updated, { dateStyle: 'medium', timeStyle: 'medium' }, dateLocale)
    : null
  const t = isEnglish === 'en'
    ? {
        editLink: 'Edit this page on GitHub',
        lastUpdatedPrefix: 'Last updated: ',
        pagerLabel: 'Pager',
        prev: 'Previous page',
        next: 'Next page',
      }
    : {
        editLink: '在 GitHub 上编辑此页面',
        lastUpdatedPrefix: '最后更新于：',
        pagerLabel: '分页器',
        prev: '上一页',
        next: '下一页',
      }

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
              <span>{t.editLink}</span>
            </a>
          )}
          {updatedLabel && (
            <p className="document-detail-page__last-updated">
              {t.lastUpdatedPrefix}
              <time dateTime={selectedCatalogItem?.updated}>{updatedLabel}</time>
            </p>
          )}
        </div>
      )}

      {(previousDocument || nextDocument) && (
        <nav aria-label={t.pagerLabel} className="document-detail-page__pager">
          <div>
            {previousDocument && (
              <Link
                className="document-detail-page__pager-link"
                to={buildItemRoute(previousDocument)}
              >
                <span>{t.prev}</span>
                <strong>{documentTitle(previousDocument, isEnglish)}</strong>
              </Link>
            )}
          </div>
          <div>
            {nextDocument && (
              <Link
                className="document-detail-page__pager-link document-detail-page__pager-link--next"
                to={buildItemRoute(nextDocument)}
              >
                <span>{t.next}</span>
                <strong>{documentTitle(nextDocument, isEnglish)}</strong>
              </Link>
            )}
          </div>
        </nav>
      )}
    </footer>
  )
}
