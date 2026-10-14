import type { DocSetId, SiteLocale } from '../../config/siteConfig'
import { getDefaultGuideRoute } from '../../config/siteConfig'

const DOC_SOURCE_LOCALE_SIBLING: Record<string, { zh: string; en: string }> = {
  'axi-docs-zh': { zh: 'axi-docs-zh', en: 'axi-docs-en' },
  'axi-docs-en': { zh: 'axi-docs-zh', en: 'axi-docs-en' },
}

export function getCurrentDocSet(pathname: string): DocSetId {
  if (/^\/(zh|en)\/skills(?:\/|$)/u.test(pathname)) return 'skills'
  if (/^\/(zh|en)\/workspace(?:\/|$)/u.test(pathname)) return 'workspace'
  return 'guide'
}

function mapDocumentRouteAcrossLocales(pathname: string, locale: SiteLocale): string | null {
  const segments = pathname.split('/').filter(Boolean)
  const sourceId = segments[1]
  const rest = segments.slice(2).join('/')
  if (!sourceId || !rest) return null

  const sibling = DOC_SOURCE_LOCALE_SIBLING[sourceId]
  if (sibling) {
    return `/docs/${sibling[locale]}/${rest}`
  }

  // axi-skills mirrors swap the root folder prefix (skills/ vs skills.zh/).
  if (sourceId === 'axi-skills' && locale === 'zh') {
    return `/docs/axi-skills-zh/${rest.replace(/^skills\//u, 'skills.zh/')}`
  }
  if (sourceId === 'axi-skills-zh' && locale === 'en') {
    return `/docs/axi-skills/${rest.replace(/^skills\.zh\//u, 'skills/')}`
  }

  // Locale-neutral sources keep the same document open; only the UI copy changes.
  return `/docs/${sourceId}/${rest}`
}

export function buildLocaleHref(pathname: string, search: string, locale: SiteLocale): string {
  if (/^\/(zh|en)\//u.test(pathname)) {
    return `${pathname.replace(/^\/(zh|en)\//u, `/${locale}/`)}${search}`
  }

  if (/^\/docs\/[^/]+\/./u.test(pathname)) {
    const mapped = mapDocumentRouteAcrossLocales(pathname, locale)
    if (mapped) return `${mapped}${search}`
  }

  return getDefaultGuideRoute(locale)
}

void DOC_SOURCE_LOCALE_SIBLING