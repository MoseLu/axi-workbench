import { useState, useEffect } from 'react'
import { scanKnowledgeSource as loadKnowledgeSourceDirectory } from '../lib/knowledgeClient'
import { formatDisplayDate } from '../lib/intl'
import { BlinkoNote } from '../types'
import { ClockIcon, TagIcon, GridIcon } from './Icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface BlinkoViewProps {
  onNoteSelect: (sourceId: string, path: string) => void
  refreshKey: number
}

interface BlinkoListItem {
  id: string
  name: string
  path: string
  relativePath: string
  type: 'file'
  extension: string
  lastModified: string
  sourceId: string
  blinkoData?: BlinkoNote
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = diff / 3_600_000
  if (hours < 1) return `${Math.floor(diff / 60000)}分钟前`
  if (hours < 24) return `${Math.floor(hours)}小时前`
  if (hours < 24 * 7) return `${Math.floor(hours / 24)}天前`
  return formatDisplayDate(d, { month: 'short', day: 'numeric' })
}

function BlinkoCard({ item, onClick }: { item: BlinkoListItem; onClick: () => void }) {
  const note = item.blinkoData
  const isFlash = note?.type === 0
  const tags = note?.tags || []
  const timeStr = note ? formatTime(note.updatedAt || note.createdAt) : ''
  const content = note?.content || item.name

  return (
    <article
      className={`blinko-card ${isFlash ? 'blinko-card--flash' : 'blinko-card--note'}`}
      onClick={onClick}
    >
      {isFlash && <div className="blinko-card__flash-badge">⚡ 闪念</div>}
      <div className="blinko-card__content">
        <div className="markdown-body markdown-body--compact">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content.length > 300 ? content.slice(0, 300) + '…' : content}
          </ReactMarkdown>
        </div>
      </div>
      {(tags.length > 0 || timeStr) && (
        <footer className="blinko-card__footer">
          {tags.length > 0 && (
            <div className="blinko-card__tags">
              {tags.map(tag => (
                <span key={tag} className="tag tag--small">#{tag}</span>
              ))}
            </div>
          )}
          {timeStr && (
            <span className="blinko-card__time">
              <ClockIcon />
              {timeStr}
            </span>
          )}
        </footer>
      )}
    </article>
  )
}

export function BlinkoView({ onNoteSelect, refreshKey }: BlinkoViewProps) {
  const [notes, setNotes] = useState<BlinkoListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'flash' | 'note'>('all')

  useEffect(() => {
    loadNotes()
  }, [refreshKey])

  const loadNotes = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await loadKnowledgeSourceDirectory('blinko') as BlinkoListItem[]
      setNotes(data)
    } catch {
      setError('无法连接到 Blinko 服务，请确保 Blinko 正在运行（端口 1111）')
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="blinko-view">
        <div className="loading"><div className="spinner" /></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="blinko-view">
        <div className="blinko-error">
          <BlinkoErrorState message={error} />
        </div>
      </div>
    )
  }

  const flashNotes = notes.filter(n => n.blinkoData?.type === 0)
  const longNotes = notes.filter(n => n.blinkoData?.type === 1)
  const filtered = filter === 'flash' ? flashNotes : filter === 'note' ? longNotes : notes

  return (
    <div className="blinko-view">
      <div className="blinko-toolbar">
        <div className="blinko-title">
          <span>⚡ Blinko 闪念</span>
          <span className="blinko-count">{notes.length} 条</span>
        </div>
        <div className="blinko-filter-tabs">
          <button
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >全部 {notes.length}</button>
          <button
            className={`filter-tab ${filter === 'flash' ? 'active' : ''}`}
            onClick={() => setFilter('flash')}
          >⚡ 闪念 {flashNotes.length}</button>
          <button
            className={`filter-tab ${filter === 'note' ? 'active' : ''}`}
            onClick={() => setFilter('note')}
          ><GridIcon /> 笔记 {longNotes.length}</button>
        </div>
      </div>
      <div className="blinko-grid">
        {filtered.map(item => (
          <BlinkoCard
            key={item.id}
            item={item}
            onClick={() => onNoteSelect('blinko', item.relativePath)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="blinko-empty">暂无笔记</div>
        )}
      </div>
    </div>
  )
}

function BlinkoErrorState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <TagIcon />
      <div>
        <p className="empty-state-text">{message}</p>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-3)' }}>
          Blinko 是 Axi Docs 的伴生项目，提供闪念笔记功能。
        </p>
        <code style={{ fontSize: 'var(--font-size-xs)', background: 'var(--color-bg-secondary)', padding: 'var(--spacing-1) var(--spacing-3)', borderRadius: 'var(--radius-xs)', display: 'inline-block', marginTop: 'var(--spacing-3)' }}>
          http://localhost:1111
        </code>
      </div>
    </div>
  )
}
