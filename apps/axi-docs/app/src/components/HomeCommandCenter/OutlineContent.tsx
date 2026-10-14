import { TableOfContents } from '../TableOfContents'
import type { SiteLocale } from '../../config/siteConfig'

type GuideLocale = SiteLocale

interface OutlineContentProps {
  isGuideDocSet: boolean
  includeTopLink?: boolean
  onItemSelect?: () => void
  content: string
  pageNavigationLabel: string
  guideLocale: GuideLocale
  headingRootSelector?: string
  scrollContainerSelector?: string
}

export function OutlineContent({
  isGuideDocSet,
  includeTopLink,
  onItemSelect,
  content,
  pageNavigationLabel,
  guideLocale,
  headingRootSelector = '.axi-docs-home__guide-reader .doc-body',
  scrollContainerSelector = '.axi-docs-home__content',
}: OutlineContentProps) {
  if (isGuideDocSet) {
    return (
      <div className="axi-docs-home__outline-card axi-docs-home__outline-card--toc">
        {includeTopLink && (
          <a className="axi-docs-home__top-link" href="#overview" onClick={onItemSelect}>
            {guideLocale === 'zh' ? '回到顶部' : 'Return to top'}
          </a>
        )}
        <TableOfContents
          content={content}
          headingRootSelector={headingRootSelector}
          label={pageNavigationLabel}
          onItemSelect={onItemSelect}
          scrollContainerSelector={scrollContainerSelector}
        />
      </div>
    )
  }

  return (
    <div className="axi-docs-home__outline-card">
      <span className="axi-docs-home__nav-label">{pageNavigationLabel}</span>
      <a href="#doc-set-overview">{guideLocale === 'zh' ? '文档集概览' : 'Docs Overview'}</a>
    </div>
  )
}