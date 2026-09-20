import { useId, useRef } from 'react'
import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react'

function cx(...tokens: Array<string | false | null | undefined>) {
  return tokens.filter(Boolean).join(' ')
}

interface PrimitiveProps {
  children: ReactNode
  className?: string
}

interface PageShellProps extends PrimitiveProps, Omit<HTMLAttributes<HTMLElement>, 'children'> {
  compact?: boolean
}

export function PageShell({ children, className, compact = false, ...rest }: PageShellProps) {
  return (
    <section className={cx('cockpit-shell', compact && 'cockpit-shell--compact', className)} {...rest}>
      {children}
    </section>
  )
}

interface RailPanelProps extends PrimitiveProps, Omit<HTMLAttributes<HTMLElement>, 'children'> {
  tone?: 'primary' | 'secondary' | 'ghost'
}

export function RailPanel({ children, className, tone = 'secondary', ...rest }: RailPanelProps) {
  return (
    <section className={cx('rail-panel', `rail-panel--${tone}`, className)} {...rest}>
      {children}
    </section>
  )
}

interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  compact?: boolean
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  compact = false,
  className,
  ...rest
}: SectionHeaderProps) {
  return (
    <div className={cx('section-header', compact && 'section-header--compact', className)} {...rest}>
      <div className="section-header__main">
        {eyebrow && <div className="section-header__eyebrow">{eyebrow}</div>}
        <div className="section-header__title">{title}</div>
        {description && <p className="section-header__description">{description}</p>}
      </div>
      {(meta || actions) && (
        <div className="section-header__aside">
          {meta && <div className="section-header__meta">{meta}</div>}
          {actions && <div className="section-header__actions">{actions}</div>}
        </div>
      )}
    </div>
  )
}

interface MetricPillProps {
  label: string
  value: ReactNode
  accent?: 'blue' | 'teal' | 'amber'
  subtle?: ReactNode
}

export function MetricPill({ label, value, accent = 'blue', subtle }: MetricPillProps) {
  return (
    <div className={cx('metric-pill', `metric-pill--${accent}`)}>
      <span className="metric-pill__label">{label}</span>
      <strong className="metric-pill__value">{value}</strong>
      {subtle && <span className="metric-pill__subtle">{subtle}</span>}
    </div>
  )
}

interface SegmentedTabsProps<T extends string> {
  items: Array<{ value: T; label: string; badge?: ReactNode; panelId?: string }>
  value: T
  onChange: (value: T) => void
  className?: string
  ariaLabel?: string
  idBase?: string
  panelId?: string
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className,
  ariaLabel,
  idBase,
  panelId,
}: SegmentedTabsProps<T>) {
  const generatedId = useId().replace(/:/g, '')
  const resolvedIdBase = idBase || `segmented-tabs-${generatedId}`
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const focusTab = (index: number) => {
    tabRefs.current[index]?.focus()
  }

  const moveFocus = (nextIndex: number) => {
    const safeIndex = (nextIndex + items.length) % items.length
    onChange(items[safeIndex].value)
    focusTab(safeIndex)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(index + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(index - 1)
        break
      case 'Home':
        event.preventDefault()
        moveFocus(0)
        break
      case 'End':
        event.preventDefault()
        moveFocus(items.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div className={cx('segmented-tabs', className)} role="tablist" aria-label={ariaLabel}>
      {items.map((item, index) => {
        const isActive = item.value === value
        const resolvedPanelId = item.panelId || panelId
        return (
        <button
          key={item.value}
          ref={(node) => {
            tabRefs.current[index] = node
          }}
          id={`${resolvedIdBase}-tab-${item.value}`}
          aria-controls={resolvedPanelId}
          aria-selected={isActive}
          className={cx('segmented-tabs__item', isActive && 'active')}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          role="tab"
          tabIndex={isActive ? 0 : -1}
          type="button"
        >
          <span>{item.label}</span>
          {item.badge !== undefined && <small>{item.badge}</small>}
        </button>
        )
      })}
    </div>
  )
}

interface CompactEmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  actions?: ReactNode
  className?: string
}

export function CompactEmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: CompactEmptyStateProps) {
  return (
    <div className={cx('compact-empty-state', className)}>
      {icon && <div className="compact-empty-state__icon">{icon}</div>}
      <div className="compact-empty-state__copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {actions && <div className="compact-empty-state__actions">{actions}</div>}
    </div>
  )
}
