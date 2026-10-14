/**
 * Local-source index construction.
 *
 * Barrel module: re-exports the same public surface that the monolithic
 * `indexer.ts` used to expose so callers (and the `knowledgeBase.ts`
 * facade) keep working unchanged. Implementation is split into:
 *
 *   cache.ts         — module-level LocalSourceIndex cache + invalidation
 *   parseDocument.ts — parseLocalDocumentFromFile, createVirtualParsedDocument
 *   workspaceProject.ts — parseWorkspaceProjectRow, buildWorkspaceProject*
 *   workspaceCollect.ts — collectWorkspaceDocuments, addRootWorkspaceDoc
 *                         (handoff loaders + test wrappers live here)
 *   indexBuilder.ts  — collectLocalMarkdownFiles, buildLocalSourceIndex,
 *                      buildVirtualSourceIndex, getSpecializedSourceIndex,
 *                      getLocalSourceIndex, getKnowledgeTags
 *
 * No public API change: `knowledgeBase.ts` re-exports everything callers
 * used to import from the monolithic module.
 */

// cache
export {
  localSourceIndexCache,
  setLocalSourceIndexStaticMode,
  isLocalSourceIndexStaticMode,
  invalidateLocalSourceIndex,
  __clearKnowledgeBaseCacheForTests,
} from './cache'

// document parsing
export { parseLocalDocumentFromFile, createVirtualParsedDocument } from './parseDocument'

// workspace project suite + on-disk governance ingestion
export {
  buildWorkspaceProjectRootDocuments,
  buildWorkspaceProjectSuiteDefinitions,
  buildWorkspaceProjectDocuments,
} from './workspaceProject'

// workspace collector + root workspace docs
export {
  collectWorkspaceDocuments,
  addRootWorkspaceDoc,
  __loadHandoffProjectsForTests,
  __shouldUseSuiteDefinitionsForProjectForTests,
  __isExcludedWorkspaceKindForTests,
  __getHandoffPathForTests,
} from './workspaceCollect'

// index construction + tag aggregation
export {
  collectLocalMarkdownFiles,
  buildLocalSourceIndex,
  buildVirtualSourceIndex,
  getSpecializedSourceIndex,
  getLocalSourceIndex,
  getKnowledgeTags,
} from './indexBuilder'