import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getPageCopy, type PageCopyLocale } from '../../config/pageCopy'
import { formatKnowledgeItemTitle } from '../../lib/knowledgeFormatter'
import { buildSearchRoute } from '../../lib/routes'

/**
 * Companion for /guide/search — provides an inline search box + results that
 * mirrors what the ⌘K palette exposes, so the guide's body promises about
 * "showing matched documents below the form" become reality.
 */
export function GuideSearchCompanion({ locale }: { locale: PageCopyLocale }) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Array<{
    id: string
    title: string
    snippet?: string
    path?: string
  }> | null>(null)
  const copy = getPageCopy(locale)
  const isEn = locale === 'en'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const q = query.trim()
    if (!q) {
      setResults(null)
      return
    }
    setSearching(true)
    setError(null)
    try {
      const { searchKnowledgeAll } = await import('../../lib/knowledgeBase')
      const items = await searchKnowledgeAll(q)
      setResults(items.slice(0, 12).map((item) => ({
        id: `${item.sourceId}:${item.path}`,
        title: formatKnowledgeItemTitle({ ...item, locale }),
        snippet: item.snippet,
        path: item.path,
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  return (
    <section className="doc-companion doc-companion--search" aria-label={isEn ? 'Search this knowledge base' : '搜索本页知识库'}>
      <h2 className="doc-companion__title">{isEn ? 'Try the search' : '试一试本页搜索'}</h2>
      <form className="doc-companion__form" onSubmit={handleSubmit} role="search">
        <input
          type="search"
          className="doc-companion__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.header.searchPlaceholder}
          aria-label={copy.header.searchLabel}
        />
        <button type="submit" className="doc-companion__submit" disabled={searching}>
          {searching
            ? (isEn ? 'Searching…' : '搜索中…')
            : (isEn ? 'Search' : '搜索')}
        </button>
      </form>
      {error && (
        <p className="doc-companion__error" role="alert">{error}</p>
      )}
      {results && results.length === 0 && !searching && (
        <p className="doc-companion__empty">{isEn ? 'No matching documents yet.' : '暂未找到匹配的文档。'}</p>
      )}
      {results && results.length > 0 && (
        <ul className="doc-companion__results">
          {results.map((item) => (
            <li key={item.id} className="doc-companion__result">
              <Link
                to={buildSearchRoute(item.path ?? item.id)}
                className="doc-companion__result-link"
              >
                <strong>{item.title}</strong>
                {item.snippet && <span className="doc-companion__result-snippet">{item.snippet}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}