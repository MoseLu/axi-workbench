/**
 * Local-source index construction.
 *
 * Backward-compatible shim. The implementation has been split into the
 * `indexer/` sub-directory (cache / parseDocument / workspaceProject /
 * workspaceCollect / indexBuilder). All public symbols are re-exported from
 * `./indexer` so callers importing from this path keep working unchanged.
 */

export type {
  IndexedLocalFile,
  LocalFileEntry,
  LocalSourceIndex,
  ParsedDocument,
  WorkspaceProjectInfo,
  WorkspaceProjectSuiteDoc,
} from './types'

export * from './indexer/index'