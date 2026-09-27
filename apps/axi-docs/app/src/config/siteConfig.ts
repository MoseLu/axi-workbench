import type { DocSource } from '../types'

export type SiteLocale = 'zh' | 'en'
export type DocSetId = 'guide' | 'skills' | 'workspace'
export type GuideSectionId = 'introduction' | 'content' | 'knowledge' | 'architecture' | 'operations'
export type GuidePageId =
  | 'what-is-axi-docs'
  | 'getting-started'
  | 'routing'
  | 'document-sources'
  | 'plans'
  | 'markdown'
  | 'frontmatter'
  | 'search'
  | 'skills'
  | 'workspace'
  | 'knowledge-graph'
  | 'frontend-bff'
  | 'localization'
  | 'configuration'

export interface LocaleNavItem {
  docSet: DocSetId
  text: string
  link: string
}

export interface LocaleGuidePage {
  id: GuidePageId
  text: string
  link: string
}

export interface LocaleGuideSection {
  id: GuideSectionId
  text: string
  items: LocaleGuidePage[]
}

interface LocaleDocSet {
  id: DocSetId
  text: string
  link: string
  sourceId: string
}

interface LocaleUiCopy {
  skipToContent: string
  header: {
    homeAria: string
    globalSearch: string
    searchInputLabel: string
    searchPlaceholder: string
    clearSearch: string
    searchAllPrefix: string
    searchAllMeta: string
    documentGroup: string
    tagGroup: string
    navigationKeys: string
    selectKey: string
    closeKey: string
    poweredBy: string
    topNavLabel: string
    siteToolsLabel: string
    languageLabel: string
    switchToLight: string
    switchToDark: string
    switchToLightTitle: string
    switchToDarkTitle: string
    openMenu: string
    closeMenu: string
  }
  home: {
    sidebarLabel: string
    guideLabel: string
    guideSection: string
    outlineLabel: string
    pageNavigation: string
    pagerLabel: string
    previousPage: string
    nextPage: string
    currentSource: string
    docSources: string
    unlockedSource: string
    defaultSourceHint: string
  }
  notFound: {
    invalidDocSet: string
    invalidDocSetDescription: string
    invalidCategory: string
    invalidCategoryEyebrow: string
    invalidCategoryDescription: string
    invalidDocument: string
    invalidDocumentDescription: string
    fallback: string
    fallbackDescription: string
    backHome: string
  }
}

export interface SiteLocaleConfig {
  label: string
  lang: string
  dir: 'ltr' | 'rtl'
  title: string
  description: string
  link: string
  themeConfig: {
    nav: LocaleNavItem[]
    guidePages: LocaleGuidePage[]
    guideSections: LocaleGuideSection[]
    docSets: LocaleDocSet[]
    workspaceProjects: Record<string, string>
  }
  ui: LocaleUiCopy
}

export const DEFAULT_LOCALE: SiteLocale = 'zh'
export const DEFAULT_GUIDE_PAGE_ID: GuidePageId = 'getting-started'

const GUIDE_SECTION_DEFINITIONS: Array<{ id: GuideSectionId; pageIds: GuidePageId[] }> = [
  { id: 'introduction', pageIds: ['what-is-axi-docs', 'getting-started', 'routing'] },
  { id: 'content', pageIds: ['document-sources', 'plans', 'markdown', 'frontmatter', 'search'] },
  { id: 'knowledge', pageIds: ['skills', 'workspace', 'knowledge-graph'] },
  { id: 'architecture', pageIds: ['frontend-bff'] },
  { id: 'operations', pageIds: ['localization', 'configuration'] },
]
const GUIDE_PAGE_IDS: GuidePageId[] = GUIDE_SECTION_DEFINITIONS.flatMap((section) => section.pageIds)
const DOC_SET_IDS: DocSetId[] = ['guide', 'skills', 'workspace']

function guideLink(locale: SiteLocale, pageId: GuidePageId): string {
  return `/${locale}/guide/${pageId}`
}

function docSetLink(locale: SiteLocale, docSet: DocSetId): string {
  return docSet === 'guide' ? guideLink(locale, DEFAULT_GUIDE_PAGE_ID) : `/${locale}/${docSet}`
}

function buildLocaleConfig(locale: SiteLocale, options: {
  label: string
  lang: string
  title: string
  description: string
  nav: Record<DocSetId, string>
  guidePages: Record<GuidePageId, string>
  guideSections: Record<GuideSectionId, string>
  docSets: Record<DocSetId, string>
  workspaceProjects: Record<string, string>
  ui: LocaleUiCopy
}): SiteLocaleConfig {
  return {
    label: options.label,
    lang: options.lang,
    dir: 'ltr',
    title: options.title,
    description: options.description,
    link: guideLink(locale, DEFAULT_GUIDE_PAGE_ID),
    themeConfig: {
      nav: DOC_SET_IDS.map((docSet) => ({
        docSet,
        text: options.nav[docSet],
        link: docSetLink(locale, docSet),
      })),
      guidePages: GUIDE_PAGE_IDS.map((pageId) => ({
        id: pageId,
        text: options.guidePages[pageId],
        link: guideLink(locale, pageId),
      })),
      guideSections: GUIDE_SECTION_DEFINITIONS.map((section) => ({
        id: section.id,
        text: options.guideSections[section.id],
        items: section.pageIds.map((pageId) => ({
          id: pageId,
          text: options.guidePages[pageId],
          link: guideLink(locale, pageId),
        })),
      })),
      docSets: DOC_SET_IDS.map((docSet) => ({
        id: docSet,
        text: options.docSets[docSet],
        link: docSetLink(locale, docSet),
        sourceId: docSet === 'skills'
          ? (locale === 'zh' ? 'axi-skills-zh' : 'axi-skills')
          : docSet === 'guide'
            ? `axi-docs-${locale}`
            : 'workspace',
      })),
      workspaceProjects: options.workspaceProjects,
    },
    ui: options.ui,
  }
}

export const siteConfig = {
  locales: {
    zh: buildLocaleConfig('zh', {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'Axi Docs - 文档中心',
      description: 'Axi 工作区文档、技能库和知识图谱的统一入口。',
      nav: {
        guide: '指南',
        skills: '技能库',
        workspace: '工作区',
      },
      guidePages: {
        'what-is-axi-docs': '什么是 Axi Docs？',
        'getting-started': '快速开始',
        routing: '导航与路由',
        'document-sources': '文档来源',
        plans: '方案库',
        markdown: 'Markdown 写作',
        frontmatter: 'Frontmatter',
        search: '搜索与索引',
        skills: '技能库',
        workspace: '工作区',
        'knowledge-graph': '知识图谱',
        'frontend-bff': '前端 BFF 模式',
        localization: '国际化',
        configuration: '配置与数据源',
      },
      guideSections: {
        introduction: '简介',
        content: '内容与写作',
        knowledge: '知识系统',
        architecture: '架构参考',
        operations: '运维与扩展',
      },
      docSets: {
        guide: '指南',
        skills: '技能库',
        workspace: '工作区',
      },
      workspaceProjects: {
        'axi-agent': 'Axi 智能体平台',
        'axi-docs': 'Axi 文档站',
        'axi-image-preview': 'Axi 图片预览',
        'axi-local-registry': 'Axi 本地注册表',
        'axi-notify-mobile': 'Axi 移动通知',
        'axi-pet': 'Axi Pet 文档',
        'axi-proxy-companion': 'Axi 代理助手',
        'axi-skills': 'Axi 技能库',
        'axi-tauri-starter': 'Axi Tauri 启动模板',
        'axi-ui': 'Axi 界面组件',
        'axi-video-downloader': 'Axi 视频下载器',
        'axi-workbench': 'Axi Workbench 文档',
        'axi-workspace-governance': 'Axi 工作区治理',
        'blinko-reference': 'Blinko Reference 文档',
        'cliproxyapi-reference': 'CLIProxyAPI Reference 文档',
        'cockpit-tools-reference': 'Cockpit Tools Reference 文档',
        'comfyui-reference': 'Comfy界面Reference',
        'ielts-vocabulary': 'IELTS 词汇',
        'image2prompt-reference': 'Image2Prompt Reference 文档',
        'opencodex-reference': 'OpenCodex Reference 文档',
        'sports-management': '运动管理',
        'sub2api-reference': 'Sub2API Reference 文档',
        'governance': '工作区项目目录',
        'WORKSPACE_INDEX.md': 'Axi 工作区索引',
      },
      ui: {
        skipToContent: '跳到主内容',
        header: {
          homeAria: '返回首页',
          globalSearch: '全局搜索',
          searchInputLabel: '搜索文档或标签',
          searchPlaceholder: '搜索文档、路径、标签，或直接回车搜索',
          clearSearch: '清除搜索',
          searchAllPrefix: '搜索全部：',
          searchAllMeta: '在首页收起式展示匹配文档',
          documentGroup: '文档',
          tagGroup: '标签',
          navigationKeys: '导航',
          selectKey: '选择',
          closeKey: '关闭',
          poweredBy: '由 Axi Knowledge 提供',
          topNavLabel: '顶部导航',
          siteToolsLabel: '站点工具',
          languageLabel: '选择语言',
          switchToLight: '切换浅色样式',
          switchToDark: '切换深色样式',
          switchToLightTitle: '切换到浅色模式',
          switchToDarkTitle: '切换到深色模式',
          openMenu: '打开导航菜单',
          closeMenu: '关闭导航菜单',
        },
        home: {
          sidebarLabel: '侧边栏导航',
          guideLabel: '指南',
          guideSection: '简介',
          outlineLabel: '页面导航',
          pageNavigation: '页面导航',
          pagerLabel: '分页器',
          previousPage: '上一页',
          nextPage: '下一页',
          currentSource: '当前来源',
          docSources: '文档来源',
          unlockedSource: '未锁定来源',
          defaultSourceHint: '指南页默认不激活具体文档集。顶部导航选择文档集后，左侧显示该文档集目录。',
        },
        notFound: {
          invalidDocSet: '文档页面不存在',
          invalidDocSetDescription: '当前文档路径不存在。Axi Docs 只提供 /zh/guide/*、/zh/skills、/zh/workspace 这类语言化文档集路径。',
          invalidCategory: '当前分类路由不存在',
          invalidCategoryEyebrow: 'Category Route',
          invalidCategoryDescription: '请返回首页重新选择知识分类，或检查链接中的分类标识是否正确。',
          invalidDocument: '文档不存在或链接已失效',
          invalidDocumentDescription: '当前文档链接无法解析到有效内容。你可以返回首页重新打开文档，或通过顶部搜索重新定位知识点。',
          fallback: '页面不存在',
          fallbackDescription: '当前页面路径没有匹配到任何文档页面。请返回首页重新定位内容。',
          backHome: '返回首页',
        },
      },
    }),
    en: buildLocaleConfig('en', {
      label: 'English',
      lang: 'en-US',
      title: 'Axi Docs - Documentation Hub',
      description: 'A unified entry for Axi workspace docs, skills, and knowledge graphs.',
      nav: {
        guide: 'Guide',
        skills: 'Skills',
        workspace: 'Workspace',
      },
      guidePages: {
        'what-is-axi-docs': 'What is Axi Docs?',
        'getting-started': 'Getting Started',
        routing: 'Navigation and Routing',
        'document-sources': 'Document Sources',
        plans: 'Plans Library',
        markdown: 'Writing Markdown',
        frontmatter: 'Frontmatter',
        search: 'Search and Indexing',
        skills: 'Skills Library',
        workspace: 'Workspace',
        'knowledge-graph': 'Knowledge Graph',
        'frontend-bff': 'Frontend BFF Pattern',
        localization: 'Localization',
        configuration: 'Configuration and Sources',
      },
      guideSections: {
        introduction: 'Introduction',
        content: 'Content and Writing',
        knowledge: 'Knowledge System',
        architecture: 'Architecture Reference',
        operations: 'Operations and Extensions',
      },
      docSets: {
        guide: 'Guide',
        skills: 'Skills',
        workspace: 'Workspace',
      },
      workspaceProjects: {
        'axi-agent': 'Axi Agent Platform',
        'axi-docs': 'Axi Docs',
        'axi-image-preview': 'Axi Image Preview',
        'axi-local-registry': 'Axi Local Registry',
        'axi-notify-mobile': 'Axi Notify / Mobile',
        'axi-pet': 'Axi Pet',
        'axi-proxy-companion': 'Axi Proxy Companion',
        'axi-skills': 'Axi Skills',
        'axi-tauri-starter': 'Axi Tauri Starter',
        'axi-ui': 'Axi UI',
        'axi-video-downloader': 'Axi Video Downloader',
        'axi-workbench': 'Axi Workbench',
        'axi-workspace-governance': 'Axi Workspace Governance',
        'blinko-reference': 'Blinko Reference',
        'cliproxyapi-reference': 'CLIProxyAPI Reference',
        'cockpit-tools-reference': 'Cockpit Tools Reference',
        'comfyui-reference': 'ComfyUI Reference',
        'ielts-vocabulary': 'IELTS Vocabulary',
        'image2prompt-reference': 'Image2Prompt Reference',
        'opencodex-reference': 'OpenCodex Reference',
        'sports-management': 'Sports Management',
        'sub2api-reference': 'Sub2API Reference',
        'governance': 'Workspace Project Catalog',
        'WORKSPACE_INDEX.md': 'Workspace Index',
      },
      ui: {
        skipToContent: 'Skip to content',
        header: {
          homeAria: 'Return home',
          globalSearch: 'Global search',
          searchInputLabel: 'Search docs or tags',
          searchPlaceholder: 'Search docs, paths, tags, or press Enter',
          clearSearch: 'Clear search',
          searchAllPrefix: 'Search all: ',
          searchAllMeta: 'Show matching docs on the guide page',
          documentGroup: 'Documents',
          tagGroup: 'Tags',
          navigationKeys: 'Navigate',
          selectKey: 'Select',
          closeKey: 'Close',
          poweredBy: 'Powered by Axi Knowledge',
          topNavLabel: 'Top navigation',
          siteToolsLabel: 'Site tools',
          languageLabel: 'Change language',
          switchToLight: 'Switch to light theme',
          switchToDark: 'Switch to dark theme',
          switchToLightTitle: 'Switch to light mode',
          switchToDarkTitle: 'Switch to dark mode',
          openMenu: 'Open navigation menu',
          closeMenu: 'Close navigation menu',
        },
        home: {
          sidebarLabel: 'Sidebar navigation',
          guideLabel: 'Guide',
          guideSection: 'Introduction',
          outlineLabel: 'Page navigation',
          pageNavigation: 'Page navigation',
          pagerLabel: 'Pager',
          previousPage: 'Previous page',
          nextPage: 'Next page',
          currentSource: 'Current source',
          docSources: 'Document sources',
          unlockedSource: 'No source locked',
          defaultSourceHint: 'Guide pages do not lock a concrete source by default. Pick a document set in the top navigation to show that set in the sidebar.',
        },
        notFound: {
          invalidDocSet: 'Document page not found',
          invalidDocSetDescription: 'This document path does not exist. Axi Docs supports localized document-set paths such as /en/guide/*, /en/skills, and /en/workspace.',
          invalidCategory: 'Category route not found',
          invalidCategoryEyebrow: 'Category Route',
          invalidCategoryDescription: 'Return to the guide and choose a knowledge category again, or check the category id in the link.',
          invalidDocument: 'Document missing or stale link',
          invalidDocumentDescription: 'This document link could not be resolved. Return to the guide or use search to locate the target knowledge item.',
          fallback: 'Page not found',
          fallbackDescription: 'No document page matches this path. Return to the guide to locate the content again.',
          backHome: 'Return home',
        },
      },
    }),
  },
} as const

export function getSupportedLocales(): SiteLocale[] {
  return Object.keys(siteConfig.locales) as SiteLocale[]
}

export function isSiteLocale(value: unknown): value is SiteLocale {
  return typeof value === 'string' && value in siteConfig.locales
}

export function resolveSiteLocale(value?: string | null): SiteLocale {
  return isSiteLocale(value) ? value : DEFAULT_LOCALE
}

export function getSiteLocaleConfig(locale?: string | null): SiteLocaleConfig {
  return siteConfig.locales[resolveSiteLocale(locale)]
}

export function resolveSiteLocaleFromPath(pathname: string): SiteLocale {
  const [, maybeLocale] = pathname.split('/')
  return resolveSiteLocale(maybeLocale)
}

export function getLocaleOptions(): Array<{ code: SiteLocale; label: string; lang: string; link: string }> {
  return getSupportedLocales().map((code) => {
    const config = siteConfig.locales[code]
    return {
      code,
      label: config.label,
      lang: config.lang,
      link: config.link,
    }
  })
}

export function getGuidePageIds(): GuidePageId[] {
  return [...GUIDE_PAGE_IDS]
}

export function isGuidePageId(value: unknown): value is GuidePageId {
  return typeof value === 'string' && GUIDE_PAGE_IDS.includes(value as GuidePageId)
}

export function isDocSetId(value: unknown): value is DocSetId {
  return typeof value === 'string' && DOC_SET_IDS.includes(value as DocSetId)
}

export function buildGuideRoute(locale: SiteLocale, pageId: GuidePageId): string {
  return guideLink(locale, pageId)
}

export function getDefaultGuideRoute(locale: SiteLocale = DEFAULT_LOCALE): string {
  return guideLink(locale, DEFAULT_GUIDE_PAGE_ID)
}

export function buildDocSetRoute(locale: SiteLocale, docSet: DocSetId): string {
  return docSetLink(locale, docSet)
}

export function getGuidePageTitle(locale: SiteLocale, pageId: GuidePageId): string {
  return siteConfig.locales[locale].themeConfig.guidePages.find((page) => page.id === pageId)?.text
    || siteConfig.locales[locale].themeConfig.guidePages.find((page) => page.id === DEFAULT_GUIDE_PAGE_ID)?.text
    || pageId
}

export function getDocSetSourceId(
  docSet: DocSetId,
  locale: SiteLocale,
  sources: DocSource[] = [],
): string {
  const configured = siteConfig.locales[locale].themeConfig.docSets.find((item) => item.id === docSet)?.sourceId || 'workspace'
  if (docSet !== 'skills') return configured

  const match = sources.find((source) => (
    source.kind === 'skill-library'
    && source.enabled
    && (source.id === configured || source.locale === locale)
  ))
  return match?.id || configured
}
