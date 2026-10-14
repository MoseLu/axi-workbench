import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { DocumentIcon, ClockIcon } from './Icons'
import { KnowledgePanel } from './KnowledgePanel'
import { formatDisplayDate } from '../lib/intl'
import { prepareDocumentDisplayMarkdown, stripDisplayEmoji } from '../lib/documentDisplay'
import { formatKnowledgeDocumentTitle } from '../lib/knowledgeFormatter'
import { type PageCopyLocale } from '../config/pageCopy'
import { isSiteLocale } from '../config/siteConfig'
import { DocSource, SelectedFile } from '../types'
import { CopyButton as _CopyButtonUnused } from './DocumentView/CopyButton'
import { GuideKnowledgeGraphCompanion } from './DocumentView/GuideKnowledgeGraphCompanion'
import { GuideSearchCompanion } from './DocumentView/GuideSearchCompanion'
import {
  isGuidePath,
  parseFrontmatter,
  preprocessContent,
} from './DocumentView/markdownContent'
import { useMarkdownComponents } from './DocumentView/markdownComponents'
import { SkillBadge } from './DocumentView/SkillBadge'

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

  const components = useMarkdownComponents(wikiLinkSourceId, effectiveLocale)

  if (!selectedFile) {
    return (
      <div className="app-content">
        <div className="empty-state">
          <DocumentIcon />
          <div>
            <p className="empty-state-text">从左侧选择一个文档开始阅读</p>
            <p style={{ fontSize: 'var(--axi-docs-font-size-sm)', color: 'var(--axi-docs-color-text-muted)', marginTop: 'var(--axi-docs-spacing-3)' }}>
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
  // App.loadFile 失败时会把 fileName 置为 'Error' 且正文以错误标题开头 —— 用红边框
  // 区分「文件真实内容」与「加载失败占位」，避免用户把占位文字当成文档本身。
  const isLoadError = fileName === 'Error'
    && Boolean(content?.startsWith('# 文件加载失败') || content?.startsWith('# 加载错误'))

  return (
    <div className={`doc-layout${variant === 'panel' ? ' doc-layout--panel' : ''}${isGuideDocument ? ' doc-layout--guide' : ''}${isLoadError ? ' axi-docs-file-error' : ''}`}>
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
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 980, fontSize: 'var(--axi-docs-font-size-xs)', color: 'var(--axi-docs-color-text-muted)' }}>
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

void _CopyButtonUnused