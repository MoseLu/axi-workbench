import { KnowledgeCatalogSection } from '../../types'

interface CatalogSidebarSectionProps {
  section: KnowledgeCatalogSection
  isSectionOpen: (sectionId: string) => boolean
  toggleSection: (sectionId: string) => void
  onOpenItem: (sourceId: string, path: string) => void
  activeSourceId: string | null | undefined
  selectedFilePath: string | undefined
  emptySectionTitle: string
}

export function CatalogSidebarSection({
  section,
  isSectionOpen,
  toggleSection,
  onOpenItem,
  activeSourceId,
  selectedFilePath,
  emptySectionTitle,
}: CatalogSidebarSectionProps) {
  const sectionId = `catalog:${section.key}`
  const open = isSectionOpen(sectionId)
  const itemLimit = section.items.length
  const hiddenItemCount = Math.max(0, section.items.length - itemLimit)
  const hasSubsections = section.subsections && section.subsections.length > 0

  const renderCatalogItemButton = (item: KnowledgeCatalogSection['items'][number]) => (
    <button
      key={`${item.sourceId}:${item.path}`}
      className={`axi-docs-home__sidebar-link${item.sourceId === activeSourceId && item.path === selectedFilePath ? ' active' : ''}`}
      onClick={() => onOpenItem(item.sourceId, item.path)}
      title={item.description || item.path}
      type="button"
    >
      <span>{item.title || item.name}</span>
    </button>
  )

  const singleItem = !hasSubsections && section.items.length === 1
    ? section.items[0]
    : null

  if (singleItem) {
    // A group with exactly one entry renders as a plain link — a collapsible
    // header identical to its only child is pure duplication.
    return (
      <nav key={section.key} className="axi-docs-home__sidebar-section" aria-label={section.title}>
        {renderCatalogItemButton(singleItem)}
      </nav>
    )
  }

  return (
    <nav key={section.key} className="axi-docs-home__sidebar-section" aria-label={section.title}>
      <button aria-expanded={open} className="axi-docs-home__sidebar-toggle" onClick={() => toggleSection(sectionId)} type="button">
        <span>{section.title}</span>
        <span aria-hidden="true" className="axi-docs-home__sidebar-caret"></span>
      </button>
      {open && (
        <div className="axi-docs-home__sidebar-items">
          {hasSubsections
            ? section.subsections!.map((subsection) => {
              const subsectionId = `${sectionId}:${subsection.key}`
              const subsectionOpen = isSectionOpen(subsectionId)
              return (
                <div key={subsection.key} className="axi-docs-home__sidebar-subsection">
                  <button
                    aria-expanded={subsectionOpen}
                    className="axi-docs-home__sidebar-subtoggle"
                    onClick={() => toggleSection(subsectionId)}
                    title={subsection.description}
                    type="button"
                  >
                    <span>{subsection.title}</span>
                    <span aria-hidden="true" className="axi-docs-home__sidebar-caret"></span>
                  </button>
                  {subsectionOpen && (
                    <div className="axi-docs-home__sidebar-subitems">
                      {subsection.items.map(renderCatalogItemButton)}
                    </div>
                  )}
                </div>
              )
            })
            : section.items.slice(0, itemLimit).map(renderCatalogItemButton)}
          {hiddenItemCount > 0 && (
            <div className="axi-docs-home__nav-card" role="note">
              <span>本组还有更多条目</span>
              <small>{hiddenItemCount} 个条目可通过搜索定位</small>
            </div>
          )}
          {section.items.length === 0 && (
            <div className="axi-docs-home__nav-card" role="note">
              <span>{emptySectionTitle}</span>
              <small>{section.description}</small>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}