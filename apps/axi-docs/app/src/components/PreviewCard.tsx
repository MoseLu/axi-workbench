import type { ReactNode } from 'react'
import { getKnowledgeCategoryLabel } from '../config/knowledgeRules'
import { formatDisplayDate } from '../lib/intl'
import { formatKnowledgeTagLabel } from '../lib/knowledgeFormatter'
import { ClockIcon, FileIcon, FolderIcon, TagIcon } from './Icons'

function cx(...tokens: Array<string | false | null | undefined>) {
  return tokens.filter(Boolean).join(' ')
}

export interface PreviewCardFact {
  label: string
  value: ReactNode
}

interface PreviewCardProps {
  title: string
  sourceName: string
  path: string
  description?: string
  docType?: string
  updated?: string
  categories?: string[]
  tags?: string[]
  facts?: PreviewCardFact[]
  actions?: ReactNode
  onTagSelect?: (tag: string) => void
  className?: string
}

export function PreviewCard({
  title,
  sourceName,
  path,
  description,
  docType,
  updated,
  categories = [],
  tags = [],
  facts = [],
  actions,
  onTagSelect,
  className,
}: PreviewCardProps) {
  const formattedDate = formatDisplayDate(updated)
  const visibleCategories = categories.filter(Boolean).slice(0, 4)
  const visibleTags = tags.filter(Boolean).slice(0, 8)

  return (
    <section className={cx('preview-card', className)}>
      <div className="preview-card__head">
        <div className="preview-card__eyebrow">{sourceName}</div>
        <div className="preview-card__title-row">
          <h2 className="preview-card__title">{title}</h2>
          {docType && <span className="preview-card__type">{docType}</span>}
        </div>
        <p className="preview-card__description">
          {description || '这里会聚合当前条目的摘要、上下文与快速动作，帮助你判断是否值得继续展开原文。'}
        </p>
      </div>

      <div className="preview-card__meta">
        <span className="preview-card__meta-item">
          <FileIcon />
          <span>{path}</span>
        </span>
        {formattedDate && (
          <span className="preview-card__meta-item">
            <ClockIcon />
            <span>{formattedDate}</span>
          </span>
        )}
      </div>

      {facts.length > 0 && (
        <div className="preview-card__facts">
          {facts.map((fact) => (
            <div key={fact.label} className="preview-card__fact">
              <span className="preview-card__fact-label">{fact.label}</span>
              <strong className="preview-card__fact-value">{fact.value}</strong>
            </div>
          ))}
        </div>
      )}

      {visibleCategories.length > 0 && (
        <div className="preview-card__group">
          <div className="preview-card__group-label">
            <FolderIcon />
            <span>分类上下文</span>
          </div>
          <div className="preview-card__pill-row">
            {visibleCategories.map((category) => (
              <span key={category} className="preview-card__pill preview-card__pill--category">
                {getKnowledgeCategoryLabel(category)}
              </span>
            ))}
          </div>
        </div>
      )}

      {visibleTags.length > 0 && (
        <div className="preview-card__group">
          <div className="preview-card__group-label">
            <TagIcon />
            <span>标签与入口</span>
          </div>
          <div className="preview-card__pill-row">
            {visibleTags.map((tag) => (
              onTagSelect ? (
                <button
                  key={tag}
                  className="preview-card__pill preview-card__pill--tag"
                  onClick={() => onTagSelect(tag)}
                  type="button"
                >
                  #{formatKnowledgeTagLabel(tag)}
                </button>
              ) : (
                <span key={tag} className="preview-card__pill preview-card__pill--tag">
                  #{formatKnowledgeTagLabel(tag)}
                </span>
              )
            ))}
          </div>
        </div>
      )}

      {actions && <div className="preview-card__actions">{actions}</div>}
    </section>
  )
}
