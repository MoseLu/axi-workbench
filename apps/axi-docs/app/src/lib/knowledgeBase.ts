/**
 * Public entry point for the knowledgeBase module.
 *
 * This file is a thin re-export facade. All implementations live in the
 * `knowledgeBase/` sub-directory, split by responsibility:
 *
 *   types.ts     — TS interfaces and types
 *   utils.ts     — pure helpers + git metadata cache + workspace constants
 *   sources.ts   — DocSource registry, Blinko API client, writeKnowledgeFile
 *   skills.ts    — skill family taxonomy + skill catalog/index builders
 *   indexer.ts   — local source index construction + virtual doc builders
 *   search.ts    — searchKnowledge, scanKnowledgeSource, readKnowledgeFile, graphs
 *   catalog.ts   — knowledge catalog, document list, directory index, frontmatter
 *   handoff.ts   — project handoff card / summary / snapshot status
 *
 * The split preserves the original `import { ... } from '@/lib/knowledgeBase'`
 * surface so existing callers (vite.config.plugin.ts, MCP servers, components,
 * and the four `knowledgeBase.*.test.ts` files) keep working unchanged.
 */

export type {
  SourceMap,
  ParsedDocument,
  WorkspaceDocumentTypeDefinition,
  IndexedLocalFile,
  LocalSourceIndex,
  LocalFileEntry,
  SkillFamilyDefinition,
  SkillSubsectionDefinition,
  WorkspaceProjectInfo,
  HandoffProject,
  HandoffLoadResult,
  WorkspaceProjectSuiteDoc,
  BlinkoNote,
  HandoffReadiness,
  ProjectHandoffCard,
  ProjectSummary,
  DocSource,
} from './knowledgeBase/types'

// ---------------------------------------------------------------------------
// sources.ts
// ---------------------------------------------------------------------------
export {
  parseExtraSources,
  createSourceMap,
  getDocumentSourceRegistrySummary,
  listKnowledgeSources,
  getSource,
  resolveLocalPath,
  blinkoRequest,
  listBlinkoNotes,
  writeKnowledgeFile,
} from './knowledgeBase/sources'

// ---------------------------------------------------------------------------
// utils.ts — pure helpers + constants
// ---------------------------------------------------------------------------
export {
  SUPPORTED_EXTENSIONS,
  EXCLUDED_NAMES,
  DEFAULT_BLINKO_URL,
  INLINE_TAG_REGEX,
  WIKILINK_REGEX,
  SKILL_SUBSECTION_THRESHOLD,
  HANDOFF_STALE_DAYS,
  gitRootCache,
  gitUpdatedCache,
  gitPrefilledRoots,
  getGitRoot,
  prefillGitUpdatedCacheForRoot,
  getGitLastUpdated,
  resolveLastUpdated,
  isSupportedFile,
  isExcludedName,
  normalizeSlashes,
  normalizeMarkdownInput,
  normalizeDate,
  parseLooseFrontmatter,
  parseMarkdownDocument,
  extractInlineTags,
  extractRawTitle,
  extractDescription,
  truncateText,
  extractTechStack,
  splitMarkdownTableRow,
  stripMarkdownLinks,
  WORKSPACE_PURPOSE_OVERRIDES,
  WORKSPACE_TITLE_OVERRIDES,
  resolveWorkspacePurpose,
  resolveWorkspaceTitle,
  joinChineseFacts,
  WORKSPACE_DOCUMENT_TYPE_DEFINITIONS,
  WORKSPACE_DOCUMENT_TYPE_ORDER,
  formatWorkspaceValue,
  formatWorkspaceCommand,
  normalizeSkillToken,
  tokenizeSkillKey,
  getSkillKey,
  getSkillFamilyDefinitions,
  getSkillSubsectionDefinitions,
  getHandoffSnapshotPath,
  normalizeReadiness,
  computeAgeDays,
  mapHandoffProjectToWorkspaceInfo,
} from './knowledgeBase/utils'

// ---------------------------------------------------------------------------
// skills.ts — taxonomy + catalog builders
// ---------------------------------------------------------------------------
export {
  DB_SKILL_FAMILIES,
  AXI_SKILL_FAMILIES,
  AXI_SKILL_SUBSECTIONS,
  getSkillFamily,
  buildSkillCatalogSubsections,
  buildSkillIndexMarkdown,
  buildSkillDocument,
  buildSkillAssetDocument,
  collectSkillDocuments,
  collectSelectedSkillAssets,
  collectSkillSupportDocuments,
  buildFallbackSkillFamily,
  buildSkillCatalogSections,
} from './knowledgeBase/skills'

// ---------------------------------------------------------------------------
// indexer.ts — local source index + virtual docs
// ---------------------------------------------------------------------------
export {
  localSourceIndexCache,
  setLocalSourceIndexStaticMode,
  isLocalSourceIndexStaticMode,
  invalidateLocalSourceIndex,
  __clearKnowledgeBaseCacheForTests,
  parseLocalDocumentFromFile,
  createVirtualParsedDocument,
  collectWorkspaceDocuments,
  addRootWorkspaceDoc,
  buildWorkspaceProjectRootDocuments,
  buildWorkspaceProjectSuiteDefinitions,
  buildWorkspaceProjectDocuments,
  collectLocalMarkdownFiles,
  buildLocalSourceIndex,
  buildVirtualSourceIndex,
  getSpecializedSourceIndex,
  getLocalSourceIndex,
  getKnowledgeTags,
  __loadHandoffProjectsForTests,
  __shouldUseSuiteDefinitionsForProjectForTests,
  __isExcludedWorkspaceKindForTests,
  __getHandoffPathForTests,
} from './knowledgeBase/indexer'

// ---------------------------------------------------------------------------
// search.ts
// ---------------------------------------------------------------------------
export {
  searchKnowledge,
  searchKnowledgeAll,
  scanKnowledgeSource,
  readKnowledgeFile,
  getKnowledgeGraph,
  getGlobalKnowledgeGraph,
} from './knowledgeBase/search'

// ---------------------------------------------------------------------------
// catalog.ts
// ---------------------------------------------------------------------------
export {
  sortCatalogItems,
  toKnowledgeCatalogItem,
  buildFrontmatter,
  sanitizeStaticFrontmatter,
  buildFileItemFrontmatter,
  buildWorkspaceCatalogSubsections,
  buildWorkspaceCatalogSections,
  getKnowledgeCatalog,
  getKnowledgeDocuments,
  getKnowledgeDirectoryIndex,
} from './knowledgeBase/catalog'

// ---------------------------------------------------------------------------
// handoff.ts
// ---------------------------------------------------------------------------
export {
  getProjectHandoffCard,
  getHandoffSnapshotStatus,
  getProjectSummary,
  getWorkspaceStatus,
} from './knowledgeBase/handoff'