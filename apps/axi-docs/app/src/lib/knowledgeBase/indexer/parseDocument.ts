/**
 * Markdown document parsing: from a single file or from a virtual normalized
 * document. Produces `ParsedDocument` instances that the rest of the indexer
 * pipeline consumes unchanged.
 */

import fs from 'fs'
import path from 'path'
import { normalizeStringArray, runKnowledgeIntake } from '../../knowledgeIntake'
import {
  formatKnowledgeDocumentDescription,
  formatKnowledgeDocumentTitle,
} from '../../knowledgeFormatter'
import { classifyKnowledgeCategories } from '../../../config/knowledgeRules'
import type {
  DocSource,
  Frontmatter,
  NormalizedDocument,
} from '../../../types'
import type { ParsedDocument } from '../types'
import {
  extractDescription,
  extractInlineTags,
  extractRawTitle,
  extractTechStack,
  normalizeSlashes,
  parseMarkdownDocument,
  resolveLastUpdated,
} from '../utils'

export async function parseLocalDocumentFromFile(
  source: DocSource,
  relativePath: string,
  fullPath: string,
  stat: fs.Stats,
): Promise<ParsedDocument | null> {
  if (!fs.existsSync(fullPath)) return null

  const raw = await fs.promises.readFile(fullPath, 'utf-8')
  const parsed = parseMarkdownDocument(raw)
  const frontmatter = parsed.data as Frontmatter
  const body = parsed.content
  const fileName = path.basename(relativePath).replace(/\.(md|markdown)$/i, '')
  const sourceTags = [...new Set([...normalizeStringArray(frontmatter.tags), ...extractInlineTags(raw)])]
  const aliases = normalizeStringArray(frontmatter.aliases)
  const rawTitle = extractRawTitle(frontmatter, body, fileName)
  const intake = runKnowledgeIntake(
    { ...frontmatter, tags: sourceTags },
    { allowUnannotated: source.organizationHint === 'axi-rules' },
  )
  // For sources that bypass frontmatter (axi-rules and similar), fall back
  // to the file's raw title so we still get a usable graphTitle. This keeps
  // search, catalog, and graph paths functional for legacy docs.
  const graphTitle = intake.graphTitle || rawTitle
  if (!intake.accepted || !graphTitle) {
    return null
  }
  const techStack = extractTechStack(frontmatter, sourceTags)
  const title = formatKnowledgeDocumentTitle(rawTitle, relativePath, graphTitle, source.locale === 'en' ? 'en' : 'zh')
  const description = formatKnowledgeDocumentDescription({
    title,
    rawTitle,
    path: relativePath,
    description: extractDescription(frontmatter, body),
    docType: typeof frontmatter.type === 'string' ? frontmatter.type : undefined,
    sourceId: source.id,
  })
  const item: ParsedDocument = {
    sourceId: source.id,
    path: normalizeSlashes(relativePath),
    name: fileName,
    title,
    rawTitle,
    description,
    docType: typeof frontmatter.type === 'string' ? frontmatter.type : undefined,
    status: typeof frontmatter.status === 'string' ? frontmatter.status : undefined,
    tags: intake.graphTags,
    rawTags: sourceTags,
    categories: [],
    techStack,
    updated: resolveLastUpdated(fullPath, stat, frontmatter),
    graphTitle: title,
    raw,
    body,
    frontmatter,
    aliases: [...new Set([rawTitle, graphTitle, title, ...aliases].filter(Boolean))],
    sourceTags,
    intakeIssues: intake.issues.map((issue) => issue.message),
  }
  item.categories = classifyKnowledgeCategories({
    ...item,
    title: rawTitle,
    tags: sourceTags,
  })
  return item
}

export function createVirtualParsedDocument(input: NormalizedDocument & {
  name?: string
  rawTitle?: string
  status?: string
  graphTitle?: string
  aliases?: string[]
  sourceTags?: string[]
  techStack?: string[]
  projectId?: string
  projectTitle?: string
  documentTypeKey?: string
  sourceLocale?: 'en' | 'zh'
}): ParsedDocument {
  const fileName = input.name || path.basename(input.path).replace(/\.(md|markdown)$/i, '')
  const rawTitle = input.rawTitle || input.title
  const sourceTags = [...new Set(input.sourceTags || input.tags)]
  const title = formatKnowledgeDocumentTitle(input.title || rawTitle, input.path, input.graphTitle, input.sourceLocale === 'en' ? 'en' : 'zh')
  const description = formatKnowledgeDocumentDescription({
    title,
    rawTitle,
    name: fileName,
    path: input.path,
    description: input.description,
    docType: input.docType,
    sourceId: input.sourceId,
  })
  const graphTitle = title
  const frontmatter = {
    ...input.frontmatter,
    title,
    description,
    'graph-title': graphTitle,
  }
  return {
    sourceId: input.sourceId,
    path: normalizeSlashes(input.path),
    name: fileName,
    title,
    rawTitle,
    description,
    docType: input.docType,
    status: input.status,
    tags: input.tags,
    rawTags: sourceTags,
    categories: input.categories,
    techStack: input.techStack || extractTechStack(input.frontmatter, sourceTags),
    updated: input.updated,
    graphTitle,
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    documentTypeKey: input.documentTypeKey,
    raw: input.raw,
    body: input.body,
    frontmatter,
    aliases: [...new Set([rawTitle, input.title, graphTitle, ...(input.aliases || [])].filter(Boolean))],
    sourceTags,
    intakeIssues: [],
  }
}