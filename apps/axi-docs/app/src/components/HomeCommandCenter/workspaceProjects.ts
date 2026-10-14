import { getSiteLocaleConfig, type SiteLocale } from '../../config/siteConfig'
import { KnowledgeCatalogItem, KnowledgeCatalogSection } from '../../types'

type GuideLocale = SiteLocale

export interface WorkspaceProjectIndexEntry {
  key: string
  title: string
  description: string
  order: number
}

export function workspaceProjectGroupKey(item: KnowledgeCatalogItem): string {
  if (item.projectId) return item.projectId
  const pathParts = item.path.split('/').filter(Boolean)
  if (pathParts[0] === 'project-docs' && pathParts[1]) return pathParts[1]
  return pathParts[0] || item.name
}

export function normalizeWorkspaceProjectTitle(title: string): string {
  return title
    .replace(/\s*(?:README|PRD|TDD|TODO|INDEX|CHANGELOG|SECURITY|MILESTONE)\s*(?:文档)?$/i, '')
    .replace(/\s*(?:需求文档|技术设计|Agent 指南|智能体指南|任务清单|里程碑|变更记录|文档索引|安全策略)$/i, '')
    .trim() || title
}

export function workspaceProjectDisplayTitle(key: string, items: KnowledgeCatalogItem[], guideLocale: GuideLocale): string {
  const translated = getSiteLocaleConfig(guideLocale).themeConfig.workspaceProjects[key]
  if (translated) return translated
  const overview = items.find((item) => item.documentTypeKey === 'overview' || item.path.endsWith('/README.md'))
  if (guideLocale === 'zh') {
    return normalizeWorkspaceProjectTitle(overview?.title || items[0]?.title || items[0]?.projectTitle || key)
  }
  return items[0]?.projectTitle || overview?.rawTitle || overview?.title || key
}

export function buildWorkspaceProjectIndex(sections: KnowledgeCatalogSection[], guideLocale: GuideLocale): WorkspaceProjectIndexEntry[] {
  const grouped = new Map<string, { description: string, items: KnowledgeCatalogItem[], order: number }>()
  let order = 0

  for (const section of sections) {
    for (const item of section.items) {
      const key = workspaceProjectGroupKey(item)
      const description = item.description || section.description
      if (!grouped.has(key)) {
        grouped.set(key, { description, items: [], order })
      }
      grouped.get(key)!.items.push(item)
      order += 1
    }
  }

  return [...grouped.entries()]
    .sort((left, right) => left[1].order - right[1].order)
    .map(([key, group]) => ({
      key,
      title: workspaceProjectDisplayTitle(key, group.items, guideLocale),
      description: group.description,
      order: group.order,
    }))
}

export function buildWorkspaceProjectSections(projectIndex: WorkspaceProjectIndexEntry[], section: KnowledgeCatalogSection | undefined): KnowledgeCatalogSection[] {
  const activeItemsByProject = new Map<string, KnowledgeCatalogItem[]>()
  if (section) {
    for (const item of section.items) {
      const key = workspaceProjectGroupKey(item)
      if (!activeItemsByProject.has(key)) {
        activeItemsByProject.set(key, [])
      }
      activeItemsByProject.get(key)!.push(item)
    }
  }

  return projectIndex.map((project) => {
    const items = activeItemsByProject.get(project.key) || []
    const description = items[0]?.description || project.description
    return {
      key: `workspace-project-${project.key}`,
      title: project.title,
      description,
      count: items.length,
      items,
    }
  })
}