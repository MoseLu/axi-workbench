/**
 * Shared TypeScript types and interfaces for the knowledgeBase module.
 * Extracted from the original monolithic knowledgeBase.ts so each concern
 * lives in its own focused file.
 */

import type { DocSource, Frontmatter, KnowledgeCatalogItem } from '../../types'

export type SourceMap = Map<string, DocSource>

export type ParsedDocument = KnowledgeCatalogItem & {
  raw: string
  body: string
  frontmatter: Frontmatter
  aliases: string[]
  sourceTags: string[]
  intakeIssues: string[]
}

export type WorkspaceDocumentTypeDefinition = {
  key: string
  fileNames: string[]
  title: string
  description: string
  itemTitleSuffix: string
  docType: string
  categories: string[]
  graphTags: string[]
  sourceTags: string[]
}

export type IndexedLocalFile = {
  relativePath: string
  fullPath: string
  mtimeMs: number
  document: ParsedDocument
}

export type LocalSourceIndex = {
  sourceId: string
  rootPath: string
  builtAt: string
  files: Map<string, IndexedLocalFile>
  documents: ParsedDocument[]
  rejected: Array<{ path: string; issues: string[] }>
  tags: Array<{ name: string; count: number }>
  byPath: Map<string, ParsedDocument>
  byStem: Map<string, ParsedDocument>
  /**
   * Precomputed reverse-wikilink index: target document path -> source
   * document paths whose body links to it (in document iteration order).
   * Built once per index so per-document graph builds do not rescan every
   * document body (the old O(N) full-body rescan per graph call made
   * generateBundle's per-document graph emission O(N^2 x body)).
   */
  backlinkPathsByPath: Map<string, string[]>
}

export type LocalFileEntry = {
  relativePath: string
  fullPath: string
  stat: import('fs').Stats
}

export type SkillFamilyDefinition = {
  key: string
  title: string
  description: string
  match: string[]
}

export type SkillSubsectionDefinition = {
  key: string
  title: string
  description: string
  match: string[]
}

export type WorkspaceProjectInfo = {
  id: string
  name: string
  projectPath: string
  purpose: string
  stack: string
  status: string
  docs: string
  verification: string
  notes: string
  description: string
  updated: string
}

export type HandoffProject = {
  id: string
  name: string
  path: string
  kind: string
  lifecycle: string
  owner: string
  readiness: string
  summary: string
  score?: number
  readOrder?: string[]
  entrypoints?: Array<{ id?: string; path?: string; purpose?: string }>
  commands: { verify?: string[]; smoke?: string[]; setup?: string[]; start?: string[]; health?: string[] }
  currentWork?: { active?: string | string[]; knownFailures?: string[]; todo?: string; milestone?: string }
  manifestPath?: string
  handoffPath?: string
  lastVerifiedAt?: string
  notes?: string
}

export type HandoffLoadResult = {
  source: 'handoff' | 'none'
  projects: WorkspaceProjectInfo[]
  generatedAt: string | null
  handoffPath: string | null
  error: Error | null
}

export type WorkspaceProjectSuiteDoc = {
  suffix?: string
  name: string
  title: string
  docType: string
  categories: string[]
  tags: string[]
  sourceTags: string[]
  description: string
  body: string
  graphTags: string[]
  aliases?: string[]
}

export type BlinkoNote = {
  id: number
  content: string
  type: 0 | 1
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export type HandoffReadiness = 'verified' | 'documented' | 'stale' | 'unready' | 'unknown'

export type ProjectHandoffCard = {
  state: 'ok' | 'stale' | 'missing'
  readiness: HandoffReadiness
  score: number
  readOrder: string[]
  entrypoints: Array<{ id: string; path: string; purpose: string }>
  smokeCommand: string | null
  verifyCommand: string | null
  currentWork: { active: string[]; knownFailures: string[] }
  lastVerifiedAt: string | null
  ageDays: number | null
  handoffPath: string | null
  manifestPath: string | null
  handoffSource: 'handoff' | 'none'
  handoffGeneratedAt: string | null
}

export type ProjectSummary = KnowledgeCatalogItem & { handoff: ProjectHandoffCard }

// Re-export the upstream types so callers importing from './types' can keep
// the existing import surface stable across the module split.
export type { DocSource }