import { Link } from 'react-router-dom'
import { buildSearchRoute } from '../../lib/routes'

// Wiki link renderer
export function renderWikiLinks(text: string, sourceId?: string): React.ReactNode {
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = wikiLinkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const [linkText, displayText] = match[1].split('|')
    const noteName = linkText.trim()
    parts.push(
      <Link
        key={match.index}
        className="wiki-link md-link"
        title={`搜索相关知识: ${noteName}`}
        to={buildSearchRoute(noteName, sourceId)}
      >
        {displayText || linkText}
      </Link>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}

export function processChildren(children: React.ReactNode, sourceId?: string): React.ReactNode {
  if (typeof children === 'string') return renderWikiLinks(children, sourceId)
  if (Array.isArray(children)) return children.map((child, i) =>
    typeof child === 'string' ? <span key={i}>{renderWikiLinks(child, sourceId)}</span> : child
  )
  return children
}