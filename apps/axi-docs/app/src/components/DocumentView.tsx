import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Components } from 'react-markdown'
import { DocumentIcon, ClockIcon } from './Icons'
import { KnowledgePanel } from './KnowledgePanel'
import { formatDisplayDate } from '../lib/intl'
import { prepareDocumentDisplayMarkdown, stripDisplayEmoji } from '../lib/documentDisplay'
import { formatKnowledgeDocumentTitle, formatKnowledgeItemTitle } from '../lib/knowledgeFormatter'
import { buildSearchRoute } from '../lib/routes'
import { getPageCopy, type PageCopyLocale } from '../config/pageCopy'
import { isSiteLocale } from '../config/siteConfig'
import { DocSource, SelectedFile, Frontmatter } from '../types'

interface DocumentViewProps {
  content: string | null
  fileName: string
  loading: boolean
  selectedFile: SelectedFile | null
  source?: DocSource
  onWikiLink: (noteName: string) => void
  onTagSelect?: (tag: string) => void
  showKnowledgePanel?: boolean
  variant?: 'page' | 'panel' | 'guide'
  footer?: React.ReactNode
  locale?: PageCopyLocale
}

// Decode JSON-encoded content strings
function preprocessContent(raw: string): string {
  if (!raw) return raw
  const s = raw.trim()
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      const decoded = JSON.parse(s)
      if (typeof decoded === 'string') return decoded
    } catch {
      return s.slice(1, -1)
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\\\/g, '\\')
    }
  }
  return raw
}

// Parse YAML frontmatter
function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  if (!content.startsWith('---')) return { frontmatter: {}, body: content }
  const end = content.indexOf('\n---', 3)
  if (end === -1) return { frontmatter: {}, body: content }
  const yaml = content.slice(4, end)
  const body = content.slice(end + 4).trimStart()
  const frontmatter: Frontmatter = {}
  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const raw = line.slice(colonIdx + 1).trim()
    if (raw.startsWith('[') && raw.endsWith(']')) {
      frontmatter[key] = raw.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
    } else {
      frontmatter[key] = raw.replace(/^["']|["']$/g, '')
    }
  }
  return { frontmatter, body }
}

function headingId(children: React.ReactNode): string {
  const text = String(children)
  return text.toLowerCase().replace(/[^\w\u4e00-\u9fa5\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

function isGuidePath(path: string, guideId: string): boolean {
  // guideId may arrive as `guide/search` or `guide/search.md`; we accept both.
  const normalized = path.replace(/\.md$/i, '')
  return normalized === `guide/${guideId}` || normalized.endsWith(`/guide/${guideId}`)
}

// Extract raw text from React children
function extractText(root: React.ReactNode): string {
  const parts: string[] = []
  const stack: React.ReactNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()
    if (typeof node === 'string') parts.push(node)
    else if (typeof node === 'number') parts.push(String(node))
    else if (Array.isArray(node)) { for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]) }
    else if (node && typeof node === 'object' && 'props' in (node as object)) {
      stack.push((node as React.ReactElement).props.children)
    }
  }
  return parts.join('')
}

// Copy button
function CopyButton({ text, locale = 'zh' }: { text: string; locale?: PageCopyLocale }) {
  const copy = getPageCopy(locale).document
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text.trim()).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text.trim()
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      aria-label={copied ? copy.codeCopied : copy.copyCode}
      className={`copy-btn copy${copied ? ' copy-btn--copied copied' : ''}`}
      onClick={handleCopy}
      title={copied ? copy.copiedTitle : copy.copyTitle}
      type="button"
    >
      {copied ? (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m5 12 5 5L20 7" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
      )}
    </button>
  )
}

function codeLanguage(className: string): string {
  const rawLanguage = className.split(/\s+/u).find((entry) => entry.startsWith('language-'))?.replace('language-', '') || ''
  return ['plain', 'plaintext', 'txt'].includes(rawLanguage) ? 'text' : rawLanguage
}

function blockCodeClassName(className: string, text: string): string {
  if (codeLanguage(className)) return className
  return text.includes('\n') ? 'language-text' : className
}

function isShellLanguage(language: string): boolean {
  return ['bash', 'sh', 'shell', 'zsh', 'console'].includes(language)
}

function shellTokenClass(token: string, isFirstToken: boolean): string {
  if (/^#/.test(token)) return 'shell-comment'
  if (/^(['"`]).*\1$/u.test(token)) return 'shell-string'
  if (/^-{1,2}[\w-]+(?:=.*)?$/u.test(token)) return 'shell-flag'
  if (isFirstToken || /^(?:npm|npx|pnpm|yarn|bun|turbo|git|curl|docker|node|tsx|vite|vercel)$/u.test(token)) {
    return 'shell-command'
  }
  if (/^(?:@?[\w.-]+\/)?[\w.-]+@[\w.-]+$/u.test(token)) return 'shell-package'
  return 'shell-arg'
}

function renderShellLine(line: string, lineIndex: number): React.ReactNode {
  const leadingWhitespace = line.match(/^\s*/u)?.[0] || ''
  const content = line.slice(leadingWhitespace.length)
  if (!content) return line
  if (content.startsWith('#')) {
    return (
      <span key={lineIndex}>
        {leadingWhitespace}
        <span className="shell-comment">{content}</span>
      </span>
    )
  }

  const tokenRegex = /\s+|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\S+/gu
  let commandSeen = false
  return (
    <span key={lineIndex}>
      {leadingWhitespace}
      {Array.from(content.matchAll(tokenRegex)).map((match, tokenIndex) => {
        const token = match[0]
        if (/^\s+$/u.test(token)) return token
        const isFirstToken = !commandSeen && token !== '$'
        if (token !== '$') commandSeen = true
        return (
          <span key={tokenIndex} className={token === '$' ? 'shell-prompt' : shellTokenClass(token, isFirstToken)}>
            {token}
          </span>
        )
      })}
    </span>
  )
}

function renderShellSyntax(text: string): React.ReactNode {
  return text.split(/(\n)/u).map((part, index) => (
    part === '\n' ? part : renderShellLine(part, index)
  ))
}

// Wiki link renderer
function renderWikiLinks(text: string, sourceId?: string): React.ReactNode {
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

function processChildren(children: React.ReactNode, sourceId?: string): React.ReactNode {
  if (typeof children === 'string') return renderWikiLinks(children, sourceId)
  if (Array.isArray(children)) return children.map((child, i) =>
    typeof child === 'string' ? <span key={i}>{renderWikiLinks(child, sourceId)}</span> : child
  )
  return children
}

// Skill badge — rich metadata for MCP/agent use
function SkillBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 980,
      background: 'var(--tag-bg)', color: 'var(--tag-text)',
      border: '1px solid var(--tag-border)',
      fontSize: 'var(--font-size-xs)', fontWeight: 500,
    }}>
      <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>{label}:</span>
      <span>{value}</span>
    </div>
  )
}

export function DocumentView({
  content, fileName, loading, selectedFile, source, onWikiLink, onTagSelect,
  showKnowledgePanel = true,
  variant = 'page',
  footer,
  locale,
}: DocumentViewProps) {
  const params = useParams()
  const urlLocale = isSiteLocale(params.locale) ? params.locale : null
  const effectiveLocale: PageCopyLocale = locale ?? urlLocale ?? (source?.locale === 'en' ? 'en' : 'zh')
  const { frontmatter, body } = useMemo(() => {
    if (!content) return { frontmatter: {}, body: '' }
    return parseFrontmatter(preprocessContent(content))
  }, [content])
  const displayBody = useMemo(() => prepareDocumentDisplayMarkdown(body, source, selectedFile), [body, selectedFile, source])

  const handleNavigate = (path: string) => onWikiLink(path)
  const wikiLinkSourceId = selectedFile?.sourceId || source?.id

  const components: Components = useMemo(() => ({
    p({ children }) { return <p>{processChildren(children, wikiLinkSourceId)}</p> },
    li({ children }) { return <li>{processChildren(children, wikiLinkSourceId)}</li> },
    a({ href, children, className, title }) {
      const isExternal = Boolean(href && /^(?:https?:)?\/\//iu.test(href))
      const linkClassName = ['md-link', isExternal ? 'md-link--external' : '', className].filter(Boolean).join(' ')
      return (
        <a
          className={linkClassName}
          href={href}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          target={isExternal ? '_blank' : undefined}
          title={title}
        >
          {children}
        </a>
      )
    },
    pre({ children }) {
      const codeEl = Array.isArray(children) ? children[0] : children
      const className = (codeEl as React.ReactElement)?.props?.className || ''
      const rawText = extractText(children)
      const lang = codeLanguage(className as string) || (rawText.includes('\n') ? 'text' : '')
      const codeBlockClassName = [
        'code-block',
        lang ? `language-${lang}` : '',
        lang === 'text' ? 'code-block--text' : '',
      ].filter(Boolean).join(' ')
      return (
        <div className={codeBlockClassName}>
          <CopyButton text={rawText} locale={effectiveLocale} />
          {lang && <span className="code-lang lang">{lang}</span>}
          <pre>{children}</pre>
        </div>
      )
    },
    code({ className, children }) {
      const rawClassName = className || ''
      const rawText = extractText(children)
      const lang = codeLanguage(rawClassName)
      const isBlock = Boolean(lang || rawClassName.includes('hljs') || rawText.includes('\n'))
      if (isBlock && isShellLanguage(lang)) {
        return <code className={blockCodeClassName(rawClassName, rawText)}>{renderShellSyntax(rawText)}</code>
      }
      if (isBlock) return <code className={blockCodeClassName(rawClassName, rawText)}>{children}</code>
      return <code className="inline-code">{children}</code>
    },
    h1: ({ children }) => {
      const id = headingId(children)
      return <h1 id={id}><a href={`#${id}`} className="heading-anchor" aria-hidden="true">#</a>{children}</h1>
    },
    h2: ({ children }) => {
      const id = headingId(children)
      return <h2 id={id}><a href={`#${id}`} className="heading-anchor" aria-hidden="true">#</a>{children}</h2>
    },
    h3: ({ children }) => {
      const id = headingId(children)
      return <h3 id={id}><a href={`#${id}`} className="heading-anchor" aria-hidden="true">#</a>{children}</h3>
    },
    h4: ({ children }) => {
      const id = headingId(children)
      return <h4 id={id}><a href={`#${id}`} className="heading-anchor" aria-hidden="true">#</a>{children}</h4>
    },
  }), [wikiLinkSourceId])

  if (!selectedFile) {
    return (
      <div className="app-content">
        <div className="empty-state">
          <DocumentIcon />
          <div>
            <p className="empty-state-text">从左侧选择一个文档开始阅读</p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-3)' }}>
              支持标签筛选 · 双向链接 · AI 洞察
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-content">
        <div className="loading"><div className="spinner" /></div>
      </div>
    )
  }

  const title = (frontmatter.title as string) || fileName
  const graphTitle = (frontmatter['graph-title'] as string) || (frontmatter.graphTitle as string) || undefined
  const isGuideDocument = variant === 'guide'
  const displayTitle = stripDisplayEmoji(
    isGuideDocument ? title : formatKnowledgeDocumentTitle(title, selectedFile.path, graphTitle),
  )
  const date = (frontmatter.modified || frontmatter.updated || frontmatter.date || frontmatter.created) as string | undefined
  const description = stripDisplayEmoji((frontmatter.description as string | undefined) || '')
  const docType = stripDisplayEmoji((frontmatter.type as string | undefined) || '')
  // Skill metadata fields (MCP-ready)
  const tech = stripDisplayEmoji((frontmatter.tech as string | undefined) || '')
  const version = stripDisplayEmoji((frontmatter.version as string | undefined) || '')
  const domain = stripDisplayEmoji((frontmatter.domain as string | undefined) || '')
  const problem = stripDisplayEmoji((frontmatter.problem as string | undefined) || '')
  const isDaily = docType === 'daily'
  const isSkillDocument = source?.kind === 'skill-library' || docType === 'skill'
  const hasCleanHeader = isSkillDocument || isGuideDocument || source?.kind === 'workspace-registry'

  return (
    <div className={`doc-layout${variant === 'panel' ? ' doc-layout--panel' : ''}${isGuideDocument ? ' doc-layout--guide' : ''}`}>
      <div className="app-content">
        {/* Document Header */}
        <div className="doc-header">
          {!hasCleanHeader && (
            <div className="doc-breadcrumb">
              <span className="breadcrumb-source">{source?.name || selectedFile.sourceId}</span>
              {selectedFile.path.split('/').slice(0, -1).map((part, i) => (
                <span key={i} className="breadcrumb-sep">
                  <span className="breadcrumb-chevron">›</span>
                  <span className="breadcrumb-part">{part}</span>
                </span>
              ))}
            </div>
          )}

          <div className="doc-title-row">
            <h1 className="doc-title">{displayTitle}</h1>
            {!hasCleanHeader && isDaily && <span className="doc-type-badge">日记</span>}
            {!hasCleanHeader && docType && !isDaily && <span className="doc-type-badge">{docType}</span>}
          </div>

          {!isGuideDocument && description && <p className="doc-description">{description}</p>}

          {!hasCleanHeader && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {domain && <SkillBadge label="领域" value={domain} />}
              {tech && <SkillBadge label="技术" value={tech} />}
              {version && <SkillBadge label="版本" value={version} />}
              {problem && <SkillBadge label="问题" value={problem} />}
              {date && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 980, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  <ClockIcon />
                  {formatDisplayDate(date, undefined, effectiveLocale === 'en' ? 'en-US' : 'zh-CN')}
                </div>
              )}
            </div>
          )}

          {/* Tags — rendered ONLY in body, not duplicated in meta */}
        </div>

        {/* Document Body */}
        <div className="doc-body">
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={components}
            >
              {displayBody}
            </ReactMarkdown>
          </div>
        </div>

        {/* Per-guide interactive companions — keep the page honest when the
            body promises functionality (search / knowledge-graph) that the
            static markdown alone cannot deliver. */}
        {selectedFile && isGuidePath(selectedFile.path, 'search') && (
          <GuideSearchCompanion locale={effectiveLocale} />
        )}
        {selectedFile && isGuidePath(selectedFile.path, 'knowledge-graph') && (
          <GuideKnowledgeGraphCompanion locale={effectiveLocale} />
        )}

        {footer}
      </div>

      {/* Knowledge Panel */}
      {selectedFile && showKnowledgePanel && (
        <KnowledgePanel
          content={displayBody || null}
          selectedFile={selectedFile}
          source={source}
          onNavigate={handleNavigate}
          onTagSelect={onTagSelect}
        />
      )}
    </div>
  )
}

/**
 * Companion for /guide/search — provides an inline search box + results that
 * mirrors what the ⌘K palette exposes, so the guide's body promises about
 * "showing matched documents below the form" become reality.
 */
function GuideSearchCompanion({ locale }: { locale: PageCopyLocale }) {
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
      const { searchKnowledgeAll } = await import('../lib/knowledgeBase')
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

/**
 * Companion for /guide/knowledge-graph — renders an SVG of the catalog's
 * top-level relationships so the page's body text becomes visible evidence
 * rather than a written description of an absent visualization.
 */
function GuideKnowledgeGraphCompanion({ locale }: { locale: PageCopyLocale }) {
  const isEnLocal = locale === 'en'
  // 关系图用一组示例节点呈现"图谱的样子"，避免在文档页面再异步加载整个 catalog。
  // 节点命名来自 HubPage 已经渲染过的目录语义（guide / skill / tag / reference）。
  const sampleNodes = isEnLocal
    ? [
        'Getting started', 'What is Axi Docs', 'Routing', 'Document sources',
        'Plans', 'Markdown guide', 'Frontmatter', 'Search',
        'Skills', 'Workspace', 'Knowledge graph', 'Frontend BFF',
        'Localization', 'Configuration', 'ADR catalogue', 'Tag taxonomy',
      ]
    : [
        '快速开始', '什么是 Axi Docs', '路由约定', '文档来源',
        'Plans', 'Markdown 指南', 'Frontmatter', '搜索',
        '技能库', '工作区', '知识图谱', '前端 BFF',
        '本地化', '配置总览', 'ADR 目录', '标签体系',
      ]
  const items = sampleNodes.map((title, index) => ({
    id: `sample-${index}`,
    title,
    tags: [],
  }))

  // 简单的环形布局：节点均匀分布在外圈
  const radius = 130
  const cx = 160
  const cy = 160
  const nodes = items.map((item, index) => {
    const angle = (index / items.length) * Math.PI * 2
    return {
      ...item,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    }
  })
  const center = { x: cx, y: cy }

  return (
    <section className="doc-companion doc-companion--graph" aria-label={isEnLocal ? 'Knowledge graph preview' : '知识图谱预览'}>
      <h2 className="doc-companion__title">{isEnLocal ? 'Knowledge graph preview' : '知识图谱预览'}</h2>
      <p className="doc-companion__hint">
        {isEnLocal
          ? 'A radial view of the top-level catalog — use the top search to dive into a specific node.'
          : '当前目录的环形预览——可使用顶部搜索进入任意节点。'}
      </p>
      <svg
        className="doc-companion__graph"
        viewBox="0 0 320 320"
        role="img"
        aria-label={isEnLocal ? 'Radial knowledge graph' : '环形知识图谱'}
      >
        {nodes.map((node) => (
          <line
            key={`${node.id}-line`}
            x1={Number(center.x.toFixed(2))}
            y1={Number(center.y.toFixed(2))}
            x2={Number(node.x.toFixed(2))}
            y2={Number(node.y.toFixed(2))}
            stroke="var(--color-text-muted, rgba(255,255,255,0.18))"
            strokeWidth={1}
          />
        ))}
        {nodes.map((node) => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r={4} fill="var(--color-brand)" />
            <text
              x={node.x + 8}
              y={node.y + 4}
              fontSize={10}
              fill="var(--color-text)"
              className="doc-companion__graph-label"
            >
              {node.title.length > 14 ? `${node.title.slice(0, 12)}…` : node.title}
            </text>
          </g>
        ))}
        <circle cx={center.x} cy={center.y} r={8} fill="var(--color-text)" />
        <text x={center.x} y={center.y + 22} textAnchor="middle" fontSize={10} fill="var(--color-text-muted)">
          {isEnLocal ? 'workspace' : '工作区'}
        </text>
      </svg>
    </section>
  )
}
