/**
 * Commit Ledger Git Collector (TypeScript facade)
 *
 * The implementation lives in `collect-all.mjs`; this module is the typed
 * entry point for TypeScript callers and for the standalone CLI.
 *
 * The two files used to hold independent copies of the collector, and the
 * copies disagreed: the hardcoded project list in `collector.ts` had 22
 * entries while the one in `collect-all.mjs` had 21 (`axi-agent` was only
 * in the second), and both mapped projects onto partition directories
 * (`projects/`, `shared/`, `infra/`) that the 2026-10-17 workspace
 * partition split removed. The roster is now read from the governance
 * registry (`workspace.graph.json`) by `repos-loader.mjs`, so there is a
 * single implementation and a single source of truth for the paths.
 *
 * The dependency direction is the reverse of the one this file used to
 * suggest, and deliberately so: `collect-all.mjs` is the module the
 * control-plane runtime loads (`api-routes.mjs` imports it), and the
 * deployed image runs Node 22.13, which cannot import a `.ts` file from an
 * `.mjs` module without `--experimental-strip-types`. `collector.ts` also
 * could not be imported as ESM at all before this change, because it
 * imported the `ExecSyncOptions` type as a runtime value.
 *
 * Usage: npx tsx collector.ts [--since <ISO-date>] [--until <ISO-date>]
 *                             [--limit <num>] [--repo <projectId>]
 *                             [--output <file.jsonl>]
 *
 * Output: JSONL with CommitLedgerV1 schema
 */

import { pathToFileURL } from 'url';

// ============================================================================
// Types
// ============================================================================

export interface RepoConfig {
  projectId: string;
  partition: string;
  /** Absolute path, taken from the governance registry. */
  path?: string;
}

export interface CommitRecord {
  schemaVersion: string;
  recordId: string;
  repo: {
    projectId: string;
    canonicalPath: string;
    gitRoot: string;
    remote: string | null;
    defaultBranch: string;
  };
  commit: {
    sha: string;
    shortSha: string;
    parentShas: string[];
    subject: string;
    body: string;
    type: string;
    scope: string | null;
    breaking: boolean;
    authoredAt: string;
    committedAt: string;
  };
  actor: {
    name: string;
    email: string | null;
  };
  refs: {
    branches: string[];
    tags: string[];
  };
  diff: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
  trailers: {
    tested: string[];
    notTested: string[];
    confidence: number | null;
    scopeRisk: string | null;
    directive: string | null;
    refs: string[];
  };
  workspaceState: {
    observedBranch: string;
    isDirty: boolean;
    ahead: number;
    behind: number;
    observedAt: string;
  };
  verification: {
    status: string;
    commands: string[];
    evidenceRefs: string[];
    observedAt: string;
  };
  provenance: {
    source: string;
    sourcePath: string;
    sourceCommand: string;
    sourceHash: string;
    observedAt: string;
  };
  ingestion: {
    idempotencyKey: string;
    firstSeenAt: string;
    lastSeenAt: string;
    status: string;
  };
}

export interface CollectError {
  error: string;
  projectId?: string;
  path?: string;
  message?: string;
  sha?: string;
}

export interface CollectResult {
  projectId: string;
  partition: string;
  path: string;
  branch: string;
  isDirty: boolean;
  commits: CommitRecord[];
  count: number;
  errors?: CollectError[];
}

export interface CollectOptions {
  since?: string;
  until?: string;
  limit?: number;
  repo?: string;
  output?: string;
}

export interface CollectAllOutput {
  results: CollectResult[];
  errors: CollectError[];
  summary: {
    totalRepos: number;
    successfulRepos: number;
    failedRepos: number;
    totalCommits: number;
  };
  collectedAt: string;
}

// ============================================================================
// Implementation (shared with collect-all.mjs)
// ============================================================================

// eslint-disable-next-line import/no-unresolved -- plain ESM sibling module
import * as collector from './collect-all.mjs';

/**
 * 生成 recordId (sha256:repoId:commitSha)
 */
export const generateRecordId = collector.generateRecordId as (
  projectId: string,
  sha: string,
) => string;

/**
 * 解析 Conventional Commit
 */
export const parseConventionalCommit = collector.parseConventionalCommit as (
  subject: string,
) => {
  type: string;
  scope: string | null;
  breaking: boolean;
  subject: string;
};

/**
 * 解析 body 中的 trailers
 */
export const parseTrailers = collector.parseTrailers as (
  body: string,
) => CommitRecord['trailers'];

/**
 * 采集单个仓库的提交
 */
export const collectRepoCommits = collector.collectRepoCommits as (
  repoConfig: RepoConfig,
  options?: CollectOptions,
) => CollectResult | CollectError;

/**
 * 采集所有仓库
 */
export const collectAll = collector.collectAll as (
  options?: CollectOptions,
) => CollectAllOutput;

/**
 * 输出 JSONL 格式
 */
export const outputJsonl = collector.outputJsonl as (
  records: CommitRecord[],
  outputPath?: string,
) => void;

/**
 * 治理注册表中的仓库清单
 */
export const loadRepos = collector.loadRepos as () => RepoConfig[];

// ============================================================================
// CLI Entry Point
// ============================================================================

function parseArgs(): CollectOptions {
  const args = process.argv.slice(2);
  const options: CollectOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--since':
        options.since = args[++i];
        break;
      case '--until':
        options.until = args[++i];
        break;
      case '--limit':
        options.limit = parseInt(args[++i], 10);
        break;
      case '--repo':
        options.repo = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      default:
        break;
    }
  }

  return options;
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const options = parseArgs();
  const output = collectAll(options);

  if (output.errors.length > 0) {
    console.error('[Errors]');
    for (const err of output.errors) {
      console.error(`  ${err.projectId}: ${err.error}`);
    }
  }

  const allRecords = output.results.flatMap((r) => r.commits);

  if (options.output) {
    outputJsonl(allRecords, options.output);
    console.error(`[OK] ${allRecords.length} commits written to ${options.output}`);
  } else {
    outputJsonl(allRecords);
  }

  console.error('\n[Summary]');
  console.error(`  Total repos: ${output.summary.totalRepos}`);
  console.error(`  Successful: ${output.summary.successfulRepos}`);
  console.error(`  Failed: ${output.summary.failedRepos}`);
  console.error(`  Total commits: ${output.summary.totalCommits}`);

  if (output.errors.some((err) => err.error === 'unknown-repo')) {
    process.exit(1);
  }
}

// ESM 导出
export default {
  collectAll,
  collectRepoCommits,
  generateRecordId,
  parseConventionalCommit,
  parseTrailers,
  outputJsonl,
  loadRepos,
};
