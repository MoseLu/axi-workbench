import { KnowledgeCatalog, KnowledgeCatalogItem } from '../types'

export function flattenCatalogItems(catalog: KnowledgeCatalog | null): KnowledgeCatalogItem[] {
  if (!catalog) return []
  return catalog.sections.flatMap((section) => section.items)
}